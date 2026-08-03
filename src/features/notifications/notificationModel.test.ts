import { describe, expect, it } from 'vitest';
import type { MonthlyBudget, Transaction } from '../../domain/models';
import {
  calculateMonthlyExpenseYen,
  createMonthlyBudgetExceededAlert,
  monthlyBudgetNotificationBody,
} from './notificationModel';

const timestamp = '2026-08-03T00:00:00.000Z';

const budget: MonthlyBudget = {
  monthKey: '2026-08',
  baseAmountYen: 10000,
  carryoverAmountYen: 2000,
  effectiveAmountYen: 12000,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const transactions: Transaction[] = [
  {
    id: 'expense-current',
    type: 'expense',
    amountYen: 12500,
    date: '2026-08-02',
    expenseCategoryId: 'expense-category-1',
    paymentMethodId: 'payment-method-cash',
    merchant: 'スーパー',
    content: '食料品',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'income-current',
    type: 'income',
    amountYen: 50000,
    date: '2026-08-01',
    incomeCategoryId: 'income-category-1',
    content: '給与',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'expense-other-month',
    type: 'expense',
    amountYen: 9000,
    date: '2026-07-31',
    expenseCategoryId: 'expense-category-1',
    paymentMethodId: 'payment-method-cash',
    merchant: 'スーパー',
    content: '前月分',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

describe('notificationModel', () => {
  it('対象月の支出だけを合計する', () => {
    expect(calculateMonthlyExpenseYen('2026-08', transactions)).toBe(12500);
  });

  it('予算へ近づいただけ、または予算と同額では通知しない', () => {
    expect(
      createMonthlyBudgetExceededAlert(
        '2026-08',
        { ...budget, effectiveAmountYen: 12501 },
        transactions,
        timestamp,
      ),
    ).toBeNull();
    expect(
      createMonthlyBudgetExceededAlert(
        '2026-08',
        { ...budget, effectiveAmountYen: 12500 },
        transactions,
        timestamp,
      ),
    ).toBeNull();
  });

  it('実際に予算を超えた場合だけ超過額を返す', () => {
    expect(
      createMonthlyBudgetExceededAlert('2026-08', budget, transactions, timestamp),
    ).toEqual({
      monthKey: '2026-08',
      budgetAmountYen: 12000,
      spentAmountYen: 12500,
      exceededAmountYen: 500,
      detectedAt: timestamp,
    });
  });

  it('通知本文に対象月と超過額を含める', () => {
    const alert = createMonthlyBudgetExceededAlert(
      '2026-08',
      budget,
      transactions,
      timestamp,
    );
    expect(alert).not.toBeNull();
    if (alert !== null) {
      expect(monthlyBudgetNotificationBody(alert)).toBe(
        '2026年8月の支出が月予算を500円超えました。',
      );
    }
  });
});
