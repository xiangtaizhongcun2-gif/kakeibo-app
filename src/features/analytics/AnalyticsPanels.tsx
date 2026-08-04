import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { formatYen } from '../transactions/transactionModel';
import type {
  BreakdownItem,
  MonthlyComparison,
  MonthlyTotals,
} from './analyticsModel';
import './analytics.css';
import './balance-color.css';

export function SummaryCards({ totals }: { totals: MonthlyTotals }): React.JSX.Element {
  return (
    <section className="summary-grid" aria-label="月の収支概要">
      <article className="summary-card income-summary">
        <small>収入</small>
        <strong>{formatYen(totals.incomeYen)}</strong>
        <span>{totals.incomeCount}件</span>
      </article>
      <article className="summary-card expense-summary">
        <small>支出</small>
        <strong>{formatYen(totals.expenseYen)}</strong>
        <span>{totals.expenseCount}件</span>
      </article>
      <article
        className={`summary-card balance-summary${totals.balanceYen < 0 ? ' negative' : ''}`}
      >
        <small>残額</small>
        <strong>{formatYen(totals.balanceYen)}</strong>
        <span>収入 − 支出</span>
      </article>
    </section>
  );
}

function differenceText(value: number): string {
  if (value === 0) return '前月と同じ';
  return `前月より${value > 0 ? '＋' : '−'}${formatYen(Math.abs(value))}`;
}

export function PreviousMonthComparison({
  comparison,
}: {
  comparison: MonthlyComparison;
}): React.JSX.Element {
  return (
    <section className="analytics-card">
      <header className="analytics-heading">
        <div>
          <p className="kicker">MONTH OVER MONTH</p>
          <h2>前月との比較</h2>
        </div>
      </header>
      <dl className="comparison-list">
        <div>
          <dt>収入</dt>
          <dd className={comparison.incomeDifferenceYen >= 0 ? 'positive' : 'negative'}>
            {differenceText(comparison.incomeDifferenceYen)}
          </dd>
        </div>
        <div>
          <dt>支出</dt>
          <dd className={comparison.expenseDifferenceYen <= 0 ? 'positive' : 'negative'}>
            {differenceText(comparison.expenseDifferenceYen)}
          </dd>
        </div>
        <div>
          <dt>残額</dt>
          <dd className={comparison.balanceDifferenceYen >= 0 ? 'positive' : 'negative'}>
            {differenceText(comparison.balanceDifferenceYen)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function PaymentMethodBreakdown({
  items,
  limit,
  onShowAll,
  title = '支払い方法別',
}: {
  items: BreakdownItem[];
  limit?: number;
  onShowAll?: () => void;
  title?: string;
}): React.JSX.Element {
  const visibleItems = limit === undefined ? items : items.slice(0, limit);

  return (
    <section className="analytics-card">
      <header className="analytics-heading">
        <div>
          <p className="kicker">PAYMENT METHODS</p>
          <h2>{title}</h2>
        </div>
        {onShowAll !== undefined && items.length > 0 && (
          <button type="button" className="text-button" onClick={onShowAll}>
            すべて見る
          </button>
        )}
      </header>
      {items.length === 0 ? (
        <div className="analytics-empty">
          <strong>支出がありません</strong>
          <p>支出を登録すると、支払い方法ごとの利用額と割合を表示します。</p>
        </div>
      ) : (
        <ul className="breakdown-list">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <div className="breakdown-copy">
                <strong>{item.name}</strong>
                <small>{item.transactionCount}件・全支出の{item.ratioPercent}%</small>
              </div>
              <strong>{formatYen(item.amountYen)}</strong>
              <div className="ratio-track" aria-hidden="true">
                <span style={{ width: `${Math.min(item.ratioPercent, 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ExpenseCategoryChart({
  items,
  totalExpenseYen,
}: {
  items: BreakdownItem[];
  totalExpenseYen: number;
}): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  const segments = useMemo(() => {
    let offset = 0;
    return items.map((item, index) => {
      const length = totalExpenseYen === 0 ? 0 : (item.amountYen / totalExpenseYen) * circumference;
      const segment = { item, index, length, offset };
      offset += length;
      return segment;
    });
  }, [circumference, items, totalExpenseYen]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  const selectOnKeyboard = (
    event: KeyboardEvent<SVGCircleElement>,
    item: BreakdownItem,
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedId(item.id);
    }
  };

  return (
    <section className="analytics-card">
      <header className="analytics-heading">
        <div>
          <p className="kicker">EXPENSE CATEGORIES</p>
          <h2>カテゴリ別支出</h2>
        </div>
      </header>
      {items.length === 0 ? (
        <div className="analytics-empty">
          <strong>支出がありません</strong>
          <p>支出を登録すると、カテゴリごとの割合を円グラフで表示します。</p>
        </div>
      ) : (
        <>
          <div className="chart-layout">
            <svg
              className="donut-chart"
              viewBox="0 0 100 100"
              role="img"
              aria-label="カテゴリ別支出の円グラフ"
            >
              <circle className="donut-track" cx="50" cy="50" r={radius} />
              {segments.map(({ item, index, length, offset }) => (
                <circle
                  key={item.id}
                  className={`donut-segment chart-color-${index % 8}${selected?.id === item.id ? ' selected' : ''}`}
                  cx="50"
                  cy="50"
                  r={radius}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.name} ${formatYen(item.amountYen)} 全支出の${item.ratioPercent}%`}
                  onClick={() => setSelectedId(item.id)}
                  onKeyDown={(event) => selectOnKeyboard(event, item)}
                />
              ))}
              <text className="donut-label" x="50" y="47" textAnchor="middle">支出</text>
              <text className="donut-value" x="50" y="57" textAnchor="middle">{formatYen(totalExpenseYen)}</text>
            </svg>
            {selected !== undefined && (
              <div className="chart-selection" role="status">
                <span className={`legend-dot chart-background-${items.indexOf(selected) % 8}`} />
                <small>選択中</small>
                <strong>{selected.name}</strong>
                <span>{formatYen(selected.amountYen)}</span>
                <span>全支出の{selected.ratioPercent}%</span>
              </div>
            )}
          </div>
          <div className="chart-legend">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={selected?.id === item.id ? 'active' : ''}
                onClick={() => setSelectedId(item.id)}
              >
                <span className={`legend-dot chart-background-${index % 8}`} />
                <span>{item.name}</span>
                <strong>{item.ratioPercent}%</strong>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
