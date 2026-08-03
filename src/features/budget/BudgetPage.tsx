import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { BudgetSettings, MonthKey, MonthlyBudget, Transaction } from '../../domain/models';
import type { BudgetRepository } from '../../data/repositories/budgetRepository';
import type { TransactionRepository } from '../../data/repositories/transactionRepository';
import { formatMonthKey, shiftMonthKey } from '../transactions/transactionModel';
import { BudgetProgressCard } from './BudgetProgressCard';
import {
  createBudgetProgress,
  parseBudgetAmount,
  totalExpenseYen,
} from './budgetModel';

interface BudgetPageProps {
  budgetRepository: BudgetRepository;
  transactionRepository: TransactionRepository;
  monthKey: MonthKey;
  revision: number;
  onMonthChange: (monthKey: MonthKey) => void;
  onChanged: () => void;
}

interface BudgetPageData {
  settings: BudgetSettings;
  monthlyBudget: MonthlyBudget | null;
  transactions: Transaction[];
}

export function BudgetPage({
  budgetRepository,
  transactionRepository,
  monthKey,
  revision,
  onMonthChange,
  onChanged,
}: BudgetPageProps): React.JSX.Element {
  const [data, setData] = useState<BudgetPageData | null>(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const load = async (): Promise<void> => {
    setLoadError('');
    try {
      const [budgetData, transactions] = await Promise.all([
        budgetRepository.getMonthData(monthKey),
        transactionRepository.listByMonth(monthKey),
      ]);
      setData({ ...budgetData, transactions });
      setAmount(
        budgetData.monthlyBudget === null
          ? ''
          : String(budgetData.monthlyBudget.baseAmountYen),
      );
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error ? error.message : '予算を読み込めませんでした。',
      );
    }
  };

  useEffect(() => {
    void load();
  }, [monthKey, revision]);

  const progress = useMemo(() => {
    if (data === null || data.monthlyBudget === null) return null;
    return createBudgetProgress(data.monthlyBudget, totalExpenseYen(data.transactions));
  }, [data]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const parsed = parseBudgetAmount(amount);
    if (!parsed.ok) {
      setAmountError(parsed.message);
      return;
    }

    setIsSaving(true);
    setAmountError('');
    setMessage('');
    try {
      const hadBudget = data?.monthlyBudget !== null;
      await budgetRepository.setMonthlyBudget(monthKey, parsed.amountYen);
      await load();
      onChanged();
      setMessage(hadBudget ? '月予算を変更しました。' : '月予算を設定しました。');
    } catch (error: unknown) {
      setAmountError(error instanceof Error ? error.message : '予算を保存できませんでした。');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCarryover = async (enabled: boolean): Promise<void> => {
    setMessage('');
    try {
      await budgetRepository.updateSettings({ monthlyCarryoverEnabled: enabled });
      await load();
      onChanged();
      setMessage(enabled ? '予算の繰越を有効にしました。' : '予算の繰越を無効にしました。');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : '繰越設定を変更できませんでした。');
    }
  };

  const deleteBudget = async (): Promise<void> => {
    try {
      await budgetRepository.deleteMonthlyBudget(monthKey);
      setShowDeleteConfirmation(false);
      await load();
      onChanged();
      setMessage('月予算を削除しました。');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : '月予算を削除できませんでした。');
    }
  };

  return (
    <div className="page-stack">
      <section className="month-card" aria-label="予算を表示する月">
        <button
          type="button"
          className="icon-button"
          aria-label="前の月"
          onClick={() => onMonthChange(shiftMonthKey(monthKey, -1))}
        >
          ‹
        </button>
        <div className="month-title">
          <small>MONTHLY BUDGET</small>
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

      {message !== '' && <div className="status-message success" role="status">{message}</div>}
      {loadError !== '' && (
        <section className="empty-panel" role="alert">
          <h2>予算を読み込めませんでした</h2>
          <p>{loadError}</p>
          <button type="button" className="secondary-button" onClick={() => void load()}>
            再試行
          </button>
        </section>
      )}

      {data === null && loadError === '' && <section className="empty-panel"><p>予算を読み込み中…</p></section>}

      {data !== null && (
        <>
          <section className="budget-settings-card">
            <div>
              <h2>未使用予算の繰越</h2>
              <p>前月に残った予算を、翌月の予算へ自動で加算します。超過額は繰り越しません。</p>
            </div>
            <label className="switch-control">
              <input
                type="checkbox"
                checked={data.settings.monthlyCarryoverEnabled}
                onChange={(event) => void toggleCarryover(event.currentTarget.checked)}
              />
              <span aria-hidden="true" />
              <b>{data.settings.monthlyCarryoverEnabled ? 'ON' : 'OFF'}</b>
            </label>
          </section>

          {progress === null ? (
            <section className="budget-empty-card">
              <p className="kicker">BUDGET NOT SET</p>
              <h2>この月の予算は未設定です</h2>
              <p>月全体で使える金額を設定すると、使用率と残額を確認できます。</p>
            </section>
          ) : (
            <BudgetProgressCard
              title={`${formatMonthKey(monthKey)}の月予算`}
              progress={progress}
              actions={(
                <button
                  type="button"
                  className="danger-text-button"
                  onClick={() => setShowDeleteConfirmation(true)}
                >
                  削除
                </button>
              )}
            />
          )}

          <section className="budget-form-card">
            <div className="section-heading">
              <div>
                <p className="kicker">BASE BUDGET</p>
                <h2>{data.monthlyBudget === null ? '月予算を設定' : '月予算を変更'}</h2>
              </div>
            </div>
            <form className="budget-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
              <label htmlFor="monthly-budget-amount">予算額</label>
              <div className="money-field">
                <span aria-hidden="true">¥</span>
                <input
                  id="monthly-budget-amount"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.currentTarget.value);
                    setAmountError('');
                  }}
                  aria-invalid={amountError !== ''}
                  aria-describedby={amountError === '' ? undefined : 'monthly-budget-error'}
                />
              </div>
              {amountError !== '' && (
                <small id="monthly-budget-error" className="field-error">{amountError}</small>
              )}
              <p className="budget-form-note">
                月の途中でも変更できます。変更後の金額を基準に、残額と使用率を再計算します。
              </p>
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? '保存中…' : data.monthlyBudget === null ? '予算を設定' : '変更を保存'}
              </button>
            </form>
          </section>
        </>
      )}

      {showDeleteConfirmation && (
        <div className="dialog-backdrop" role="presentation">
          <section className="sheet-dialog" role="dialog" aria-modal="true" aria-label="月予算を削除">
            <header className="sheet-header">
              <h2>月予算を削除</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="閉じる"
                onClick={() => setShowDeleteConfirmation(false)}
              >
                ×
              </button>
            </header>
            <div className="confirm-message">
              <p>{formatMonthKey(monthKey)}の月予算を削除します。</p>
              <p>翌月以降の繰越額も再計算されます。</p>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setShowDeleteConfirmation(false)}>
                キャンセル
              </button>
              <button type="button" className="danger-button" onClick={() => void deleteBudget()}>
                削除する
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
