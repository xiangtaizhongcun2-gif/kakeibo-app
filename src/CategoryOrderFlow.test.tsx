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
  window.location.hash = '#/settings';
  database = new MyKakeiboDatabase(`category-order-${crypto.randomUUID()}`);
  await initializeDatabase(database);
  services = createAppServices(database);
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe('category order flow', () => {
  it('設定した支出カテゴリ順を登録フォームへ反映する', async () => {
    const user = userEvent.setup();
    render(<App services={services} />);

    expect(await screen.findByRole('heading', { name: '支出カテゴリ' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '娯楽費を上へ' }));

    expect(
      await screen.findByText('支出カテゴリの順番を変更しました。'),
    ).toBeInTheDocument();

    await waitFor(async () => {
      expect(await database.expenseCategories.get('expense-category-5')).toMatchObject({
        sortOrder: 3,
      });
      expect(await database.expenseCategories.get('expense-category-4')).toMatchObject({
        sortOrder: 4,
      });
    });

    await user.click(screen.getByRole('button', { name: '登録' }));
    expect(await screen.findByRole('heading', { name: '収支を登録' })).toBeInTheDocument();

    const categorySelect = screen.getByLabelText('カテゴリ');
    const labels = within(categorySelect)
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(labels).toEqual([
      '選択してください',
      '食費',
      '日用品',
      '交通費',
      '娯楽費',
      '固定費',
    ]);
  });

  it('追加したカテゴリを現在の並び順の末尾へ置く', async () => {
    await services.masterData.moveIncomeCategory('income-category-4', 'up');
    await services.masterData.createIncomeCategory('副業');

    const categories = await services.masterData.listIncomeCategories(true);
    expect(categories.map((category) => category.name)).toEqual([
      '給与',
      '仕送り',
      'その他',
      '臨時収入',
      '副業',
    ]);
    expect(categories.map((category) => category.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });

  it('設定した支払い方法順を登録フォームへ反映する', async () => {
    const user = userEvent.setup();
    render(<App services={services} />);

    expect(await screen.findByRole('heading', { name: '支払い方法' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '銀行振込を上へ' }));

    expect(
      await screen.findByText('支払い方法の順番を変更しました。'),
    ).toBeInTheDocument();

    await waitFor(async () => {
      expect(await database.paymentMethods.get('payment-method-bank-transfer')).toMatchObject({
        sortOrder: 2,
      });
      expect(await database.paymentMethods.get('payment-method-electronic-money')).toMatchObject({
        sortOrder: 3,
      });
    });

    await user.click(screen.getByRole('button', { name: '登録' }));
    expect(await screen.findByRole('heading', { name: '収支を登録' })).toBeInTheDocument();

    const paymentSelect = screen.getByLabelText('支払い方法');
    const labels = within(paymentSelect)
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(labels).toEqual([
      '選択してください',
      '未設定',
      '現金',
      'クレジットカード',
      '銀行振込',
      '電子マネー',
    ]);
  });

  it('追加した支払い方法を現在の並び順の末尾へ置く', async () => {
    await services.masterData.movePaymentMethod('payment-method-bank-transfer', 'up');
    await services.masterData.createPaymentMethod('PayPay', 'electronic-money');

    const paymentMethods = (await services.masterData.listPaymentMethods(true)).filter(
      (paymentMethod) => !paymentMethod.isSystem,
    );
    expect(paymentMethods.map((paymentMethod) => paymentMethod.name)).toEqual([
      '現金',
      'クレジットカード',
      '銀行振込',
      '電子マネー',
      'PayPay',
    ]);
    expect(paymentMethods.map((paymentMethod) => paymentMethod.sortOrder)).toEqual([
      0,
      1,
      2,
      3,
      4,
    ]);
  });
});
