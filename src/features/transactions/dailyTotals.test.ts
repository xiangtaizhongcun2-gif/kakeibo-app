import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../domain/models';
import { createDailyTransactionTotals } from './dailyTotals';

const transactions: Transaction[] = [
  {
    id: 'expense-1',
    type: 'expense',
    amountYen: 1200,
    date: '2026-08-06',
    expenseCategoryId: 'food',
    paymentMethodId: 'cash',
    merchant: 'スーパー',
    content: '食料品',
    createdAt: '2026-08-06T01:00:00.000Z',
    updatedAt: '2026-08-06T01:00:00.000Z',
  },
  {
    id: 'expense-2',
    type: 'expense',
    amountYen: 300,
    date: '2026-08-06',
    expenseCategoryId: 'transport',
    paymentMethodId: 'cash',
    merchant: '',
    content: '電車',
    createdAt: '2026-08-06T02:00:00.000Z',
    updatedAt: '2026-08-06T02:00:00.000Z',
  },
  {
    id: 'income-1',
    type: 'income',
    amountYen: 2000,
    date: '2026-08-06',
    incomeCategoryId: 'other',
    content: '返金',
    createdAt: '2026-08-06T03:00:00.000Z',
    updatedAt: '2026-08-06T03:00:00.000Z',
  },
];

describe('createDailyTransactionTotals', () => {
  it('日ごとの支出・収入・差額を集計する', () => {
    expect(createDailyTransactionTotals(transactions)).toEqual({
      expenseYen: 1500,
      incomeYen: 2000,
      balanceYen: 500,
    });
  });

  it('記録がない場合はすべて0円にする', () => {
    expect(createDailyTransactionTotals([])).toEqual({
      expenseYen: 0,
      incomeYen: 0,
      balanceYen: 0,
    });
  });
});
