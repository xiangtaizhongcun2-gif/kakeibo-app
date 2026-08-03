import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ExpenseCategory, MonthKey, Transaction } from '../../domain/models';
import type {
  BudgetMonthData,
  BudgetRepository,
} from '../../data/repositories/budgetRepository';
import type { TransactionRepository } from '../../data/repositories/transactionRepository';
import {
  formatMonthKey,
  formatYen,
  shiftMonthKey,
} from '../transactions/transactionModel';
import { BudgetProgressCard } from './BudgetProgressCard';
import { buildBudgetOverview, parseBudgetAmount } from './budgetModel';

interface BudgetPageProps {
  budgetRepository: BudgetRepository;
  transactionRepository: TransactionRepository;
  expenseCategories: ExpenseCategory[];
  monthKey: MonthKey;
  revision: number;
  onMonthChange: (monthKey: MonthKey) => void;
  onChanged: () => void;
}

type BudgetEditorTarget =
  | {
      type: 'monthly';
      title: string;
      currentAmountYen: number | null;
    }
  | {
      type: 'category';
      title: string;
      expenseCategoryId: string;
      currentAmountYen: number | null;
    };

type BudgetDeleteTarget =
  | { type: 'monthly'; title: string }
  | { type: 'category'; title: string; expenseCategoryId: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '予算を更新できませんでした。';
}

export function BudgetPage({
  budgetRepository,
  transactionRepository,
  expenseCategories,
  monthKey,
  revision,
  onMonthChange,
  onChanged,
}: BudgetPageProps): React.JSX.Element {
  const [monthData, setMonthData] = useState<BudgetMonthData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState<BudgetEditorTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetDeleteTarget | null>(null);
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = async (): Promise<void> => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [nextMonthData, nextTransactions] = await Promise.all([
        budgetRepository.getMonthData(monthKey),
        transactionRepository.listByMonth(monthKey),
      ]);
      setMonthData(nextMonthData);
      setTransactions(nextTransactions);
    } catch (error: unknown) {
      setLoadError(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    setIsLoading(true);
    setLoadError('');
    void Promise.all([
      budgetRepository.getMonthData(monthKey),
      transactionRepository.listByMonth(monthKey),
    ])
      .then(([nextMonthData, nextTransactions]) => {
        if (disposed) return;
        setMonthData(nextMonthData);
        setTransactions(nextTransactions);
      })
      .catch((error: unknown) => {
        if (!disposed) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!disposed) setIsLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [budgetRepository, monthKey, revision, transactionRepository]);

  const overview = useMemo(
    () =>
      monthData === null
        ? null
        : buildBudgetOverview(
            monthData.monthlyBudget,
            monthData.categoryBudgets,
            transactions,
            expenseCategories,
          ),
    [expenseCategories, monthData, transactions],
  );

  const categoryProgressById = useMemo(
    () => new Map(overview?.categories.map((item) => [item.expenseCategoryId, item]) ?? []),
    [overview],
  );

  const orderedCategories = useMemo(
    () =>
      [...expenseCategories].sort((left, right) => {
        const leftHasBudget = categoryProgressById.has(left.id);
        const rightHasBudget = categoryProgressById.has(right.id);
        if (leftHasBudget !== rightHasBudget) return leftHasBudget ? -1 : 1;
        if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
        return left.name.localeCompare(right.name, 'ja');
      }),
    [categoryProgressById, expenseCategories],
  );

  const openEditor = (target: BudgetEditorTarget): void => {
    setEditor(target);
    setAmount(target.currentAmountYen === null ? '' : String(target.currentAmountYen));
    setFormError('');
    setStatusMessage('');
  };

  const saveBudget = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (editor === null) return;
    const parsed = parseBudgetAmount(amount);
    if (!parsed.ok) {
      setFormError(parsed.message);
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      if (editor.type === 'monthly') {
        await budgetRepository.setMonthlyBudget(monthKey, parsed.amountYen);
      } else {
        await budgetRepository.setCategoryBudget(
          monthKey,
          editor.expenseCategoryId,
          parsed.amountYen,
        );
      }
      setEditor(null);
      setStatusMessage(`${editor.title}を保存しました。`);
      await load();
      onChanged();
    } catch (error: unknown) {
      setFormError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBudget = async (): Promise<void> => {
    if (deleteTarget === null) return;
    setIsSaving(true);
    setFormError('');
    try {
      if (deleteTarget.type === 'monthly') {
        await budgetRepository.deleteMonthlyBudget(monthKey);
      } else {
        await budgetRepository.deleteCategoryBudget(
          monthKey,
          deleteTarget.expenseCategoryId,
        );
      }
      const title = deleteTarget.title;
      setDeleteTarget(null);
      setStatusMessage(`${title}を削除しました。`);
      await load();
      onChanged();
    } catch (error: unknown) {
      setFormError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const changeMonth = (delta: number): void => {
    onMonthChange(shiftMonthKey(monthKey, delta));
    setStatusMessage('');
    setEditor(null);
    setDeleteTarget(null);
  };

  if (isLoading) return <section className="empty-panel"><p>予算を読み込み中…</p></section>;

  if (loadError !== '') {
    return (
      <section className="empty-panel" role="alert">
        <h2>予算を読み込めませんでした</h2>
        <p>{loadError}</p>
        <button type="button" className="secondary-button" onClick={() => void load()}>
          再試行
        </button>
      </section>
    );
  }

  if (monthData === null || overview === null) {
    return <section className="empty-panel"><p>予算データがありません。</p></section>;
  }

  return (
    <div className="page-stack">
      {statusMessage !== '' && (
        <div className="status-message success" role="status">{statusMessage}</div>
      )}

      <section className="month-card" aria-label="予算を表示する月">
        <button type="button" className="icon-button" aria-label="前の月" onClick={() => changeMonth(-1)}>‹</button>
        <div className="month-title">
          <small>BUDGET</small>
          <strong>{formatMonthKey(monthKey)}</strong>
        </div>
        <button type="button" className="icon-button" aria-label="次の月" onClick={() => changeMonth(1)}>›</button>
      </section>

      <section className="budget-rule-card">
        <div>
          <span>月全体の繰越</span>
          <strong>{monthData.settings.monthlyCarryoverEnabled ? 'ON' : 'OFF'}</strong>
        </div>
        <div>
          <span>カテゴリ別の繰越</span>
          <strong>{monthData.settings.categoryCarryoverEnabled ? 'ON' : 'OFF'}</strong>
        </div>
        <p>繰越設定は設定タブから変更できます。超過額は翌月へ繰り越しません。</p>
      </section>

      <section className="budget-section">
        <header className="budget-section-heading">
          <div>
            <p className="kicker">MONTHLY BUDGET</p>
            <h2>月全体予算</h2>
          </div>
        </header>
        {overview.monthly === null ? (
          <div className="budget-unset-card">
            <div>
              <strong>月予算は未設定です</strong>
              <p>毎月1日から月末までの支出上限を設定します。</p>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={() => openEditor({ type: 'monthly', title: '月全体予算', currentAmountYen: null })}
            >
              予算を設定
            </button>
          </div>
        ) : (
          <BudgetProgressCard
            title="月全体予算"
            progress={overview.monthly}
            actions={
              <div className="budget-card-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    openEditor({
                      type: 'monthly',
                      title: '月全体予算',
                      currentAmountYen: overview.monthly?.baseAmountYen ?? null,
                    })
                  }
                >
                  編集
                </button>
                <button
                  type="button"
                  className="danger-text-button"
                  onClick={() => setDeleteTarget({ type: 'monthly', title: '月全体予算' })}
                >
                  削除
                </button>
              </div>
            }
          />
        )}
      </section>

      <section className="budget-section">
        <header className="budget-section-heading">
          <div>
            <p className="kicker">CATEGORY BUDGETS</p>
            <h2>カテゴリ別予算</h2>
          </div>
          <span>{overview.categories.length}件設定</span>
        </header>
        <div className="category-budget-list">
          {orderedCategories.map((category) => {
            const progress = categoryProgressById.get(category.id);
            if (progress === undefined) {
              return (
                <article className="category-budget-unset" key={category.id}>
                  <div>
                    <strong>{category.name}</strong>
                    <small>{category.isActive ? '未設定' : '非表示カテゴリ・未設定'}</small>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      openEditor({
                        type: 'category',
                        title: `${category.name}の予算`,
                        expenseCategoryId: category.id,
                        currentAmountYen: null,
                      })
                    }
                  >
                    設定
                  </button>
                </article>
              );
            }

            return (
              <BudgetProgressCard
                key={category.id}
                title={category.name}
                progress={progress}
                compact
                actions={
                  <div className="budget-card-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        openEditor({
                          type: 'category',
                          title: `${category.name}の予算`,
                          expenseCategoryId: category.id,
                          currentAmountYen: progress.baseAmountYen,
                        })
                      }
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="danger-text-button"
                      onClick={() =>
                        setDeleteTarget({
                          type: 'category',
                          title: `${category.name}の予算`,
                          expenseCategoryId: category.id,
                        })
                      }
                    >
                      削除
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      </section>

      {editor !== null && (
        <div className="dialog-backdrop" role="presentation">
          <section className="sheet-dialog" role="dialog" aria-modal="true" aria-label={editor.title}>
            <header className="sheet-header">
              <div>
                <p className="kicker">{formatMonthKey(monthKey)}</p>
                <h2>{editor.title}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="閉じる" onClick={() => setEditor(null)}>×</button>
            </header>
            <form className="budget-form" onSubmit={(event) => void saveBudget(event)} noValidate>
              <label htmlFor="budget-amount">予算額</label>
              <div className="money-field">
                <span aria-hidden="true">¥</span>
                <input
                  id="budget-amount"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.currentTarget.value);
                    setFormError('');
                  }}
                  aria-invalid={formError !== ''}
                  required
                  autoFocus
                />
              </div>
              <p className="budget-form-note">月途中で変更した場合も、その月の全支出に対して新しい予算額を使用します。</p>
              {formError !== '' && <p className="form-error" role="alert">{formError}</p>}
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={() => setEditor(null)}>キャンセル</button>
                <button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? '保存中…' : '保存する'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget !== null && (
        <div className="dialog-backdrop" role="presentation">
          <section className="sheet-dialog" role="dialog" aria-modal="true" aria-label="予算を削除">
            <header className="sheet-header">
              <h2>予算を削除</h2>
              <button type="button" className="icon-button" aria-label="閉じる" onClick={() => setDeleteTarget(null)}>×</button>
            </header>
            <div className="confirm-message">
              <p><strong>{deleteTarget.title}</strong>を削除します。</p>
              <p>翌月以降の繰越額も再計算されます。</p>
            </div>
            {formError !== '' && <p className="form-error" role="alert">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)}>キャンセル</button>
              <button type="button" className="danger-button" disabled={isSaving} onClick={() => void deleteBudget()}>{isSaving ? '削除中…' : '削除する'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
