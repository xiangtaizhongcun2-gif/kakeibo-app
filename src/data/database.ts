import Dexie, { type Table } from 'dexie';
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
  SavingsSettings,
  Transaction,
} from '../domain/models';

export const DATABASE_NAME = 'my-kakeibo';
export const DATABASE_VERSION = 3;

const VERSION_1_STORES = {
  transactions:
    '&id,type,date,expenseCategoryId,incomeCategoryId,paymentMethodId,[type+date],createdAt,updatedAt',
  expenseCategories: '&id,&name,isActive,isSystem,usageCount',
  incomeCategories: '&id,&name,isActive,isSystem,usageCount',
  paymentMethods: '&id,&name,kind,isActive,isSystem,usageCount',
  monthlyBudgets: '&monthKey,updatedAt',
  categoryBudgets: '&id,[monthKey+expenseCategoryId],monthKey,expenseCategoryId,updatedAt',
  notificationStates:
    '&id,budgetType,monthKey,expenseCategoryId,[budgetType+monthKey]',
  displaySettings: '&id',
  notificationSettings: '&id',
  onboardingStates: '&id',
  appMetadata: '&id,dataVersion',
} as const;

const VERSION_2_STORES = {
  ...VERSION_1_STORES,
  budgetSettings: '&id',
} as const;

export class MyKakeiboDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  expenseCategories!: Table<ExpenseCategory, string>;
  incomeCategories!: Table<IncomeCategory, string>;
  paymentMethods!: Table<PaymentMethod, string>;
  monthlyBudgets!: Table<MonthlyBudget, string>;
  categoryBudgets!: Table<CategoryBudget, string>;
  budgetSettings!: Table<BudgetSettings, string>;
  savingsSettings!: Table<SavingsSettings, string>;
  notificationStates!: Table<NotificationState, string>;
  displaySettings!: Table<DisplaySettings, string>;
  notificationSettings!: Table<NotificationSettings, string>;
  onboardingStates!: Table<OnboardingState, string>;
  appMetadata!: Table<AppMetadata, string>;

  constructor(name = DATABASE_NAME) {
    super(name);

    this.version(1).stores(VERSION_1_STORES);
    this.version(2).stores(VERSION_2_STORES);
    this.version(DATABASE_VERSION).stores({
      ...VERSION_2_STORES,
      savingsSettings: '&id',
    });
  }
}

export const appDatabase = new MyKakeiboDatabase();
