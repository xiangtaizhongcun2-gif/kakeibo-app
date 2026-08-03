import { formatYen } from '../transactions/transactionModel';
import type { BudgetProgress } from './budgetModel';
import './budget.css';

interface BudgetProgressCardProps {
  title: string;
  progress: BudgetProgress;
  compact?: boolean;
  actions?: React.ReactNode;
}

export function BudgetProgressCard({
  title,
  progress,
  compact = false,
  actions,
}: BudgetProgressCardProps): React.JSX.Element {
  const progressWidth = Math.min(Math.max(progress.usagePercent, 0), 100);

  return (
    <article className={`budget-progress-card${progress.isExceeded ? ' exceeded' : ''}${compact ? ' compact' : ''}`}>
      <header className="budget-card-header">
        <div>
          <h3>{title}</h3>
          <p>{progress.isExceeded ? '予算を超過しています' : '予算内です'}</p>
        </div>
        {actions}
      </header>

      <div
        className="budget-progress-track"
        role="progressbar"
        aria-label={`${title}の使用率`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.usagePercent)}
        aria-valuetext={`${progress.usagePercent}%`}
      >
        <span style={{ width: `${progressWidth}%` }} />
      </div>

      <div className="budget-progress-main">
        <strong>{progress.usagePercent}%</strong>
        <span>
          {progress.isExceeded ? '超過額' : '残額'}
          <b>{formatYen(Math.abs(progress.remainingAmountYen))}</b>
        </span>
      </div>

      <dl className="budget-values">
        <div>
          <dt>予算額</dt>
          <dd>{formatYen(progress.baseAmountYen)}</dd>
        </div>
        {progress.carryoverAmountYen > 0 && (
          <div>
            <dt>繰越額</dt>
            <dd>＋{formatYen(progress.carryoverAmountYen)}</dd>
          </div>
        )}
        <div>
          <dt>有効予算</dt>
          <dd>{formatYen(progress.effectiveAmountYen)}</dd>
        </div>
        <div>
          <dt>使用額</dt>
          <dd>{formatYen(progress.spentAmountYen)}</dd>
        </div>
      </dl>
    </article>
  );
}
