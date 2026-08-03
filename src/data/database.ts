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
  Transaction,
} from '../domain/models';

export const DATABASE_NAME = 'my-kakeibo';
export const DATABASE_VERSION = 2;

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

export class MyKakeiboDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  expenseCategories!: Table<ExpenseCategory, string>;
  incomeCategories!: Table<IncomeCategory, string>;
  paymentMethods!: Table<PaymentMethod, string>;
  monthlyBudgets!: Table<MonthlyBudget, string>;
  categoryBudgets!: Table<CategoryBudget, string>;
  budgetSettings!: Table<BudgetSettings, string>;
  notificationStates!: Table<NotificationState, string>;
  displaySettings!: Table<DisplaySettings, string>;
  notificationSettings!: Table<NotificationSettings, string>;
  onboardingStates!: Table<OnboardingState, string>;
  appMetadata!: Table<AppMetadata, string>;

  constructor(name = DATABASE_NAME) {
    super(name);

    this.version(1).stores(VERSION_1_STORES);
    this.version(DATABASE_VERSION).stores({
      ...VERSION_1_STORES,
      budgetSettings: '&id',
    });
  }
}

export const appDatabase = new MyKakeiboDatabase();
