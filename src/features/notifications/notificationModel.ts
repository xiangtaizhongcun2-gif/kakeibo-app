import type {
  MonthKey,
  MonthlyBudget,
  Transaction,
  UtcIsoDateTime,
} from '../../domain/models';

export interface MonthlyBudgetExceededAlert {
  monthKey: MonthKey;
  budgetAmountYen: number;
  spentAmountYen: number;
  exceededAmountYen: number;
  detectedAt: UtcIsoDateTime;
}

export function monthlyBudgetNotificationStateId(monthKey: MonthKey): string {
  return `monthly:${monthKey}`;
}

export function calculateMonthlyExpenseYen(
  monthKey: MonthKey,
  transactions: readonly Transaction[],
): number {
  return transactions.reduce((total, transaction) => {
    if (transaction.type !== 'expense' || !transaction.date.startsWith(monthKey)) {
      return total;
    }
    return total + transaction.amountYen;
  }, 0);
}

export function createMonthlyBudgetExceededAlert(
  monthKey: MonthKey,
  budget: MonthlyBudget | null,
  transactions: readonly Transaction[],
  detectedAt: UtcIsoDateTime,
): MonthlyBudgetExceededAlert | null {
  if (budget === null) return null;
  const spentAmountYen = calculateMonthlyExpenseYen(monthKey, transactions);
  if (spentAmountYen <= budget.effectiveAmountYen) return null;

  return {
    monthKey,
    budgetAmountYen: budget.effectiveAmountYen,
    spentAmountYen,
    exceededAmountYen: spentAmountYen - budget.effectiveAmountYen,
    detectedAt,
  };
}

export function formatNotificationMonth(monthKey: MonthKey): string {
  const [year, month] = monthKey.split('-');
  return `${year}年${Number(month)}月`;
}

export function formatNotificationYen(amountYen: number): string {
  return `${new Intl.NumberFormat('ja-JP').format(amountYen)}円`;
}

export function monthlyBudgetNotificationBody(
  alert: MonthlyBudgetExceededAlert,
): string {
  return `${formatNotificationMonth(alert.monthKey)}の支出が月予算を${formatNotificationYen(alert.exceededAmountYen)}超えました。`;
}
