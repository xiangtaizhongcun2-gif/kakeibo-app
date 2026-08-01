import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../domain/models';
import {
  applyTransactionFilters,
  buildTransactionInput,
  groupTransactionsByDate,
  shiftMonthKey,
} from './transactionModel';

const transactions: Transaction[] = [
  {
    id: 'newer',
    type: 'expense',
    amountYen: 1200,
    date: '2026-08-02',
    expenseCategoryId: 'food',
    paymentMethodId: 'cash',
    merchant: 'スーパー',
    content: '食料品',
    createdAt: '2026-08-02T03:00:00.000Z',
    updatedAt: '2026-08-02T03:00:00.000Z',
  },
  {
    id: 'older',
    type: 'income',
    amountYen: 50000,
    date: '2026-08-01',
    incomeCategoryId: 'salary',
    content: '8月分',
    createdAt: '2026-08-01T03:00:00.000Z',
    updatedAt: '2026-08-01T03:00:00.000Z',
  },
];

describe('transactionModel', () => {
  it('支出フォームを保存用データへ変換する', () => {
    expect(
      buildTransactionInput({
        type: 'expense',
        amount: '1280',
        date: '2026-08-01',
        categoryId: 'food',
        paymentMethodId: 'cash',
        merchant: ' スーパー ',
        content: ' 食料品 ',
      }),
    ).toEqual({
      ok: true,
      value: {
        type: 'expense',
        amountYen: 1280,
        date: '2026-08-01',
        expenseCategoryId: 'food',
        paymentMethodId: 'cash',
        merchant: 'スーパー',
        content: '食料品',
      },
    });
  });

  it('0円・不正日付・未選択を拒否する', () => {
    const result = buildTransactionInput({
      type: 'expense',
      amount: '0',
      date: '2026-02-30',
      categoryId: '',
      paymentMethodId: '',
      merchant: '',
      content: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toMatchObject({
        amount: expect.any(String),
        date: expect.any(String),
        categoryId: expect.any(String),
        paymentMethodId: expect.any(String),
      });
    }
  });

  it('店名・内容を検索し、日付ごとにまとめる', () => {
    const filtered = applyTransactionFilters(transactions, {
      query: 'スーパー',
      type: 'all',
      date: '',
      categoryKey: '',
      paymentMethodId: '',
    });
    expect(filtered.map(({ id }) => id)).toEqual(['newer']);
    expect(groupTransactionsByDate(transactions).map(({ date }) => date)).toEqual([
      '2026-08-02',
      '2026-08-01',
    ]);
  });

  it('年をまたいで月を移動する', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
  });
});
