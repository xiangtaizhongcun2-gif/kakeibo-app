import { useState, type InputHTMLAttributes } from 'react';
import {
  appendCalculatorDigits,
  appendCalculatorOperator,
  deleteCalculatorCharacter,
  evaluateMoneyExpression,
  formatCalculatorExpression,
  type CalculatorOperator,
} from './calculatorModel';
import './calculator.css';

interface MoneyInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'min' | 'step' | 'value' | 'onChange'
  > {
  value: string;
  onValueChange: (value: string) => void;
  minimumYen?: 0 | 1;
  calculatorLabel: string;
}

interface MoneyCalculatorDialogProps {
  initialValue: string;
  minimumYen: 0 | 1;
  label: string;
  onApply: (value: string) => void;
  onClose: () => void;
}

const OPERATOR_LABELS: Readonly<Record<CalculatorOperator, string>> = {
  '+': '足す',
  '-': '引く',
  '*': '掛ける',
  '/': '割る',
};

function initialExpression(value: string): string {
  return /^\d+$/.test(value) ? value : '';
}

function MoneyCalculatorDialog({
  initialValue,
  minimumYen,
  label,
  onApply,
  onClose,
}: MoneyCalculatorDialogProps): React.JSX.Element {
  const [expression, setExpression] = useState(() => initialExpression(initialValue));
  const [error, setError] = useState('');
  const [justEvaluated, setJustEvaluated] = useState(false);

  const enterDigits = (digits: string): void => {
    setExpression((current) =>
      appendCalculatorDigits(justEvaluated ? '' : current, digits),
    );
    setJustEvaluated(false);
    setError('');
  };

  const enterOperator = (operator: CalculatorOperator): void => {
    setExpression((current) => appendCalculatorOperator(current, operator));
    setJustEvaluated(false);
    setError('');
  };

  const calculate = (): number | null => {
    const result = evaluateMoneyExpression(expression, minimumYen);
    if (!result.ok) {
      setError(result.message);
      return null;
    }
    setExpression(String(result.value));
    setJustEvaluated(true);
    setError('');
    return result.value;
  };

  const apply = (): void => {
    const result = evaluateMoneyExpression(expression, minimumYen);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onApply(String(result.value));
  };

  return (
    <div className="dialog-backdrop calculator-backdrop" role="presentation" onClick={onClose}>
      <section
        className="sheet-dialog calculator-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-header">
          <div>
            <p className="kicker">CALCULATOR</p>
            <h2>電卓</h2>
          </div>
          <button type="button" className="icon-button" aria-label="電卓を閉じる" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="calculator-display">
          <small>計算式</small>
          <output aria-live="polite">
            {expression === '' ? '0' : formatCalculatorExpression(expression)}
          </output>
        </div>

        {error !== '' && <p className="calculator-error" role="alert">{error}</p>}

        <div className="calculator-keypad" aria-label="電卓のキー">
          <button
            type="button"
            className="calculator-key utility"
            onClick={() => {
              setExpression('');
              setJustEvaluated(false);
              setError('');
            }}
          >
            C
          </button>
          <button
            type="button"
            className="calculator-key utility"
            aria-label="1文字削除"
            onClick={() => {
              setExpression((current) => deleteCalculatorCharacter(current));
              setJustEvaluated(false);
              setError('');
            }}
          >
            ⌫
          </button>
          <button
            type="button"
            className="calculator-key operator"
            aria-label={OPERATOR_LABELS['/']}
            onClick={() => enterOperator('/')}
          >
            ÷
          </button>
          <button
            type="button"
            className="calculator-key operator"
            aria-label={OPERATOR_LABELS['*']}
            onClick={() => enterOperator('*')}
          >
            ×
          </button>

          {[7, 8, 9].map((digit) => (
            <button key={digit} type="button" className="calculator-key" onClick={() => enterDigits(String(digit))}>
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="calculator-key operator"
            aria-label={OPERATOR_LABELS['-']}
            onClick={() => enterOperator('-')}
          >
            −
          </button>

          {[4, 5, 6].map((digit) => (
            <button key={digit} type="button" className="calculator-key" onClick={() => enterDigits(String(digit))}>
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="calculator-key operator"
            aria-label={OPERATOR_LABELS['+']}
            onClick={() => enterOperator('+')}
          >
            ＋
          </button>

          {[1, 2, 3].map((digit) => (
            <button key={digit} type="button" className="calculator-key" onClick={() => enterDigits(String(digit))}>
              {digit}
            </button>
          ))}
          <button type="button" className="calculator-key equals" aria-label="計算する" onClick={() => void calculate()}>
            ＝
          </button>

          <button type="button" className="calculator-key zero" onClick={() => enterDigits('0')}>
            0
          </button>
          <button type="button" className="calculator-key double-zero" onClick={() => enterDigits('00')}>
            00
          </button>
        </div>

        <button type="button" className="primary-button calculator-apply" onClick={apply}>
          この金額を使う
        </button>
      </section>
    </div>
  );
}

export function MoneyInput({
  value,
  onValueChange,
  minimumYen = 1,
  calculatorLabel,
  ...inputProps
}: MoneyInputProps): React.JSX.Element {
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const openCalculator = (): void => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setCalculatorOpen(true);
  };

  return (
    <>
      <div className="money-field calculator-money-field">
        <span aria-hidden="true">¥</span>
        <input
          {...inputProps}
          type="number"
          inputMode="numeric"
          min={minimumYen}
          step="1"
          value={value}
          onChange={(event) => onValueChange(event.currentTarget.value)}
        />
        <button
          type="button"
          className="money-calculator-button"
          aria-label={calculatorLabel}
          onClick={openCalculator}
        >
          電卓
        </button>
      </div>

      {calculatorOpen && (
        <MoneyCalculatorDialog
          initialValue={value}
          minimumYen={minimumYen}
          label={calculatorLabel}
          onApply={(nextValue) => {
            onValueChange(nextValue);
            setCalculatorOpen(false);
          }}
          onClose={() => setCalculatorOpen(false)}
        />
      )}
    </>
  );
}
