import type { AppMetadata, UtcIsoDateTime } from '../domain/models';
import type { MyKakeiboDatabase } from './database';
import { CURRENT_DATA_VERSION } from './initialData';

export async function runDataMigrations(
  database: MyKakeiboDatabase,
  metadata: AppMetadata,
  now: UtcIsoDateTime,
): Promise<AppMetadata> {
  if (metadata.dataVersion > CURRENT_DATA_VERSION) {
    throw new Error('このデータは、現在のアプリより新しいバージョンで作成されています。');
  }

  let dataVersion = metadata.dataVersion;

  while (dataVersion < CURRENT_DATA_VERSION) {
    switch (dataVersion) {
      default:
        throw new Error(`未対応のデータバージョンです: ${dataVersion}`);
    }
  }

  if (dataVersion === metadata.dataVersion) return metadata;

  const migrated: AppMetadata = {
    ...metadata,
    dataVersion,
    lastMigratedAt: now,
  };
  await database.appMetadata.put(migrated);
  return migrated;
}
