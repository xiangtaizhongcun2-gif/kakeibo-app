import { useEffect, useMemo, useState } from 'react';
import type { DisplaySettings, MonthKey, Transaction } from '../../domain/models';
import type { TransactionRepository } from '../../data/repositories/transactionRepository';
import { TransactionsAnalyticsPanel } from '../analytics/TransactionsAnalyticsPanel';
import { TransactionForm } from './TransactionForm';
import {
  applyTransactionFilters,
  categoryKey,
  categoryName,
  formatLocalDate,
  formatMonthKey,
  formatYen,
  groupTransactionsByDate,
  paymentMethodName,
  shiftMonthKey,
  type TransactionFilters,
  type TransactionMasterData,
} from './transactionModel';

interface TransactionsPageProps {
  repository: TransactionRepository;
  masterData: TransactionMasterData;
  displaySettings: DisplaySettings;
  monthKey: MonthKey;
  revision: number;
  onMonthChange: (monthKey: MonthKey) => void;
  onChanged: () => void;
}

const EMPTY_FILTERS: TransactionFilters = {
  query: '',
  type: 'all',
  date: '',
  categoryKey: '',
  paymentMethodId: '',
};

function DialogFrame({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="sheet-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function TransactionDetail({
  transaction,
  masterData,
  onEdit,
  onDelete,
  onClose,
}: {
  transaction: Transaction;
  masterData: TransactionMasterData;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <DialogFrame title="収支の詳細" onClose={onClose}>
      <dl className="detail-list">
        <div><dt>種類</dt><dd>{transaction.type === 'expense' ? '支出' : '収入'}</dd></div>
        <div><dt>金額</dt><dd className={transaction.type}>{transaction.type === 'expense' ? '−' : '＋'}{formatYen(transaction.amountYen)}</dd></div>
        <div><dt>日付</dt><dd>{formatLocalDate(transaction.date)}</dd></div>
        <div><dt>カテゴリ</dt><dd>{categoryName(transaction, masterData)}</dd></div>
        {transaction.type === 'expense' && (
          <>
            <div><dt>支払い方法</dt><dd>{paymentMethodName(transaction, masterData)}</dd></div>
            <div><dt>店名</dt><dd>{transaction.merchant === '' ? '未入力' : transaction.merchant}</dd></div>
          </>
        )}
        <div><dt>内容</dt><dd>{transaction.content === '' ? '未入力' : transaction.content}</dd></div>
      </dl>
      <div className="form-actions">
        <button type="button" className="danger-button" onClick={onDelete}>削除</button>
        <button type="button" className="primary-button" onClick={onEdit}>編集</button>
      </div>
    </DialogFrame>
  );
}

export function TransactionsPage({
  repository,
  masterData,
  displaySettings,
  monthKey,
  revision,
  onMonthChange,
  onChanged,
}: TransactionsPageProps): React.JSX.Element {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async (): Promise<void> => {
    setIsLoading(true);
    setLoadError('');
    try {
      setTransactions(await repository.listByMonth(monthKey));
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : '収支を読み込めませんでした。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    setIsLoading(true);
    setLoadError('');
    void repository
      .listByMonth(monthKey)
      .then((items) => {
        if (!disposed) setTransactions(items);
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : '収支を読み込めませんでした。');
        }
      })
      .finally(() => {
        if (!disposed) setIsLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [monthKey, repository, revision]);

  const filteredTransactions = useMemo(
    () => applyTransactionFilters(transactions, filters),
    [transactions, filters],
  );
  const groups = useMemo(
    () => groupTransactionsByDate(filteredTransactions),
    [filteredTransactions],
  );
  const visibleFields = useMemo(
    () => new Set(displaySettings.transactionListFields),
    [displaySettings.transactionListFields],
  );

  const changeMonth = (delta: number): void => {
    onMonthChange(shiftMonthKey(monthKey, delta));
    setFilters((current) => ({ ...current, date: '' }));
    setSelected(null);
  };

  const closeDialog = (): void => {
    setSelected(null);
    setIsEditing(false);
    setIsDeleting(false);
  };

  const handleDelete = async (): Promise<void> => {
    if (selected === null) return;
    await repository.delete(selected.id);
    closeDialog();
    await load();
    onChanged();
  };

  return (
    <div className="page-stack">
      <section className="month-card" aria-label="表示する月">
        <button type="button" className="icon-button" aria-label="前の月" onClick={() => changeMonth(-1)}>‹</button>
        <strong>{formatMonthKey(monthKey)}</strong>
        <button type="button" className="icon-button" aria-label="次の月" onClick={() => changeMonth(1)}>›</button>
      </section>

      <section className="filter-card">
        <label className="search-field">
          <span className="sr-only">店名・内容を検索</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.currentTarget.value }))}
            placeholder="店名・内容を検索"
          />
        </label>
        <div className="filter-grid">
          <label><span>種類</span><select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.currentTarget.value as TransactionFilters['type'] }))}><option value="all">すべて</option><option value="expense">支出</option><option value="income">収入</option></select></label>
          <label><span>日付</span><input type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.currentTarget.value }))} /></label>
          <label><span>カテゴリ</span><select value={filters.categoryKey} onChange={(event) => setFilters((current) => ({ ...current, categoryKey: event.currentTarget.value }))}><option value="">すべて</option><optgroup label="支出">{masterData.expenseCategories.map((category) => <option key={category.id} value={categoryKey('expense', category.id)}>{category.name}</option>)}</optgroup><optgroup label="収入">{masterData.incomeCategories.map((category) => <option key={category.id} value={categoryKey('income', category.id)}>{category.name}</option>)}</optgroup></select></label>
          <label><span>支払い方法</span><select value={filters.paymentMethodId} onChange={(event) => setFilters((current) => ({ ...current, paymentMethodId: event.currentTarget.value }))}><option value="">すべて</option>{masterData.paymentMethods.map((paymentMethod) => <option key={paymentMethod.id} value={paymentMethod.id}>{paymentMethod.name}</option>)}</select></label>
        </div>
        <div className="filter-footer"><span>{filteredTransactions.length}件</span><button type="button" className="text-button" onClick={() => setFilters(EMPTY_FILTERS)}>条件をクリア</button></div>
      </section>

      {!isLoading && loadError === '' && displaySettings.showFilteredSummary && (
        <TransactionsAnalyticsPanel
          transactions={filteredTransactions}
          masterData={masterData}
        />
      )}

      {isLoading && <section className="empty-panel"><p>読み込み中…</p></section>}
      {loadError !== '' && <section className="empty-panel" role="alert"><h2>読み込めませんでした</h2><p>{loadError}</p><button type="button" className="secondary-button" onClick={() => void load()}>再試行</button></section>}
      {!isLoading && loadError === '' && groups.length === 0 && <section className="empty-panel"><h2>記録がありません</h2><p>条件に一致する収支はありません。登録タブから追加できます。</p></section>}

      {!isLoading && loadError === '' && groups.map((group) => (
        <section className="date-group" key={group.date}>
          <h2>{formatLocalDate(group.date)}</h2>
          <div className="transaction-list">
            {group.transactions.map((transaction) => {
              const category = categoryName(transaction, masterData);
              const paymentMethod = paymentMethodName(transaction, masterData);
              const title = transaction.content || (transaction.type === 'expense' ? transaction.merchant : '') || category;
              return (
                <button key={transaction.id} type="button" className="transaction-row" onClick={() => setSelected(transaction)} aria-label={`${formatYen(transaction.amountYen)} ${category} ${title}`}>
                  <div className="transaction-main">
                    <strong>{title}</strong>
                    <div className="transaction-meta">
                      {visibleFields.has('category') && <span>{category}</span>}
                      {transaction.type === 'expense' && visibleFields.has('paymentMethod') && <span>{paymentMethod}</span>}
                      {transaction.type === 'expense' && visibleFields.has('merchant') && transaction.merchant !== '' && <span>{transaction.merchant}</span>}
                      {visibleFields.has('content') && transaction.content !== '' && <span>{transaction.content}</span>}
                    </div>
                  </div>
                  {visibleFields.has('amount') && <strong className={`transaction-amount ${transaction.type}`}>{transaction.type === 'expense' ? '−' : '＋'}{formatYen(transaction.amountYen)}</strong>}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {selected !== null && !isEditing && !isDeleting && <TransactionDetail transaction={selected} masterData={masterData} onEdit={() => setIsEditing(true)} onDelete={() => setIsDeleting(true)} onClose={closeDialog} />}
      {selected !== null && isEditing && <DialogFrame title="収支を編集" onClose={closeDialog}><TransactionForm masterData={masterData} transaction={selected} onCancel={() => setIsEditing(false)} onSubmit={async (input) => { const updated = await repository.replace(selected.id, input); setSelected(updated); setIsEditing(false); await load(); onChanged(); }} /></DialogFrame>}
      {selected !== null && isDeleting && <DialogFrame title="収支を削除" onClose={() => setIsDeleting(false)}><div className="confirm-message"><p><strong>{formatYen(selected.amountYen)}</strong>の記録を削除します。</p><p>この操作は元に戻せません。</p></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setIsDeleting(false)}>キャンセル</button><button type="button" className="danger-button" onClick={() => void handleDelete()}>削除する</button></div></DialogFrame>}
    </div>
  );
}
