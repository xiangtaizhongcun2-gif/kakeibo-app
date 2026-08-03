import type { MonthKey, MonthlyBudget, Transaction } from '../../domain/models';
import { formatMonthKey } from '../transactions/transactionModel';
import { BudgetProgressCard } from './BudgetProgressCard';
import { createBudgetProgress, totalExpenseYen } from './budgetModel';

interface HomeBudgetPanelProps {
  monthKey: MonthKey;
  budget: MonthlyBudget | null;
  transactions: Transaction[];
  onOpenBudget: () => void;
}

export function HomeBudgetPanel({
  monthKey,
  budget,
  transactions,
  onOpenBudget,
}: HomeBudgetPanelProps): React.JSX.Element {
  if (budget === null) {
    return (
      <section className="home-budget-empty">
        <header className="home-budget-heading">
          <div>
            <p className="kicker">MONTHLY BUDGET</p>
            <h2>月予算</h2>
          </div>
          <button type="button" className="text-button" onClick={onOpenBudget}>
            設定する
          </button>
        </header>
        <p>{formatMonthKey(monthKey)}の予算は未設定です。</p>
      </section>
    );
  }

  const progress = createBudgetProgress(budget, totalExpenseYen(transactions));
  return (
    <section className="home-budget-section" aria-label="月予算の状況">
      <header className="home-budget-heading">
        <div>
          <p className="kicker">MONTHLY BUDGET</p>
          <h2>月予算</h2>
        </div>
        <button type="button" className="text-button" onClick={onOpenBudget}>
          詳細
        </button>
      </header>
      <BudgetProgressCard
        title={`${formatMonthKey(monthKey)}の予算`}
        progress={progress}
        compact
        actions={progress.isExceeded ? <span className="budget-alert-badge">超過</span> : undefined}
      />
    </section>
  );
}
