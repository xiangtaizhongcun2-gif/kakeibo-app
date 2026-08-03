import { BudgetProgressCard } from './BudgetProgressCard';
import type { BudgetOverview } from './budgetModel';

export function HomeBudgetPanel({
  overview,
}: {
  overview: BudgetOverview;
}): React.JSX.Element {
  if (overview.monthly === null) {
    return (
      <section className="home-budget-empty">
        <div>
          <p className="kicker">MONTHLY BUDGET</p>
          <h2>月予算は未設定です</h2>
          <p>予算タブから設定すると、使用率と残額をホームに表示します。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="home-budget-section" aria-label="月予算の状況">
      <div className="home-budget-heading">
        <div>
          <p className="kicker">MONTHLY BUDGET</p>
          <h2>月予算の状況</h2>
        </div>
        {overview.exceededCategoryCount > 0 && (
          <span className="budget-alert-badge">
            {overview.exceededCategoryCount}カテゴリ超過
          </span>
        )}
      </div>
      <BudgetProgressCard title="月全体予算" progress={overview.monthly} compact />
    </section>
  );
}
