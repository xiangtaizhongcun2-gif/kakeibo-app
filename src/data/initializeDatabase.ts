import type { AppMetadata } from '../domain/models';
import { currentUtcIsoDateTime } from '../domain/valueObjects';
import { appDatabase, DATABASE_VERSION, type MyKakeiboDatabase } from './database';
import { createInitialData } from './initialData';
import { runDataMigrations } from './migrations';

export async function initializeDatabase(
  database: MyKakeiboDatabase = appDatabase,
): Promise<AppMetadata> {
  await database.open();
  const now = currentUtcIsoDateTime();

  return database.transaction(
    'rw',
    database.expenseCategories,
    database.incomeCategories,
    database.paymentMethods,
    database.displaySettings,
    database.notificationSettings,
    database.onboardingStates,
    database.appMetadata,
    async () => {
      const existingMetadata = await database.appMetadata.get('metadata');

      if (existingMetadata === undefined) {
        const initialData = createInitialData(now);
        await database.expenseCategories.bulkAdd(initialData.expenseCategories);
        await database.incomeCategories.bulkAdd(initialData.incomeCategories);
        await database.paymentMethods.bulkAdd(initialData.paymentMethods);
        await database.displaySettings.add(initialData.displaySettings);
        await database.notificationSettings.add(initialData.notificationSettings);
        await database.onboardingStates.add(initialData.onboardingState);
        await database.appMetadata.add(initialData.appMetadata);
        return initialData.appMetadata;
      }

      if (existingMetadata.databaseVersion > DATABASE_VERSION) {
        throw new Error('このデータベースは、現在のアプリより新しい形式です。');
      }

      const migratedMetadata = await runDataMigrations(database, existingMetadata, now);
      if (migratedMetadata.databaseVersion === DATABASE_VERSION) return migratedMetadata;

      const updatedMetadata: AppMetadata = {
        ...migratedMetadata,
        databaseVersion: DATABASE_VERSION,
        lastMigratedAt: now,
      };
      await database.appMetadata.put(updatedMetadata);
      return updatedMetadata;
    },
  );
}
