import Dexie, { type Table } from 'dexie';
import type {
  AppMetadata,
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
export const DATABASE_VERSION = 1;

export class MyKakeiboDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  expenseCategories!: Table<ExpenseCategory, string>;
  incomeCategories!: Table<IncomeCategory, string>;
  paymentMethods!: Table<PaymentMethod, string>;
  monthlyBudgets!: Table<MonthlyBudget, string>;
  categoryBudgets!: Table<CategoryBudget, string>;
  notificationStates!: Table<NotificationState, string>;
  displaySettings!: Table<DisplaySettings, string>;
  notificationSettings!: Table<NotificationSettings, string>;
  onboardingStates!: Table<OnboardingState, string>;
  appMetadata!: Table<AppMetadata, string>;

  constructor(name = DATABASE_NAME) {
    super(name);

    this.version(DATABASE_VERSION).stores({
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
    });
  }
}

export const appDatabase = new MyKakeiboDatabase();
