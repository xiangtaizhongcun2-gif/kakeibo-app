import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createAppServices, type AppServices } from '../../app/services';
import { MyKakeiboDatabase } from '../../data/database';
import { initializeDatabase } from '../../data/initializeDatabase';

let database: MyKakeiboDatabase;
let services: AppServices;

beforeEach(async () => {
  window.location.hash = '';
  database = new MyKakeiboDatabase(`savings-flow-${crypto.randomUUID()}`);
  await initializeDatabase(database);
  services = createAppServices(database);
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe('savings flow', () => {
  it('設定した貯金額・目標・達成率をホームへ表示する', async () => {
    const user = userEvent.setup();
    render(<App services={services} />);

    expect(await screen.findByRole('heading', { name: '現在の貯金' })).toBeInTheDocument();
    expect(screen.getByText('貯金目標はまだ設定されていません。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '設定' }));
    expect(await screen.findByRole('heading', { name: '貯金額・目標' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('現在の貯金額'));
    await user.type(screen.getByLabelText('現在の貯金額'), '50000');
    await user.type(screen.getByLabelText('目標名'), '旅行資金');
    await user.type(screen.getByLabelText('目標金額'), '100000');
    await user.click(screen.getByRole('button', { name: '貯金設定を保存' }));

    expect(
      await screen.findByText('貯金額と目標を保存しました。'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ホーム' }));

    expect(await screen.findByText('旅行資金')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/あと.*50,000/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '旅行資金の達成率' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
  });

  it('目標削除後も現在の貯金額を維持する', async () => {
    await services.savings.updateSettings({
      balanceYen: 75000,
      goalName: '引越し資金',
      goalAmountYen: 200000,
    });

    const user = userEvent.setup();
    render(<App services={services} />);
    await user.click(await screen.findByRole('button', { name: '設定' }));
    await user.click(screen.getByRole('button', { name: '目標を削除' }));
    expect(screen.getByRole('dialog', { name: '貯金目標を削除' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(
      await screen.findByText('貯金目標を削除しました。現在の貯金額は残しています。'),
    ).toBeInTheDocument();
    await waitFor(async () => {
      await expect(services.savings.getSettings()).resolves.toMatchObject({
        balanceYen: 75000,
        goalName: '',
        goalAmountYen: null,
      });
    });
  });
});
