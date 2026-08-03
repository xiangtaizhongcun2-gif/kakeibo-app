import { appDatabase, type MyKakeiboDatabase } from '../data/database';
import { BackupRepository } from '../data/repositories/backupRepository';
import { BudgetRepository } from '../data/repositories/budgetRepository';
import { MasterDataRepository } from '../data/repositories/masterDataRepository';
import { NotificationRepository } from '../data/repositories/notificationRepository';
import { SavingsRepository } from '../data/repositories/savingsRepository';
import { SettingsRepository } from '../data/repositories/settingsRepository';
import { TransactionRepository } from '../data/repositories/transactionRepository';

export interface AppServices {
  transactions: TransactionRepository;
  budgets: BudgetRepository;
  savings: SavingsRepository;
  backups: BackupRepository;
  notifications: NotificationRepository;
  masterData: MasterDataRepository;
  settings: SettingsRepository;
}

export function createAppServices(database: MyKakeiboDatabase = appDatabase): AppServices {
  return {
    transactions: new TransactionRepository(database),
    budgets: new BudgetRepository(database),
    savings: new SavingsRepository(database),
    backups: new BackupRepository(database),
    notifications: new NotificationRepository(database),
    masterData: new MasterDataRepository(database),
    settings: new SettingsRepository(database),
  };
}

export const defaultAppServices = createAppServices();
