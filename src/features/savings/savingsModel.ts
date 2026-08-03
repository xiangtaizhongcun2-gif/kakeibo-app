import type { MoneyYen, SavingsSettings } from '../../domain/models';

export interface SavingsGoalProgress {
  goalName: string;
  balanceYen: MoneyYen;
  goalAmountYen: MoneyYen;
  remainingYen: MoneyYen;
  progressPercent: number;
  progressBarPercent: number;
  isAchieved: boolean;
}

export type SavingsAmountParseResult =
  | { ok: true; amountYen: MoneyYen }
  | { ok: false; message: string };

export type OptionalGoalAmountParseResult =
  | { ok: true; amountYen: MoneyYen | null }
  | { ok: false; message: string };

function parseInteger(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

export function parseSavingsBalance(value: string): SavingsAmountParseResult {
  const parsed = parseInteger(value);
  if (parsed === null) return { ok: false, message: '現在の貯金額を入力してください。' };
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return { ok: false, message: '貯金額は0円以上の整数で入力してください。' };
  }
  return { ok: true, amountYen: parsed };
}

export function parseSavingsGoalAmount(value: string): OptionalGoalAmountParseResult {
  const parsed = parseInteger(value);
  if (parsed === null) return { ok: true, amountYen: null };
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { ok: false, message: '目標金額は1円以上の整数で入力してください。' };
  }
  return { ok: true, amountYen: parsed };
}

export function createSavingsProgress(
  settings: SavingsSettings,
): SavingsGoalProgress | null {
  if (settings.goalAmountYen === null || settings.goalName.trim() === '') return null;

  const rawPercent = Math.floor(
    (settings.balanceYen / settings.goalAmountYen) * 100,
  );
  return {
    goalName: settings.goalName,
    balanceYen: settings.balanceYen,
    goalAmountYen: settings.goalAmountYen,
    remainingYen: Math.max(0, settings.goalAmountYen - settings.balanceYen),
    progressPercent: rawPercent,
    progressBarPercent: Math.min(100, rawPercent),
    isAchieved: settings.balanceYen >= settings.goalAmountYen,
  };
}
