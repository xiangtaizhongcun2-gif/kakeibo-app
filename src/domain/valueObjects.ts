import type { LocalDate, MoneyYen, MonthKey, UtcIsoDateTime } from './models';

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

export function toPositiveMoneyYen(value: number): MoneyYen {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError('金額は1円以上の安全な整数で指定してください。');
  }
  return value;
}

export function toNonNegativeMoneyYen(value: number): MoneyYen {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('金額は0円以上の安全な整数で指定してください。');
  }
  return value;
}

export function toLocalDate(value: string): LocalDate {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (match === null) throw new TypeError('日付はYYYY-MM-DD形式で指定してください。');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError('存在しない日付です。');
  }

  return value as LocalDate;
}

export function toMonthKey(value: string): MonthKey {
  const match = MONTH_KEY_PATTERN.exec(value);
  if (match === null) throw new TypeError('月はYYYY-MM形式で指定してください。');

  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new RangeError('月は01から12で指定してください。');
  return value as MonthKey;
}

export function monthKeyFromLocalDate(value: LocalDate): MonthKey {
  return value.slice(0, 7) as MonthKey;
}

export function toUtcIsoDateTime(value: string): UtcIsoDateTime {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError('日時はUTCのISO 8601形式で指定してください。');
  }
  return value;
}

export function currentUtcIsoDateTime(now: Date = new Date()): UtcIsoDateTime {
  return now.toISOString();
}

export function createEntityId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('この環境では安全なIDを生成できません。');
  }
  return globalThis.crypto.randomUUID();
}

export function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label}は0以上の安全な整数で指定してください。`);
  }
}
