import type { Transaction } from '../../domain/models';
import type { TransactionMasterData } from '../transactions/transactionModel';

export interface MonthlyTotals {
  incomeYen: number;
  expenseYen: number;
  balanceYen: number;
  transactionCount: number;
  expenseCount: number;
  incomeCount: number;
}

export interface BreakdownItem {
  id: string;
  name: string;
  amountYen: number;
  ratioPercent: number;
  transactionCount: number;
}

export interface MonthlyAnalytics {
  totals: MonthlyTotals;
  expenseCategories: BreakdownItem[];
  paymentMethods: BreakdownItem[];
}

export interface MonthlyComparison {
  incomeDifferenceYen: number;
  expenseDifferenceYen: number;
  balanceDifferenceYen: number;
}

interface MutableBreakdownItem {
  id: string;
  name: string;
  amountYen: number;
  transactionCount: number;
}

function ratioPercent(amountYen: number, totalExpenseYen: number): number {
  if (totalExpenseYen === 0) return 0;
  return Math.round((amountYen / totalExpenseYen) * 1000) / 10;
}

function finalizeBreakdown(
  items: Iterable<MutableBreakdownItem>,
  totalExpenseYen: number,
): BreakdownItem[] {
  return [...items]
    .map((item) => ({
      ...item,
      ratioPercent: ratioPercent(item.amountYen, totalExpenseYen),
    }))
    .sort(
      (left, right) =>
        right.amountYen - left.amountYen || left.name.localeCompare(right.name, 'ja'),
    );
}

function addToBreakdown(
  map: Map<string, MutableBreakdownItem>,
  id: string,
  name: string,
  amountYen: number,
): void {
  const existing = map.get(id);
  if (existing === undefined) {
    map.set(id, { id, name, amountYen, transactionCount: 1 });
    return;
  }
  existing.amountYen += amountYen;
  existing.transactionCount += 1;
}

export function aggregateTransactions(
  transactions: readonly Transaction[],
  masterData: TransactionMasterData,
): MonthlyAnalytics {
  let incomeYen = 0;
  let expenseYen = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  const categoryNames = new Map(
    masterData.expenseCategories.map((category) => [category.id, category.name]),
  );
  const paymentMethodNames = new Map(
    masterData.paymentMethods.map((paymentMethod) => [paymentMethod.id, paymentMethod.name]),
  );
  const categories = new Map<string, MutableBreakdownItem>();
  const paymentMethods = new Map<string, MutableBreakdownItem>();

  for (const transaction of transactions) {
    if (transaction.type === 'income') {
      incomeYen += transaction.amountYen;
      incomeCount += 1;
      continue;
    }

    expenseYen += transaction.amountYen;
    expenseCount += 1;
    addToBreakdown(
      categories,
      transaction.expenseCategoryId,
      categoryNames.get(transaction.expenseCategoryId) ?? '削除済みカテゴリ',
      transaction.amountYen,
    );
    addToBreakdown(
      paymentMethods,
      transaction.paymentMethodId,
      paymentMethodNames.get(transaction.paymentMethodId) ?? '未設定',
      transaction.amountYen,
    );
  }

  return {
    totals: {
      incomeYen,
      expenseYen,
      balanceYen: incomeYen - expenseYen,
      transactionCount: transactions.length,
      expenseCount,
      incomeCount,
    },
    expenseCategories: finalizeBreakdown(categories.values(), expenseYen),
    paymentMethods: finalizeBreakdown(paymentMethods.values(), expenseYen),
  };
}

export function compareMonthlyTotals(
  current: MonthlyTotals,
  previous: MonthlyTotals,
): MonthlyComparison {
  return {
    incomeDifferenceYen: current.incomeYen - previous.incomeYen,
    expenseDifferenceYen: current.expenseYen - previous.expenseYen,
    balanceDifferenceYen: current.balanceYen - previous.balanceYen,
  };
}
