import type {
  AppMetadata,
  DisplaySettings,
  ExpenseCategory,
  IncomeCategory,
  NotificationSettings,
  OnboardingState,
  PaymentMethod,
  UtcIsoDateTime,
} from '../domain/models';
import { DATABASE_VERSION } from './database';

export const CURRENT_DATA_VERSION = 2;
export const SYSTEM_UNSET_PAYMENT_METHOD_ID = 'payment-method-unset';

const EXPENSE_CATEGORY_NAMES = ['食費', '日用品', '交通費', '固定費', '娯楽費'] as const;
const INCOME_CATEGORY_NAMES = ['給与', '仕送り', '臨時収入', 'その他'] as const;

export interface InitialData {
  expenseCategories: ExpenseCategory[];
  incomeCategories: IncomeCategory[];
  paymentMethods: PaymentMethod[];
  displaySettings: DisplaySettings;
  notificationSettings: NotificationSettings;
  onboardingState: OnboardingState;
  appMetadata: AppMetadata;
}

export function createInitialData(now: UtcIsoDateTime): InitialData {
  const expenseCategories: ExpenseCategory[] = EXPENSE_CATEGORY_NAMES.map((name, index) => ({
    id: `expense-category-${index + 1}`,
    name,
    usageCount: 0,
    isActive: true,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  }));

  const incomeCategories: IncomeCategory[] = INCOME_CATEGORY_NAMES.map((name, index) => ({
    id: `income-category-${index + 1}`,
    name,
    usageCount: 0,
    isActive: true,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  }));

  const paymentMethods: PaymentMethod[] = [
    {
      id: SYSTEM_UNSET_PAYMENT_METHOD_ID,
      name: '未設定',
      kind: 'system-unset',
      usageCount: 0,
      isActive: true,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'payment-method-cash',
      name: '現金',
      kind: 'cash',
      usageCount: 0,
      isActive: true,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'payment-method-credit-card',
      name: 'クレジットカード',
      kind: 'credit-card',
      usageCount: 0,
      isActive: true,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'payment-method-electronic-money',
      name: '電子マネー',
      kind: 'electronic-money',
      usageCount: 0,
      isActive: true,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'payment-method-bank-transfer',
      name: '銀行振込',
      kind: 'bank-transfer',
      usageCount: 0,
      isActive: true,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    expenseCategories,
    incomeCategories,
    paymentMethods,
    displaySettings: {
      id: 'display-settings',
      transactionListFields: ['amount', 'category', 'paymentMethod', 'merchant', 'content'],
      showFilteredSummary: true,
      themeMode: 'system',
      updatedAt: now,
    },
    notificationSettings: {
      id: 'notification-settings',
      inAppEnabled: true,
      systemNotificationEnabled: false,
      lastKnownPermission: 'default',
      updatedAt: now,
    },
    onboardingState: {
      id: 'onboarding',
      currentStep: 0,
      draftSettings: {},
      isCompleted: false,
      completedAt: null,
      updatedAt: now,
    },
    appMetadata: {
      id: 'metadata',
      databaseVersion: DATABASE_VERSION,
      dataVersion: CURRENT_DATA_VERSION,
      initializedAt: now,
      lastMigratedAt: now,
    },
  };
}
