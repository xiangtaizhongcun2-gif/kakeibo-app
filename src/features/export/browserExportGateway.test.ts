import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserExportGateway } from './browserExportGateway';
import type { MonthlyExportReport } from './exportModel';

const report: MonthlyExportReport = {
  monthKey: '2026-08',
  monthLabel: '2026年8月',
  generatedAtLabel: '2026/8/8 13:00',
  totals: {
    incomeYen: 0,
    expenseYen: 0,
    balanceYen: 0,
    transactionCount: 0,
    expenseCount: 0,
    incomeCount: 0,
  },
  expenseCategories: [],
  paymentMethods: [],
  budget: null,
  transactions: [],
};

afterEach(() => {
  document
    .querySelectorAll('iframe[data-monthly-pdf-print-frame="true"]')
    .forEach((frame) => frame.remove());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BrowserExportGateway PDF export', () => {
  it('別タブへ移動せず印刷用フレームからPDF印刷を開く', () => {
    vi.useFakeTimers();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    expect(browserExportGateway.openMonthlyPdfReport(report)).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();

    const frame = document.querySelector(
      'iframe[data-monthly-pdf-print-frame="true"]',
    ) as HTMLIFrameElement | null;
    expect(frame).not.toBeNull();
    expect(frame?.contentDocument?.body.textContent).toContain('2026年8月');

    const printWindow = frame?.contentWindow;
    expect(printWindow).not.toBeNull();
    if (printWindow === null || printWindow === undefined) return;

    const printSpy = vi.spyOn(printWindow, 'print').mockImplementation(() => undefined);
    vi.advanceTimersByTime(200);
    expect(printSpy).toHaveBeenCalledTimes(1);

    printWindow.dispatchEvent(new Event('afterprint'));
    expect(
      document.querySelector('iframe[data-monthly-pdf-print-frame="true"]'),
    ).toBeNull();
  });
});
