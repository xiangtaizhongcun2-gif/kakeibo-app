import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../domain/models';
import { DailyTotalsHeader } from './DailyTotalsHeader';
import { formatYen } from './transactionModel';

const transactions: Transaction[] = [
  {
    id: 'expense',
    type: 'expense',
    amountYen: 1500,
    date: '2026-08-06',
    expenseCategoryId: 'food',
    paymentMethodId: 'cash',
    merchant: '',
    content: '食費',
    createdAt: '2026-08-06T01:00:00.000Z',
    updatedAt: '2026-08-06T01:00:00.000Z',
  },
  {
    id: 'income',
    type: 'income',
    amountYen: 1000,
    date: '2026-08-06',
    incomeCategoryId: 'other',
    content: '返金',
    createdAt: '2026-08-06T02:00:00.000Z',
    updatedAt: '2026-08-06T02:00:00.000Z',
  },
];

describe('DailyTotalsHeader', () => {
  it('日付と支出・収入・マイナス差額を表示する', () => {
    const { container } = render(
      <DailyTotalsHeader date="2026-08-06" transactions={transactions} />,
    );

    expect(screen.getByText('8月6日')).toBeInTheDocument();
    expect(screen.getByText(`−${formatYen(1500)}`)).toBeInTheDocument();
    expect(screen.getByText(`＋${formatYen(1000)}`)).toBeInTheDocument();
    expect(screen.getByText(`−${formatYen(500)}`)).toBeInTheDocument();
    expect(container.querySelector('.balance.negative')).not.toBeNull();
  });

  it('0円の差額はプラス側の表示色を使う', () => {
    const { container } = render(
      <DailyTotalsHeader date="2026-08-06" transactions={[]} />,
    );

    expect(screen.getAllByText(formatYen(0))).toHaveLength(1);
    expect(container.querySelector('.balance.positive')).not.toBeNull();
  });
});
