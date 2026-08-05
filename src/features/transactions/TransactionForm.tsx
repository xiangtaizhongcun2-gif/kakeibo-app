import { useId, useState, type FormEvent } from 'react';
import type { Transaction } from '../../domain/models';
import type { NewTransaction } from '../../data/repositories/transactionRepository';
import { MoneyInput } from '../calculator/MoneyInput';
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

function fieldError(
  errors: TransactionFormErrors,
  key: keyof TransactionFormErrors,
): string | undefined {
  return errors[key];
}

export function TransactionForm({
  masterData,
  transaction,
  submitLabel = transaction === undefined ? '登録する' : '変更を保存',
  onSubmit,
  onCancel,
}: TransactionFormProps): React.JSX.Element {
  const formId = useId();
  const amountId = `${formId}-amount`;
  const amountErrorId = `${formId}-amount-error`;
  const dateId = `${formId}-date`;
  const dateErrorId = `${formId}-date-error`;
  const categoryId = `${formId}-category`;
  const categoryErrorId = `${formId}-category-error`;
  const paymentMethodId = `${formId}-payment-method`;
  const paymentMethodErrorId = `${formId}-payment-method-error`;
  const merchantId = `${formId}-merchant`;
  const contentId = `${formId}-content`;

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
          onClick={() =>
            setState((current) => changeFormType(current, 'expense', masterData))
          }
        >
          支出
        </button>
        <button
          type="button"
          className={state.type === 'income' ? 'active' : ''}
          aria-pressed={state.type === 'income'}
          onClick={() =>
            setState((current) => changeFormType(current, 'income', masterData))
          }
        >
          収入
        </button>
      </div>

      <div className="form-field">
        <label htmlFor={amountId}>金額</label>
        <MoneyInput
          id={amountId}
          name="amount"
          value={state.amount}
          onValueChange={(value) => update('amount', value)}
          calculatorLabel="取引金額を電卓で計算"
          aria-invalid={fieldError(errors, 'amount') !== undefined}
          aria-describedby={
            fieldError(errors, 'amount') === undefined ? undefined : amountErrorId
          }
          required
        />
        {fieldError(errors, 'amount') !== undefined && (
          <small className="field-error" id={amountErrorId}>
            {fieldError(errors, 'amount')}
          </small>
        )}
      </div>

      <div className="form-field">
        <label htmlFor={dateId}>日付</label>
        <input
          id={dateId}
          name="date"
          type="date"
          value={state.date}
          onChange={(event) => update('date', event.currentTarget.value)}
          aria-invalid={fieldError(errors, 'date') !== undefined}
          aria-describedby={fieldError(errors, 'date') === undefined ? undefined : dateErrorId}
          required
        />
        {fieldError(errors, 'date') !== undefined && (
          <small className="field-error" id={dateErrorId}>
            {fieldError(errors, 'date')}
          </small>
        )}
      </div>

      <div className="form-field">
        <label htmlFor={categoryId}>カテゴリ</label>
        <select
          id={categoryId}
          name="category"
          value={state.categoryId}
          onChange={(event) => update('categoryId', event.currentTarget.value)}
          aria-invalid={fieldError(errors, 'categoryId') !== undefined}
          aria-describedby={
            fieldError(errors, 'categoryId') === undefined ? undefined : categoryErrorId
          }
          required
        >
          <option value="">選択してください</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id} disabled={!category.isActive}>
              {category.name}
              {category.isActive ? '' : '（非表示）'}
            </option>
          ))}
        </select>
        {fieldError(errors, 'categoryId') !== undefined && (
          <small className="field-error" id={categoryErrorId}>
            {fieldError(errors, 'categoryId')}
          </small>
        )}
      </div>

      {state.type === 'expense' && (
        <>
          <div className="form-field">
            <label htmlFor={paymentMethodId}>支払い方法</label>
            <select
              id={paymentMethodId}
              name="paymentMethod"
              value={state.paymentMethodId}
              onChange={(event) => update('paymentMethodId', event.currentTarget.value)}
              aria-invalid={fieldError(errors, 'paymentMethodId') !== undefined}
              aria-describedby={
                fieldError(errors, 'paymentMethodId') === undefined
                  ? undefined
                  : paymentMethodErrorId
              }
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
              <small className="field-error" id={paymentMethodErrorId}>
                {fieldError(errors, 'paymentMethodId')}
              </small>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={merchantId}>
              店名 <small>任意</small>
            </label>
            <input
              id={merchantId}
              name="merchant"
              type="text"
              maxLength={80}
              value={state.merchant}
              onChange={(event) => update('merchant', event.currentTarget.value)}
              placeholder="例：スーパー"
            />
          </div>
        </>
      )}

      <div className="form-field">
        <label htmlFor={contentId}>
          内容 <small>任意</small>
        </label>
        <input
          id={contentId}
          name="content"
          type="text"
          maxLength={120}
          value={state.content}
          onChange={(event) => update('content', event.currentTarget.value)}
          placeholder={state.type === 'expense' ? '例：食料品' : '例：8月分'}
        />
      </div>

      {formError !== '' && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}

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
