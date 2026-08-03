import type {
  MonthlyBudgetNotificationState,
  MonthKey,
  UtcIsoDateTime,
} from '../../domain/models';
import {
  currentUtcIsoDateTime,
  toMonthKey,
} from '../../domain/valueObjects';
import type { MonthlyBudgetExceededAlert } from '../../features/notifications/notificationModel';
import {
  createMonthlyBudgetExceededAlert,
  monthlyBudgetNotificationStateId,
} from '../../features/notifications/notificationModel';
import { appDatabase, type MyKakeiboDatabase } from '../database';

export interface MonthlyBudgetNotificationClaim {
  alert: MonthlyBudgetExceededAlert;
  showInApp: boolean;
  showSystem: boolean;
}

export class NotificationRepository {
  constructor(private readonly database: MyKakeiboDatabase = appDatabase) {}

  async claimMonthlyBudgetExceeded(
    monthKey: MonthKey,
    detectedAt: UtcIsoDateTime = currentUtcIsoDateTime(),
  ): Promise<MonthlyBudgetNotificationClaim | null> {
    const validMonthKey = toMonthKey(monthKey);

    return this.database.transaction(
      'rw',
      [
        this.database.transactions,
        this.database.monthlyBudgets,
        this.database.notificationSettings,
        this.database.notificationStates,
      ],
      async () => {
        const [budget, settings, transactions] = await Promise.all([
          this.database.monthlyBudgets.get(validMonthKey),
          this.database.notificationSettings.get('notification-settings'),
          this.database.transactions
            .where('date')
            .between(`${validMonthKey}-01`, `${validMonthKey}-31`, true, true)
            .toArray(),
        ]);

        if (settings === undefined) {
          throw new Error('通知設定が初期化されていません。');
        }

        const alert = createMonthlyBudgetExceededAlert(
          validMonthKey,
          budget ?? null,
          transactions,
          detectedAt,
        );
        if (alert === null) return null;

        const id = monthlyBudgetNotificationStateId(validMonthKey);
        const current = await this.database.notificationStates.get(id);
        const currentMonthly =
          current?.budgetType === 'monthly' ? current : undefined;
        const showInApp =
          settings.inAppEnabled && currentMonthly?.inAppNotifiedAt == null;
        const showSystem =
          settings.systemNotificationEnabled &&
          settings.lastKnownPermission === 'granted' &&
          currentMonthly?.systemNotifiedAt == null;

        const next: MonthlyBudgetNotificationState = {
          id,
          budgetType: 'monthly',
          monthKey: validMonthKey,
          hasEverExceeded: true,
          firstExceededAt: currentMonthly?.firstExceededAt ?? detectedAt,
          inAppNotifiedAt: showInApp
            ? detectedAt
            : currentMonthly?.inAppNotifiedAt ?? null,
          systemNotifiedAt: showSystem
            ? detectedAt
            : currentMonthly?.systemNotifiedAt ?? null,
        };
        await this.database.notificationStates.put(next);

        return { alert, showInApp, showSystem };
      },
    );
  }

  async releaseSystemNotification(monthKey: MonthKey): Promise<void> {
    const validMonthKey = toMonthKey(monthKey);
    const id = monthlyBudgetNotificationStateId(validMonthKey);
    const current = await this.database.notificationStates.get(id);
    if (current?.budgetType !== 'monthly') return;
    await this.database.notificationStates.put({
      ...current,
      systemNotifiedAt: null,
    });
  }

  async getMonthlyState(
    monthKey: MonthKey,
  ): Promise<MonthlyBudgetNotificationState | null> {
    const id = monthlyBudgetNotificationStateId(toMonthKey(monthKey));
    const state = await this.database.notificationStates.get(id);
    return state?.budgetType === 'monthly' ? state : null;
  }
}
