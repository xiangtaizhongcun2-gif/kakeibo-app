import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MonthlyTotals } from './analyticsModel';
import { SummaryCards } from './AnalyticsPanels';

function totals(balanceYen: number): MonthlyTotals {
  return {
    incomeYen: 100_000,
    expenseYen: 100_000 - balanceYen,
    balanceYen,
    transactionCount: 2,
    expenseCount: 1,
    incomeCount: 1,
  };
}

function balanceCard(): HTMLElement {
  const label = screen.getByText('残額');
  const card = label.closest('article');
  if (card === null) throw new Error('残額カードが見つかりません。');
  return card;
}

describe('SummaryCards', () => {
  it('残額がマイナスのとき赤字用クラスを付ける', () => {
    render(<SummaryCards totals={totals(-5_000)} />);

    expect(balanceCard()).toHaveClass('negative');
  });

  it.each([0, 5_000])('残額が%s円のとき現在の緑表示を維持する', (balanceYen) => {
    render(<SummaryCards totals={totals(balanceYen)} />);

    expect(balanceCard()).not.toHaveClass('negative');
  });
});
