import { describe, expect, it } from 'vitest';
import type { MonthlyBudget, Transaction } from '../../domain/models';
import {
  createBudgetProgress,
  parseBudgetAmount,
  totalExpenseYen,
} from './budgetModel';

const timestamp = '2026-08-01T00:00:00.000Z';

const monthlyBudget: MonthlyBudget = {
  monthKey: '2026-08',
  baseAmountYen: 10000,
  carryoverAmountYen: 2000,
  effectiveAmountYen: 12000,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const transactions: Transaction[] = [
  {
    id: 'food-expense',
    type: 'expense',
    amountYen: 4500,
    date: '2026-08-02',
    expenseCategoryId: 'food',
    paymentMethodId: 'cash',
    merchant: 'スーパー',
    content: '食料品',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'transport-expense',
    type: 'expense',
    amountYen: 1500,
    date: '2026-08-03',
    expenseCategoryId: 'transport',
    paymentMethodId: 'cash',
    merchant: '鉄道',
    content: '交通費',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'income',
    type: 'income',
    amountYen: 50000,
    date: '2026-08-01',
    incomeCategoryId: 'salary',
    content: '給与',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

describe('budgetModel', () => {
  it('予算額・使用額・残額・使用率を計算する', () => {
    expect(createBudgetProgress(monthlyBudget, 6000)).toEqual({
      baseAmountYen: 10000,
      carryoverAmountYen: 2000,
      effectiveAmountYen: 12000,
      spentAmountYen: 6000,
      remainingAmountYen: 6000,
      usagePercent: 50,
      isExceeded: false,
    });
  });

  it('超過時は負の残額と100%を超える使用率を返す', () => {
    expect(createBudgetProgress(monthlyBudget, 15000)).toMatchObject({
      remainingAmountYen: -3000,
      usagePercent: 125,
      isExceeded: true,
    });
  });

  it('収入を除外して月の支出額だけを合計する', () => {
    expect(totalExpenseYen(transactions)).toBe(6000);
  });

  it('予算額は1円以上の整数だけを受け付ける', () => {
    expect(parseBudgetAmount('10000')).toEqual({ ok: true, amountYen: 10000 });
    expect(parseBudgetAmount('')).toEqual({
      ok: false,
      message: '予算額を入力してください。',
    });
    expect(parseBudgetAmount('0').ok).toBe(false);
    expect(parseBudgetAmount('-1').ok).toBe(false);
    expect(parseBudgetAmount('1.5').ok).toBe(false);
  });
});
