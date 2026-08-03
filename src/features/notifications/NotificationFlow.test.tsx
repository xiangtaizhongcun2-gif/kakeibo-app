import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createAppServices, type AppServices } from '../../app/services';
import { MyKakeiboDatabase } from '../../data/database';
import { initializeDatabase } from '../../data/initializeDatabase';
import type { NotificationPermissionState } from '../../domain/models';
import { toLocalDate } from '../../domain/valueObjects';
import { currentMonthKey } from '../transactions/transactionModel';
import type { SystemNotificationGateway } from './browserNotificationGateway';
import type { MonthlyBudgetExceededAlert } from './notificationModel';

class FakeNotificationGateway implements SystemNotificationGateway {
  permission: NotificationPermissionState = 'default';
  requestCount = 0;
  shownAlerts: MonthlyBudgetExceededAlert[] = [];

  getPermission(): NotificationPermissionState {
    return this.permission;
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    this.requestCount += 1;
    this.permission = 'granted';
    return this.permission;
  }

  async showBudgetExceeded(alert: MonthlyBudgetExceededAlert): Promise<boolean> {
    this.shownAlerts.push(alert);
    return true;
  }
}

let database: MyKakeiboDatabase;
let services: AppServices;
let gateway: FakeNotificationGateway;

beforeEach(async () => {
  window.location.hash = '';
  database = new MyKakeiboDatabase(`notification-flow-${crypto.randomUUID()}`);
  await initializeDatabase(database);
  services = createAppServices(database);
  gateway = new FakeNotificationGateway();
});

afterEach(async () => {
  database.close();
  await database.delete();
});

async function createCurrentMonthOverBudget(): Promise<void> {
  const monthKey = currentMonthKey();
  await services.budgets.setMonthlyBudget(monthKey, 10000);
  await services.transactions.create({
    type: 'expense',
    amountYen: 12000,
    date: toLocalDate(`${monthKey}-01`),
    expenseCategoryId: 'expense-category-1',
    paymentMethodId: 'payment-method-cash',
    merchant: 'スーパー',
    content: '食料品',
  });
}

describe('Phase 6 notification flow', () => {
  it('予算超過をアプリ内に1回だけ表示する', async () => {
    await createCurrentMonthOverBudget();
    const first = render(
      <App services={services} notificationGateway={gateway} />,
    );

    expect(
      await screen.findByRole('heading', { name: '月予算を超過しました' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/2,000円/).length).toBeGreaterThan(0);
    await waitFor(async () =>
      expect(await services.notifications.getMonthlyState(currentMonthKey())).toMatchObject({
        hasEverExceeded: true,
        inAppNotifiedAt: expect.any(String),
      }),
    );

    first.unmount();
    render(<App services={services} notificationGateway={gateway} />);
    await screen.findByRole('heading', { name: '前月との比較' });
    expect(
      screen.queryByRole('heading', { name: '月予算を超過しました' }),
    ).not.toBeInTheDocument();
  });

  it('ユーザーが許可ボタンを押した後だけシステム通知をONにする', async () => {
    await createCurrentMonthOverBudget();
    const user = userEvent.setup();
    render(<App services={services} notificationGateway={gateway} />);
    await screen.findByRole('heading', { name: '月予算を超過しました' });

    await user.click(screen.getByRole('button', { name: '設定' }));
    expect(
      await screen.findByRole('heading', { name: '予算超過の通知' }),
    ).toBeInTheDocument();
    expect(gateway.requestCount).toBe(0);

    await user.click(
      screen.getByRole('button', { name: 'システム通知を許可' }),
    );

    await waitFor(() => expect(gateway.requestCount).toBe(1));
    await waitFor(() => expect(gateway.shownAlerts).toHaveLength(1));
    await waitFor(async () =>
      expect(await services.settings.getNotificationSettings()).toMatchObject({
        lastKnownPermission: 'granted',
        systemNotificationEnabled: true,
      }),
    );
  });
});
