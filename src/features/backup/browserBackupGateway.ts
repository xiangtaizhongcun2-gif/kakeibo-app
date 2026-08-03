export type BackupExportResult = 'shared' | 'downloaded';

export interface BackupFileGateway {
  shareOrDownload(content: string, filename: string): Promise<BackupExportResult>;
  readText(file: File): Promise<string>;
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

class BrowserBackupFileGateway implements BackupFileGateway {
  async shareOrDownload(
    content: string,
    filename: string,
  ): Promise<BackupExportResult> {
    const file = new File([content], filename, {
      type: 'application/json;charset=utf-8',
    });

    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: 'My家計簿 バックアップ',
        });
        return 'shared';
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('バックアップの共有をキャンセルしました。');
        }
      }
    }

    downloadFile(file);
    return 'downloaded';
  }

  async readText(file: File): Promise<string> {
    try {
      return await file.text();
    } catch {
      throw new Error('選択したファイルを読み込めませんでした。');
    }
  }
}

export const browserBackupFileGateway: BackupFileGateway =
  new BrowserBackupFileGateway();
