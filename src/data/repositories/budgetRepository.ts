import type {
  BudgetSettings,
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
}

function previousMonthKey(monthKey: MonthKey): MonthKey {
  const [yearText, monthText] = monthKey.split('-');
  const date = new Date(Number(yearText), Number(monthText) - 2, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}` as MonthKey;
}

function hasBudgetChanged(
  current: MonthlyBudget,
  carryoverAmountYen: number,
  effectiveAmountYen: number,
): boolean {
  return (
    current.carryoverAmountYen !== carryoverAmountYen ||
    current.effectiveAmountYen !== effectiveAmountYen
  );
}

export async function recalculateMonthlyBudgets(
  database: MyKakeiboDatabase,
  updatedAt: UtcIsoDateTime = currentUtcIsoDateTime(),
): Promise<void> {
  const settings = await database.budgetSettings.get('budget-settings');
  if (settings === undefined) throw new Error('予算設定が初期化されていません。');

  const monthlySpend = new Map<MonthKey, number>();
  const transactions = await database.transactions.toArray();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const monthKey = transaction.date.slice(0, 7) as MonthKey;
    monthlySpend.set(monthKey, (monthlySpend.get(monthKey) ?? 0) + transaction.amountYen);
  }

  const budgets = (await database.monthlyBudgets.toArray()).sort((left, right) =>
    left.monthKey.localeCompare(right.monthKey),
  );
  const recalculated = new Map<MonthKey, MonthlyBudget>();
  const updates: MonthlyBudget[] = [];

  for (const budget of budgets) {
    const previousKey = previousMonthKey(budget.monthKey);
    const previous = recalculated.get(previousKey);
    const carryoverAmountYen =
      settings.monthlyCarryoverEnabled && previous !== undefined
        ? Math.max(0, previous.effectiveAmountYen - (monthlySpend.get(previousKey) ?? 0))
        : 0;
    const effectiveAmountYen = budget.baseAmountYen + carryoverAmountYen;
    const nextBudget = hasBudgetChanged(budget, carryoverAmountYen, effectiveAmountYen)
      ? { ...budget, carryoverAmountYen, effectiveAmountYen, updatedAt }
      : budget;
    recalculated.set(budget.monthKey, nextBudget);
    if (nextBudget !== budget) updates.push(nextBudget);
  }

  if (updates.length > 0) await database.monthlyBudgets.bulkPut(updates);
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
    const [settings, monthlyBudget] = await Promise.all([
      this.getSettings(),
      this.database.monthlyBudgets.get(validMonthKey),
    ]);

    return {
      settings,
      monthlyBudget: monthlyBudget ?? null,
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
        await recalculateMonthlyBudgets(this.database, now);
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
      this.database.budgetSettings,
      async () => {
        const current = await this.database.monthlyBudgets.get(validMonthKey);
        if (current === undefined) return false;
        await this.database.monthlyBudgets.delete(validMonthKey);
        await recalculateMonthlyBudgets(this.database, now);
        return true;
      },
    );
  }

  async updateSettings(
    changes: Partial<Pick<BudgetSettings, 'monthlyCarryoverEnabled'>>,
  ): Promise<BudgetSettings> {
    const now = currentUtcIsoDateTime();

    return this.database.transaction(
      'rw',
      this.database.transactions,
      this.database.monthlyBudgets,
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
        await recalculateMonthlyBudgets(this.database, now);
        return updated;
      },
    );
  }
}
