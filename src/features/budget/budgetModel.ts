import type { MonthlyBudget, Transaction } from '../../domain/models';

export interface BudgetProgress {
  baseAmountYen: number;
  carryoverAmountYen: number;
  effectiveAmountYen: number;
  spentAmountYen: number;
  remainingAmountYen: number;
  usagePercent: number;
  isExceeded: boolean;
}

export type BudgetAmountResult =
  | { ok: true; amountYen: number }
  | { ok: false; message: string };

function usagePercent(spentAmountYen: number, effectiveAmountYen: number): number {
  if (effectiveAmountYen <= 0) return 0;
  return Math.round((spentAmountYen / effectiveAmountYen) * 1000) / 10;
}

export function totalExpenseYen(transactions: readonly Transaction[]): number {
  return transactions.reduce(
    (total, transaction) =>
      transaction.type === 'expense' ? total + transaction.amountYen : total,
    0,
  );
}

export function createBudgetProgress(
  budget: Pick<MonthlyBudget, 'baseAmountYen' | 'carryoverAmountYen' | 'effectiveAmountYen'>,
  spentAmountYen: number,
): BudgetProgress {
  const remainingAmountYen = budget.effectiveAmountYen - spentAmountYen;
  return {
    baseAmountYen: budget.baseAmountYen,
    carryoverAmountYen: budget.carryoverAmountYen,
    effectiveAmountYen: budget.effectiveAmountYen,
    spentAmountYen,
    remainingAmountYen,
    usagePercent: usagePercent(spentAmountYen, budget.effectiveAmountYen),
    isExceeded: spentAmountYen > budget.effectiveAmountYen,
  };
}

export function parseBudgetAmount(value: string): BudgetAmountResult {
  const normalized = value.trim();
  if (normalized === '') return { ok: false, message: '予算額を入力してください。' };
  const amountYen = Number(normalized);
  if (!Number.isSafeInteger(amountYen) || amountYen <= 0) {
    return { ok: false, message: '1円以上の整数を入力してください。' };
  }
  return { ok: true, amountYen };
}
