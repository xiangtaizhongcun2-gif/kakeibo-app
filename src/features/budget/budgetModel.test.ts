import { describe, expect, it } from 'vitest';
import type {
  CategoryBudget,
  ExpenseCategory,
  MonthlyBudget,
  Transaction,
} from '../../domain/models';
import {
  buildBudgetOverview,
  createBudgetProgress,
  parseBudgetAmount,
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

const categoryBudgets: CategoryBudget[] = [
  {
    id: '2026-08:food',
    monthKey: '2026-08',
    expenseCategoryId: 'food',
    baseAmountYen: 5000,
    carryoverAmountYen: 1000,
    effectiveAmountYen: 6000,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: '2026-08:transport',
    monthKey: '2026-08',
    expenseCategoryId: 'transport',
    baseAmountYen: 1000,
    carryoverAmountYen: 0,
    effectiveAmountYen: 1000,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

const categories: ExpenseCategory[] = [
  {
    id: 'food',
    name: '食費',
    usageCount: 1,
    isActive: true,
    isSystem: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'transport',
    name: '交通費',
    usageCount: 1,
    isActive: true,
    isSystem: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

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

  it('月全体とカテゴリ別の予算状況を支出だけから集計する', () => {
    const overview = buildBudgetOverview(
      monthlyBudget,
      categoryBudgets,
      transactions,
      categories,
    );

    expect(overview.monthly).toMatchObject({
      spentAmountYen: 6000,
      remainingAmountYen: 6000,
      usagePercent: 50,
    });
    expect(overview.categories[0]).toMatchObject({
      categoryName: '交通費',
      spentAmountYen: 1500,
      remainingAmountYen: -500,
      usagePercent: 150,
      isExceeded: true,
    });
    expect(overview.exceededCategoryCount).toBe(1);
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
