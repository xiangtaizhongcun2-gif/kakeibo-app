import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../domain/models';
import type { TransactionMasterData } from '../transactions/transactionModel';
import { aggregateTransactions, compareMonthlyTotals } from './analyticsModel';

const timestamp = '2026-08-01T00:00:00.000Z';

const masterData: TransactionMasterData = {
  expenseCategories: [
    {
      id: 'food',
      name: '食費',
      usageCount: 2,
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
  ],
  incomeCategories: [
    {
      id: 'salary',
      name: '給与',
      usageCount: 1,
      isActive: true,
      isSystem: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  paymentMethods: [
    {
      id: 'cash',
      name: '現金',
      kind: 'cash',
      usageCount: 2,
      isActive: true,
      isSystem: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'credit',
      name: 'クレジットカード',
      kind: 'credit-card',
      usageCount: 1,
      isActive: true,
      isSystem: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
};

const transactions: Transaction[] = [
  {
    id: 'expense-1',
    type: 'expense',
    amountYen: 1000,
    date: '2026-08-01',
    expenseCategoryId: 'food',
    paymentMethodId: 'cash',
    merchant: 'スーパー',
    content: '食料品',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'expense-2',
    type: 'expense',
    amountYen: 500,
    date: '2026-08-02',
    expenseCategoryId: 'food',
    paymentMethodId: 'credit',
    merchant: 'カフェ',
    content: '昼食',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'expense-3',
    type: 'expense',
    amountYen: 500,
    date: '2026-08-03',
    expenseCategoryId: 'transport',
    paymentMethodId: 'cash',
    merchant: '鉄道',
    content: '交通費',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'income-1',
    type: 'income',
    amountYen: 4000,
    date: '2026-08-01',
    incomeCategoryId: 'salary',
    content: '給与',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

describe('analyticsModel', () => {
  it('月の収入・支出・残額を集計する', () => {
    expect(aggregateTransactions(transactions, masterData).totals).toEqual({
      incomeYen: 4000,
      expenseYen: 2000,
      balanceYen: 2000,
      transactionCount: 4,
      expenseCount: 3,
      incomeCount: 1,
    });
  });

  it('カテゴリ別と支払い方法別を金額順で集計する', () => {
    const analytics = aggregateTransactions(transactions, masterData);

    expect(analytics.expenseCategories).toEqual([
      {
        id: 'food',
        name: '食費',
        amountYen: 1500,
        ratioPercent: 75,
        transactionCount: 2,
      },
      {
        id: 'transport',
        name: '交通費',
        amountYen: 500,
        ratioPercent: 25,
        transactionCount: 1,
      },
    ]);
    expect(analytics.paymentMethods.map(({ name, amountYen, ratioPercent }) => ({
      name,
      amountYen,
      ratioPercent,
    }))).toEqual([
      { name: '現金', amountYen: 1500, ratioPercent: 75 },
      { name: 'クレジットカード', amountYen: 500, ratioPercent: 25 },
    ]);
  });

  it('支出0件では空の内訳を返す', () => {
    const incomeOnly = transactions.filter((transaction) => transaction.type === 'income');
    const analytics = aggregateTransactions(incomeOnly, masterData);

    expect(analytics.totals.expenseYen).toBe(0);
    expect(analytics.expenseCategories).toEqual([]);
    expect(analytics.paymentMethods).toEqual([]);
  });

  it('前月との差額を計算する', () => {
    expect(
      compareMonthlyTotals(
        {
          incomeYen: 4000,
          expenseYen: 2000,
          balanceYen: 2000,
          transactionCount: 4,
          expenseCount: 3,
          incomeCount: 1,
        },
        {
          incomeYen: 3000,
          expenseYen: 2500,
          balanceYen: 500,
          transactionCount: 3,
          expenseCount: 2,
          incomeCount: 1,
        },
      ),
    ).toEqual({
      incomeDifferenceYen: 1000,
      expenseDifferenceYen: -500,
      balanceDifferenceYen: 1500,
    });
  });
});
