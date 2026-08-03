import type {
  BudgetSettings,
  CategoryBudget,
  ExpenseCategoryId,
  MonthlyBudget,
  MonthKey,
  UtcIsoDateTime,
} from '../../domain/models';
import {
  currentUtcIsoDateTime,
  toMonthKey,
  toPositiveMoneyYen,
} from '../../domain/valueObjects';
import { appDatabase, type MyKakeiboDatabase } from '../database';

export interface BudgetMonthData {
  settings: BudgetSettings;
  monthlyBudget: MonthlyBudget | null;
  categoryBudgets: CategoryBudget[];
}

function previousMonthKey(monthKey: MonthKey): MonthKey {
  const [yearText, monthText] = monthKey.split('-');
  const date = new Date(Number(yearText), Number(monthText) - 2, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}` as MonthKey;
}

function categoryBudgetId(monthKey: MonthKey, expenseCategoryId: ExpenseCategoryId): string {
  return `${monthKey}:${expenseCategoryId}`;
}

function hasBudgetChanged(
  current: MonthlyBudget | CategoryBudget,
  carryoverAmountYen: number,
  effectiveAmountYen: number,
): boolean {
  return (
    current.carryoverAmountYen !== carryoverAmountYen ||
    current.effectiveAmountYen !== effectiveAmountYen
  );
}

export async function recalculateAllBudgets(
  database: MyKakeiboDatabase,
  updatedAt: UtcIsoDateTime = currentUtcIsoDateTime(),
): Promise<void> {
  const settings = await database.budgetSettings.get('budget-settings');
  if (settings === undefined) throw new Error('予算設定が初期化されていません。');

  const expenses = (await database.transactions.toArray()).filter(
    (transaction) => transaction.type === 'expense',
  );
  const monthlySpend = new Map<MonthKey, number>();
  const categorySpend = new Map<string, number>();

  for (const expense of expenses) {
    const monthKey = expense.date.slice(0, 7) as MonthKey;
    monthlySpend.set(monthKey, (monthlySpend.get(monthKey) ?? 0) + expense.amountYen);
    const categoryKey = categoryBudgetId(monthKey, expense.expenseCategoryId);
    categorySpend.set(categoryKey, (categorySpend.get(categoryKey) ?? 0) + expense.amountYen);
  }

  const monthlyBudgets = (await database.monthlyBudgets.toArray()).sort((left, right) =>
    left.monthKey.localeCompare(right.monthKey),
  );
  const recalculatedMonthly = new Map<MonthKey, MonthlyBudget>();
  const monthlyUpdates: MonthlyBudget[] = [];

  for (const budget of monthlyBudgets) {
    const previousKey = previousMonthKey(budget.monthKey);
    const previous = recalculatedMonthly.get(previousKey);
    const carryoverAmountYen =
      settings.monthlyCarryoverEnabled && previous !== undefined
        ? Math.max(0, previous.effectiveAmountYen - (monthlySpend.get(previousKey) ?? 0))
        : 0;
    const effectiveAmountYen = budget.baseAmountYen + carryoverAmountYen;
    const recalculated = hasBudgetChanged(budget, carryoverAmountYen, effectiveAmountYen)
      ? { ...budget, carryoverAmountYen, effectiveAmountYen, updatedAt }
      : budget;
    recalculatedMonthly.set(budget.monthKey, recalculated);
    if (recalculated !== budget) monthlyUpdates.push(recalculated);
  }

  const categoryBudgets = (await database.categoryBudgets.toArray()).sort(
    (left, right) =>
      left.expenseCategoryId.localeCompare(right.expenseCategoryId) ||
      left.monthKey.localeCompare(right.monthKey),
  );
  const recalculatedCategories = new Map<string, CategoryBudget>();
  const categoryUpdates: CategoryBudget[] = [];

  for (const budget of categoryBudgets) {
    const previousKey = previousMonthKey(budget.monthKey);
    const previousId = categoryBudgetId(previousKey, budget.expenseCategoryId);
    const previous = recalculatedCategories.get(previousId);
    const carryoverAmountYen =
      settings.categoryCarryoverEnabled && previous !== undefined
        ? Math.max(0, previous.effectiveAmountYen - (categorySpend.get(previousId) ?? 0))
        : 0;
    const effectiveAmountYen = budget.baseAmountYen + carryoverAmountYen;
    const recalculated = hasBudgetChanged(budget, carryoverAmountYen, effectiveAmountYen)
      ? { ...budget, carryoverAmountYen, effectiveAmountYen, updatedAt }
      : budget;
    recalculatedCategories.set(budget.id, recalculated);
    if (recalculated !== budget) categoryUpdates.push(recalculated);
  }

  if (monthlyUpdates.length > 0) await database.monthlyBudgets.bulkPut(monthlyUpdates);
  if (categoryUpdates.length > 0) await database.categoryBudgets.bulkPut(categoryUpdates);
}

export class BudgetRepository {
  constructor(private readonly database: MyKakeiboDatabase = appDatabase) {}

  async getSettings(): Promise<BudgetSettings> {
    const settings = await this.database.budgetSettings.get('budget-settings');
    if (settings === undefined) throw new Error('予算設定が初期化されていません。');
    return settings;
  }

  async getMonthData(monthKey: MonthKey): Promise<BudgetMonthData> {
    const validMonthKey = toMonthKey(monthKey);
    const [settings, monthlyBudget, categoryBudgets] = await Promise.all([
      this.getSettings(),
      this.database.monthlyBudgets.get(validMonthKey),
      this.database.categoryBudgets.where('monthKey').equals(validMonthKey).toArray(),
    ]);

    return {
      settings,
      monthlyBudget: monthlyBudget ?? null,
      categoryBudgets: categoryBudgets.sort((left, right) =>
        left.expenseCategoryId.localeCompare(right.expenseCategoryId),
      ),
    };
  }

  async setMonthlyBudget(monthKey: MonthKey, baseAmountYen: number): Promise<MonthlyBudget> {
    const validMonthKey = toMonthKey(monthKey);
    const validAmount = toPositiveMoneyYen(baseAmountYen);
    const now = currentUtcIsoDateTime();

    return this.database.transaction(
      'rw',
      this.database.transactions,
      this.database.monthlyBudgets,
      this.database.categoryBudgets,
      this.database.budgetSettings,
      async () => {
        const current = await this.database.monthlyBudgets.get(validMonthKey);
        const budget: MonthlyBudget = {
          monthKey: validMonthKey,
          baseAmountYen: validAmount,
          carryoverAmountYen: current?.carryoverAmountYen ?? 0,
          effectiveAmountYen: validAmount + (current?.carryoverAmountYen ?? 0),
          createdAt: current?.createdAt ?? now,
          updatedAt: now,
        };
        await this.database.monthlyBudgets.put(budget);
        await recalculateAllBudgets(this.database, now);
        const recalculated = await this.database.monthlyBudgets.get(validMonthKey);
        if (recalculated === undefined) throw new Error('月予算を保存できませんでした。');
        return recalculated;
      },
    );
  }

  async deleteMonthlyBudget(monthKey: MonthKey): Promise<boolean> {
    const validMonthKey = toMonthKey(monthKey);
    const now = currentUtcIsoDateTime();

    return this.database.transaction(
      'rw',
      this.database.transactions,
      this.database.monthlyBudgets,
      this.database.categoryBudgets,
      this.database.budgetSettings,
      async () => {
        const current = await this.database.monthlyBudgets.get(validMonthKey);
        if (current === undefined) return false;
        await this.database.monthlyBudgets.delete(validMonthKey);
        await recalculateAllBudgets(this.database, now);
        return true;
      },
    );
  }

  async setCategoryBudget(
    monthKey: MonthKey,
    expenseCategoryId: ExpenseCategoryId,
    baseAmountYen: number,
  ): Promise<CategoryBudget> {
    const validMonthKey = toMonthKey(monthKey);
    const validAmount = toPositiveMoneyYen(baseAmountYen);
    const category = await this.database.expenseCategories.get(expenseCategoryId);
    if (category === undefined) throw new Error('支出カテゴリが見つかりません。');
    const id = categoryBudgetId(validMonthKey, expenseCategoryId);
    const now = currentUtcIsoDateTime();

    return this.database.transaction(
      'rw',
      this.database.transactions,
      this.database.monthlyBudgets,
      this.database.categoryBudgets,
      this.database.budgetSettings,
      async () => {
        const current = await this.database.categoryBudgets.get(id);
        const budget: CategoryBudget = {
          id,
          monthKey: validMonthKey,
          expenseCategoryId,
          baseAmountYen: validAmount,
          carryoverAmountYen: current?.carryoverAmountYen ?? 0,
          effectiveAmountYen: validAmount + (current?.carryoverAmountYen ?? 0),
          createdAt: current?.createdAt ?? now,
          updatedAt: now,
        };
        await this.database.categoryBudgets.put(budget);
        await recalculateAllBudgets(this.database, now);
        const recalculated = await this.database.categoryBudgets.get(id);
        if (recalculated === undefined) throw new Error('カテゴリ予算を保存できませんでした。');
        return recalculated;
      },
    );
  }

  async deleteCategoryBudget(
    monthKey: MonthKey,
    expenseCategoryId: ExpenseCategoryId,
  ): Promise<boolean> {
    const validMonthKey = toMonthKey(monthKey);
    const id = categoryBudgetId(validMonthKey, expenseCategoryId);
    const now = currentUtcIsoDateTime();

    return this.database.transaction(
      'rw',
      this.database.transactions,
      this.database.monthlyBudgets,
      this.database.categoryBudgets,
      this.database.budgetSettings,
      async () => {
        const current = await this.database.categoryBudgets.get(id);
        if (current === undefined) return false;
        await this.database.categoryBudgets.delete(id);
        await recalculateAllBudgets(this.database, now);
        return true;
      },
    );
  }

  async updateSettings(
    changes: Partial<
      Pick<BudgetSettings, 'monthlyCarryoverEnabled' | 'categoryCarryoverEnabled'>
    >,
  ): Promise<BudgetSettings> {
    const now = currentUtcIsoDateTime();

    return this.database.transaction(
      'rw',
      this.database.transactions,
      this.database.monthlyBudgets,
      this.database.categoryBudgets,
      this.database.budgetSettings,
      async () => {
        const current = await this.getSettings();
        const updated: BudgetSettings = {
          ...current,
          ...changes,
          id: 'budget-settings',
          updatedAt: now,
        };
        await this.database.budgetSettings.put(updated);
        await recalculateAllBudgets(this.database, now);
        return updated;
      },
    );
  }
}
