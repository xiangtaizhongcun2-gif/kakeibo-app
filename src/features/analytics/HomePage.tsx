import { useEffect, useMemo, useState } from 'react';
import type { MonthKey, Transaction } from '../../domain/models';
import type {
  BudgetMonthData,
  BudgetRepository,
} from '../../data/repositories/budgetRepository';
import type { TransactionRepository } from '../../data/repositories/transactionRepository';
import { HomeBudgetPanel } from '../budget/HomeBudgetPanel';
import { buildBudgetOverview } from '../budget/budgetModel';
import {
  formatMonthKey,
  shiftMonthKey,
  type TransactionMasterData,
} from '../transactions/transactionModel';
import {
  ExpenseCategoryChart,
  PaymentMethodBreakdown,
  PreviousMonthComparison,
  SummaryCards,
} from './AnalyticsPanels';
import { aggregateTransactions, compareMonthlyTotals } from './analyticsModel';

interface HomePageProps {
  repository: TransactionRepository;
  budgetRepository: BudgetRepository;
  masterData: TransactionMasterData;
  monthKey: MonthKey;
  revision: number;
  onMonthChange: (monthKey: MonthKey) => void;
}

export function HomePage({
  repository,
  budgetRepository,
  masterData,
  monthKey,
  revision,
  onMonthChange,
}: HomePageProps): React.JSX.Element {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
  const [budgetData, setBudgetData] = useState<BudgetMonthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);

  const previousMonthKey = shiftMonthKey(monthKey, -1);

  useEffect(() => {
    let disposed = false;
    setIsLoading(true);
    setLoadError('');

    void Promise.all([
      repository.listByMonth(monthKey),
      repository.listByMonth(previousMonthKey),
      budgetRepository.getMonthData(monthKey),
    ])
      .then(([currentItems, previousItems, nextBudgetData]) => {
        if (disposed) return;
        setTransactions(currentItems);
        setPreviousTransactions(previousItems);
        setBudgetData(nextBudgetData);
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setLoadError(
            error instanceof Error ? error.message : '集計データを読み込めませんでした。',
          );
        }
      })
      .finally(() => {
        if (!disposed) setIsLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [budgetRepository, monthKey, previousMonthKey, repository, revision]);

  const analytics = useMemo(
    () => aggregateTransactions(transactions, masterData),
    [masterData, transactions],
  );
  const previousAnalytics = useMemo(
    () => aggregateTransactions(previousTransactions, masterData),
    [masterData, previousTransactions],
  );
  const comparison = useMemo(
    () => compareMonthlyTotals(analytics.totals, previousAnalytics.totals),
    [analytics.totals, previousAnalytics.totals],
  );
  const budgetOverview = useMemo(
    () =>
      budgetData === null
        ? null
        : buildBudgetOverview(
            budgetData.monthlyBudget,
            budgetData.categoryBudgets,
            transactions,
            masterData.expenseCategories,
          ),
    [budgetData, masterData.expenseCategories, transactions],
  );

  if (isLoading) return <section className="empty-panel"><p>集計を読み込み中…</p></section>;

  if (loadError !== '') {
    return (
      <section className="empty-panel" role="alert">
        <h2>集計を読み込めませんでした</h2>
        <p>{loadError}</p>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="month-card" aria-label="ホームに表示する月">
        <button
          type="button"
          className="icon-button"
          aria-label="前の月"
          onClick={() => onMonthChange(shiftMonthKey(monthKey, -1))}
        >
          ‹
        </button>
        <div className="month-title">
          <small>HOME SUMMARY</small>
          <strong>{formatMonthKey(monthKey)}</strong>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="次の月"
          onClick={() => onMonthChange(shiftMonthKey(monthKey, 1))}
        >
          ›
        </button>
      </section>

      <SummaryCards totals={analytics.totals} />
      {budgetOverview !== null && <HomeBudgetPanel overview={budgetOverview} />}

      {analytics.totals.transactionCount === 0 && (
        <section className="analytics-card analytics-empty-home">
          <h2>この月の記録はまだありません</h2>
          <p>登録タブから収入または支出を追加すると、ここに集計結果を表示します。</p>
        </section>
      )}

      <PreviousMonthComparison comparison={comparison} />
      <ExpenseCategoryChart
        items={analytics.expenseCategories}
        totalExpenseYen={analytics.totals.expenseYen}
      />
      <PaymentMethodBreakdown
        items={analytics.paymentMethods}
        limit={3}
        onShowAll={() => setShowPaymentDetails(true)}
      />

      {showPaymentDetails && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="sheet-dialog analytics-detail-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="支払い方法別集計"
          >
            <header className="sheet-header">
              <div>
                <p className="kicker">{formatMonthKey(monthKey)}</p>
                <h2>支払い方法別集計</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="閉じる"
                onClick={() => setShowPaymentDetails(false)}
              >
                ×
              </button>
            </header>
            <PaymentMethodBreakdown
              items={analytics.paymentMethods}
              title="利用額と全支出比率"
            />
          </section>
        </div>
      )}
    </div>
  );
}
