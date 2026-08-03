import { describe, expect, it } from 'vitest';
import type { BackupSnapshot } from './backupModel';
import {
  BACKUP_FORMAT,
  BackupValidationError,
  backupSummary,
  createBackupDocument,
  createBackupFilename,
  parseBackupJson,
  stringifyBackup,
} from './backupModel';
import { createInitialData } from '../../data/initialData';

const timestamp = '2026-08-03T03:30:00.000Z';
const compatibility = { databaseVersion: 3, dataVersion: 4 } as const;

function validDocument() {
  const initial = createInitialData(timestamp);
  const expenseCategory = initial.expenseCategories[0]!;
  const cash = initial.paymentMethods.find((item) => item.id === 'payment-method-cash')!;
  const snapshot: BackupSnapshot = {
    transactions: [
      {
        id: 'transaction-1',
        type: 'expense',
        amountYen: 1280,
        date: '2026-08-03',
        expenseCategoryId: expenseCategory.id,
        paymentMethodId: cash.id,
        merchant: 'スーパー',
        content: '食料品',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    expenseCategories: initial.expenseCategories.map((item) =>
      item.id === expenseCategory.id ? { ...item, usageCount: 1 } : item,
    ),
    incomeCategories: initial.incomeCategories,
    paymentMethods: initial.paymentMethods.map((item) =>
      item.id === cash.id ? { ...item, usageCount: 1 } : item,
    ),
    monthlyBudgets: [
      {
        monthKey: '2026-08',
        baseAmountYen: 10000,
        carryoverAmountYen: 2000,
        effectiveAmountYen: 12000,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    categoryBudgets: [],
    budgetSettings: [initial.budgetSettings],
    savingsSettings: [
      {
        ...initial.savingsSettings,
        balanceYen: 50000,
        goalName: '旅行資金',
        goalAmountYen: 100000,
      },
    ],
    notificationStates: [],
    displaySettings: [initial.displaySettings],
    notificationSettings: [initial.notificationSettings],
    onboardingStates: [initial.onboardingState],
    appMetadata: [initial.appMetadata],
  };
  return createBackupDocument(snapshot, compatibility, timestamp);
}

describe('backupModel', () => {
  it('貯金設定を含む全テーブルのJSONを作成して検証する', () => {
    const document = validDocument();
    const parsed = parseBackupJson(stringifyBackup(document), compatibility);

    expect(parsed.format).toBe(BACKUP_FORMAT);
    expect(parsed.data.transactions).toHaveLength(1);
    expect(parsed.data.savingsSettings).toEqual([
      expect.objectContaining({
        balanceYen: 50000,
        goalName: '旅行資金',
        goalAmountYen: 100000,
      }),
    ]);
    expect(backupSummary(parsed)).toMatchObject({
      transactionCount: 1,
      expenseCategoryCount: 5,
      incomeCategoryCount: 4,
      monthlyBudgetCount: 1,
    });
    expect(createBackupFilename(timestamp)).toBe(
      'my-kakeibo-backup-20260803-033000Z.json',
    );
  });

  it('Phase 8のバックアップへ初期貯金設定を補い現在形式へ移行する', () => {
    const previous = structuredClone(validDocument());
    previous.databaseVersion = 2;
    previous.dataVersion = 3;
    previous.data.appMetadata[0] = {
      ...previous.data.appMetadata[0]!,
      databaseVersion: 2,
      dataVersion: 3,
    };
    const previousData = previous.data as unknown as Record<string, unknown>;
    delete previousData.savingsSettings;

    const parsed = parseBackupJson(JSON.stringify(previous), compatibility);

    expect(parsed.databaseVersion).toBe(3);
    expect(parsed.dataVersion).toBe(4);
    expect(parsed.data.savingsSettings).toEqual([
      {
        id: 'savings-settings',
        balanceYen: 0,
        goalName: '',
        goalAmountYen: null,
        updatedAt: timestamp,
      },
    ]);
    expect(parsed.data.appMetadata[0]).toMatchObject({
      databaseVersion: 3,
      dataVersion: 4,
    });
  });

  it('壊れたJSONと他アプリのJSONを拒否する', () => {
    expect(() => parseBackupJson('{', compatibility)).toThrow(BackupValidationError);
    expect(() =>
      parseBackupJson(
        JSON.stringify({ ...validDocument(), format: 'another-app' }),
        compatibility,
      ),
    ).toThrow('My家計簿のバックアップではありません');
  });

  it('互換性のないバージョンと必須項目不足を拒否する', () => {
    const incompatible = { ...validDocument(), databaseVersion: 99 };
    expect(() => parseBackupJson(JSON.stringify(incompatible), compatibility)).toThrow(
      '互換性のないデータバージョン',
    );

    const missing = structuredClone(validDocument());
    const unknownData = missing.data as unknown as Record<string, unknown>;
    delete unknownData.transactions;
    expect(() => parseBackupJson(JSON.stringify(missing), compatibility)).toThrow(
      '必須項目「transactions」',
    );
  });

  it('重複ID、不正な金額、不正な日付を拒否する', () => {
    const duplicate = structuredClone(validDocument());
    duplicate.data.transactions.push({
      ...duplicate.data.transactions[0]!,
      content: '重複',
    });
    expect(() => parseBackupJson(JSON.stringify(duplicate), compatibility)).toThrow(
      '重複があります',
    );

    const invalidMoney = structuredClone(validDocument());
    invalidMoney.data.transactions[0]!.amountYen = 0;
    expect(() => parseBackupJson(JSON.stringify(invalidMoney), compatibility)).toThrow(
      '1円以上',
    );

    const invalidDate = structuredClone(validDocument());
    invalidDate.data.transactions[0]!.date = '2026-02-30';
    expect(() => parseBackupJson(JSON.stringify(invalidDate), compatibility)).toThrow(
      '有効なYYYY-MM-DD',
    );
  });

  it('不正な貯金設定を拒否する', () => {
    const invalidSavings = structuredClone(validDocument());
    invalidSavings.data.savingsSettings[0]!.goalName = '';
    expect(() => parseBackupJson(JSON.stringify(invalidSavings), compatibility)).toThrow(
      '目標金額だけが設定されています',
    );
  });

  it('参照先不足と使用回数の不整合を拒否する', () => {
    const missingReference = structuredClone(validDocument());
    const transaction = missingReference.data.transactions[0]!;
    if (transaction.type === 'expense') {
      transaction.expenseCategoryId = 'missing-category';
    }
    expect(() =>
      parseBackupJson(JSON.stringify(missingReference), compatibility),
    ).toThrow('参照先が存在しません');

    const invalidCount = structuredClone(validDocument());
    invalidCount.data.expenseCategories[0]!.usageCount = 0;
    expect(() => parseBackupJson(JSON.stringify(invalidCount), compatibility)).toThrow(
      '収支の参照件数と一致しません',
    );
  });
});
