export type CalculatorOperator = '+' | '-' | '*' | '/';

export type CalculatorEvaluation =
  | { ok: true; value: number }
  | { ok: false; message: string };

const MAX_EXPRESSION_LENGTH = 48;
const OPERATOR_PATTERN = /[+\-*/]/;

function isOperator(value: string | undefined): value is CalculatorOperator {
  return value === '+' || value === '-' || value === '*' || value === '/';
}

function safeInteger(value: number): boolean {
  return Number.isSafeInteger(value);
}

function applyOperator(
  left: number,
  operator: CalculatorOperator,
  right: number,
): CalculatorEvaluation {
  if (operator === '/' && right === 0) {
    return { ok: false, message: '0では割れません。' };
  }

  if (operator === '/' && left % right !== 0) {
    return { ok: false, message: '1円単位にならない割り算です。' };
  }

  const value =
    operator === '+'
      ? left + right
      : operator === '-'
        ? left - right
        : operator === '*'
          ? left * right
          : left / right;

  if (!safeInteger(value)) {
    return { ok: false, message: '計算結果が大きすぎます。' };
  }
  return { ok: true, value };
}

export function appendCalculatorDigits(expression: string, digits: string): string {
  if (!/^\d+$/.test(digits)) return expression;

  return [...digits].reduce((current, digit) => {
    if (current.length >= MAX_EXPRESSION_LENGTH) return current;
    const operand = current.split(OPERATOR_PATTERN).at(-1) ?? '';
    if (operand === '0') {
      return digit === '0' ? current : `${current.slice(0, -1)}${digit}`;
    }
    return `${current}${digit}`;
  }, expression);
}

export function appendCalculatorOperator(
  expression: string,
  operator: CalculatorOperator,
): string {
  if (expression === '') return expression;
  const last = expression.at(-1) ?? '';
  if (isOperator(last)) return `${expression.slice(0, -1)}${operator}`;
  if (expression.length >= MAX_EXPRESSION_LENGTH) return expression;
  return `${expression}${operator}`;
}

export function deleteCalculatorCharacter(expression: string): string {
  return expression.slice(0, -1);
}

export function formatCalculatorExpression(expression: string): string {
  return expression
    .replaceAll('*', '×')
    .replaceAll('/', '÷')
    .replaceAll('-', '−');
}

export function evaluateMoneyExpression(
  expression: string,
  minimumYen = 1,
): CalculatorEvaluation {
  if (expression === '') return { ok: false, message: '計算式を入力してください。' };
  if (!/^\d+(?:[+\-*/]\d+)*$/.test(expression)) {
    return { ok: false, message: '計算式が途中です。' };
  }

  const tokens = expression.split(/([+\-*/])/);
  const first = Number(tokens[0]);
  if (!safeInteger(first)) return { ok: false, message: '入力した数が大きすぎます。' };

  const values: number[] = [];
  const additiveOperators: Array<'+' | '-'> = [];
  let current = first;

  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const right = Number(tokens[index + 1]);
    if (!isOperator(operator) || !safeInteger(right)) {
      return { ok: false, message: '計算式を確認してください。' };
    }

    if (operator === '*' || operator === '/') {
      const result = applyOperator(current, operator, right);
      if (!result.ok) return result;
      current = result.value;
    } else {
      values.push(current);
      additiveOperators.push(operator);
      current = right;
    }
  }
  values.push(current);

  let total = values[0] ?? 0;
  for (let index = 0; index < additiveOperators.length; index += 1) {
    const operator = additiveOperators[index];
    const right = values[index + 1];
    if (operator === undefined || right === undefined) {
      return { ok: false, message: '計算式を確認してください。' };
    }
    const result = applyOperator(total, operator, right);
    if (!result.ok) return result;
    total = result.value;
  }

  if (total < minimumYen) {
    return {
      ok: false,
      message: minimumYen === 0 ? '0円以上になる計算にしてください。' : '1円以上になる計算にしてください。',
    };
  }
  return { ok: true, value: total };
}
