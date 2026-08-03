import { describe, expect, it } from 'vitest';
import type { MonthlyBudget, Transaction } from '../../domain/models';
import type { TransactionMasterData } from '../transactions/transactionModel';
import {
  buildMonthlyExportReport,
  createCsvFilename,
  createTransactionsCsv,
  filterTransactionsByDateRange,
  monthDateRange,
  parseExportDateRange,
  renderMonthlyReportHtml,
} from './exportModel';

const timestamp = '2026-08-01T00:00:00.000Z';

const masterData: TransactionMasterData = {
  expenseCategories: [
    {
      id: 'food',
      name: '食費',
      usageCount: 1,
      isActive: true,
      isSystem: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  incomeCategories: [
    {
      id: 'salary',
      name: '給与',
      usageCount: 1,
      isActive: true,
      isSystem: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  paymentMethods: [
    {
      id: 'cash',
      name: '現金',
      kind: 'cash',
      usageCount: 1,
      isActive: true,
      isSystem: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
};

const transactions: Transaction[] = [
  {
    id: 'expense-2',
    type: 'expense',
    amountYen: 1200,
    date: '2026-08-20',
    expenseCategoryId: 'food',
    paymentMethodId: 'cash',
    merchant: 'スーパー,本店',
    content: '牛乳"パン',
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
  },
  {
    id: 'income-1',
    type: 'income',
    amountYen: 50000,
    date: '2026-08-01',
    incomeCategoryId: 'salary',
    content: '給与',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'other-month',
    type: 'expense',
    amountYen: 300,
    date: '2026-09-01',
    expenseCategoryId: 'food',
    paymentMethodId: 'cash',
    merchant: '売店',
    content: '飲み物',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
];

const budget: MonthlyBudget = {
  monthKey: '2026-08',
  baseAmountYen: 10000,
  carryoverAmountYen: 2000,
  effectiveAmountYen: 12000,
  createdAt: timestamp,
  updatedAt: timestamp,
};

describe('exportModel', () => {
  it('月の開始日と最終日を求める', () => {
    expect(monthDateRange('2026-02')).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
  });

  it('指定期間を検証し、期間内を古い順に抽出する', () => {
    expect(parseExportDateRange('2026-08-20', '2026-08-01')).toEqual({
      ok: false,
      message: '開始日は終了日以前にしてください。',
    });

    const range = parseExportDateRange('2026-08-01', '2026-08-31');
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(filterTransactionsByDateRange(transactions, range.range).map(({ id }) => id)).toEqual([
      'income-1',
      'expense-2',
    ]);
  });

  it('Excelで開けるBOM付きCSVを作り、カンマと引用符をエスケープする', () => {
    const csv = createTransactionsCsv(transactions.slice(0, 2), masterData);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"日付","種類","金額（円）"');
    expect(csv).toContain('"スーパー,本店"');
    expect(csv).toContain('"牛乳""パン"');
    expect(csv).toContain('"収入","50000","給与"');
  });

  it('ファイル名へ期間と用途を含める', () => {
    expect(
      createCsvFilename(
        { startDate: '2026-08-01', endDate: '2026-08-31' },
        'filtered',
      ),
    ).toBe('my-kakeibo_2026-08-01_2026-08-31_filtered.csv');
  });

  it('月次レポートへ集計・予算・明細をまとめる', () => {
    const report = buildMonthlyExportReport(
      '2026-08',
      transactions,
      masterData,
      budget,
      new Date('2026-08-31T03:00:00.000Z'),
    );

    expect(report.totals).toMatchObject({
      incomeYen: 50000,
      expenseYen: 1200,
      balanceYen: 48800,
      transactionCount: 2,
    });
    expect(report.budget).toMatchObject({
      effectiveAmountYen: 12000,
      spentAmountYen: 1200,
      remainingAmountYen: 10800,
      usagePercent: 10,
    });
    expect(report.transactions).toHaveLength(2);
  });

  it('印刷用HTMLへ日本語レポートを出力し、入力値をエスケープする', () => {
    const report = buildMonthlyExportReport(
      '2026-08',
      transactions,
      masterData,
      budget,
      new Date('2026-08-31T03:00:00.000Z'),
    );
    const secondRow = report.transactions[1];
    expect(secondRow).toBeDefined();
    if (secondRow === undefined) return;
    report.transactions[1] = {
      ...secondRow,
      content: '<script>alert(1)</script>',
    };

    const html = renderMonthlyReportHtml(report);
    expect(html).toContain('2026年8月 家計簿レポート');
    expect(html).toContain('@page { size: A4 portrait;');
    expect(html).toContain('カテゴリ別支出');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
