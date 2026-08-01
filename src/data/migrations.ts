import type {
  AppMetadata,
  TransactionListField,
  UtcIsoDateTime,
} from '../domain/models';
import type { MyKakeiboDatabase } from './database';
import { CURRENT_DATA_VERSION } from './initialData';

const VALID_LIST_FIELDS: readonly TransactionListField[] = [
  'amount',
  'category',
  'paymentMethod',
  'merchant',
  'content',
];

function isTransactionListField(value: string): value is TransactionListField {
  return VALID_LIST_FIELDS.some((field) => field === value);
}

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
      case 0:
        dataVersion = 1;
        break;
      case 1: {
        const settings = await database.displaySettings.get('display-settings');
        if (settings !== undefined) {
          const previousFields = settings.transactionListFields as readonly string[];
          const retainedFields = previousFields.filter(isTransactionListField);
          const transactionListFields: TransactionListField[] = retainedFields.includes('amount')
            ? [...retainedFields]
            : ['amount', ...retainedFields];

          await database.displaySettings.put({
            ...settings,
            transactionListFields:
              transactionListFields.length > 0
                ? transactionListFields
                : [...VALID_LIST_FIELDS],
            updatedAt: now,
          });
        }
        dataVersion = 2;
        break;
      }
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
