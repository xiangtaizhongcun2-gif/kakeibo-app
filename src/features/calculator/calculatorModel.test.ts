import { describe, expect, it } from 'vitest';
import {
  appendCalculatorDigits,
  appendCalculatorOperator,
  evaluateMoneyExpression,
  formatCalculatorExpression,
} from './calculatorModel';

describe('money calculator model', () => {
  it('掛け算と割り算を足し算と引き算より先に計算する', () => {
    expect(evaluateMoneyExpression('1200+300*2')).toEqual({ ok: true, value: 1800 });
    expect(evaluateMoneyExpression('2400/3-200')).toEqual({ ok: true, value: 600 });
  });

  it('0除算と1円未満の端数が出る割り算を拒否する', () => {
    expect(evaluateMoneyExpression('100/0')).toEqual({
      ok: false,
      message: '0では割れません。',
    });
    expect(evaluateMoneyExpression('1000/3')).toEqual({
      ok: false,
      message: '1円単位にならない割り算です。',
    });
  });

  it('貯金残高では0円を許可し、通常の金額では1円以上を求める', () => {
    expect(evaluateMoneyExpression('0', 0)).toEqual({ ok: true, value: 0 });
    expect(evaluateMoneyExpression('0', 1)).toEqual({
      ok: false,
      message: '1円以上になる計算にしてください。',
    });
  });

  it('入力中の演算子置換と先頭0を安全に扱う', () => {
    expect(appendCalculatorOperator('1200+', '*')).toBe('1200*');
    expect(appendCalculatorDigits('0', '05')).toBe('5');
    expect(formatCalculatorExpression('1200*3-200/2')).toBe('1200×3−200÷2');
  });
});
