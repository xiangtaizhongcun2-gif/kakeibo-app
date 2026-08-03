import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createAppServices, type AppServices } from '../../app/services';
import { MyKakeiboDatabase } from '../../data/database';
import { initializeDatabase } from '../../data/initializeDatabase';
import { toLocalDate } from '../../domain/valueObjects';
import { currentMonthKey } from '../transactions/transactionModel';
import type {
  CsvExportResult,
  ExportGateway,
} from './browserExportGateway';
import type { MonthlyExportReport } from './exportModel';

class FakeExportGateway implements ExportGateway {
  csvExports: Array<{ content: string; filename: string }> = [];
  reports: MonthlyExportReport[] = [];

  async shareOrDownloadCsv(
    content: string,
    filename: string,
  ): Promise<CsvExportResult> {
    this.csvExports.push({ content, filename });
    return 'downloaded';
  }

  openMonthlyPdfReport(report: MonthlyExportReport): boolean {
    this.reports.push(report);
    return true;
  }
}

let database: MyKakeiboDatabase;
let services: AppServices;
let gateway: FakeExportGateway;

beforeEach(async () => {
  window.location.hash = '';
  database = new MyKakeiboDatabase(`export-flow-${crypto.randomUUID()}`);
  await initializeDatabase(database);
  services = createAppServices(database);
  gateway = new FakeExportGateway();
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe('Phase 7 export flow', () => {
  it('収支一覧の表示中フィルター結果だけをCSVへ出力する', async () => {
    const monthKey = currentMonthKey();
    await services.transactions.create({
      type: 'expense',
      amountYen: 1200,
      date: toLocalDate(`${monthKey}-01`),
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
    });
    await services.transactions.create({
      type: 'expense',
      amountYen: 500,
      date: toLocalDate(`${monthKey}-02`),
      expenseCategoryId: 'expense-category-3',
      paymentMethodId: 'payment-method-credit-card',
      merchant: '鉄道',
      content: '交通費',
    });

    const user = userEvent.setup();
    render(<App services={services} exportGateway={gateway} />);
    await user.click(screen.getByRole('button', { name: '収支' }));
    await screen.findByText('スーパー');
    await user.type(screen.getByPlaceholderText('店名・内容を検索'), 'スーパー');
    await user.click(screen.getByRole('button', { name: '表示中をCSV出力' }));

    await waitFor(() => expect(gateway.csvExports).toHaveLength(1));
    const exported = gateway.csvExports[0];
    expect(exported).toBeDefined();
    if (exported === undefined) return;
    expect(exported.filename).toContain('_filtered.csv');
    expect(exported.content).toContain('スーパー');
    expect(exported.content).not.toContain('鉄道');
  });

  it('設定画面から月次CSVとPDF用レポートを作成する', async () => {
    const monthKey = currentMonthKey();
    await services.budgets.setMonthlyBudget(monthKey, 10000);
    await services.transactions.create({
      type: 'income',
      amountYen: 50000,
      date: toLocalDate(`${monthKey}-01`),
      incomeCategoryId: 'income-category-1',
      content: '給与',
    });
    await services.transactions.create({
      type: 'expense',
      amountYen: 3000,
      date: toLocalDate(`${monthKey}-02`),
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
    });

    const user = userEvent.setup();
    render(<App services={services} exportGateway={gateway} />);
    await user.click(screen.getByRole('button', { name: '設定' }));
    expect(
      await screen.findByRole('heading', { name: 'CSV・PDF出力' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '月のCSVを共有・保存' }),
    );
    await waitFor(() => expect(gateway.csvExports).toHaveLength(1));
    expect(gateway.csvExports[0]?.content).toContain('給与');
    expect(gateway.csvExports[0]?.content).toContain('スーパー');

    await user.click(screen.getByRole('button', { name: 'PDFとして保存' }));
    expect(gateway.reports).toHaveLength(1);
    expect(gateway.reports[0]).toMatchObject({
      monthKey,
      totals: {
        incomeYen: 50000,
        expenseYen: 3000,
        balanceYen: 47000,
      },
      budget: {
        baseAmountYen: 10000,
        spentAmountYen: 3000,
        remainingAmountYen: 7000,
      },
    });
  });
});
