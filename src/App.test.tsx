import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { createAppServices, type AppServices } from './app/services';
import { MyKakeiboDatabase } from './data/database';
import { initializeDatabase } from './data/initializeDatabase';

let database: MyKakeiboDatabase;
let services: AppServices;

beforeEach(async () => {
  database = new MyKakeiboDatabase(`app-test-${crypto.randomUUID()}`);
  await initializeDatabase(database);
  services = createAppServices(database);
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe('App', () => {
  it('5つのメインタブを表示する', async () => {
    render(<App services={services} />);
    const navigation = screen.getByRole('navigation', { name: 'メインメニュー' });
    expect(within(navigation).getAllByRole('button')).toHaveLength(5);
    expect(await screen.findByRole('heading', { name: 'My家計簿へようこそ' })).toBeInTheDocument();
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

  it('支出を登録して月別一覧へ表示する', async () => {
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
