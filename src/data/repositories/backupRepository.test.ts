import { afterEach, describe, expect, it } from 'vitest';
import { MyKakeiboDatabase } from '../database';
import { initializeDatabase } from '../initializeDatabase';
import { BackupRepository } from './backupRepository';
import { BudgetRepository } from './budgetRepository';
import { SettingsRepository } from './settingsRepository';
import { TransactionRepository } from './transactionRepository';

const databases: MyKakeiboDatabase[] = [];

function createDatabase(): MyKakeiboDatabase {
  const database = new MyKakeiboDatabase(`backup-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (database) => {
      database.close();
      await database.delete();
    }),
  );
});

describe('BackupRepository', () => {
  it('全テーブルをバックアップし、現在データを完全に置き換えて復元する', async () => {
    const database = createDatabase();
    await initializeDatabase(database);
    const transactions = new TransactionRepository(database);
    const budgets = new BudgetRepository(database);
    const settings = new SettingsRepository(database);
    const backups = new BackupRepository(database);

    const original = await transactions.create({
      type: 'expense',
      amountYen: 1280,
      date: '2026-08-03',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: 'バックアップ対象',
    });
    await budgets.setMonthlyBudget('2026-08', 10000);
    await settings.updateDisplaySettings({
      transactionListFields: ['amount', 'category'],
      themeMode: 'dark',
    });
    const document = await backups.createBackup('2026-08-03T03:30:00.000Z');

    await transactions.delete(original.id);
    await transactions.create({
      type: 'income',
      amountYen: 50000,
      date: '2026-08-03',
      incomeCategoryId: 'income-category-1',
      content: '復元前だけのデータ',
    });
    await budgets.deleteMonthlyBudget('2026-08');
    await settings.updateDisplaySettings({
      transactionListFields: ['amount'],
      themeMode: 'light',
    });

    await backups.restoreBackup(document);

    expect(await database.transactions.toArray()).toEqual(document.data.transactions);
    expect(await database.expenseCategories.toArray()).toEqual(
      document.data.expenseCategories,
    );
    expect(await database.incomeCategories.toArray()).toEqual(
      document.data.incomeCategories,
    );
    expect(await database.paymentMethods.toArray()).toEqual(
      document.data.paymentMethods,
    );
    expect(await database.monthlyBudgets.toArray()).toEqual(
      document.data.monthlyBudgets,
    );
    expect(await database.categoryBudgets.toArray()).toEqual(
      document.data.categoryBudgets,
    );
    expect(await database.budgetSettings.toArray()).toEqual(
      document.data.budgetSettings,
    );
    expect(await database.notificationStates.toArray()).toEqual(
      document.data.notificationStates,
    );
    expect(await database.displaySettings.toArray()).toEqual(
      document.data.displaySettings,
    );
    expect(await database.notificationSettings.toArray()).toEqual(
      document.data.notificationSettings,
    );
    expect(await database.onboardingStates.toArray()).toEqual(
      document.data.onboardingStates,
    );
    expect(await database.appMetadata.toArray()).toEqual(document.data.appMetadata);
  });

  it('不正なファイルを検証しただけでは現在データを変更しない', async () => {
    const database = createDatabase();
    await initializeDatabase(database);
    const transactions = new TransactionRepository(database);
    const backups = new BackupRepository(database);

    const current = await transactions.create({
      type: 'income',
      amountYen: 1000,
      date: '2026-08-03',
      incomeCategoryId: 'income-category-2',
      content: '現在データ',
    });

    expect(() => backups.inspectBackup('{"format":"wrong"}')).toThrow();
    expect(await database.transactions.get(current.id)).toBeDefined();
    expect(await database.transactions.count()).toBe(1);
  });

  it('置換途中でIndexedDB書き込みに失敗した場合は全変更をロールバックする', async () => {
    const database = createDatabase();
    await initializeDatabase(database);
    const transactions = new TransactionRepository(database);
    const backups = new BackupRepository(database);

    const backedUp = await transactions.create({
      type: 'expense',
      amountYen: 500,
      date: '2026-08-01',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: '売店',
      content: 'バックアップ側',
    });
    const document = await backups.createBackup('2026-08-03T03:30:00.000Z');
    await transactions.delete(backedUp.id);
    const current = await transactions.create({
      type: 'income',
      amountYen: 2000,
      date: '2026-08-02',
      incomeCategoryId: 'income-category-1',
      content: '現在側',
    });

    const failCreatingMetadata = (): never => {
      throw new Error('forced restore failure');
    };
    database.appMetadata.hook('creating', failCreatingMetadata);

    await expect(backups.restoreBackup(document)).rejects.toThrow(
      'forced restore failure',
    );

    expect(await database.transactions.count()).toBe(1);
    expect(await database.transactions.get(current.id)).toBeDefined();
    expect(await database.transactions.get(backedUp.id)).toBeUndefined();
    expect(await database.appMetadata.get('metadata')).toBeDefined();
  });
});
