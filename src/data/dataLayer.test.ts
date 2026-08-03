import { afterEach, describe, expect, it } from 'vitest';
import { MyKakeiboDatabase } from './database';
import { initializeDatabase } from './initializeDatabase';
import { SYSTEM_UNSET_PAYMENT_METHOD_ID } from './initialData';
import { BudgetRepository } from './repositories/budgetRepository';
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

describe('data layer', () => {
  it('初期データを一度だけ登録する', async () => {
    const database = createTestDatabase();
    const firstMetadata = await initializeDatabase(database);
    const secondMetadata = await initializeDatabase(database);

    expect(firstMetadata.dataVersion).toBe(3);
    expect(firstMetadata.databaseVersion).toBe(2);
    expect(secondMetadata.initializedAt).toBe(firstMetadata.initializedAt);
    expectNames((await database.expenseCategories.toArray()).map(({ name }) => name), ['食費', '日用品', '交通費', '固定費', '娯楽費']);
    expectNames((await database.incomeCategories.toArray()).map(({ name }) => name), ['給与', '仕送り', '臨時収入', 'その他']);
    expectNames((await database.paymentMethods.toArray()).map(({ name }) => name), ['未設定', '現金', 'クレジットカード', '電子マネー', '銀行振込']);
    expect(await database.displaySettings.get('display-settings')).toMatchObject({
      transactionListFields: ['amount', 'category', 'paymentMethod', 'merchant', 'content'],
    });
    expect(await database.budgetSettings.get('budget-settings')).toMatchObject({
      monthlyCarryoverEnabled: false,
      categoryCarryoverEnabled: false,
    });

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
    });

    expect(await database.expenseCategories.get('expense-category-1')).toMatchObject({ usageCount: 1 });
    expect(await database.paymentMethods.get('payment-method-cash')).toMatchObject({ usageCount: 1 });

    await repository.replace(created.id, {
      type: 'expense',
      amountYen: 1500,
      date: '2026-08-01',
      expenseCategoryId: 'expense-category-2',
      paymentMethodId: 'payment-method-credit-card',
      merchant: 'ドラッグストア',
      content: '日用品',
    });

    expect(await database.expenseCategories.get('expense-category-1')).toMatchObject({ usageCount: 0 });
    expect(await database.expenseCategories.get('expense-category-2')).toMatchObject({ usageCount: 1 });
    expect(await database.paymentMethods.get('payment-method-cash')).toMatchObject({ usageCount: 0 });
    expect(await database.paymentMethods.get('payment-method-credit-card')).toMatchObject({ usageCount: 1 });

    await expect(repository.delete(created.id)).resolves.toBe(true);
    expect(await database.expenseCategories.get('expense-category-2')).toMatchObject({ usageCount: 0 });
    expect(await database.paymentMethods.get('payment-method-credit-card')).toMatchObject({ usageCount: 0 });
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
    });

    await expect(masterData.deletePaymentMethod('payment-method-credit-card')).resolves.toBe(1);
    expect(await database.paymentMethods.get('payment-method-credit-card')).toBeUndefined();
    expect(await transactions.getById(created.id)).toMatchObject({ type: 'expense', paymentMethodId: SYSTEM_UNSET_PAYMENT_METHOD_ID });
    expect(await database.paymentMethods.get(SYSTEM_UNSET_PAYMENT_METHOD_ID)).toMatchObject({ usageCount: 1 });
  });

  it('月全体とカテゴリの正の残額だけを翌月へ繰り越す', async () => {
    const database = createTestDatabase();
    await initializeDatabase(database);
    const transactions = new TransactionRepository(database);
    const budgets = new BudgetRepository(database);

    await budgets.updateSettings({
      monthlyCarryoverEnabled: true,
      categoryCarryoverEnabled: true,
    });
    await budgets.setMonthlyBudget('2026-08', 10000);
    await budgets.setMonthlyBudget('2026-09', 8000);
    await budgets.setCategoryBudget('2026-08', 'expense-category-1', 6000);
    await budgets.setCategoryBudget('2026-09', 'expense-category-1', 5000);

    const expense = await transactions.create({
      type: 'expense',
      amountYen: 4000,
      date: '2026-08-10',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
    });

    expect(await database.monthlyBudgets.get('2026-09')).toMatchObject({
      carryoverAmountYen: 6000,
      effectiveAmountYen: 14000,
    });
    expect(await database.categoryBudgets.get('2026-09:expense-category-1')).toMatchObject({
      carryoverAmountYen: 2000,
      effectiveAmountYen: 7000,
    });

    await transactions.replace(expense.id, {
      type: 'expense',
      amountYen: 9000,
      date: '2026-08-10',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
    });

    expect(await database.monthlyBudgets.get('2026-09')).toMatchObject({
      carryoverAmountYen: 1000,
      effectiveAmountYen: 9000,
    });
    expect(await database.categoryBudgets.get('2026-09:expense-category-1')).toMatchObject({
      carryoverAmountYen: 0,
      effectiveAmountYen: 5000,
    });
  });

  it('繰越をOFFにすると保存済みの翌月予算を再計算する', async () => {
    const database = createTestDatabase();
    await initializeDatabase(database);
    const budgets = new BudgetRepository(database);
    const transactions = new TransactionRepository(database);

    await budgets.updateSettings({ monthlyCarryoverEnabled: true });
    await budgets.setMonthlyBudget('2026-08', 10000);
    await budgets.setMonthlyBudget('2026-09', 8000);
    await transactions.create({
      type: 'expense',
      amountYen: 2500,
      date: '2026-08-05',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
    });

    expect(await database.monthlyBudgets.get('2026-09')).toMatchObject({
      carryoverAmountYen: 7500,
      effectiveAmountYen: 15500,
    });

    await budgets.updateSettings({ monthlyCarryoverEnabled: false });
    expect(await database.monthlyBudgets.get('2026-09')).toMatchObject({
      carryoverAmountYen: 0,
      effectiveAmountYen: 8000,
    });
  });
});
