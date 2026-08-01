import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('5つのメインタブを表示する', () => {
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'メインメニュー' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('タブ選択で画面とaria-currentが切り替わる', async () => {
    const user = userEvent.setup();
    render(<App />);
    const settings = screen.getByRole('button', { name: '設定' });
    await user.click(settings);
    expect(await screen.findByRole('heading', { name: 'アプリ情報' })).toBeInTheDocument();
    expect(settings).toHaveAttribute('aria-current', 'page');
  });

  it('旧版のLocalStorageデータへアクセスできる導線を表示する', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '設定' }));
    expect(screen.getByRole('link', { name: '旧版の家計簿を開く' })).toHaveAttribute(
      'href',
      '/legacy/',
    );
  });
});
