import type { NotificationPermissionState } from '../../domain/models';
import type { MonthlyBudgetExceededAlert } from './notificationModel';
import { monthlyBudgetNotificationBody } from './notificationModel';

export interface SystemNotificationGateway {
  getPermission(): NotificationPermissionState;
  requestPermission(): Promise<NotificationPermissionState>;
  showBudgetExceeded(alert: MonthlyBudgetExceededAlert): Promise<boolean>;
}

function mapPermission(permission: NotificationPermission): NotificationPermissionState {
  if (permission === 'granted') return 'granted';
  if (permission === 'denied') return 'denied';
  return 'default';
}

export class BrowserSystemNotificationGateway implements SystemNotificationGateway {
  getPermission(): NotificationPermissionState {
    if (typeof Notification === 'undefined') return 'unsupported';
    return mapPermission(Notification.permission);
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (typeof Notification === 'undefined') return 'unsupported';
    try {
      return mapPermission(await Notification.requestPermission());
    } catch {
      return mapPermission(Notification.permission);
    }
  }

  async showBudgetExceeded(alert: MonthlyBudgetExceededAlert): Promise<boolean> {
    if (this.getPermission() !== 'granted') return false;

    const title = '月予算を超過しました';
    const options: NotificationOptions = {
      body: monthlyBudgetNotificationBody(alert),
      tag: `my-kakeibo-monthly-budget-${alert.monthKey}`,
      icon: `${import.meta.env.BASE_URL}favicon.svg`,
    };

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
        return true;
      } catch {
        // Foreground Notification APIへフォールバックします。
      }
    }

    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }
}

export const browserSystemNotificationGateway = new BrowserSystemNotificationGateway();
