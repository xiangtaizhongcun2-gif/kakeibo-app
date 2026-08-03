import { appDatabase, type MyKakeiboDatabase } from '../data/database';
import { BudgetRepository } from '../data/repositories/budgetRepository';
import { MasterDataRepository } from '../data/repositories/masterDataRepository';
import { SettingsRepository } from '../data/repositories/settingsRepository';
import { TransactionRepository } from '../data/repositories/transactionRepository';

export interface AppServices {
  transactions: TransactionRepository;
  budgets: BudgetRepository;
  masterData: MasterDataRepository;
  settings: SettingsRepository;
}

export function createAppServices(database: MyKakeiboDatabase = appDatabase): AppServices {
  return {
    transactions: new TransactionRepository(database),
    budgets: new BudgetRepository(database),
    masterData: new MasterDataRepository(database),
    settings: new SettingsRepository(database),
  };
}

export const defaultAppServices = createAppServices();
