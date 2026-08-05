import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MoneyInput } from './MoneyInput';

function calculatorButton(text: string): HTMLButtonElement {
  return screen.getByText(text, { selector: 'button' });
}

describe('MoneyInput', () => {
  it('通常の数値入力をそのまま利用できる', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <MoneyInput
        id="amount"
        value=""
        onValueChange={onValueChange}
        calculatorLabel="取引金額を電卓で計算"
      />,
    );

    await user.type(screen.getByRole('spinbutton'), '1200');
    expect(onValueChange).toHaveBeenCalled();
  });

  it('電卓の計算結果を金額欄へ反映する', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <MoneyInput
        id="amount"
        value=""
        onValueChange={onValueChange}
        calculatorLabel="取引金額を電卓で計算"
      />,
    );

    await user.click(screen.getByRole('button', { name: '取引金額を電卓で計算' }));
    expect(
      document.querySelector('[role="dialog"][aria-label="取引金額を電卓で計算"]'),
    ).toBeInTheDocument();

    await user.click(calculatorButton('1'));
    await user.click(calculatorButton('00'));
    await user.click(calculatorButton('＋'));
    await user.click(calculatorButton('2'));
    await user.click(calculatorButton('00'));
    await user.click(calculatorButton('この金額を使う'));

    expect(onValueChange).toHaveBeenLastCalledWith('300');
    expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('端数が出る割り算は金額へ反映しない', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <MoneyInput
        id="amount"
        value=""
        onValueChange={onValueChange}
        calculatorLabel="取引金額を電卓で計算"
      />,
    );

    await user.click(screen.getByRole('button', { name: '取引金額を電卓で計算' }));
    await user.click(calculatorButton('1'));
    await user.click(calculatorButton('00'));
    await user.click(calculatorButton('÷'));
    await user.click(calculatorButton('3'));
    await user.click(calculatorButton('この金額を使う'));

    expect(screen.getByText('1円単位にならない割り算です。')).toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
