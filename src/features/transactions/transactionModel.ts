import type {
  ExpenseCategory,
  IncomeCategory,
  LocalDate,
  MonthKey,
  PaymentMethod,
  Transaction,
  TransactionListField,
} from '../../domain/models';
import { toLocalDate, toPositiveMoneyYen } from '../../domain/valueObjects';
import type { NewTransaction } from '../../data/repositories/transactionRepository';

export interface TransactionMasterData {
  expenseCategories: ExpenseCategory[];
  incomeCategories: IncomeCategory[];
  paymentMethods: PaymentMethod[];
}

export interface TransactionFormState {
  type: 'expense' | 'income';
  amount: string;
  date: string;
  categoryId: string;
  paymentMethodId: string;
  merchant: string;
  content: string;
}

export interface TransactionFormErrors {
  amount?: string;
  date?: string;
  categoryId?: string;
  paymentMethodId?: string;
}

export type TransactionFormResult =
  | { ok: true; value: NewTransaction }
  | { ok: false; errors: TransactionFormErrors };

export type TransactionTypeFilter = 'all' | 'expense' | 'income';

export interface TransactionFilters {
  query: string;
  type: TransactionTypeFilter;
  date: string;
  categoryKey: string;
  paymentMethodId: string;
}

export interface TransactionGroup {
  date: LocalDate;
  transactions: Transaction[];
}

export const LIST_FIELD_ORDER: readonly TransactionListField[] = [
  'amount',
  'category',
  'paymentMethod',
  'merchant',
  'content',
];

export const LIST_FIELD_LABELS: Readonly<Record<TransactionListField, string>> = {
  amount: '金額',
  category: 'カテゴリ',
  paymentMethod: '支払い方法',
  merchant: '店名',
  content: '内容',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function todayLocalDate(now: Date = new Date()): LocalDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` as LocalDate;
}

export function currentMonthKey(now: Date = new Date()): MonthKey {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}` as MonthKey;
}

export function shiftMonthKey(monthKey: MonthKey, delta: number): MonthKey {
  const [yearText, monthText] = monthKey.split('-');
  const date = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}` as MonthKey;
}

export function formatMonthKey(monthKey: MonthKey): string {
  const [year, month] = monthKey.split('-');
  return `${year}年${Number(month)}月`;
}

export function formatLocalDate(date: LocalDate): string {
  const [, month, day] = date.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

export function formatYen(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value);
}

export function categoryKey(type: 'expense' | 'income', id: string): string {
  return `${type}:${id}`;
}

export function createFormState(
  masterData: TransactionMasterData,
  transaction?: Transaction,
): TransactionFormState {
  if (transaction?.type === 'expense') {
    return {
      type: 'expense',
      amount: String(transaction.amountYen),
      date: transaction.date,
      categoryId: transaction.expenseCategoryId,
      paymentMethodId: transaction.paymentMethodId,
      merchant: transaction.merchant,
      content: transaction.content,
    };
  }

  if (transaction?.type === 'income') {
    return {
      type: 'income',
      amount: String(transaction.amountYen),
      date: transaction.date,
      categoryId: transaction.incomeCategoryId,
      paymentMethodId: '',
      merchant: '',
      content: transaction.content,
    };
  }

  return {
    type: 'expense',
    amount: '',
    date: todayLocalDate(),
    categoryId: masterData.expenseCategories.find(({ isActive }) => isActive)?.id ?? '',
    paymentMethodId:
      masterData.paymentMethods.find(({ isActive, isSystem }) => isActive && !isSystem)?.id ??
      masterData.paymentMethods.find(({ isActive }) => isActive)?.id ??
      '',
    merchant: '',
    content: '',
  };
}

export function changeFormType(
  state: TransactionFormState,
  type: 'expense' | 'income',
  masterData: TransactionMasterData,
): TransactionFormState {
  if (type === state.type) return state;

  return {
    ...state,
    type,
    categoryId:
      type === 'expense'
        ? masterData.expenseCategories.find(({ isActive }) => isActive)?.id ?? ''
        : masterData.incomeCategories.find(({ isActive }) => isActive)?.id ?? '',
    paymentMethodId:
      type === 'expense'
        ? masterData.paymentMethods.find(({ isActive, isSystem }) => isActive && !isSystem)?.id ??
          masterData.paymentMethods.find(({ isActive }) => isActive)?.id ??
          ''
        : '',
    merchant: type === 'expense' ? state.merchant : '',
  };
}

export function buildTransactionInput(state: TransactionFormState): TransactionFormResult {
  const errors: TransactionFormErrors = {};
  const amount = Number(state.amount);

  try {
    toPositiveMoneyYen(amount);
  } catch {
    errors.amount = '1円以上の整数を入力してください。';
  }

  let date: LocalDate | undefined;
  try {
    date = toLocalDate(state.date);
  } catch {
    errors.date = '正しい日付を入力してください。';
  }

  if (state.categoryId === '') errors.categoryId = 'カテゴリを選択してください。';
  if (state.type === 'expense' && state.paymentMethodId === '') {
    errors.paymentMethodId = '支払い方法を選択してください。';
  }

  if (Object.keys(errors).length > 0 || date === undefined) return { ok: false, errors };

  if (state.type === 'expense') {
    return {
      ok: true,
      value: {
        type: 'expense',
        amountYen: amount,
        date,
        expenseCategoryId: state.categoryId,
        paymentMethodId: state.paymentMethodId,
        merchant: state.merchant.trim(),
        content: state.content.trim(),
      },
    };
  }

  return {
    ok: true,
    value: {
      type: 'income',
      amountYen: amount,
      date,
      incomeCategoryId: state.categoryId,
      content: state.content.trim(),
    },
  };
}

export function applyTransactionFilters(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const query = filters.query.trim().toLocaleLowerCase('ja');

  return transactions.filter((transaction) => {
    if (filters.type !== 'all' && transaction.type !== filters.type) return false;
    if (filters.date !== '' && transaction.date !== filters.date) return false;

    if (filters.categoryKey !== '') {
      const expected =
        transaction.type === 'expense'
          ? categoryKey('expense', transaction.expenseCategoryId)
          : categoryKey('income', transaction.incomeCategoryId);
      if (expected !== filters.categoryKey) return false;
    }

    if (filters.paymentMethodId !== '') {
      if (
        transaction.type !== 'expense' ||
        transaction.paymentMethodId !== filters.paymentMethodId
      ) {
        return false;
      }
    }

    if (query !== '') {
      const searchable =
        transaction.type === 'expense'
          ? `${transaction.merchant} ${transaction.content}`
          : transaction.content;
      if (!searchable.toLocaleLowerCase('ja').includes(query)) return false;
    }

    return true;
  });
}

export function groupTransactionsByDate(transactions: Transaction[]): TransactionGroup[] {
  const groups = new Map<LocalDate, Transaction[]>();
  for (const transaction of transactions) {
    const group = groups.get(transaction.date);
    if (group === undefined) groups.set(transaction.date, [transaction]);
    else group.push(transaction);
  }
  return [...groups.entries()].map(([date, groupedTransactions]) => ({
    date,
    transactions: groupedTransactions,
  }));
}

export function categoryName(
  transaction: Transaction,
  masterData: TransactionMasterData,
): string {
  if (transaction.type === 'expense') {
    return (
      masterData.expenseCategories.find(({ id }) => id === transaction.expenseCategoryId)?.name ??
      '削除済みカテゴリ'
    );
  }
  return (
    masterData.incomeCategories.find(({ id }) => id === transaction.incomeCategoryId)?.name ??
    '削除済みカテゴリ'
  );
}

export function paymentMethodName(
  transaction: Transaction,
  masterData: TransactionMasterData,
): string {
  if (transaction.type === 'income') return '';
  return (
    masterData.paymentMethods.find(({ id }) => id === transaction.paymentMethodId)?.name ??
    '未設定'
  );
}
