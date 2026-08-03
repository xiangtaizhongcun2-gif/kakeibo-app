import { useRef, useState, type ChangeEvent } from 'react';
import type { BackupRepository } from '../../data/repositories/backupRepository';
import type { BackupDocument, BackupSummary } from './backupModel';
import {
  backupSummary,
  createBackupFilename,
  stringifyBackup,
} from './backupModel';
import type { BackupFileGateway } from './browserBackupGateway';
import './backup.css';

interface BackupRestorePanelProps {
  repository: BackupRepository;
  gateway: BackupFileGateway;
  onRestored: () => Promise<void>;
}

interface InspectedBackup {
  fileName: string;
  document: BackupDocument;
  summary: BackupSummary;
}

function formatBackupDate(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function BackupRestorePanel({
  repository,
  gateway,
  onRestored,
}: BackupRestorePanelProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inspected, setInspected] = useState<InspectedBackup | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const createBackup = async (): Promise<void> => {
    setMessage('');
    setError('');
    setIsExporting(true);
    try {
      const document = await repository.createBackup();
      const result = await gateway.shareOrDownload(
        stringifyBackup(document),
        createBackupFilename(document.createdAt),
      );
      setMessage(
        result === 'shared'
          ? '全データのバックアップを共有しました。'
          : '全データのバックアップを保存しました。',
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'バックアップを作成できませんでした。',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const inspectFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) return;

    setMessage('');
    setError('');
    setInspected(null);
    setShowConfirmation(false);
    setIsInspecting(true);
    try {
      const content = await gateway.readText(file);
      const document = repository.inspectBackup(content);
      setInspected({
        fileName: file.name,
        document,
        summary: backupSummary(document),
      });
      setMessage('バックアップの検証が完了しました。内容を確認してください。');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? `復元できないファイルです。${caught.message}`
          : '復元できないファイルです。',
      );
    } finally {
      setIsInspecting(false);
    }
  };

  const restore = async (): Promise<void> => {
    if (inspected === null) return;
    setError('');
    setMessage('');
    setIsRestoring(true);
    try {
      await repository.restoreBackup(inspected.document);
      await onRestored();
      setShowConfirmation(false);
      setInspected(null);
      setMessage('バックアップから全データを復元しました。');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? `復元に失敗しました。現在のデータは変更されていません。${caught.message}`
          : '復元に失敗しました。現在のデータは変更されていません。',
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <section className="backup-card" aria-labelledby="backup-title">
      <header className="backup-heading">
        <div>
          <p className="kicker">DATA MANAGEMENT</p>
          <h2 id="backup-title">バックアップ・復元</h2>
        </div>
        <span className="local-only-badge">端末内処理</span>
      </header>

      <p className="backup-description">
        収支、カテゴリ、支払い方法、予算、表示・通知設定など、現在の全データを1つのJSONファイルへ保存します。
      </p>

      {(message !== '' || error !== '') && (
        <div
          className={error === '' ? 'status-message success' : 'status-message error'}
          role="status"
        >
          {error === '' ? message : error}
        </div>
      )}

      <div className="backup-action-block">
        <div>
          <h3>バックアップを作成</h3>
          <p>復元に必要な全データと形式バージョン、作成日時を保存します。</p>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={isExporting}
          onClick={() => void createBackup()}
        >
          {isExporting ? '作成中…' : '全データをバックアップ'}
        </button>
      </div>

      <div className="backup-divider" aria-hidden="true" />

      <div className="backup-action-block">
        <div>
          <h3>バックアップから復元</h3>
          <p>ファイルを検証した後、現在のデータと設定をすべて置き換えます。</p>
        </div>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void inspectFile(event)}
        />
        <button
          type="button"
          className="secondary-button"
          disabled={isInspecting || isRestoring}
          onClick={() => fileInputRef.current?.click()}
        >
          {isInspecting ? '検証中…' : 'バックアップファイルを選択'}
        </button>
      </div>

      {inspected !== null && (
        <article className="backup-preview" aria-label="選択したバックアップの内容">
          <header>
            <div>
              <small>検証済み</small>
              <h3>{inspected.fileName}</h3>
            </div>
            <span>復元可能</span>
          </header>
          <dl>
            <div><dt>作成日時</dt><dd>{formatBackupDate(inspected.summary.createdAt)}</dd></div>
            <div><dt>収支</dt><dd>{inspected.summary.transactionCount}件</dd></div>
            <div><dt>支出カテゴリ</dt><dd>{inspected.summary.expenseCategoryCount}件</dd></div>
            <div><dt>収入カテゴリ</dt><dd>{inspected.summary.incomeCategoryCount}件</dd></div>
            <div><dt>支払い方法</dt><dd>{inspected.summary.paymentMethodCount}件</dd></div>
            <div><dt>月予算</dt><dd>{inspected.summary.monthlyBudgetCount}件</dd></div>
          </dl>
          <button
            type="button"
            className="danger-button"
            onClick={() => setShowConfirmation(true)}
          >
            このバックアップを復元
          </button>
        </article>
      )}

      <p className="backup-privacy-note">
        ファイルの作成・検証・復元はこの端末内で行い、家計簿データを外部サーバーへ送信しません。
      </p>

      {showConfirmation && inspected !== null && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="sheet-dialog restore-confirmation"
            role="dialog"
            aria-modal="true"
            aria-label="全データを置き換えて復元"
          >
            <header className="sheet-header">
              <h2>全データを置き換えて復元</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="閉じる"
                disabled={isRestoring}
                onClick={() => setShowConfirmation(false)}
              >
                ×
              </button>
            </header>
            <div className="restore-warning">
              <strong>現在の家計簿データと設定はすべて消去されます。</strong>
              <p>選択したバックアップの内容へ完全に置き換えます。統合やCSV読込は行いません。</p>
            </div>
            <dl className="restore-summary">
              <div><dt>ファイル</dt><dd>{inspected.fileName}</dd></div>
              <div><dt>作成日時</dt><dd>{formatBackupDate(inspected.summary.createdAt)}</dd></div>
              <div><dt>復元する収支</dt><dd>{inspected.summary.transactionCount}件</dd></div>
            </dl>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={isRestoring}
                onClick={() => setShowConfirmation(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={isRestoring}
                onClick={() => void restore()}
              >
                {isRestoring ? '復元中…' : '現在のデータを消して復元'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
