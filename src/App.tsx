import { useCallback, useEffect, useState } from 'react';
import type { DisplaySettings, MonthKey } from './domain/models';
import { APP_TABS, isAppTabId, type AppTabId } from './app/tabs';
import {
  defaultAppServices,
  type AppServices,
} from './app/services';
import { AppShell } from './components/AppShell';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { SettingsPage } from './features/settings/SettingsPage';
import { RegisterPage } from './features/transactions/RegisterPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import {
  currentMonthKey,
  type TransactionMasterData,
} from './features/transactions/transactionModel';

interface AppReferenceData extends TransactionMasterData {
  displaySettings: DisplaySettings;
}

interface AppProps {
  services?: AppServices;
}

function readTab(): AppTabId {
  const value = window.location.hash.replace(/^#\/?/, '');
  return isAppTabId(value) ? value : 'home';
}

function HomePage(): React.JSX.Element {
  return (
    <div className="page-stack">
      <section className="hero-card">
        <p className="kicker">WELCOME</p>
        <h2>My家計簿へようこそ</h2>
        <p>登録タブから収入・支出を記録し、収支一覧で月ごとに確認できます。</p>
      </section>
      <section className="info-grid">
        <article><small>保存先</small><strong>このiPhone</strong><p>入力した家計簿データを外部へ送信しません。</p></article>
        <article><small>使い始める</small><strong>登録タブ</strong><p>金額・日付・カテゴリから記録できます。</p></article>
      </section>
    </div>
  );
}

function EmptyPage({ title, text }: { title: string; text: string }): React.JSX.Element {
  return <section className="empty-panel"><h2>{title}</h2><p>{text}</p></section>;
}

export function App({ services = defaultAppServices }: AppProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AppTabId>(readTab);
  const [referenceData, setReferenceData] = useState<AppReferenceData | null>(null);
  const [referenceError, setReferenceError] = useState('');
  const [transactionsMonth, setTransactionsMonth] = useState<MonthKey>(currentMonthKey);
  const [revision, setRevision] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const loadReferenceData = useCallback(async (): Promise<void> => {
    setReferenceError('');
    try {
      const [expenseCategories, incomeCategories, paymentMethods, displaySettings] =
        await Promise.all([
          services.masterData.listExpenseCategories(true),
          services.masterData.listIncomeCategories(true),
          services.masterData.listPaymentMethods(true),
          services.settings.getDisplaySettings(),
        ]);
      setReferenceData({
        expenseCategories,
        incomeCategories,
        paymentMethods,
        displaySettings,
      });
    } catch (error: unknown) {
      setReferenceError(
        error instanceof Error ? error.message : '設定データを読み込めませんでした。',
      );
    }
  }, [services]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    const listener = (): void => setActiveTab(readTab());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);

  const navigate = (tab: AppTabId): void => {
    window.location.hash = `#/${tab}`;
    setActiveTab(tab);
    setStatusMessage('');
  };

  const handleDataChanged = (): void => {
    setRevision((current) => current + 1);
    void loadReferenceData();
  };

  const page = (): React.JSX.Element => {
    if (referenceError !== '') {
      return (
        <section className="empty-panel" role="alert">
          <h2>データを読み込めませんでした</h2>
          <p>{referenceError}</p>
          <button type="button" className="secondary-button" onClick={() => void loadReferenceData()}>再試行</button>
        </section>
      );
    }

    if (referenceData === null) return <section className="empty-panel"><p>読み込み中…</p></section>;
    if (activeTab === 'home') return <HomePage />;
    if (activeTab === 'transactions') {
      return (
        <TransactionsPage
          repository={services.transactions}
          masterData={referenceData}
          displaySettings={referenceData.displaySettings}
          monthKey={transactionsMonth}
          revision={revision}
          onMonthChange={setTransactionsMonth}
          onChanged={handleDataChanged}
        />
      );
    }
    if (activeTab === 'register') {
      return (
        <RegisterPage
          repository={services.transactions}
          masterData={referenceData}
          onRegistered={(monthKey) => {
            setTransactionsMonth(monthKey);
            setRevision((current) => current + 1);
            void loadReferenceData();
            setStatusMessage('収支を登録しました。');
            window.location.hash = '#/transactions';
            setActiveTab('transactions');
          }}
        />
      );
    }
    if (activeTab === 'budget') {
      return <EmptyPage title="予算" text="予算機能はPhase 5で実装します。" />;
    }
    return (
      <SettingsPage
        masterData={referenceData}
        displaySettings={referenceData.displaySettings}
        masterDataRepository={services.masterData}
        settingsRepository={services.settings}
        onChanged={loadReferenceData}
      />
    );
  };

  const title = APP_TABS.find((tab) => tab.id === activeTab)?.label ?? 'ホーム';

  return (
    <>
      <a className="skip-link" href="#main-content">本文へ移動</a>
      <PwaUpdateBanner />
      <AppShell title={title} activeTab={activeTab} onSelectTab={navigate}>
        {statusMessage !== '' && <div className="status-message success" role="status">{statusMessage}</div>}
        {page()}
      </AppShell>
    </>
  );
}
