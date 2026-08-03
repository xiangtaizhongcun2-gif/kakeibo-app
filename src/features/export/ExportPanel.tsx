import { useEffect, useMemo, useState } from 'react';
import type { MonthlyBudget, MonthKey, Transaction } from '../../domain/models';
import { toMonthKey } from '../../domain/valueObjects';
import type { BudgetRepository } from '../../data/repositories/budgetRepository';
import type { TransactionRepository } from '../../data/repositories/transactionRepository';
import type { TransactionMasterData } from '../transactions/transactionModel';
import type { ExportGateway } from './browserExportGateway';
import {
  buildMonthlyExportReport,
  createCsvFilename,
  createTransactionsCsv,
  filterTransactionsByDateRange,
  monthDateRange,
  parseExportDateRange,
} from './exportModel';
import './export.css';

interface ExportPanelProps {
  transactionRepository: TransactionRepository;
  budgetRepository: BudgetRepository;
  masterData: TransactionMasterData;
  initialMonthKey: MonthKey;
  revision: number;
  gateway: ExportGateway;
}

function resultMessage(result: 'shared' | 'downloaded'): string {
  return result === 'shared'
    ? 'CSVを共有しました。'
    : 'CSVファイルを保存しました。';
}

export function ExportPanel({
  transactionRepository,
  budgetRepository,
  masterData,
  initialMonthKey,
  revision,
  gateway,
}: ExportPanelProps): React.JSX.Element {
  const initialRange = useMemo(() => monthDateRange(initialMonthKey), [initialMonthKey]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthKey, setMonthKey] = useState<string>(initialMonthKey);
  const [monthlyBudget, setMonthlyBudget] = useState<MonthlyBudget | null>(null);
  const [startDate, setStartDate] = useState<string>(initialRange.startDate);
  const [endDate, setEndDate] = useState<string>(initialRange.endDate);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    setIsLoading(true);
    setError('');
    void transactionRepository
      .listAll()
      .then((items) => {
        if (!disposed) setTransactions(items);
      })
      .catch((caught: unknown) => {
        if (!disposed) {
          setError(
            caught instanceof Error
              ? caught.message
              : '出力する収支を読み込めませんでした。',
          );
        }
      })
      .finally(() => {
        if (!disposed) setIsLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [revision, transactionRepository]);

  useEffect(() => {
    let disposed = false;
    try {
      const validMonthKey = toMonthKey(monthKey);
      void budgetRepository
        .getMonthData(validMonthKey)
        .then((data) => {
          if (!disposed) setMonthlyBudget(data.monthlyBudget);
        })
        .catch((caught: unknown) => {
          if (!disposed) {
            setMonthlyBudget(null);
            setError(
              caught instanceof Error
                ? caught.message
                : '月予算を読み込めませんでした。',
            );
          }
        });
    } catch {
      setMonthlyBudget(null);
    }

    return () => {
      disposed = true;
    };
  }, [budgetRepository, monthKey, revision]);

  const exportCsv = async (
    selected: readonly Transaction[],
    filename: string,
  ): Promise<void> => {
    setMessage('');
    setError('');
    try {
      const result = await gateway.shareOrDownloadCsv(
        createTransactionsCsv(selected, masterData),
        filename,
      );
      setMessage(resultMessage(result));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'CSVを出力できませんでした。',
      );
    }
  };

  const exportMonthlyCsv = async (): Promise<void> => {
    try {
      const validMonthKey = toMonthKey(monthKey);
      const range = monthDateRange(validMonthKey);
      await exportCsv(
        filterTransactionsByDateRange(transactions, range),
        createCsvFilename(range, 'monthly'),
      );
    } catch {
      setError('出力する月を選択してください。');
    }
  };

  const openMonthlyPdf = (): void => {
    setMessage('');
    setError('');
    try {
      const validMonthKey = toMonthKey(monthKey);
      const report = buildMonthlyExportReport(
        validMonthKey,
        transactions,
        masterData,
        monthlyBudget,
      );
      if (!gateway.openMonthlyPdfReport(report)) {
        setError(
          '印刷用レポートを開けませんでした。ポップアップを許可して再試行してください。',
        );
        return;
      }
      setMessage(
        '印刷画面を開きました。「PDFとして保存」または共有を選択してください。',
      );
    } catch {
      setError('出力する月を選択してください。');
    }
  };

  const exportRangeCsv = async (): Promise<void> => {
    const parsed = parseExportDateRange(startDate, endDate);
    if (!parsed.ok) {
      setError(parsed.message);
      setMessage('');
      return;
    }
    await exportCsv(
      filterTransactionsByDateRange(transactions, parsed.range),
      createCsvFilename(parsed.range, 'range'),
    );
  };

  return (
    <section className="settings-card export-card">
      <div className="section-heading">
        <div>
          <p className="kicker">LOCAL EXPORT</p>
          <h2>CSV・PDF出力</h2>
        </div>
        <span className="local-only-badge">端末内処理</span>
      </div>
      <p className="settings-description">
        収支データを外部サーバーへ送信せず、この端末内でファイルまたは印刷用レポートを作成します。
      </p>

      {(message !== '' || error !== '') && (
        <div
          className={error === '' ? 'status-message success' : 'status-message error'}
          role="status"
        >
          {error === '' ? message : error}
        </div>
      )}

      <div className="export-section">
        <div>
          <h3>月単位の出力</h3>
          <p>月の全収支をCSVへ出力し、集計・予算・明細をPDF用レポートにまとめます。</p>
        </div>
        <label className="form-field" htmlFor="export-month">
          <span>対象月</span>
          <input
            id="export-month"
            type="month"
            value={monthKey}
            onChange={(event) => setMonthKey(event.currentTarget.value)}
          />
        </label>
        <div className="export-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={isLoading}
            onClick={() => void exportMonthlyCsv()}
          >
            月のCSVを共有・保存
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={isLoading}
            onClick={openMonthlyPdf}
          >
            PDFとして保存
          </button>
        </div>
        <small>
          PDFボタンは印刷用画面を開きます。ブラウザの印刷画面でPDF保存または共有を選択してください。
        </small>
      </div>

      <div className="export-section">
        <div>
          <h3>指定期間のCSV</h3>
          <p>開始日から終了日までの全収支を1つのCSVへ出力します。</p>
        </div>
        <div className="export-range-grid">
          <label className="form-field" htmlFor="export-start-date">
            <span>開始日</span>
            <input
              id="export-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.currentTarget.value)}
            />
          </label>
          <label className="form-field" htmlFor="export-end-date">
            <span>終了日</span>
            <input
              id="export-end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.currentTarget.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="secondary-button export-wide-button"
          disabled={isLoading}
          onClick={() => void exportRangeCsv()}
        >
          指定期間のCSVを共有・保存
        </button>
      </div>
    </section>
  );
}
