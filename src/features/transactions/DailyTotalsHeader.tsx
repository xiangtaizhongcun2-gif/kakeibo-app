import type { LocalDate, Transaction } from '../../domain/models';
import { createDailyTransactionTotals } from './dailyTotals';
import { formatLocalDate, formatYen } from './transactionModel';
import './dailyTotals.css';

interface DailyTotalsHeaderProps {
  date: LocalDate;
  transactions: readonly Transaction[];
}

function formatBalance(value: number): string {
  if (value > 0) return `＋${formatYen(value)}`;
  if (value < 0) return `−${formatYen(Math.abs(value))}`;
  return formatYen(0);
}

export function DailyTotalsHeader({
  date,
  transactions,
}: DailyTotalsHeaderProps): React.JSX.Element {
  const totals = createDailyTransactionTotals(transactions);

  return (
    <header className="date-group-header">
      <h2>{formatLocalDate(date)}</h2>
      <dl className="daily-totals" aria-label={`${formatLocalDate(date)}の合計`}>
        <div className="expense">
          <dt>支出</dt>
          <dd>−{formatYen(totals.expenseYen)}</dd>
        </div>
        <div className="income">
          <dt>収入</dt>
          <dd>＋{formatYen(totals.incomeYen)}</dd>
        </div>
        <div className={totals.balanceYen < 0 ? 'balance negative' : 'balance positive'}>
          <dt>差額</dt>
          <dd>{formatBalance(totals.balanceYen)}</dd>
        </div>
      </dl>
    </header>
  );
}
