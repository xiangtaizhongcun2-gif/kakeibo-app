import type { Transaction } from '../../domain/models';

export interface DailyTransactionTotals {
  expenseYen: number;
  incomeYen: number;
  balanceYen: number;
}

export function createDailyTransactionTotals(
  transactions: readonly Transaction[],
): DailyTransactionTotals {
  let expenseYen = 0;
  let incomeYen = 0;

  for (const transaction of transactions) {
    if (transaction.type === 'expense') expenseYen += transaction.amountYen;
    else incomeYen += transaction.amountYen;
  }

  return {
    expenseYen,
    incomeYen,
    balanceYen: incomeYen - expenseYen,
  };
}
