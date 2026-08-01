import type { ReactNode } from 'react';
import { APP_TABS, type AppTabId } from '../app/tabs';

interface AppShellProps {
  title: string;
  activeTab: AppTabId;
  onSelectTab: (tab: AppTabId) => void;
  children: ReactNode;
}

function TabIcon({ tab }: { tab: AppTabId }): React.JSX.Element {
  const props = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (tab === 'home') return <svg {...props}><path d="m3 10 9-7 9 7v10H5V10" /><path d="M9 20v-6h6v6" /></svg>;
  if (tab === 'transactions') return <svg {...props}><path d="M6 4h12M6 9h12M6 14h8M6 19h5" /><path d="M3 4h.01M3 9h.01M3 14h.01M3 19h.01" /></svg>;
  if (tab === 'register') return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
  if (tab === 'budget') return <svg {...props}><path d="M4 7h16v12H4z" /><path d="M4 10h16M8 7V5h8v2" /></svg>;
  return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.3-2.5h-4L10.4 6A8 8 0 0 0 8 7.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A8 8 0 0 0 10.4 18l.3 2.5h4L15 18a8 8 0 0 0 1.5-1.1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></svg>;
}

export function AppShell({ title, activeTab, onSelectTab, children }: AppShellProps): React.JSX.Element {
  return (
    <div className="app-shell">
      <div className="app-content">
        <header className="app-header">
          <div><p>MY HOUSEHOLD ACCOUNT</p><h1>{title}</h1></div>
          <span aria-label="端末内保存">端末内</span>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
      <nav className="bottom-tabs" aria-label="メインメニュー">
        <div>
          {APP_TABS.map((tab) => (
            <button key={tab.id} type="button" aria-current={tab.id === activeTab ? 'page' : undefined} onClick={() => onSelectTab(tab.id)}>
              <TabIcon tab={tab.id} /><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
