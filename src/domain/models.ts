export type MoneyYen = number;
export type LocalDate = `${number}-${number}-${number}`;
export type MonthKey = `${number}-${number}`;
export type UtcIsoDateTime = string;

export type TransactionId = string;
export type ExpenseCategoryId = string;
export type IncomeCategoryId = string;
export type PaymentMethodId = string;

export interface EntityTimestamps {
  createdAt: UtcIsoDateTime;
  updatedAt: UtcIsoDateTime;
}

interface TransactionBase extends EntityTimestamps {
  id: TransactionId;
  amountYen: MoneyYen;
  date: LocalDate;
  content: string;
}

export interface ExpenseTransaction extends TransactionBase {
  type: 'expense';
  expenseCategoryId: ExpenseCategoryId;
  paymentMethodId: PaymentMethodId;
  merchant: string;
}

export interface IncomeTransaction extends TransactionBase {
  type: 'income';
  incomeCategoryId: IncomeCategoryId;
}

export type Transaction = ExpenseTransaction | IncomeTransaction;

export interface ExpenseCategory extends EntityTimestamps {
  id: ExpenseCategoryId;
  name: string;
  usageCount: number;
  isActive: boolean;
  isSystem: boolean;
}

export interface IncomeCategory extends EntityTimestamps {
  id: IncomeCategoryId;
  name: string;
  usageCount: number;
  isActive: boolean;
  isSystem: boolean;
}

export type PaymentMethodKind =
  | 'cash'
  | 'credit-card'
  | 'electronic-money'
  | 'bank-transfer'
  | 'other'
  | 'system-unset';

export interface PaymentMethod extends EntityTimestamps {
  id: PaymentMethodId;
  name: string;
  kind: PaymentMethodKind;
  usageCount: number;
  isActive: boolean;
  isSystem: boolean;
}

export interface MonthlyBudget extends EntityTimestamps {
  monthKey: MonthKey;
  baseAmountYen: MoneyYen;
  carryoverAmountYen: MoneyYen;
  effectiveAmountYen: MoneyYen;
}

export interface CategoryBudget extends EntityTimestamps {
  id: string;
  monthKey: MonthKey;
  expenseCategoryId: ExpenseCategoryId;
  baseAmountYen: MoneyYen;
  carryoverAmountYen: MoneyYen;
  effectiveAmountYen: MoneyYen;
}

export interface BudgetSettings {
  id: 'budget-settings';
  monthlyCarryoverEnabled: boolean;
  categoryCarryoverEnabled: boolean;
  updatedAt: UtcIsoDateTime;
}

interface NotificationStateBase {
  id: string;
  monthKey: MonthKey;
  hasEverExceeded: boolean;
  firstExceededAt: UtcIsoDateTime | null;
  inAppNotifiedAt: UtcIsoDateTime | null;
  systemNotifiedAt: UtcIsoDateTime | null;
}

export interface MonthlyBudgetNotificationState extends NotificationStateBase {
  budgetType: 'monthly';
}

export interface CategoryBudgetNotificationState extends NotificationStateBase {
  budgetType: 'category';
  expenseCategoryId: ExpenseCategoryId;
}

export type NotificationState =
  | MonthlyBudgetNotificationState
  | CategoryBudgetNotificationState;

export type TransactionListField =
  | 'amount'
  | 'category'
  | 'paymentMethod'
  | 'merchant'
  | 'content';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface DisplaySettings {
  id: 'display-settings';
  transactionListFields: TransactionListField[];
  showFilteredSummary: boolean;
  themeMode: ThemeMode;
  updatedAt: UtcIsoDateTime;
}

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface NotificationSettings {
  id: 'notification-settings';
  inAppEnabled: boolean;
  systemNotificationEnabled: boolean;
  lastKnownPermission: NotificationPermissionState;
  updatedAt: UtcIsoDateTime;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface OnboardingState {
  id: 'onboarding';
  currentStep: number;
  draftSettings: { [key: string]: JsonValue };
  isCompleted: boolean;
  completedAt: UtcIsoDateTime | null;
  updatedAt: UtcIsoDateTime;
}

export interface AppMetadata {
  id: 'metadata';
  databaseVersion: number;
  dataVersion: number;
  initializedAt: UtcIsoDateTime;
  lastMigratedAt: UtcIsoDateTime;
}
