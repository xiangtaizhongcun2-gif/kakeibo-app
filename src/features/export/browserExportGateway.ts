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

const PRINT_FRAME_ATTRIBUTE = 'data-monthly-pdf-print-frame';

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

function createPrintFrame(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.setAttribute(PRINT_FRAME_ATTRIBUTE, 'true');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.position = 'fixed';
  frame.style.left = '-10000px';
  frame.style.top = '0';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  document.body.append(frame);
  return frame;
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
    const frame = createPrintFrame();
    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;

    if (printWindow === null || printDocument === null) {
      frame.remove();
      return false;
    }

    try {
      printDocument.open();
      printDocument.write(renderMonthlyReportHtml(report));
      printDocument.close();
      printDocument.title = createMonthlyPdfFilename(report.monthKey);

      let cleanedUp = false;
      const cleanup = (): void => {
        if (cleanedUp) return;
        cleanedUp = true;
        frame.remove();
      };

      printWindow.addEventListener('afterprint', cleanup, { once: true });
      window.setTimeout(cleanup, 120000);
      window.setTimeout(() => {
        try {
          printWindow.print();
        } catch {
          cleanup();
        }
      }, 150);

      return true;
    } catch {
      frame.remove();
      return false;
    }
  }
}

export const browserExportGateway: ExportGateway = new BrowserExportGateway();
