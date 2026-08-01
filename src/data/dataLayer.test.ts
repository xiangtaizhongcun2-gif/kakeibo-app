import { afterEach, describe, expect, it } from 'vitest';
import { MyKakeiboDatabase } from './database';
import { initializeDatabase } from './initializeDatabase';
import { SYSTEM_UNSET_PAYMENT_METHOD_ID } from './initialData';
import { MasterDataRepository } from './repositories/masterDataRepository';
import { TransactionRepository } from './repositories/transactionRepository';

const databases: MyKakeiboDatabase[] = [];

function createTestDatabase(): MyKakeiboDatabase {
  const database = new MyKakeiboDatabase(`my-kakeibo-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
}

function expectNames(actual: string[], expected: string[]): void {
  expect(actual).toHaveLength(expected.length);
  expect(actual).toEqual(expect.arrayContaining(expected));
}

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (database) => {
      database.close();
      await database.delete();
    }),
  );
});

describe('Phase 2 data layer', () => {
  it('初期データを一度だけ登録する', async () => {
    const database = createTestDatabase();

    const firstMetadata = await initializeDatabase(database);
    const secondMetadata = await initializeDatabase(database);

    expect(firstMetadata.dataVersion).toBe(1);
    expect(secondMetadata.initializedAt).toBe(firstMetadata.initializedAt);
    expectNames(
      (await database.expenseCategories.toArray()).map(({ name }) => name),
      ['食費', '日用品', '交通費', '固定費', '娯楽費'],
    );
    expectNames(
      (await database.incomeCategories.toArray()).map(({ name }) => name),
      ['給与', '仕送り', '臨時収入', 'その他'],
    );
    expectNames(
      (await database.paymentMethods.toArray()).map(({ name }) => name),
      ['未設定', '現金', 'クレジットカード', '電子マネー', '銀行振込'],
    );

    const unset = await database.paymentMethods.get(SYSTEM_UNSET_PAYMENT_METHOD_ID);
    expect(unset).toMatchObject({ isSystem: true, isActive: true, kind: 'system-unset' });
  });

  it('収支の作成・更新・削除と使用回数を同じトランザクションで更新する', async () => {
    const database = createTestDatabase();
    await initializeDatabase(database);
    const repository = new TransactionRepository(database);

    const created = await repository.create({
      type: 'expense',
      amountYen: 1280,
      date: '2026-08-01',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
      memo: '',
    });

    expect(await database.expenseCategories.get('expense-category-1')).toMatchObject({
      usageCount: 1,
    });
    expect(await database.paymentMethods.get('payment-method-cash')).toMatchObject({
      usageCount: 1,
    });

    await repository.replace(created.id, {
      type: 'expense',
      amountYen: 1500,
      date: '2026-08-01',
      expenseCategoryId: 'expense-category-2',
      paymentMethodId: 'payment-method-credit-card',
      merchant: 'ドラッグストア',
      content: '日用品',
      memo: '修正',
    });

    expect(await database.expenseCategories.get('expense-category-1')).toMatchObject({
      usageCount: 0,
    });
    expect(await database.expenseCategories.get('expense-category-2')).toMatchObject({
      usageCount: 1,
    });
    expect(await database.paymentMethods.get('payment-method-cash')).toMatchObject({
      usageCount: 0,
    });
    expect(await database.paymentMethods.get('payment-method-credit-card')).toMatchObject({
      usageCount: 1,
    });

    await expect(repository.delete(created.id)).resolves.toBe(true);
    expect(await database.expenseCategories.get('expense-category-2')).toMatchObject({
      usageCount: 0,
    });
    expect(await database.paymentMethods.get('payment-method-credit-card')).toMatchObject({
      usageCount: 0,
    });
  });

  it('使用中の支払い方法を削除すると過去データを未設定へ置換する', async () => {
    const database = createTestDatabase();
    await initializeDatabase(database);
    const transactions = new TransactionRepository(database);
    const masterData = new MasterDataRepository(database);

    const created = await transactions.create({
      type: 'expense',
      amountYen: 5000,
      date: '2026-08-01',
      expenseCategoryId: 'expense-category-4',
      paymentMethodId: 'payment-method-credit-card',
      merchant: '通信会社',
      content: '固定費',
      memo: '',
    });

    await expect(masterData.deletePaymentMethod('payment-method-credit-card')).resolves.toBe(1);
    expect(await database.paymentMethods.get('payment-method-credit-card')).toBeUndefined();
    expect(await transactions.getById(created.id)).toMatchObject({
      type: 'expense',
      paymentMethodId: SYSTEM_UNSET_PAYMENT_METHOD_ID,
    });
    expect(await database.paymentMethods.get(SYSTEM_UNSET_PAYMENT_METHOD_ID)).toMatchObject({
      usageCount: 1,
    });
    await expect(masterData.deletePaymentMethod(SYSTEM_UNSET_PAYMENT_METHOD_ID)).rejects.toThrow(
      'システム管理の支払い方法は削除できません。',
    );
  });
});
