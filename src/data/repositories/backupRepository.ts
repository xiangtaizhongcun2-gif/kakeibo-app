import type { Table } from 'dexie';
import type { UtcIsoDateTime } from '../../domain/models';
import { currentUtcIsoDateTime } from '../../domain/valueObjects';
import {
  createBackupDocument,
  parseBackupJson,
  type BackupDocument,
  type BackupSnapshot,
} from '../../features/backup/backupModel';
import { appDatabase, DATABASE_VERSION, type MyKakeiboDatabase } from '../database';
import { CURRENT_DATA_VERSION } from '../initialData';

const COMPATIBILITY = {
  databaseVersion: DATABASE_VERSION,
  dataVersion: CURRENT_DATA_VERSION,
} as const;

async function replaceTable<T, TKey>(table: Table<T, TKey>, items: readonly T[]): Promise<void> {
  await table.clear();
  if (items.length > 0) await table.bulkAdd([...items]);
}

export class BackupRepository {
  constructor(private readonly database: MyKakeiboDatabase = appDatabase) {}

  async createBackup(
    createdAt: UtcIsoDateTime = currentUtcIsoDateTime(),
  ): Promise<BackupDocument> {
    const data = await this.readSnapshot();
    return createBackupDocument(data, COMPATIBILITY, createdAt);
  }

  inspectBackup(content: string): BackupDocument {
    return parseBackupJson(content, COMPATIBILITY);
  }

  async restoreBackup(document: BackupDocument): Promise<void> {
    const validated = parseBackupJson(JSON.stringify(document), COMPATIBILITY);
    const data = validated.data;

    await this.database.transaction(
      'rw',
      [
        this.database.transactions,
        this.database.expenseCategories,
        this.database.incomeCategories,
        this.database.paymentMethods,
        this.database.monthlyBudgets,
        this.database.categoryBudgets,
        this.database.budgetSettings,
        this.database.savingsSettings,
        this.database.notificationStates,
        this.database.displaySettings,
        this.database.notificationSettings,
        this.database.onboardingStates,
        this.database.appMetadata,
      ],
      async () => {
        await replaceTable(this.database.transactions, data.transactions);
        await replaceTable(this.database.expenseCategories, data.expenseCategories);
        await replaceTable(this.database.incomeCategories, data.incomeCategories);
        await replaceTable(this.database.paymentMethods, data.paymentMethods);
        await replaceTable(this.database.monthlyBudgets, data.monthlyBudgets);
        await replaceTable(this.database.categoryBudgets, data.categoryBudgets);
        await replaceTable(this.database.budgetSettings, data.budgetSettings);
        await replaceTable(this.database.savingsSettings, data.savingsSettings);
        await replaceTable(this.database.notificationStates, data.notificationStates);
        await replaceTable(this.database.displaySettings, data.displaySettings);
        await replaceTable(this.database.notificationSettings, data.notificationSettings);
        await replaceTable(this.database.onboardingStates, data.onboardingStates);
        await replaceTable(this.database.appMetadata, data.appMetadata);
      },
    );
  }

  private async readSnapshot(): Promise<BackupSnapshot> {
    return this.database.transaction(
      'r',
      [
        this.database.transactions,
        this.database.expenseCategories,
        this.database.incomeCategories,
        this.database.paymentMethods,
        this.database.monthlyBudgets,
        this.database.categoryBudgets,
        this.database.budgetSettings,
        this.database.savingsSettings,
        this.database.notificationStates,
        this.database.displaySettings,
        this.database.notificationSettings,
        this.database.onboardingStates,
        this.database.appMetadata,
      ],
      async () => {
        const [
          transactions,
          expenseCategories,
          incomeCategories,
          paymentMethods,
          monthlyBudgets,
          categoryBudgets,
          budgetSettings,
          savingsSettings,
          notificationStates,
          displaySettings,
          notificationSettings,
          onboardingStates,
          appMetadata,
        ] = await Promise.all([
          this.database.transactions.toArray(),
          this.database.expenseCategories.toArray(),
          this.database.incomeCategories.toArray(),
          this.database.paymentMethods.toArray(),
          this.database.monthlyBudgets.toArray(),
          this.database.categoryBudgets.toArray(),
          this.database.budgetSettings.toArray(),
          this.database.savingsSettings.toArray(),
          this.database.notificationStates.toArray(),
          this.database.displaySettings.toArray(),
          this.database.notificationSettings.toArray(),
          this.database.onboardingStates.toArray(),
          this.database.appMetadata.toArray(),
        ]);

        return {
          transactions,
          expenseCategories,
          incomeCategories,
          paymentMethods,
          monthlyBudgets,
          categoryBudgets,
          budgetSettings,
          savingsSettings,
          notificationStates,
          displaySettings,
          notificationSettings,
          onboardingStates,
          appMetadata,
        };
      },
    );
  }
}
