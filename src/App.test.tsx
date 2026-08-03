import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { createAppServices, type AppServices } from './app/services';
import { MyKakeiboDatabase } from './data/database';
import { initializeDatabase } from './data/initializeDatabase';
import { toLocalDate } from './domain/valueObjects';
import { currentMonthKey, shiftMonthKey } from './features/transactions/transactionModel';

let database: MyKakeiboDatabase;
let services: AppServices;

beforeEach(async () => {
  window.location.hash = '';
  database = new MyKakeiboDatabase(`app-test-${crypto.randomUUID()}`);
  await initializeDatabase(database);
  services = createAppServices(database);
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe('App', () => {
  it('5つのメインタブと支出0件のホーム空状態を表示する', async () => {
    render(<App services={services} />);
    const navigation = screen.getByRole('navigation', { name: 'メインメニュー' });
    expect(within(navigation).getAllByRole('button')).toHaveLength(5);
    expect(await screen.findByRole('heading', { name: '前月との比較' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'カテゴリ別支出' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '月予算' })).toBeInTheDocument();
    expect(screen.getAllByText('支出がありません')).toHaveLength(2);
  });

  it('設定画面から旧版データへアクセスできる', async () => {
    const user = userEvent.setup();
    render(<App services={services} />);
    await user.click(screen.getByRole('button', { name: '設定' }));
    expect(await screen.findByRole('heading', { name: '一覧の表示項目' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '旧版の家計簿を開く' })).toHaveAttribute(
      'href',
      '/legacy/index.html',
    );
  });

  it('ホームに月次集計・カテゴリ比率・支払い方法別を表示する', async () => {
    const monthKey = currentMonthKey();
    const previousMonthKey = shiftMonthKey(monthKey, -1);

    await services.transactions.create({
      type: 'income',
      amountYen: 5000,
      date: toLocalDate(`${monthKey}-01`),
      incomeCategoryId: 'income-category-1',
      content: '今月の収入',
    });
    await services.transactions.create({
      type: 'expense',
      amountYen: 2000,
      date: toLocalDate(`${monthKey}-01`),
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
    });
    await services.transactions.create({
      type: 'expense',
      amountYen: 1000,
      date: toLocalDate(`${monthKey}-02`),
      expenseCategoryId: 'expense-category-3',
      paymentMethodId: 'payment-method-credit-card',
      merchant: '鉄道',
      content: '交通費',
    });
    await services.transactions.create({
      type: 'income',
      amountYen: 3000,
      date: toLocalDate(`${previousMonthKey}-01`),
      incomeCategoryId: 'income-category-1',
      content: '前月の収入',
    });

    const user = userEvent.setup();
    render(<App services={services} />);

    expect(await screen.findByText(/5,000/)).toBeInTheDocument();
    expect(screen.getAllByText(/3,000/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /食費.*2,000.*66.7%/ })).toBeInTheDocument();
    expect(screen.getByText('現金')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'すべて見る' }));
    expect(screen.getByRole('dialog', { name: '支払い方法別集計' })).toBeInTheDocument();
  });

  it('予算タブで繰越を有効化し、月予算を設定してホームへ反映する', async () => {
    const monthKey = currentMonthKey();
    await services.transactions.create({
      type: 'expense',
      amountYen: 4000,
      date: toLocalDate(`${monthKey}-01`),
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
    });

    const user = userEvent.setup();
    render(<App services={services} />);
    await user.click(screen.getByRole('button', { name: '予算' }));
    expect(await screen.findByRole('heading', { name: '未使用予算の繰越' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    await waitFor(async () =>
      expect(await database.budgetSettings.get('budget-settings')).toMatchObject({
        monthlyCarryoverEnabled: true,
      }),
    );

    await user.type(screen.getByLabelText('予算額'), '10000');
    await user.click(screen.getByRole('button', { name: '予算を設定' }));

    await waitFor(async () =>
      expect(await database.monthlyBudgets.get(monthKey)).toMatchObject({
        baseAmountYen: 10000,
        effectiveAmountYen: 10000,
      }),
    );
    expect(await screen.findByRole('progressbar', { name: /月予算の使用率/ })).toHaveAttribute(
      'aria-valuetext',
      '40%',
    );

    await user.click(screen.getByRole('button', { name: 'ホーム' }));
    expect(await screen.findByRole('heading', { name: '月予算' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /予算の使用率/ })).toHaveAttribute(
      'aria-valuetext',
      '40%',
    );
  });

  it('支出を登録して月別一覧と集計へ表示する', async () => {
    const user = userEvent.setup();
    render(<App services={services} />);

    await user.click(screen.getByRole('button', { name: '登録' }));
    expect(await screen.findByRole('heading', { name: '収支を登録' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('金額'), '1280');
    await user.clear(screen.getByLabelText('日付'));
    await user.type(screen.getByLabelText('日付'), '2026-08-01');
    await user.selectOptions(screen.getByLabelText('カテゴリ'), 'expense-category-1');
    await user.selectOptions(screen.getByLabelText('支払い方法'), 'payment-method-cash');
    await user.type(screen.getByLabelText(/店名/), 'スーパー');
    await user.type(screen.getByLabelText(/内容/), '食料品');
    await user.click(screen.getByRole('button', { name: '登録する' }));

    expect(await screen.findByText('収支を登録しました。')).toBeInTheDocument();
    expect(await screen.findByText('スーパー')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '表示中の収支集計' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '表示中の支払い方法別' })).toBeInTheDocument();
    await waitFor(async () => expect(await database.transactions.count()).toBe(1));
  });

  it('削除前に確認画面を表示し、確定後に削除する', async () => {
    const transaction = await services.transactions.create({
      type: 'expense',
      amountYen: 500,
      date: '2026-08-01',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: '売店',
      content: '飲み物',
    });
    window.location.hash = '#/transactions';
    const user = userEvent.setup();
    render(<App services={services} />);

    const row = await screen.findByRole('button', { name: /500.*食費.*飲み物/ });
    await user.click(row);
    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(screen.getByRole('dialog', { name: '収支を削除' })).toBeInTheDocument();
    expect(await database.transactions.get(transaction.id)).toBeDefined();
    await user.click(screen.getByRole('button', { name: '削除する' }));
    await waitFor(async () => expect(await database.transactions.get(transaction.id)).toBeUndefined());
  });
});
