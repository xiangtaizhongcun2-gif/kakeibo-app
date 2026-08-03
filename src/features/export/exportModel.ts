import type {
  LocalDate,
  MonthlyBudget,
  MonthKey,
  Transaction,
} from '../../domain/models';
import { toLocalDate, toMonthKey } from '../../domain/valueObjects';
import {
  aggregateTransactions,
  type BreakdownItem,
  type MonthlyTotals,
} from '../analytics/analyticsModel';
import { createBudgetProgress, type BudgetProgress } from '../budget/budgetModel';
import {
  categoryName,
  formatMonthKey,
  formatYen,
  paymentMethodName,
  type TransactionMasterData,
} from '../transactions/transactionModel';

export interface ExportDateRange {
  startDate: LocalDate;
  endDate: LocalDate;
}

export type ExportDateRangeResult =
  | { ok: true; range: ExportDateRange }
  | { ok: false; message: string };

export interface ExportTransactionRow {
  date: LocalDate;
  typeLabel: '支出' | '収入';
  amountYen: number;
  category: string;
  paymentMethod: string;
  merchant: string;
  content: string;
}

export interface MonthlyExportReport {
  monthKey: MonthKey;
  monthLabel: string;
  generatedAtLabel: string;
  totals: MonthlyTotals;
  expenseCategories: BreakdownItem[];
  paymentMethods: BreakdownItem[];
  budget: BudgetProgress | null;
  transactions: ExportTransactionRow[];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function escapeCsvCell(value: string | number): string {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatGeneratedAt(value: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function breakdownRows(items: readonly BreakdownItem[]): string {
  if (items.length === 0) {
    return '<tr><td colspan="4" class="empty-cell">支出がありません</td></tr>';
  }

  return items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="number">${escapeHtml(formatYen(item.amountYen))}</td>
        <td class="number">${item.ratioPercent}%</td>
        <td class="number">${item.transactionCount}件</td>
      </tr>`,
    )
    .join('');
}

function transactionRows(items: readonly ExportTransactionRow[]): string {
  if (items.length === 0) {
    return '<tr><td colspan="7" class="empty-cell">この月の収支はありません</td></tr>';
  }

  return items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.date)}</td>
        <td>${item.typeLabel}</td>
        <td class="number">${escapeHtml(formatYen(item.amountYen))}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.paymentMethod)}</td>
        <td>${escapeHtml(item.merchant)}</td>
        <td>${escapeHtml(item.content)}</td>
      </tr>`,
    )
    .join('');
}

export function monthDateRange(monthKey: MonthKey): ExportDateRange {
  const validMonthKey = toMonthKey(monthKey);
  const [yearText, monthText] = validMonthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${validMonthKey}-01` as LocalDate,
    endDate: `${validMonthKey}-${pad(lastDay)}` as LocalDate,
  };
}

export function parseExportDateRange(
  startDate: string,
  endDate: string,
): ExportDateRangeResult {
  let validStart: LocalDate;
  let validEnd: LocalDate;

  try {
    validStart = toLocalDate(startDate);
    validEnd = toLocalDate(endDate);
  } catch {
    return { ok: false, message: '正しい開始日と終了日を入力してください。' };
  }

  if (validStart > validEnd) {
    return { ok: false, message: '開始日は終了日以前にしてください。' };
  }

  return { ok: true, range: { startDate: validStart, endDate: validEnd } };
}

export function filterTransactionsByDateRange(
  transactions: readonly Transaction[],
  range: ExportDateRange,
): Transaction[] {
  return transactions
    .filter(
      (transaction) =>
        transaction.date >= range.startDate && transaction.date <= range.endDate,
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt),
    );
}

export function createExportRows(
  transactions: readonly Transaction[],
  masterData: TransactionMasterData,
): ExportTransactionRow[] {
  return transactions.map((transaction) => ({
    date: transaction.date,
    typeLabel: transaction.type === 'expense' ? '支出' : '収入',
    amountYen: transaction.amountYen,
    category: categoryName(transaction, masterData),
    paymentMethod:
      transaction.type === 'expense' ? paymentMethodName(transaction, masterData) : '',
    merchant: transaction.type === 'expense' ? transaction.merchant : '',
    content: transaction.content,
  }));
}

export function createTransactionsCsv(
  transactions: readonly Transaction[],
  masterData: TransactionMasterData,
): string {
  const rows = createExportRows(transactions, masterData);
  const header = [
    '日付',
    '種類',
    '金額（円）',
    'カテゴリ',
    '支払い方法',
    '店名',
    '内容',
  ];
  const lines = [
    header.map(escapeCsvCell).join(','),
    ...rows.map((row) =>
      [
        row.date,
        row.typeLabel,
        row.amountYen,
        row.category,
        row.paymentMethod,
        row.merchant,
        row.content,
      ]
        .map(escapeCsvCell)
        .join(','),
    ),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function createCsvFilename(
  range: ExportDateRange,
  suffix = '',
): string {
  const normalizedSuffix = suffix === '' ? '' : `_${suffix}`;
  return `my-kakeibo_${range.startDate}_${range.endDate}${normalizedSuffix}.csv`;
}

export function buildMonthlyExportReport(
  monthKey: MonthKey,
  transactions: readonly Transaction[],
  masterData: TransactionMasterData,
  budget: MonthlyBudget | null,
  generatedAt: Date = new Date(),
): MonthlyExportReport {
  const range = monthDateRange(monthKey);
  const monthlyTransactions = filterTransactionsByDateRange(transactions, range);
  const analytics = aggregateTransactions(monthlyTransactions, masterData);

  return {
    monthKey: toMonthKey(monthKey),
    monthLabel: formatMonthKey(monthKey),
    generatedAtLabel: formatGeneratedAt(generatedAt),
    totals: analytics.totals,
    expenseCategories: analytics.expenseCategories,
    paymentMethods: analytics.paymentMethods,
    budget:
      budget === null
        ? null
        : createBudgetProgress(budget, analytics.totals.expenseYen),
    transactions: createExportRows(monthlyTransactions, masterData),
  };
}

export function createMonthlyPdfFilename(monthKey: MonthKey): string {
  return `my-kakeibo_${toMonthKey(monthKey)}_report.pdf`;
}

export function renderMonthlyReportHtml(report: MonthlyExportReport): string {
  const budgetHtml =
    report.budget === null
      ? '<p class="muted">月予算は未設定です。</p>'
      : `<div class="summary-grid budget-grid">
          <div><span>基本予算</span><strong>${escapeHtml(formatYen(report.budget.baseAmountYen))}</strong></div>
          <div><span>繰越額</span><strong>${escapeHtml(formatYen(report.budget.carryoverAmountYen))}</strong></div>
          <div><span>有効予算</span><strong>${escapeHtml(formatYen(report.budget.effectiveAmountYen))}</strong></div>
          <div><span>${report.budget.isExceeded ? '超過額' : '残額'}</span><strong>${escapeHtml(formatYen(Math.abs(report.budget.remainingAmountYen)))}</strong></div>
          <div><span>使用率</span><strong>${report.budget.usagePercent}%</strong></div>
        </div>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(createMonthlyPdfFilename(report.monthKey))}</title>
<style>
  @page { size: A4 portrait; margin: 13mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #20221f; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif; font-size: 10pt; line-height: 1.5; }
  h1, h2, p { margin: 0; }
  header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-end; border-bottom: 2px solid #2f6554; padding-bottom: 10px; }
  h1 { font-size: 21pt; }
  header p { color: #60645e; font-size: 8.5pt; text-align: right; }
  section { margin-top: 16px; break-inside: avoid; }
  h2 { margin-bottom: 8px; font-size: 12pt; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .summary-grid > div { border: 1px solid #d9ddd8; border-radius: 8px; padding: 9px; }
  .summary-grid span { display: block; color: #666b64; font-size: 8pt; }
  .summary-grid strong { display: block; margin-top: 3px; font-size: 13pt; overflow-wrap: anywhere; }
  .budget-grid { grid-template-columns: repeat(5, 1fr); }
  .muted { color: #666b64; }
  .table-wrap { overflow: visible; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #d9ddd8; padding: 6px 7px; vertical-align: top; overflow-wrap: anywhere; }
  th { background: #eef3f0; text-align: left; }
  .number { text-align: right; white-space: nowrap; }
  .empty-cell { color: #666b64; text-align: center; padding: 14px; }
  footer { margin-top: 18px; border-top: 1px solid #d9ddd8; padding-top: 7px; color: #666b64; font-size: 7.5pt; }
  @media print { .no-print { display: none; } }
  @media screen { body { max-width: 210mm; margin: 0 auto; padding: 16px; } }
</style>
</head>
<body>
<header>
  <div><p>MY KAKEIBO MONTHLY REPORT</p><h1>${escapeHtml(report.monthLabel)} 家計簿レポート</h1></div>
  <p>作成日時<br>${escapeHtml(report.generatedAtLabel)}</p>
</header>
<section>
  <h2>月次サマリー</h2>
  <div class="summary-grid">
    <div><span>収入</span><strong>${escapeHtml(formatYen(report.totals.incomeYen))}</strong></div>
    <div><span>支出</span><strong>${escapeHtml(formatYen(report.totals.expenseYen))}</strong></div>
    <div><span>残額</span><strong>${escapeHtml(formatYen(report.totals.balanceYen))}</strong></div>
  </div>
</section>
<section><h2>月予算</h2>${budgetHtml}</section>
<section>
  <h2>カテゴリ別支出</h2>
  <div class="table-wrap"><table><thead><tr><th>カテゴリ</th><th class="number">金額</th><th class="number">比率</th><th class="number">件数</th></tr></thead><tbody>${breakdownRows(report.expenseCategories)}</tbody></table></div>
</section>
<section>
  <h2>支払い方法別支出</h2>
  <div class="table-wrap"><table><thead><tr><th>支払い方法</th><th class="number">金額</th><th class="number">比率</th><th class="number">件数</th></tr></thead><tbody>${breakdownRows(report.paymentMethods)}</tbody></table></div>
</section>
<section>
  <h2>収支明細</h2>
  <div class="table-wrap"><table><thead><tr><th>日付</th><th>種類</th><th class="number">金額</th><th>カテゴリ</th><th>支払い方法</th><th>店名</th><th>内容</th></tr></thead><tbody>${transactionRows(report.transactions)}</tbody></table></div>
</section>
<footer>このレポートは端末内のMy家計簿データから作成されました。データは外部サーバーへ送信されていません。</footer>
</body>
</html>`;
}
