import type { MonthlyExportReport } from './exportModel';
import {
  createMonthlyPdfFilename,
  renderMonthlyReportHtml,
} from './exportModel';

export type CsvExportResult = 'shared' | 'downloaded';

export interface ExportGateway {
  shareOrDownloadCsv(content: string, filename: string): Promise<CsvExportResult>;
  openMonthlyPdfReport(report: MonthlyExportReport): boolean;
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

class BrowserExportGateway implements ExportGateway {
  async shareOrDownloadCsv(
    content: string,
    filename: string,
  ): Promise<CsvExportResult> {
    const file = new File([content], filename, {
      type: 'text/csv;charset=utf-8',
    });

    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: 'My家計簿 CSV',
        });
        return 'shared';
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('CSVの共有をキャンセルしました。');
        }
      }
    }

    downloadFile(file);
    return 'downloaded';
  }

  openMonthlyPdfReport(report: MonthlyExportReport): boolean {
    const reportWindow = window.open('', '_blank');
    if (reportWindow === null) return false;

    reportWindow.document.open();
    reportWindow.document.write(renderMonthlyReportHtml(report));
    reportWindow.document.close();
    reportWindow.document.title = createMonthlyPdfFilename(report.monthKey);

    const printReport = (): void => {
      reportWindow.focus();
      reportWindow.print();
    };

    if (reportWindow.document.readyState === 'complete') {
      reportWindow.setTimeout(printReport, 100);
    } else {
      reportWindow.addEventListener('load', () => reportWindow.setTimeout(printReport, 100), {
        once: true,
      });
    }
    return true;
  }
}

export const browserExportGateway: ExportGateway = new BrowserExportGateway();
