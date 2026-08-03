import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createAppServices, type AppServices } from '../../app/services';
import { MyKakeiboDatabase } from '../../data/database';
import { initializeDatabase } from '../../data/initializeDatabase';
import type {
  BackupExportResult,
  BackupFileGateway,
} from './browserBackupGateway';
import { stringifyBackup } from './backupModel';

class TestBackupGateway implements BackupFileGateway {
  contentToRead = '';
  exportedContent = '';
  exportedFilename = '';

  async shareOrDownload(
    content: string,
    filename: string,
  ): Promise<BackupExportResult> {
    this.exportedContent = content;
    this.exportedFilename = filename;
    return 'downloaded';
  }

  async readText(): Promise<string> {
    return this.contentToRead;
  }
}

let database: MyKakeiboDatabase;
let services: AppServices;
let gateway: TestBackupGateway;

beforeEach(async () => {
  window.location.hash = '';
  database = new MyKakeiboDatabase(`backup-flow-${crypto.randomUUID()}`);
  await initializeDatabase(database);
  services = createAppServices(database);
  gateway = new TestBackupGateway();
});

afterEach(async () => {
  database.close();
  await database.delete();
});

async function openBackupPanel(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  render(<App services={services} backupGateway={gateway} />);
  await user.click(screen.getByRole('button', { name: '設定' }));
  expect(
    await screen.findByRole('heading', { name: 'バックアップ・復元' }),
  ).toBeInTheDocument();
}

function backupFileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('バックアップ用ファイル入力がありません。');
  return input;
}

describe('Phase 8 backup flow', () => {
  it('設定画面から全データのJSONバックアップを保存する', async () => {
    await services.transactions.create({
      type: 'expense',
      amountYen: 1280,
      date: '2026-08-03',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: 'スーパー',
      content: '食料品',
    });

    const user = userEvent.setup();
    await openBackupPanel(user);
    await user.click(screen.getByRole('button', { name: '全データをバックアップ' }));

    await waitFor(() => expect(gateway.exportedContent).not.toBe(''));
    expect(gateway.exportedFilename).toMatch(
      /^my-kakeibo-backup-\d{8}-\d{6}Z\.json$/,
    );
    expect(JSON.parse(gateway.exportedContent)).toMatchObject({
      format: 'my-kakeibo-backup',
      formatVersion: 1,
      data: {
        transactions: [{ content: '食料品' }],
        displaySettings: [{ id: 'display-settings' }],
        notificationSettings: [{ id: 'notification-settings' }],
      },
    });
    expect(
      await screen.findByText('全データのバックアップを保存しました。'),
    ).toBeInTheDocument();
  });

  it('検証済みファイルを最終確認後に現在データと置き換える', async () => {
    const backedUp = await services.transactions.create({
      type: 'expense',
      amountYen: 500,
      date: '2026-08-01',
      expenseCategoryId: 'expense-category-1',
      paymentMethodId: 'payment-method-cash',
      merchant: '売店',
      content: 'バックアップ側',
    });
    const document = await services.backups.createBackup('2026-08-03T03:30:00.000Z');
    gateway.contentToRead = stringifyBackup(document);

    await services.transactions.delete(backedUp.id);
    const current = await services.transactions.create({
      type: 'income',
      amountYen: 2000,
      date: '2026-08-02',
      incomeCategoryId: 'income-category-1',
      content: '現在側',
    });

    const user = userEvent.setup();
    await openBackupPanel(user);
    await user.upload(
      backupFileInput(),
      new File(['placeholder'], 'my-backup.json', { type: 'application/json' }),
    );

    expect(await screen.findByText('my-backup.json')).toBeInTheDocument();
    expect(screen.getByText('復元可能')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'このバックアップを復元' }));
    expect(
      screen.getByRole('dialog', { name: '全データを置き換えて復元' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(await database.transactions.get(current.id)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'このバックアップを復元' }));
    await user.click(
      screen.getByRole('button', { name: '現在のデータを消して復元' }),
    );

    expect(
      await screen.findByText('バックアップから全データを復元しました。'),
    ).toBeInTheDocument();
    await waitFor(async () => {
      expect(await database.transactions.get(backedUp.id)).toBeDefined();
      expect(await database.transactions.get(current.id)).toBeUndefined();
    });
  });

  it('不正ファイルでは確認画面を表示せず現在データを残す', async () => {
    const current = await services.transactions.create({
      type: 'income',
      amountYen: 3000,
      date: '2026-08-03',
      incomeCategoryId: 'income-category-1',
      content: '残すデータ',
    });
    gateway.contentToRead = '{"format":"not-kakeibo"}';

    const user = userEvent.setup();
    await openBackupPanel(user);
    await user.upload(
      backupFileInput(),
      new File(['invalid'], 'invalid.json', { type: 'application/json' }),
    );

    expect(await screen.findByText(/復元できないファイルです/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'このバックアップを復元' }),
    ).not.toBeInTheDocument();
    expect(await database.transactions.get(current.id)).toBeDefined();
  });
});
