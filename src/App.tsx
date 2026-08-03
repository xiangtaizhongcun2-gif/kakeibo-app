import { useCallback, useEffect, useState } from 'react';
import type { BudgetSettings, DisplaySettings, MonthKey } from './domain/models';
import { APP_TABS, isAppTabId, type AppTabId } from './app/tabs';
import { defaultAppServices, type AppServices } from './app/services';
import { AppShell } from './components/AppShell';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { HomePage } from './features/analytics/HomePage';
import { BudgetPage } from './features/budget/BudgetPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { RegisterPage } from './features/transactions/RegisterPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import {
  currentMonthKey,
  type TransactionMasterData,
} from './features/transactions/transactionModel';

interface AppReferenceData extends TransactionMasterData {
  displaySettings: DisplaySettings;
  budgetSettings: BudgetSettings;
}

interface AppProps {
  services?: AppServices;
}

function readTab(): AppTabId {
  const value = window.location.hash.replace(/^#\/?/, '');
  return isAppTabId(value) ? value : 'home';
}

export function App({ services = defaultAppServices }: AppProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AppTabId>(readTab);
  const [referenceData, setReferenceData] = useState<AppReferenceData | null>(null);
  const [referenceError, setReferenceError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(currentMonthKey);
  const [revision, setRevision] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const loadReferenceData = useCallback(async (): Promise<void> => {
    setReferenceError('');
    try {
      const [
        expenseCategories,
        incomeCategories,
        paymentMethods,
        displaySettings,
        budgetSettings,
      ] = await Promise.all([
        services.masterData.listExpenseCategories(true),
        services.masterData.listIncomeCategories(true),
        services.masterData.listPaymentMethods(true),
        services.settings.getDisplaySettings(),
        services.budgets.getSettings(),
      ]);
      setReferenceData({
        expenseCategories,
        incomeCategories,
        paymentMethods,
        displaySettings,
        budgetSettings,
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

  const handleSettingsChanged = async (): Promise<void> => {
    await loadReferenceData();
    setRevision((current) => current + 1);
  };

  const page = (): React.JSX.Element => {
    if (referenceError !== '') {
      return (
        <section className="empty-panel" role="alert">
          <h2>データを読み込めませんでした</h2>
          <p>{referenceError}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadReferenceData()}
          >
            再試行
          </button>
        </section>
      );
    }

    if (referenceData === null) {
      return <section className="empty-panel"><p>読み込み中…</p></section>;
    }

    if (activeTab === 'home') {
      return (
        <HomePage
          repository={services.transactions}
          budgetRepository={services.budgets}
          masterData={referenceData}
          monthKey={selectedMonth}
          revision={revision}
          onMonthChange={setSelectedMonth}
        />
      );
    }

    if (activeTab === 'transactions') {
      return (
        <TransactionsPage
          repository={services.transactions}
          masterData={referenceData}
          displaySettings={referenceData.displaySettings}
          monthKey={selectedMonth}
          revision={revision}
          onMonthChange={setSelectedMonth}
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
            setSelectedMonth(monthKey);
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
      return (
        <BudgetPage
          budgetRepository={services.budgets}
          transactionRepository={services.transactions}
          expenseCategories={referenceData.expenseCategories}
          monthKey={selectedMonth}
          revision={revision}
          onMonthChange={setSelectedMonth}
          onChanged={handleDataChanged}
        />
      );
    }

    return (
      <SettingsPage
        masterData={referenceData}
        displaySettings={referenceData.displaySettings}
        budgetSettings={referenceData.budgetSettings}
        masterDataRepository={services.masterData}
        settingsRepository={services.settings}
        budgetRepository={services.budgets}
        onChanged={handleSettingsChanged}
      />
    );
  };

  const title = APP_TABS.find((tab) => tab.id === activeTab)?.label ?? 'ホーム';

  return (
    <>
      <a className="skip-link" href="#main-content">本文へ移動</a>
      <PwaUpdateBanner />
      <AppShell title={title} activeTab={activeTab} onSelectTab={navigate}>
        {statusMessage !== '' && (
          <div className="status-message success" role="status">{statusMessage}</div>
        )}
        {page()}
      </AppShell>
    </>
  );
}
