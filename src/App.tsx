import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DisplaySettings,
  MonthKey,
  NotificationSettings,
} from './domain/models';
import { APP_TABS, isAppTabId, type AppTabId } from './app/tabs';
import { defaultAppServices, type AppServices } from './app/services';
import { AppShell } from './components/AppShell';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { HomePage } from './features/analytics/HomePage';
import {
  browserBackupFileGateway,
  type BackupFileGateway,
} from './features/backup/browserBackupGateway';
import { BackupRestorePanel } from './features/backup/BackupRestorePanel';
import { BudgetPage } from './features/budget/BudgetPage';
import {
  browserExportGateway,
  type ExportGateway,
} from './features/export/browserExportGateway';
import { ExportPanel } from './features/export/ExportPanel';
import { BudgetAlertBanner } from './features/notifications/BudgetAlertBanner';
import {
  browserSystemNotificationGateway,
  type SystemNotificationGateway,
} from './features/notifications/browserNotificationGateway';
import type { MonthlyBudgetExceededAlert } from './features/notifications/notificationModel';
import { NotificationSettingsCard } from './features/notifications/NotificationSettingsCard';
import { SettingsPage } from './features/settings/SettingsPage';
import { RegisterPage } from './features/transactions/RegisterPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import {
  currentMonthKey,
  type TransactionMasterData,
} from './features/transactions/transactionModel';

interface AppReferenceData extends TransactionMasterData {
  displaySettings: DisplaySettings;
  notificationSettings: NotificationSettings;
}

interface AppProps {
  services?: AppServices;
  notificationGateway?: SystemNotificationGateway;
  exportGateway?: ExportGateway;
  backupGateway?: BackupFileGateway;
}

function readTab(): AppTabId {
  const value = window.location.hash.replace(/^#\/?/, '');
  return isAppTabId(value) ? value : 'home';
}

export function App({
  services = defaultAppServices,
  notificationGateway = browserSystemNotificationGateway,
  exportGateway = browserExportGateway,
  backupGateway = browserBackupFileGateway,
}: AppProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AppTabId>(readTab);
  const [referenceData, setReferenceData] = useState<AppReferenceData | null>(null);
  const [referenceError, setReferenceError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(currentMonthKey);
  const [revision, setRevision] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [budgetAlert, setBudgetAlert] = useState<MonthlyBudgetExceededAlert | null>(null);
  const notificationCheckRunning = useRef(false);

  const loadReferenceData = useCallback(async (): Promise<void> => {
    setReferenceError('');
    try {
      const [
        expenseCategories,
        incomeCategories,
        paymentMethods,
        displaySettings,
        storedNotificationSettings,
      ] = await Promise.all([
        services.masterData.listExpenseCategories(true),
        services.masterData.listIncomeCategories(true),
        services.masterData.listPaymentMethods(true),
        services.settings.getDisplaySettings(),
        services.settings.getNotificationSettings(),
      ]);

      const currentPermission = notificationGateway.getPermission();
      const notificationSettings =
        currentPermission === storedNotificationSettings.lastKnownPermission
          ? storedNotificationSettings
          : await services.settings.updateNotificationSettings({
              lastKnownPermission: currentPermission,
              systemNotificationEnabled:
                currentPermission === 'granted' &&
                storedNotificationSettings.systemNotificationEnabled,
            });

      setReferenceData({
        expenseCategories,
        incomeCategories,
        paymentMethods,
        displaySettings,
        notificationSettings,
      });
    } catch (error: unknown) {
      setReferenceError(
        error instanceof Error ? error.message : '設定データを読み込めませんでした。',
      );
    }
  }, [notificationGateway, services]);

  const checkBudgetNotifications = useCallback(async (): Promise<void> => {
    if (notificationCheckRunning.current) return;
    notificationCheckRunning.current = true;
    try {
      const claim = await services.notifications.claimMonthlyBudgetExceeded(
        currentMonthKey(),
      );
      if (claim === null) return;

      if (claim.showInApp) setBudgetAlert(claim.alert);
      if (claim.showSystem) {
        const wasShown = await notificationGateway.showBudgetExceeded(claim.alert);
        if (!wasShown) {
          await services.notifications.releaseSystemNotification(claim.alert.monthKey);
        }
      }
    } catch {
      // 通知失敗で家計簿本体を利用不能にしないため、次回の変更時に再試行します。
    } finally {
      notificationCheckRunning.current = false;
    }
  }, [notificationGateway, services]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    if (referenceData !== null) void checkBudgetNotifications();
  }, [checkBudgetNotifications, referenceData, revision]);

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

  const handleRestored = async (): Promise<void> => {
    setBudgetAlert(null);
    setSelectedMonth(currentMonthKey());
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
          onOpenBudget={() => navigate('budget')}
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
          exportGateway={exportGateway}
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
          monthKey={selectedMonth}
          revision={revision}
          onMonthChange={setSelectedMonth}
          onChanged={handleDataChanged}
        />
      );
    }

    return (
      <div className="page-stack">
        <NotificationSettingsCard
          settings={referenceData.notificationSettings}
          settingsRepository={services.settings}
          gateway={notificationGateway}
          onChanged={handleSettingsChanged}
        />
        <ExportPanel
          transactionRepository={services.transactions}
          budgetRepository={services.budgets}
          masterData={referenceData}
          initialMonthKey={selectedMonth}
          revision={revision}
          gateway={exportGateway}
        />
        <BackupRestorePanel
          repository={services.backups}
          gateway={backupGateway}
          onRestored={handleRestored}
        />
        <SettingsPage
          masterData={referenceData}
          displaySettings={referenceData.displaySettings}
          masterDataRepository={services.masterData}
          settingsRepository={services.settings}
          onChanged={loadReferenceData}
        />
      </div>
    );
  };

  const title = APP_TABS.find((tab) => tab.id === activeTab)?.label ?? 'ホーム';

  return (
    <>
      <a className="skip-link" href="#main-content">本文へ移動</a>
      <PwaUpdateBanner />
      <AppShell title={title} activeTab={activeTab} onSelectTab={navigate}>
        {budgetAlert !== null && (
          <BudgetAlertBanner
            alert={budgetAlert}
            onDismiss={() => setBudgetAlert(null)}
            onOpenBudget={() => {
              setSelectedMonth(budgetAlert.monthKey);
              setBudgetAlert(null);
              navigate('budget');
            }}
          />
        )}
        {statusMessage !== '' && (
          <div className="status-message success" role="status">{statusMessage}</div>
        )}
        {page()}
      </AppShell>
    </>
  );
}
