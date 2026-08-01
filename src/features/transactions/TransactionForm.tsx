import { useState, type FormEvent } from 'react';
import type { Transaction } from '../../domain/models';
import type { NewTransaction } from '../../data/repositories/transactionRepository';
import {
  buildTransactionInput,
  changeFormType,
  createFormState,
  type TransactionFormErrors,
  type TransactionFormState,
  type TransactionMasterData,
} from './transactionModel';

interface TransactionFormProps {
  masterData: TransactionMasterData;
  transaction?: Transaction;
  submitLabel?: string;
  onSubmit: (input: NewTransaction) => Promise<void>;
  onCancel?: () => void;
}

function fieldError(errors: TransactionFormErrors, key: keyof TransactionFormErrors): string | undefined {
  return errors[key];
}

export function TransactionForm({
  masterData,
  transaction,
  submitLabel = transaction === undefined ? '登録する' : '変更を保存',
  onSubmit,
  onCancel,
}: TransactionFormProps): React.JSX.Element {
  const [state, setState] = useState<TransactionFormState>(() =>
    createFormState(masterData, transaction),
  );
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = <K extends keyof TransactionFormState>(
    key: K,
    value: TransactionFormState[K],
  ): void => {
    setState((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const result = buildTransactionInput(state);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await onSubmit(result.value);
      if (transaction === undefined) setState(createFormState(masterData));
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : '保存できませんでした。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories =
    state.type === 'expense' ? masterData.expenseCategories : masterData.incomeCategories;

  return (
    <form className="transaction-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className="type-segment" aria-label="収支の種類">
        <button
          type="button"
          className={state.type === 'expense' ? 'active' : ''}
          aria-pressed={state.type === 'expense'}
          onClick={() => setState((current) => changeFormType(current, 'expense', masterData))}
        >
          支出
        </button>
        <button
          type="button"
          className={state.type === 'income' ? 'active' : ''}
          aria-pressed={state.type === 'income'}
          onClick={() => setState((current) => changeFormType(current, 'income', masterData))}
        >
          収入
        </button>
      </div>

      <label className="form-field">
        <span>金額</span>
        <div className="money-field">
          <span aria-hidden="true">¥</span>
          <input
            name="amount"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={state.amount}
            onChange={(event) => update('amount', event.currentTarget.value)}
            aria-invalid={fieldError(errors, 'amount') !== undefined}
            aria-describedby={fieldError(errors, 'amount') === undefined ? undefined : 'amount-error'}
            required
          />
        </div>
        {fieldError(errors, 'amount') !== undefined && (
          <small className="field-error" id="amount-error">
            {fieldError(errors, 'amount')}
          </small>
        )}
      </label>

      <label className="form-field">
        <span>日付</span>
        <input
          name="date"
          type="date"
          value={state.date}
          onChange={(event) => update('date', event.currentTarget.value)}
          aria-invalid={fieldError(errors, 'date') !== undefined}
          aria-describedby={fieldError(errors, 'date') === undefined ? undefined : 'date-error'}
          required
        />
        {fieldError(errors, 'date') !== undefined && (
          <small className="field-error" id="date-error">
            {fieldError(errors, 'date')}
          </small>
        )}
      </label>

      <label className="form-field">
        <span>カテゴリ</span>
        <select
          name="category"
          value={state.categoryId}
          onChange={(event) => update('categoryId', event.currentTarget.value)}
          aria-invalid={fieldError(errors, 'categoryId') !== undefined}
          required
        >
          <option value="">選択してください</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id} disabled={!category.isActive}>
              {category.name}{category.isActive ? '' : '（非表示）'}
            </option>
          ))}
        </select>
        {fieldError(errors, 'categoryId') !== undefined && (
          <small className="field-error">{fieldError(errors, 'categoryId')}</small>
        )}
      </label>

      {state.type === 'expense' && (
        <>
          <label className="form-field">
            <span>支払い方法</span>
            <select
              name="paymentMethod"
              value={state.paymentMethodId}
              onChange={(event) => update('paymentMethodId', event.currentTarget.value)}
              aria-invalid={fieldError(errors, 'paymentMethodId') !== undefined}
              required
            >
              <option value="">選択してください</option>
              {masterData.paymentMethods.map((paymentMethod) => (
                <option
                  key={paymentMethod.id}
                  value={paymentMethod.id}
                  disabled={!paymentMethod.isActive}
                >
                  {paymentMethod.name}
                </option>
              ))}
            </select>
            {fieldError(errors, 'paymentMethodId') !== undefined && (
              <small className="field-error">{fieldError(errors, 'paymentMethodId')}</small>
            )}
          </label>

          <label className="form-field">
            <span>店名 <small>任意</small></span>
            <input
              name="merchant"
              type="text"
              maxLength={80}
              value={state.merchant}
              onChange={(event) => update('merchant', event.currentTarget.value)}
              placeholder="例：スーパー"
            />
          </label>
        </>
      )}

      <label className="form-field">
        <span>内容 <small>任意</small></span>
        <input
          name="content"
          type="text"
          maxLength={120}
          value={state.content}
          onChange={(event) => update('content', event.currentTarget.value)}
          placeholder={state.type === 'expense' ? '例：食料品' : '例：8月分'}
        />
      </label>

      {formError !== '' && <p className="form-error" role="alert">{formError}</p>}

      <div className="form-actions">
        {onCancel !== undefined && (
          <button type="button" className="secondary-button" onClick={onCancel}>
            キャンセル
          </button>
        )}
        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
