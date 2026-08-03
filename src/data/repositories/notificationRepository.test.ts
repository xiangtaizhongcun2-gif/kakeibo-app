import { afterEach, describe, expect, it } from 'vitest';
import { MyKakeiboDatabase } from '../database';
import { initializeDatabase } from '../initializeDatabase';
import { BudgetRepository } from './budgetRepository';
import { NotificationRepository } from './notificationRepository';
import { SettingsRepository } from './settingsRepository';
import { TransactionRepository } from './transactionRepository';

const databases: MyKakeiboDatabase[] = [];

function createTestDatabase(): MyKakeiboDatabase {
  const database = new MyKakeiboDatabase(`notification-test-${crypto.randomUUID()}`);
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

async function createExceededBudget(database: MyKakeiboDatabase): Promise<void> {
  const budgets = new BudgetRepository(database);
  const transactions = new TransactionRepository(database);
  await budgets.setMonthlyBudget('2026-08', 10000);
  await transactions.create({
    type: 'expense',
    amountYen: 10500,
    date: '2026-08-03',
    expenseCategoryId: 'expense-category-1',
    paymentMethodId: 'payment-method-cash',
    merchant: 'スーパー',
    content: '食料品',
  });
}

describe('NotificationRepository', () => {
  it('予算を実際に超えた最初の1回だけアプリ内通知を確保する', async () => {
    const database = createTestDatabase();
    await initializeDatabase(database);
    await createExceededBudget(database);
    const notifications = new NotificationRepository(database);

    const first = await notifications.claimMonthlyBudgetExceeded(
      '2026-08',
      '2026-08-03T01:00:00.000Z',
    );
    expect(first).toMatchObject({
      showInApp: true,
      showSystem: false,
      alert: { exceededAmountYen: 500 },
    });

    const state = await notifications.getMonthlyState('2026-08');
    expect(state).toMatchObject({
      hasEverExceeded: true,
      firstExceededAt: '2026-08-03T01:00:00.000Z',
      inAppNotifiedAt: '2026-08-03T01:00:00.000Z',
      systemNotifiedAt: null,
    });

    const second = await notifications.claimMonthlyBudgetExceeded(
      '2026-08',
      '2026-08-03T02:00:00.000Z',
    );
    expect(second).toMatchObject({ showInApp: false, showSystem: false });
  });

  it('予算と同額では通知状態を作成しない', async () => {
    const database = createTestDatabase();
    await initializeDatabase(database);
    const budgets = new BudgetRepository(database);
    const transactions = new TransactionRepository(database);
    const notifications = new NotificationRepository(database);
    await budgets.setMonthlyBudget('2026-08', 10000);
    await transactions.create({
      type: 'expense',
      amountYen: 10000,
      date: '2026-08-03',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
    });

    await expect(
      notifications.claimMonthlyBudgetExceeded('2026-08'),
    ).resolves.toBeNull();
    await expect(notifications.getMonthlyState('2026-08')).resolves.toBeNull();
  });

  it('許可済みでONの場合だけシステム通知を確保する', async () => {
    const database = createTestDatabase();
    await initializeDatabase(database);
    await createExceededBudget(database);
    const notifications = new NotificationRepository(database);
    const settings = new SettingsRepository(database);

    await notifications.claimMonthlyBudgetExceeded('2026-08');
    await settings.updateNotificationSettings({
      lastKnownPermission: 'granted',
      systemNotificationEnabled: true,
    });

    const systemClaim = await notifications.claimMonthlyBudgetExceeded('2026-08');
    expect(systemClaim).toMatchObject({ showInApp: false, showSystem: true });

    const duplicate = await notifications.claimMonthlyBudgetExceeded('2026-08');
    expect(duplicate).toMatchObject({ showInApp: false, showSystem: false });
  });

  it('システム通知の表示失敗後は次回再試行できる', async () => {
    const database = createTestDatabase();
    await initializeDatabase(database);
    await createExceededBudget(database);
    const notifications = new NotificationRepository(database);
    const settings = new SettingsRepository(database);
    await settings.updateNotificationSettings({
      lastKnownPermission: 'granted',
      systemNotificationEnabled: true,
    });

    const first = await notifications.claimMonthlyBudgetExceeded('2026-08');
    expect(first?.showSystem).toBe(true);
    await notifications.releaseSystemNotification('2026-08');
    const retry = await notifications.claimMonthlyBudgetExceeded('2026-08');
    expect(retry?.showSystem).toBe(true);
  });
});
