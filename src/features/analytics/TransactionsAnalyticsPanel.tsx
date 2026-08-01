import { useMemo } from 'react';
import type { Transaction } from '../../domain/models';
import type { TransactionMasterData } from '../transactions/transactionModel';
import { PaymentMethodBreakdown, SummaryCards } from './AnalyticsPanels';
import { aggregateTransactions } from './analyticsModel';

export function TransactionsAnalyticsPanel({
  transactions,
  masterData,
}: {
  transactions: Transaction[];
  masterData: TransactionMasterData;
}): React.JSX.Element {
  const analytics = useMemo(
    () => aggregateTransactions(transactions, masterData),
    [masterData, transactions],
  );

  return (
    <section className="filtered-analytics" aria-label="絞り込み結果の集計">
      <header className="filtered-analytics-heading">
        <div>
          <p className="kicker">FILTERED SUMMARY</p>
          <h2>表示中の収支集計</h2>
        </div>
        <span>{analytics.totals.transactionCount}件</span>
      </header>
      <SummaryCards totals={analytics.totals} />
      <PaymentMethodBreakdown
        items={analytics.paymentMethods}
        limit={3}
        title="表示中の支払い方法別"
      />
    </section>
  );
}
