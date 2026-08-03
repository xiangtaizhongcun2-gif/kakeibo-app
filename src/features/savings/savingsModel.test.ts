import { describe, expect, it } from 'vitest';
import type { SavingsSettings } from '../../domain/models';
import {
  createSavingsProgress,
  parseSavingsBalance,
  parseSavingsGoalAmount,
} from './savingsModel';

const updatedAt = '2026-08-03T07:30:00.000Z';

function settings(
  balanceYen: number,
  goalName: string,
  goalAmountYen: number | null,
): SavingsSettings {
  return {
    id: 'savings-settings',
    balanceYen,
    goalName,
    goalAmountYen,
    updatedAt,
  };
}

describe('savingsModel', () => {
  it('現在の貯金額は0円以上の整数だけを受け付ける', () => {
    expect(parseSavingsBalance('0')).toEqual({ ok: true, amountYen: 0 });
    expect(parseSavingsBalance('125000')).toEqual({ ok: true, amountYen: 125000 });
    expect(parseSavingsBalance('')).toMatchObject({ ok: false });
    expect(parseSavingsBalance('-1')).toMatchObject({ ok: false });
    expect(parseSavingsBalance('1.5')).toMatchObject({ ok: false });
  });

  it('目標金額は未設定または1円以上の整数だけを受け付ける', () => {
    expect(parseSavingsGoalAmount('')).toEqual({ ok: true, amountYen: null });
    expect(parseSavingsGoalAmount('100000')).toEqual({ ok: true, amountYen: 100000 });
    expect(parseSavingsGoalAmount('0')).toMatchObject({ ok: false });
    expect(parseSavingsGoalAmount('-100')).toMatchObject({ ok: false });
  });

  it('目標未設定では進捗を作成しない', () => {
    expect(createSavingsProgress(settings(50000, '', null))).toBeNull();
  });

  it('目標までの残額と達成率を計算する', () => {
    expect(createSavingsProgress(settings(50000, '旅行資金', 100000))).toEqual({
      goalName: '旅行資金',
      balanceYen: 50000,
      goalAmountYen: 100000,
      remainingYen: 50000,
      progressPercent: 50,
      progressBarPercent: 50,
      isAchieved: false,
    });
  });

  it('目標超過時は実際の達成率を示し、バーだけ100%に制限する', () => {
    expect(createSavingsProgress(settings(125000, '旅行資金', 100000))).toMatchObject({
      remainingYen: 0,
      progressPercent: 125,
      progressBarPercent: 100,
      isAchieved: true,
    });
  });
});
