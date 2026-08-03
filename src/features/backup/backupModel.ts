import type {
  AppMetadata,
  BudgetSettings,
  CategoryBudget,
  DisplaySettings,
  ExpenseCategory,
  IncomeCategory,
  MonthlyBudget,
  NotificationSettings,
  NotificationState,
  OnboardingState,
  PaymentMethod,
  Transaction,
} from '../../domain/models';
import {
  toLocalDate,
  toMonthKey,
  toNonNegativeMoneyYen,
  toPositiveMoneyYen,
  toUtcIsoDateTime,
} from '../../domain/valueObjects';

export const BACKUP_FORMAT = 'my-kakeibo-backup';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupCompatibility {
  databaseVersion: number;
  dataVersion: number;
}

export interface BackupSnapshot {
  transactions: Transaction[];
  expenseCategories: ExpenseCategory[];
  incomeCategories: IncomeCategory[];
  paymentMethods: PaymentMethod[];
  monthlyBudgets: MonthlyBudget[];
  categoryBudgets: CategoryBudget[];
  budgetSettings: BudgetSettings[];
  notificationStates: NotificationState[];
  displaySettings: DisplaySettings[];
  notificationSettings: NotificationSettings[];
  onboardingStates: OnboardingState[];
  appMetadata: AppMetadata[];
}

export interface BackupDocument extends BackupCompatibility {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  createdAt: string;
  data: BackupSnapshot;
}

export interface BackupSummary {
  createdAt: string;
  transactionCount: number;
  expenseCategoryCount: number;
  incomeCategoryCount: number;
  paymentMethodCount: number;
  monthlyBudgetCount: number;
  notificationStateCount: number;
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

const PAYMENT_KINDS = new Set([
  'cash',
  'credit-card',
  'electronic-money',
  'bank-transfer',
  'other',
  'system-unset',
]);
const LIST_FIELDS = new Set([
  'amount',
  'category',
  'paymentMethod',
  'merchant',
  'content',
]);
const THEMES = new Set(['system', 'light', 'dark']);
const NOTIFICATION_PERMISSIONS = new Set([
  'default',
  'granted',
  'denied',
  'unsupported',
]);

function fail(label: string, message: string): never {
  throw new BackupValidationError(`${label}: ${message}`);
}

function record(value: unknown, label: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(label, 'オブジェクトではありません。');
  }
  return value as UnknownRecord;
}

function required(source: UnknownRecord, key: string, label: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    return fail(label, `必須項目「${key}」がありません。`);
  }
  return source[key];
}

function text(value: unknown, label: string, allowEmpty = true): string {
  if (typeof value !== 'string') return fail(label, '文字列ではありません。');
  if (!allowEmpty && value.trim() === '') return fail(label, '空文字列は使用できません。');
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') return fail(label, '真偽値ではありません。');
  return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    return fail(label, `${minimum}以上の安全な整数ではありません。`);
  }
  return value as number;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) return fail(label, '配列ではありません。');
  return value;
}

function utc(value: unknown, label: string): string {
  try {
    return toUtcIsoDateTime(text(value, label));
  } catch {
    return fail(label, 'UTCのISO 8601日時ではありません。');
  }
}

function nullableUtc(value: unknown, label: string): string | null {
  return value === null ? null : utc(value, label);
}

function localDate(value: unknown, label: string): string {
  try {
    return toLocalDate(text(value, label));
  } catch {
    return fail(label, '有効なYYYY-MM-DD形式の日付ではありません。');
  }
}

function monthKey(value: unknown, label: string): string {
  try {
    return toMonthKey(text(value, label));
  } catch {
    return fail(label, '有効なYYYY-MM形式の月ではありません。');
  }
}

function positiveMoney(value: unknown, label: string): number {
  try {
    return toPositiveMoneyYen(integer(value, label, 1));
  } catch {
    return fail(label, '1円以上の安全な整数ではありません。');
  }
}

function nonNegativeMoney(value: unknown, label: string): number {
  try {
    return toNonNegativeMoneyYen(integer(value, label));
  } catch {
    return fail(label, '0円以上の安全な整数ではありません。');
  }
}

function timestamps(source: UnknownRecord, label: string): void {
  utc(required(source, 'createdAt', label), `${label}.createdAt`);
  utc(required(source, 'updatedAt', label), `${label}.updatedAt`);
}

function jsonValue(value: unknown, label: string, depth = 0): void {
  if (depth > 50) fail(label, 'JSONの階層が深すぎます。');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(label, '有限数ではありません。');
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => jsonValue(item, `${label}[${index}]`, depth + 1));
    return;
  }
  const source = record(value, label);
  Object.entries(source).forEach(([key, item]) =>
    jsonValue(item, `${label}.${key}`, depth + 1),
  );
}

function validateTransaction(value: unknown, label: string): void {
  const source = record(value, label);
  text(required(source, 'id', label), `${label}.id`, false);
  positiveMoney(required(source, 'amountYen', label), `${label}.amountYen`);
  localDate(required(source, 'date', label), `${label}.date`);
  text(required(source, 'content', label), `${label}.content`);
  timestamps(source, label);

  const type = text(required(source, 'type', label), `${label}.type`);
  if (type === 'expense') {
    text(required(source, 'expenseCategoryId', label), `${label}.expenseCategoryId`, false);
    text(required(source, 'paymentMethodId', label), `${label}.paymentMethodId`, false);
    text(required(source, 'merchant', label), `${label}.merchant`);
    return;
  }
  if (type === 'income') {
    text(required(source, 'incomeCategoryId', label), `${label}.incomeCategoryId`, false);
    return;
  }
  fail(`${label}.type`, 'expenseまたはincomeではありません。');
}

function validateCategory(value: unknown, label: string): void {
  const source = record(value, label);
  text(required(source, 'id', label), `${label}.id`, false);
  text(required(source, 'name', label), `${label}.name`, false);
  integer(required(source, 'usageCount', label), `${label}.usageCount`);
  booleanValue(required(source, 'isActive', label), `${label}.isActive`);
  booleanValue(required(source, 'isSystem', label), `${label}.isSystem`);
  timestamps(source, label);
}

function validatePaymentMethod(value: unknown, label: string): void {
  validateCategory(value, label);
  const source = record(value, label);
  const kind = text(required(source, 'kind', label), `${label}.kind`);
  if (!PAYMENT_KINDS.has(kind)) fail(`${label}.kind`, '未対応の支払い方法種別です。');
}

function validateMonthlyBudget(value: unknown, label: string): void {
  const source = record(value, label);
  monthKey(required(source, 'monthKey', label), `${label}.monthKey`);
  const base = positiveMoney(required(source, 'baseAmountYen', label), `${label}.baseAmountYen`);
  const carryover = nonNegativeMoney(
    required(source, 'carryoverAmountYen', label),
    `${label}.carryoverAmountYen`,
  );
  const effective = positiveMoney(
    required(source, 'effectiveAmountYen', label),
    `${label}.effectiveAmountYen`,
  );
  if (effective !== base + carryover) fail(label, '有効予算が基本予算と繰越額の合計と一致しません。');
  timestamps(source, label);
}

function validateCategoryBudget(value: unknown, label: string): void {
  const source = record(value, label);
  text(required(source, 'id', label), `${label}.id`, false);
  monthKey(required(source, 'monthKey', label), `${label}.monthKey`);
  text(required(source, 'expenseCategoryId', label), `${label}.expenseCategoryId`, false);
  const base = positiveMoney(required(source, 'baseAmountYen', label), `${label}.baseAmountYen`);
  const carryover = nonNegativeMoney(
    required(source, 'carryoverAmountYen', label),
    `${label}.carryoverAmountYen`,
  );
  const effective = positiveMoney(
    required(source, 'effectiveAmountYen', label),
    `${label}.effectiveAmountYen`,
  );
  if (effective !== base + carryover) fail(label, '有効予算が基本予算と繰越額の合計と一致しません。');
  timestamps(source, label);
}

function validateBudgetSettings(value: unknown, label: string): void {
  const source = record(value, label);
  if (text(required(source, 'id', label), `${label}.id`) !== 'budget-settings') {
    fail(`${label}.id`, 'budget-settingsではありません。');
  }
  booleanValue(
    required(source, 'monthlyCarryoverEnabled', label),
    `${label}.monthlyCarryoverEnabled`,
  );
  utc(required(source, 'updatedAt', label), `${label}.updatedAt`);
}

function validateNotificationState(value: unknown, label: string): void {
  const source = record(value, label);
  text(required(source, 'id', label), `${label}.id`, false);
  monthKey(required(source, 'monthKey', label), `${label}.monthKey`);
  booleanValue(required(source, 'hasEverExceeded', label), `${label}.hasEverExceeded`);
  nullableUtc(required(source, 'firstExceededAt', label), `${label}.firstExceededAt`);
  nullableUtc(required(source, 'inAppNotifiedAt', label), `${label}.inAppNotifiedAt`);
  nullableUtc(required(source, 'systemNotifiedAt', label), `${label}.systemNotifiedAt`);
  const budgetType = text(required(source, 'budgetType', label), `${label}.budgetType`);
  if (budgetType === 'category') {
    text(required(source, 'expenseCategoryId', label), `${label}.expenseCategoryId`, false);
  } else if (budgetType !== 'monthly') {
    fail(`${label}.budgetType`, 'monthlyまたはcategoryではありません。');
  }
}

function validateDisplaySettings(value: unknown, label: string): void {
  const source = record(value, label);
  if (text(required(source, 'id', label), `${label}.id`) !== 'display-settings') {
    fail(`${label}.id`, 'display-settingsではありません。');
  }
  const fields = array(
    required(source, 'transactionListFields', label),
    `${label}.transactionListFields`,
  );
  if (fields.length === 0) fail(`${label}.transactionListFields`, '1項目以上必要です。');
  const names = fields.map((field, index) =>
    text(field, `${label}.transactionListFields[${index}]`),
  );
  names.forEach((field) => {
    if (!LIST_FIELDS.has(field)) fail(`${label}.transactionListFields`, '未対応の表示項目です。');
  });
  assertUniqueStrings(names, `${label}.transactionListFields`);
  booleanValue(required(source, 'showFilteredSummary', label), `${label}.showFilteredSummary`);
  const theme = text(required(source, 'themeMode', label), `${label}.themeMode`);
  if (!THEMES.has(theme)) fail(`${label}.themeMode`, '未対応のテーマです。');
  utc(required(source, 'updatedAt', label), `${label}.updatedAt`);
}

function validateNotificationSettings(value: unknown, label: string): void {
  const source = record(value, label);
  if (text(required(source, 'id', label), `${label}.id`) !== 'notification-settings') {
    fail(`${label}.id`, 'notification-settingsではありません。');
  }
  booleanValue(required(source, 'inAppEnabled', label), `${label}.inAppEnabled`);
  booleanValue(
    required(source, 'systemNotificationEnabled', label),
    `${label}.systemNotificationEnabled`,
  );
  const permission = text(
    required(source, 'lastKnownPermission', label),
    `${label}.lastKnownPermission`,
  );
  if (!NOTIFICATION_PERMISSIONS.has(permission)) {
    fail(`${label}.lastKnownPermission`, '未対応の通知権限状態です。');
  }
  utc(required(source, 'updatedAt', label), `${label}.updatedAt`);
}

function validateOnboardingState(value: unknown, label: string): void {
  const source = record(value, label);
  if (text(required(source, 'id', label), `${label}.id`) !== 'onboarding') {
    fail(`${label}.id`, 'onboardingではありません。');
  }
  integer(required(source, 'currentStep', label), `${label}.currentStep`);
  jsonValue(required(source, 'draftSettings', label), `${label}.draftSettings`);
  booleanValue(required(source, 'isCompleted', label), `${label}.isCompleted`);
  nullableUtc(required(source, 'completedAt', label), `${label}.completedAt`);
  utc(required(source, 'updatedAt', label), `${label}.updatedAt`);
}

function validateAppMetadata(value: unknown, label: string): void {
  const source = record(value, label);
  if (text(required(source, 'id', label), `${label}.id`) !== 'metadata') {
    fail(`${label}.id`, 'metadataではありません。');
  }
  integer(required(source, 'databaseVersion', label), `${label}.databaseVersion`, 1);
  integer(required(source, 'dataVersion', label), `${label}.dataVersion`, 1);
  utc(required(source, 'initializedAt', label), `${label}.initializedAt`);
  utc(required(source, 'lastMigratedAt', label), `${label}.lastMigratedAt`);
}

function validateArrayItems(
  value: unknown,
  label: string,
  validator: (item: unknown, itemLabel: string) => void,
): unknown[] {
  const items = array(value, label);
  items.forEach((item, index) => validator(item, `${label}[${index}]`));
  return items;
}

function objectId(value: unknown): string {
  const source = value as UnknownRecord;
  return source.id as string;
}

function assertUniqueStrings(values: readonly string[], label: string): void {
  const unique = new Set(values);
  if (unique.size !== values.length) fail(label, '重複があります。');
}

function assertUniqueIds(items: readonly unknown[], label: string): void {
  assertUniqueStrings(items.map(objectId), `${label}.id`);
}

function assertSingleton(items: readonly unknown[], id: string, label: string): void {
  if (items.length !== 1 || objectId(items[0]) !== id) {
    fail(label, `ID「${id}」のデータが1件必要です。`);
  }
}

function validateReferences(data: BackupSnapshot): void {
  const expenseIds = new Set(data.expenseCategories.map((item) => item.id));
  const incomeIds = new Set(data.incomeCategories.map((item) => item.id));
  const paymentIds = new Set(data.paymentMethods.map((item) => item.id));

  assertUniqueStrings(data.expenseCategories.map((item) => item.name), 'data.expenseCategories.name');
  assertUniqueStrings(data.incomeCategories.map((item) => item.name), 'data.incomeCategories.name');
  assertUniqueStrings(data.paymentMethods.map((item) => item.name), 'data.paymentMethods.name');
  assertUniqueStrings(data.monthlyBudgets.map((item) => item.monthKey), 'data.monthlyBudgets.monthKey');
  assertUniqueStrings(
    data.categoryBudgets.map((item) => `${item.monthKey}:${item.expenseCategoryId}`),
    'data.categoryBudgets.monthKey+expenseCategoryId',
  );

  const expenseUsage = new Map<string, number>();
  const incomeUsage = new Map<string, number>();
  const paymentUsage = new Map<string, number>();

  data.transactions.forEach((transaction, index) => {
    if (transaction.type === 'expense') {
      if (!expenseIds.has(transaction.expenseCategoryId)) {
        fail(`data.transactions[${index}].expenseCategoryId`, '参照先が存在しません。');
      }
      if (!paymentIds.has(transaction.paymentMethodId)) {
        fail(`data.transactions[${index}].paymentMethodId`, '参照先が存在しません。');
      }
      expenseUsage.set(
        transaction.expenseCategoryId,
        (expenseUsage.get(transaction.expenseCategoryId) ?? 0) + 1,
      );
      paymentUsage.set(
        transaction.paymentMethodId,
        (paymentUsage.get(transaction.paymentMethodId) ?? 0) + 1,
      );
    } else {
      if (!incomeIds.has(transaction.incomeCategoryId)) {
        fail(`data.transactions[${index}].incomeCategoryId`, '参照先が存在しません。');
      }
      incomeUsage.set(
        transaction.incomeCategoryId,
        (incomeUsage.get(transaction.incomeCategoryId) ?? 0) + 1,
      );
    }
  });

  data.expenseCategories.forEach((category, index) => {
    if (category.usageCount !== (expenseUsage.get(category.id) ?? 0)) {
      fail(`data.expenseCategories[${index}].usageCount`, '収支の参照件数と一致しません。');
    }
  });
  data.incomeCategories.forEach((category, index) => {
    if (category.usageCount !== (incomeUsage.get(category.id) ?? 0)) {
      fail(`data.incomeCategories[${index}].usageCount`, '収支の参照件数と一致しません。');
    }
  });
  data.paymentMethods.forEach((method, index) => {
    if (method.usageCount !== (paymentUsage.get(method.id) ?? 0)) {
      fail(`data.paymentMethods[${index}].usageCount`, '収支の参照件数と一致しません。');
    }
  });

  const unset = data.paymentMethods.find((item) => item.id === 'payment-method-unset');
  if (unset === undefined || unset.kind !== 'system-unset' || !unset.isSystem) {
    fail('data.paymentMethods', 'システム管理の「未設定」支払い方法がありません。');
  }

  data.categoryBudgets.forEach((budget, index) => {
    if (!expenseIds.has(budget.expenseCategoryId)) {
      fail(`data.categoryBudgets[${index}].expenseCategoryId`, '参照先が存在しません。');
    }
  });
  data.notificationStates.forEach((state, index) => {
    if (state.budgetType === 'category' && !expenseIds.has(state.expenseCategoryId)) {
      fail(`data.notificationStates[${index}].expenseCategoryId`, '参照先が存在しません。');
    }
  });
}

export function createBackupDocument(
  data: BackupSnapshot,
  compatibility: BackupCompatibility,
  createdAt: string,
): BackupDocument {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: toUtcIsoDateTime(createdAt),
    databaseVersion: compatibility.databaseVersion,
    dataVersion: compatibility.dataVersion,
    data,
  };
}

export function stringifyBackup(document: BackupDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function createBackupFilename(createdAt: string): string {
  const date = toUtcIsoDateTime(createdAt);
  const timestamp = date
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace(/\.\d{3}Z$/, 'Z');
  return `my-kakeibo-backup-${timestamp}.json`;
}

export function parseBackupJson(
  content: string,
  compatibility: BackupCompatibility,
): BackupDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new BackupValidationError('JSONとして読み込めませんでした。');
  }

  const root = record(parsed, 'backup');
  if (text(required(root, 'format', 'backup'), 'backup.format') !== BACKUP_FORMAT) {
    fail('backup.format', 'My家計簿のバックアップではありません。');
  }
  if (integer(required(root, 'formatVersion', 'backup'), 'backup.formatVersion', 1) !== BACKUP_FORMAT_VERSION) {
    fail('backup.formatVersion', '未対応のバックアップ形式です。');
  }
  utc(required(root, 'createdAt', 'backup'), 'backup.createdAt');
  const databaseVersion = integer(
    required(root, 'databaseVersion', 'backup'),
    'backup.databaseVersion',
    1,
  );
  const dataVersion = integer(required(root, 'dataVersion', 'backup'), 'backup.dataVersion', 1);
  if (databaseVersion !== compatibility.databaseVersion || dataVersion !== compatibility.dataVersion) {
    fail('backup', '現在のアプリと互換性のないデータバージョンです。');
  }

  const dataSource = record(required(root, 'data', 'backup'), 'backup.data');
  const transactions = validateArrayItems(
    required(dataSource, 'transactions', 'backup.data'),
    'data.transactions',
    validateTransaction,
  );
  const expenseCategories = validateArrayItems(
    required(dataSource, 'expenseCategories', 'backup.data'),
    'data.expenseCategories',
    validateCategory,
  );
  const incomeCategories = validateArrayItems(
    required(dataSource, 'incomeCategories', 'backup.data'),
    'data.incomeCategories',
    validateCategory,
  );
  const paymentMethods = validateArrayItems(
    required(dataSource, 'paymentMethods', 'backup.data'),
    'data.paymentMethods',
    validatePaymentMethod,
  );
  const monthlyBudgets = validateArrayItems(
    required(dataSource, 'monthlyBudgets', 'backup.data'),
    'data.monthlyBudgets',
    validateMonthlyBudget,
  );
  const categoryBudgets = validateArrayItems(
    required(dataSource, 'categoryBudgets', 'backup.data'),
    'data.categoryBudgets',
    validateCategoryBudget,
  );
  const budgetSettings = validateArrayItems(
    required(dataSource, 'budgetSettings', 'backup.data'),
    'data.budgetSettings',
    validateBudgetSettings,
  );
  const notificationStates = validateArrayItems(
    required(dataSource, 'notificationStates', 'backup.data'),
    'data.notificationStates',
    validateNotificationState,
  );
  const displaySettings = validateArrayItems(
    required(dataSource, 'displaySettings', 'backup.data'),
    'data.displaySettings',
    validateDisplaySettings,
  );
  const notificationSettings = validateArrayItems(
    required(dataSource, 'notificationSettings', 'backup.data'),
    'data.notificationSettings',
    validateNotificationSettings,
  );
  const onboardingStates = validateArrayItems(
    required(dataSource, 'onboardingStates', 'backup.data'),
    'data.onboardingStates',
    validateOnboardingState,
  );
  const appMetadata = validateArrayItems(
    required(dataSource, 'appMetadata', 'backup.data'),
    'data.appMetadata',
    validateAppMetadata,
  );

  [
    ['transactions', transactions],
    ['expenseCategories', expenseCategories],
    ['incomeCategories', incomeCategories],
    ['paymentMethods', paymentMethods],
    ['categoryBudgets', categoryBudgets],
    ['notificationStates', notificationStates],
  ].forEach(([label, items]) => assertUniqueIds(items as unknown[], `data.${String(label)}`));
  assertSingleton(budgetSettings, 'budget-settings', 'data.budgetSettings');
  assertSingleton(displaySettings, 'display-settings', 'data.displaySettings');
  assertSingleton(notificationSettings, 'notification-settings', 'data.notificationSettings');
  assertSingleton(onboardingStates, 'onboarding', 'data.onboardingStates');
  assertSingleton(appMetadata, 'metadata', 'data.appMetadata');

  const metadata = appMetadata[0] as AppMetadata;
  if (
    metadata.databaseVersion !== databaseVersion ||
    metadata.dataVersion !== dataVersion
  ) {
    fail('data.appMetadata[0]', 'ヘッダーのバージョンと一致しません。');
  }

  const document = parsed as BackupDocument;
  validateReferences(document.data);
  return document;
}

export function backupSummary(document: BackupDocument): BackupSummary {
  return {
    createdAt: document.createdAt,
    transactionCount: document.data.transactions.length,
    expenseCategoryCount: document.data.expenseCategories.length,
    incomeCategoryCount: document.data.incomeCategories.length,
    paymentMethodCount: document.data.paymentMethods.length,
    monthlyBudgetCount: document.data.monthlyBudgets.length,
    notificationStateCount: document.data.notificationStates.length,
  };
}
