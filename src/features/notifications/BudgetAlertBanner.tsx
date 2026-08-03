import type { MonthlyBudgetExceededAlert } from './notificationModel';
import {
  formatNotificationMonth,
  formatNotificationYen,
} from './notificationModel';
import './notifications.css';

interface BudgetAlertBannerProps {
  alert: MonthlyBudgetExceededAlert;
  onOpenBudget: () => void;
  onDismiss: () => void;
}

export function BudgetAlertBanner({
  alert,
  onOpenBudget,
  onDismiss,
}: BudgetAlertBannerProps): React.JSX.Element {
  return (
    <section className="budget-alert-banner" role="alert" aria-live="assertive">
      <div className="budget-alert-copy">
        <p className="kicker">BUDGET ALERT</p>
        <h2>月予算を超過しました</h2>
        <p>
          {formatNotificationMonth(alert.monthKey)}の支出は
          <strong>{formatNotificationYen(alert.spentAmountYen)}</strong>です。予算を
          <strong>{formatNotificationYen(alert.exceededAmountYen)}</strong>超えています。
        </p>
      </div>
      <div className="budget-alert-actions">
        <button type="button" className="primary-button" onClick={onOpenBudget}>
          予算を確認
        </button>
        <button type="button" className="secondary-button" onClick={onDismiss}>
          閉じる
        </button>
      </div>
    </section>
  );
}
