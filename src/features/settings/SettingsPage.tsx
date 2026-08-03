import { useState, type FormEvent } from 'react';
import type {
  BudgetSettings,
  DisplaySettings,
  PaymentMethod,
  PaymentMethodKind,
  TransactionListField,
} from '../../domain/models';
import type { BudgetRepository } from '../../data/repositories/budgetRepository';
import type { MasterDataRepository } from '../../data/repositories/masterDataRepository';
import type { SettingsRepository } from '../../data/repositories/settingsRepository';
import {
  LIST_FIELD_LABELS,
  LIST_FIELD_ORDER,
  type TransactionMasterData,
} from '../transactions/transactionModel';

interface SettingsPageProps {
  masterData: TransactionMasterData;
  displaySettings: DisplaySettings;
  budgetSettings: BudgetSettings;
  masterDataRepository: MasterDataRepository;
  settingsRepository: SettingsRepository;
  budgetRepository: BudgetRepository;
  onChanged: () => Promise<void>;
}

const PAYMENT_KIND_LABELS: Readonly<
  Record<Exclude<PaymentMethodKind, 'system-unset'>, string>
> = {
  cash: '現金',
  'credit-card': 'クレジットカード',
  'electronic-money': '電子マネー',
  'bank-transfer': '銀行振込',
  other: 'その他',
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'ConstraintError') {
    return '同じ名前がすでに登録されています。';
  }
  return error instanceof Error ? error.message : '操作を完了できませんでした。';
}

export function SettingsPage({
  masterData,
  displaySettings,
  budgetSettings,
  masterDataRepository,
  settingsRepository,
  budgetRepository,
  onChanged,
}: SettingsPageProps): React.JSX.Element {
  const [expenseName, setExpenseName] = useState('');
  const [incomeName, setIncomeName] = useState('');
  const [paymentName, setPaymentName] = useState('');
  const [paymentKind, setPaymentKind] = useState<Exclude<PaymentMethodKind, 'system-unset'>>('other');
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentMethod | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (operation: () => Promise<void>, success: string): Promise<void> => {
    setError('');
    setMessage('');
    try {
      await operation();
      await onChanged();
      setMessage(success);
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    }
  };

  const toggleField = async (field: TransactionListField): Promise<void> => {
    const current = displaySettings.transactionListFields;
    const next = current.includes(field)
      ? current.filter((item) => item !== field)
      : LIST_FIELD_ORDER.filter((item) => item === field || current.includes(item));

    if (next.length === 0) {
      setError('一覧には1項目以上を表示してください。');
      return;
    }

    await run(
      async () => {
        await settingsRepository.updateDisplaySettings({ transactionListFields: next });
      },
      '一覧の表示項目を更新しました。',
    );
  };

  const toggleMonthlyCarryover = async (): Promise<void> => {
    await run(
      async () => {
        await budgetRepository.updateSettings({
          monthlyCarryoverEnabled: !budgetSettings.monthlyCarryoverEnabled,
        });
      },
      budgetSettings.monthlyCarryoverEnabled
        ? '月全体予算の繰越をOFFにしました。'
        : '月全体予算の繰越をONにしました。',
    );
  };

  const toggleCategoryCarryover = async (): Promise<void> => {
    await run(
      async () => {
        await budgetRepository.updateSettings({
          categoryCarryoverEnabled: !budgetSettings.categoryCarryoverEnabled,
        });
      },
      budgetSettings.categoryCarryoverEnabled
        ? 'カテゴリ別予算の繰越をOFFにしました。'
        : 'カテゴリ別予算の繰越をONにしました。',
    );
  };

  const addExpenseCategory = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await run(async () => {
      await masterDataRepository.createExpenseCategory(expenseName);
      setExpenseName('');
    }, '支出カテゴリを追加しました。');
  };

  const addIncomeCategory = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await run(async () => {
      await masterDataRepository.createIncomeCategory(incomeName);
      setIncomeName('');
    }, '収入カテゴリを追加しました。');
  };

  const addPaymentMethod = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await run(async () => {
      await masterDataRepository.createPaymentMethod(paymentName, paymentKind);
      setPaymentName('');
      setPaymentKind('other');
    }, '支払い方法を追加しました。');
  };

  return (
    <div className="page-stack">
      {(message !== '' || error !== '') && (
        <div className={error === '' ? 'status-message success' : 'status-message error'} role="status">
          {error === '' ? message : error}
        </div>
      )}

      <section className="settings-card">
        <h2>一覧の表示項目</h2>
        <p className="settings-description">日付はグループ見出しとして常に表示されます。</p>
        <div className="checkbox-list">
          {LIST_FIELD_ORDER.map((field) => (
            <label key={field}>
              <input
                type="checkbox"
                checked={displaySettings.transactionListFields.includes(field)}
                onChange={() => void toggleField(field)}
              />
              <span>{LIST_FIELD_LABELS[field]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2>予算の繰越</h2>
        <p className="settings-description">
          前月の正の残額だけを翌月へ加えます。超過額は繰り越しません。
        </p>
        <div className="settings-toggle-list">
          <label className="settings-toggle">
            <span>
              <strong>月全体予算</strong>
              <small>月全体の未使用予算を翌月へ繰り越す</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={budgetSettings.monthlyCarryoverEnabled}
              onChange={() => void toggleMonthlyCarryover()}
            />
          </label>
          <label className="settings-toggle">
            <span>
              <strong>カテゴリ別予算</strong>
              <small>カテゴリごとの未使用予算を翌月へ繰り越す</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={budgetSettings.categoryCarryoverEnabled}
              onChange={() => void toggleCategoryCarryover()}
            />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h2>支出カテゴリ</h2>
        <form className="inline-form" onSubmit={(event) => void addExpenseCategory(event)}>
          <label><span className="sr-only">新しい支出カテゴリ</span><input value={expenseName} onChange={(event) => setExpenseName(event.currentTarget.value)} placeholder="カテゴリ名" maxLength={40} /></label>
          <button className="primary-button" type="submit">追加</button>
        </form>
        <ul className="master-list">
          {masterData.expenseCategories.map((category) => (
            <li key={category.id}>
              <div><strong>{category.name}</strong><small>{category.usageCount}件で使用{category.isActive ? '' : '・非表示'}</small></div>
              <button type="button" className="text-button" onClick={() => void run(() => masterDataRepository.setExpenseCategoryActive(category.id, !category.isActive), category.isActive ? 'カテゴリを非表示にしました。' : 'カテゴリを再表示しました。')}>{category.isActive ? '非表示' : '再表示'}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2>収入カテゴリ</h2>
        <form className="inline-form" onSubmit={(event) => void addIncomeCategory(event)}>
          <label><span className="sr-only">新しい収入カテゴリ</span><input value={incomeName} onChange={(event) => setIncomeName(event.currentTarget.value)} placeholder="カテゴリ名" maxLength={40} /></label>
          <button className="primary-button" type="submit">追加</button>
        </form>
        <ul className="master-list">
          {masterData.incomeCategories.map((category) => (
            <li key={category.id}>
              <div><strong>{category.name}</strong><small>{category.usageCount}件で使用{category.isActive ? '' : '・非表示'}</small></div>
              <button type="button" className="text-button" onClick={() => void run(() => masterDataRepository.setIncomeCategoryActive(category.id, !category.isActive), category.isActive ? 'カテゴリを非表示にしました。' : 'カテゴリを再表示しました。')}>{category.isActive ? '非表示' : '再表示'}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2>支払い方法</h2>
        <form className="payment-form" onSubmit={(event) => void addPaymentMethod(event)}>
          <label><span>名前</span><input value={paymentName} onChange={(event) => setPaymentName(event.currentTarget.value)} placeholder="例：PayPay" maxLength={40} /></label>
          <label><span>種類</span><select value={paymentKind} onChange={(event) => setPaymentKind(event.currentTarget.value as Exclude<PaymentMethodKind, 'system-unset'>)}>{Object.entries(PAYMENT_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="primary-button" type="submit">追加</button>
        </form>
        <ul className="master-list">
          {masterData.paymentMethods.map((paymentMethod) => (
            <li key={paymentMethod.id}>
              <div><strong>{paymentMethod.name}</strong><small>{paymentMethod.isSystem ? 'システム管理' : `${paymentMethod.usageCount}件で使用`}</small></div>
              {!paymentMethod.isSystem && <button type="button" className="danger-text-button" onClick={() => setPaymentToDelete(paymentMethod)}>削除</button>}
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2>アプリ情報</h2>
        <dl>
          <div><dt>アプリ名</dt><dd>My家計簿</dd></div>
          <div><dt>保存方式</dt><dd>IndexedDB（この端末）</dd></div>
          <div><dt>外部送信</dt><dd>なし</dd></div>
        </dl>
      </section>

      <section className="notice-card">
        <h2>旧版データ</h2>
        <p>以前のLocalStorage記録は自動変換せず、確認・書き出し用の旧版画面を残しています。</p>
        <a className="legacy-link" href={`${import.meta.env.BASE_URL}legacy/index.html`}>旧版の家計簿を開く</a>
      </section>

      {paymentToDelete !== null && (
        <div className="dialog-backdrop" role="presentation">
          <section className="sheet-dialog" role="dialog" aria-modal="true" aria-label="支払い方法を削除">
            <header className="sheet-header"><h2>支払い方法を削除</h2><button type="button" className="icon-button" aria-label="閉じる" onClick={() => setPaymentToDelete(null)}>×</button></header>
            <div className="confirm-message"><p><strong>{paymentToDelete.name}</strong>を削除します。</p>{paymentToDelete.usageCount > 0 && <p>過去の{paymentToDelete.usageCount}件は「未設定」に変更されます。</p>}</div>
            <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setPaymentToDelete(null)}>キャンセル</button><button type="button" className="danger-button" onClick={() => void run(async () => { await masterDataRepository.deletePaymentMethod(paymentToDelete.id); setPaymentToDelete(null); }, '支払い方法を削除しました。')}>削除する</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
