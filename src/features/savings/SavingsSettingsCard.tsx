import { useEffect, useState, type FormEvent } from 'react';
import type { SavingsSettings } from '../../domain/models';
import type { SavingsRepository } from '../../data/repositories/savingsRepository';
import { MoneyInput } from '../calculator/MoneyInput';
import {
  parseSavingsBalance,
  parseSavingsGoalAmount,
} from './savingsModel';

interface SavingsSettingsCardProps {
  settings: SavingsSettings;
  repository: SavingsRepository;
  onChanged: () => Promise<void>;
}

export function SavingsSettingsCard({
  settings,
  repository,
  onChanged,
}: SavingsSettingsCardProps): React.JSX.Element {
  const [balance, setBalance] = useState(String(settings.balanceYen));
  const [goalName, setGoalName] = useState(settings.goalName);
  const [goalAmount, setGoalAmount] = useState(
    settings.goalAmountYen === null ? '' : String(settings.goalAmountYen),
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  useEffect(() => {
    setBalance(String(settings.balanceYen));
    setGoalName(settings.goalName);
    setGoalAmount(settings.goalAmountYen === null ? '' : String(settings.goalAmountYen));
  }, [settings]);

  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setMessage('');
    setError('');

    const parsedBalance = parseSavingsBalance(balance);
    if (!parsedBalance.ok) {
      setError(parsedBalance.message);
      return;
    }

    const parsedGoal = parseSavingsGoalAmount(goalAmount);
    if (!parsedGoal.ok) {
      setError(parsedGoal.message);
      return;
    }

    setIsSaving(true);
    try {
      await repository.updateSettings({
        balanceYen: parsedBalance.amountYen,
        goalName,
        goalAmountYen: parsedGoal.amountYen,
      });
      await onChanged();
      setMessage('貯金額と目標を保存しました。');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : '貯金設定を保存できませんでした。',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const clearGoal = async (): Promise<void> => {
    setMessage('');
    setError('');
    setIsSaving(true);
    try {
      await repository.clearGoal();
      await onChanged();
      setShowDeleteConfirmation(false);
      setMessage('貯金目標を削除しました。現在の貯金額は残しています。');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : '貯金目標を削除できませんでした。',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="savings-settings-card" aria-labelledby="savings-settings-title">
      <header className="savings-card-heading">
        <div>
          <p className="kicker">SAVINGS</p>
          <h2 id="savings-settings-title">貯金額・目標</h2>
        </div>
        <span className="local-only-badge">端末内保存</span>
      </header>

      <p className="savings-description">
        現在の貯金残高を手入力します。収入と支出から自動計算はしません。
      </p>

      {(message !== '' || error !== '') && (
        <div
          className={error === '' ? 'status-message success' : 'status-message error'}
          role="status"
        >
          {error === '' ? message : error}
        </div>
      )}

      <form className="savings-form" onSubmit={(event) => void save(event)} noValidate>
        <label htmlFor="savings-balance">現在の貯金額</label>
        <MoneyInput
          id="savings-balance"
          value={balance}
          minimumYen={0}
          onValueChange={(value) => {
            setBalance(value);
            setError('');
          }}
          calculatorLabel="現在の貯金額を電卓で計算"
        />

        <div className="savings-goal-fields">
          <div className="savings-goal-field">
            <label htmlFor="savings-goal-name">目標名</label>
            <input
              id="savings-goal-name"
              type="text"
              maxLength={40}
              value={goalName}
              placeholder="例：旅行資金"
              onChange={(event) => {
                setGoalName(event.currentTarget.value);
                setError('');
              }}
            />
          </div>
          <div className="savings-goal-field">
            <label htmlFor="savings-goal-amount">目標金額</label>
            <MoneyInput
              id="savings-goal-amount"
              value={goalAmount}
              placeholder="100000"
              onValueChange={(value) => {
                setGoalAmount(value);
                setError('');
              }}
              calculatorLabel="貯金の目標金額を電卓で計算"
            />
          </div>
        </div>

        <p className="savings-form-note">
          目標を設定する場合は、目標名と目標金額の両方を入力してください。
        </p>

        <div className="savings-form-actions">
          {settings.goalAmountYen !== null && (
            <button
              type="button"
              className="danger-text-button"
              disabled={isSaving}
              onClick={() => setShowDeleteConfirmation(true)}
            >
              目標を削除
            </button>
          )}
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? '保存中…' : '貯金設定を保存'}
          </button>
        </div>
      </form>

      {showDeleteConfirmation && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="sheet-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="貯金目標を削除"
          >
            <header className="sheet-header">
              <h2>貯金目標を削除</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="閉じる"
                disabled={isSaving}
                onClick={() => setShowDeleteConfirmation(false)}
              >
                ×
              </button>
            </header>
            <div className="confirm-message">
              <p>目標名と目標金額を削除します。</p>
              <p>現在の貯金額は削除されません。</p>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={isSaving}
                onClick={() => setShowDeleteConfirmation(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={isSaving}
                onClick={() => void clearGoal()}
              >
                削除する
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
