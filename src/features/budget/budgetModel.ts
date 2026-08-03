import type {
  CategoryBudget,
  ExpenseCategory,
  MonthlyBudget,
  Transaction,
} from '../../domain/models';

export interface BudgetProgress {
  baseAmountYen: number;
  carryoverAmountYen: number;
  effectiveAmountYen: number;
  spentAmountYen: number;
  remainingAmountYen: number;
  usagePercent: number;
  isExceeded: boolean;
}

export interface CategoryBudgetProgress extends BudgetProgress {
  expenseCategoryId: string;
  categoryName: string;
  isCategoryActive: boolean;
}

export interface BudgetOverview {
  monthly: BudgetProgress | null;
  categories: CategoryBudgetProgress[];
  exceededCategoryCount: number;
}

export type BudgetAmountResult =
  | { ok: true; amountYen: number }
  | { ok: false; message: string };

function usagePercent(spentAmountYen: number, effectiveAmountYen: number): number {
  if (effectiveAmountYen <= 0) return 0;
  return Math.round((spentAmountYen / effectiveAmountYen) * 1000) / 10;
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

export function buildBudgetOverview(
  monthlyBudget: MonthlyBudget | null,
  categoryBudgets: readonly CategoryBudget[],
  transactions: readonly Transaction[],
  expenseCategories: readonly ExpenseCategory[],
): BudgetOverview {
  let totalExpenseYen = 0;
  const categorySpend = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    totalExpenseYen += transaction.amountYen;
    categorySpend.set(
      transaction.expenseCategoryId,
      (categorySpend.get(transaction.expenseCategoryId) ?? 0) + transaction.amountYen,
    );
  }

  const categoryById = new Map(expenseCategories.map((category) => [category.id, category]));
  const categories = categoryBudgets
    .map((budget): CategoryBudgetProgress => {
      const category = categoryById.get(budget.expenseCategoryId);
      return {
        expenseCategoryId: budget.expenseCategoryId,
        categoryName: category?.name ?? '削除済みカテゴリ',
        isCategoryActive: category?.isActive ?? false,
        ...createBudgetProgress(
          budget,
          categorySpend.get(budget.expenseCategoryId) ?? 0,
        ),
      };
    })
    .sort(
      (left, right) =>
        Number(right.isExceeded) - Number(left.isExceeded) ||
        right.usagePercent - left.usagePercent ||
        left.categoryName.localeCompare(right.categoryName, 'ja'),
    );

  return {
    monthly: monthlyBudget === null ? null : createBudgetProgress(monthlyBudget, totalExpenseYen),
    categories,
    exceededCategoryCount: categories.filter((category) => category.isExceeded).length,
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
