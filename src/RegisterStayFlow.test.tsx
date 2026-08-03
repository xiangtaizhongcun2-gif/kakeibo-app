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
  window.location.hash = '#/register';
  database = new MyKakeiboDatabase(`register-stay-${crypto.randomUUID()}`);
  await initializeDatabase(database);
  services = createAppServices(database);
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe('register flow', () => {
  it('登録後も登録タブに残り、入力欄を初期化する', async () => {
    const user = userEvent.setup();
    render(<App services={services} />);

    expect(await screen.findByRole('heading', { name: '収支を登録' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('金額'), '1280');
    await user.clear(screen.getByLabelText('日付'));
    await user.type(screen.getByLabelText('日付'), '2026-08-04');
    await user.selectOptions(screen.getByLabelText('カテゴリ'), 'expense-category-1');
    await user.selectOptions(screen.getByLabelText('支払い方法'), 'payment-method-cash');
    await user.type(screen.getByLabelText(/店名/), 'スーパー');
    await user.type(screen.getByLabelText(/内容/), '食料品');
    await user.click(screen.getByRole('button', { name: '登録する' }));

    expect(
      await screen.findByText('収支を登録しました。続けて登録できます。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '収支を登録' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/register');

    const navigation = screen.getByRole('navigation', { name: 'メインメニュー' });
    expect(within(navigation).getByRole('button', { name: '登録' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    expect(screen.getByLabelText('金額')).toHaveValue(null);
    expect(screen.getByLabelText(/店名/)).toHaveValue('');
    expect(screen.getByLabelText(/内容/)).toHaveValue('');

    await waitFor(async () => expect(await database.transactions.count()).toBe(1));
  });
});
