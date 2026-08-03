import type { MoneyYen, SavingsSettings } from '../../domain/models';
import {
  currentUtcIsoDateTime,
  toNonNegativeMoneyYen,
  toPositiveMoneyYen,
} from '../../domain/valueObjects';
import { appDatabase, type MyKakeiboDatabase } from '../database';

export interface SavingsSettingsInput {
  balanceYen: MoneyYen;
  goalName: string;
  goalAmountYen: MoneyYen | null;
}

function validateInput(input: SavingsSettingsInput): SavingsSettingsInput {
  const balanceYen = toNonNegativeMoneyYen(input.balanceYen);
  const goalName = input.goalName.trim();

  if (goalName.length > 40) {
    throw new RangeError('目標名は40文字以内で入力してください。');
  }

  if (input.goalAmountYen === null) {
    if (goalName !== '') {
      throw new RangeError('目標名を設定する場合は目標金額も入力してください。');
    }
    return { balanceYen, goalName: '', goalAmountYen: null };
  }

  const goalAmountYen = toPositiveMoneyYen(input.goalAmountYen);
  if (goalName === '') {
    throw new RangeError('目標金額を設定する場合は目標名も入力してください。');
  }

  return { balanceYen, goalName, goalAmountYen };
}

export class SavingsRepository {
  constructor(private readonly database: MyKakeiboDatabase = appDatabase) {}

  async getSettings(): Promise<SavingsSettings> {
    const settings = await this.database.savingsSettings.get('savings-settings');
    if (settings === undefined) {
      throw new Error('貯金設定が初期化されていません。');
    }
    return settings;
  }

  async updateSettings(input: SavingsSettingsInput): Promise<SavingsSettings> {
    const validated = validateInput(input);
    const updated: SavingsSettings = {
      id: 'savings-settings',
      ...validated,
      updatedAt: currentUtcIsoDateTime(),
    };
    await this.database.savingsSettings.put(updated);
    return updated;
  }

  async clearGoal(): Promise<SavingsSettings> {
    const current = await this.getSettings();
    return this.updateSettings({
      balanceYen: current.balanceYen,
      goalName: '',
      goalAmountYen: null,
    });
  }
}
