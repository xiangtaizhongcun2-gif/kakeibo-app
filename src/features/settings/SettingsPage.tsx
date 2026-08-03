import { useState, type FormEvent } from 'react';
import type {
  DisplaySettings,
  PaymentMethod,
  PaymentMethodKind,
  TransactionListField,
} from '../../domain/models';
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
  masterDataRepository: MasterDataRepository;
  settingsRepository: SettingsRepository;
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
  masterDataRepository,
  settingsRepository,
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
        <h2>支出カテゴリ</h2>
        <p className="settings-description">
          矢印で変更した順番が、登録画面のカテゴリ選択にも反映されます。
        </p>
        <form className="inline-form" onSubmit={(event) => void addExpenseCategory(event)}>
          <label>
            <span className="sr-only">新しい支出カテゴリ</span>
            <input
              value={expenseName}
              onChange={(event) => setExpenseName(event.currentTarget.value)}
              placeholder="カテゴリ名"
              maxLength={40}
            />
          </label>
          <button className="primary-button" type="submit">追加</button>
        </form>
        <ul className="master-list category-sortable-list">
          {masterData.expenseCategories.map((category, index) => (
            <li key={category.id}>
              <div className="category-list-copy">
                <strong>{category.name}</strong>
                <small>{category.usageCount}件で使用{category.isActive ? '' : '・非表示'}</small>
              </div>
              <div className="category-list-actions">
                <button
                  type="button"
                  className="category-order-button"
                  aria-label={`${category.name}を上へ`}
                  title="上へ"
                  disabled={index === 0}
                  onClick={() => void run(
                    () => masterDataRepository.moveExpenseCategory(category.id, 'up'),
                    '支出カテゴリの順番を変更しました。',
                  )}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="category-order-button"
                  aria-label={`${category.name}を下へ`}
                  title="下へ"
                  disabled={index === masterData.expenseCategories.length - 1}
                  onClick={() => void run(
                    () => masterDataRepository.moveExpenseCategory(category.id, 'down'),
                    '支出カテゴリの順番を変更しました。',
                  )}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-button category-visibility-button"
                  onClick={() => void run(
                    () => masterDataRepository.setExpenseCategoryActive(
                      category.id,
                      !category.isActive,
                    ),
                    category.isActive
                      ? 'カテゴリを非表示にしました。'
                      : 'カテゴリを再表示しました。',
                  )}
                >
                  {category.isActive ? '非表示' : '再表示'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2>収入カテゴリ</h2>
        <p className="settings-description">
          矢印で変更した順番が、登録画面のカテゴリ選択にも反映されます。
        </p>
        <form className="inline-form" onSubmit={(event) => void addIncomeCategory(event)}>
          <label>
            <span className="sr-only">新しい収入カテゴリ</span>
            <input
              value={incomeName}
              onChange={(event) => setIncomeName(event.currentTarget.value)}
              placeholder="カテゴリ名"
              maxLength={40}
            />
          </label>
          <button className="primary-button" type="submit">追加</button>
        </form>
        <ul className="master-list category-sortable-list">
          {masterData.incomeCategories.map((category, index) => (
            <li key={category.id}>
              <div className="category-list-copy">
                <strong>{category.name}</strong>
                <small>{category.usageCount}件で使用{category.isActive ? '' : '・非表示'}</small>
              </div>
              <div className="category-list-actions">
                <button
                  type="button"
                  className="category-order-button"
                  aria-label={`${category.name}を上へ`}
                  title="上へ"
                  disabled={index === 0}
                  onClick={() => void run(
                    () => masterDataRepository.moveIncomeCategory(category.id, 'up'),
                    '収入カテゴリの順番を変更しました。',
                  )}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="category-order-button"
                  aria-label={`${category.name}を下へ`}
                  title="下へ"
                  disabled={index === masterData.incomeCategories.length - 1}
                  onClick={() => void run(
                    () => masterDataRepository.moveIncomeCategory(category.id, 'down'),
                    '収入カテゴリの順番を変更しました。',
                  )}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-button category-visibility-button"
                  onClick={() => void run(
                    () => masterDataRepository.setIncomeCategoryActive(
                      category.id,
                      !category.isActive,
                    ),
                    category.isActive
                      ? 'カテゴリを非表示にしました。'
                      : 'カテゴリを再表示しました。',
                  )}
                >
                  {category.isActive ? '非表示' : '再表示'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h2>支払い方法</h2>
        <form className="payment-form" onSubmit={(event) => void addPaymentMethod(event)}>
          <label>
            <span>名前</span>
            <input
              value={paymentName}
              onChange={(event) => setPaymentName(event.currentTarget.value)}
              placeholder="例：PayPay"
              maxLength={40}
            />
          </label>
          <label>
            <span>種類</span>
            <select
              value={paymentKind}
              onChange={(event) => setPaymentKind(
                event.currentTarget.value as Exclude<PaymentMethodKind, 'system-unset'>,
              )}
            >
              {Object.entries(PAYMENT_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">追加</button>
        </form>
        <ul className="master-list">
          {masterData.paymentMethods.map((paymentMethod) => (
            <li key={paymentMethod.id}>
              <div>
                <strong>{paymentMethod.name}</strong>
                <small>
                  {paymentMethod.isSystem
                    ? 'システム管理'
                    : `${paymentMethod.usageCount}件で使用`}
                </small>
              </div>
              {!paymentMethod.isSystem && (
                <button
                  type="button"
                  className="danger-text-button"
                  onClick={() => setPaymentToDelete(paymentMethod)}
                >
                  削除
                </button>
              )}
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
        <a className="legacy-link" href={`${import.meta.env.BASE_URL}legacy/index.html`}>
          旧版の家計簿を開く
        </a>
      </section>

      {paymentToDelete !== null && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="sheet-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="支払い方法を削除"
          >
            <header className="sheet-header">
              <h2>支払い方法を削除</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="閉じる"
                onClick={() => setPaymentToDelete(null)}
              >
                ×
              </button>
            </header>
            <div className="confirm-message">
              <p><strong>{paymentToDelete.name}</strong>を削除します。</p>
              {paymentToDelete.usageCount > 0 && (
                <p>過去の{paymentToDelete.usageCount}件は「未設定」に変更されます。</p>
              )}
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPaymentToDelete(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void run(async () => {
                  await masterDataRepository.deletePaymentMethod(paymentToDelete.id);
                  setPaymentToDelete(null);
                }, '支払い方法を削除しました。')}
              >
                削除する
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
