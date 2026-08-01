import { useEffect, useState } from 'react';
import { APP_TABS, isAppTabId, type AppTabId } from './app/tabs';
import { AppShell } from './components/AppShell';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';

function readTab(): AppTabId {
  const value = window.location.hash.replace(/^#\/?/, '');
  return isAppTabId(value) ? value : 'home';
}

function HomePage(): React.JSX.Element {
  return <div className="page-stack"><section className="hero-card"><p className="kicker">WELCOME</p><h2>My家計簿へようこそ</h2><p>iPhoneで使いやすい家計簿の基盤を準備しました。家計簿データは今後も端末内だけに保存します。</p></section><section className="info-grid"><article><small>保存先</small><strong>このiPhone</strong><p>外部サーバーへ家計簿データを送信しません。</p></article><article><small>利用方法</small><strong>PWA</strong><p>Safariからホーム画面へ追加して利用できます。</p></article></section></div>;
}

function EmptyPage({ title, text }: { title: string; text: string }): React.JSX.Element {
  return <section className="empty-panel"><h2>{title}</h2><p>{text}</p></section>;
}

function SettingsPage(): React.JSX.Element {
  return <div className="page-stack"><section className="settings-card"><h2>アプリ情報</h2><dl><div><dt>アプリ名</dt><dd>My家計簿</dd></div><div><dt>保存方式</dt><dd>Phase 2でIndexedDBを実装</dd></div><div><dt>外部送信</dt><dd>なし</dd></div></dl></section><section className="notice-card"><h2>データ保存について</h2><p>ブラウザのデータを削除すると、今後保存する家計簿データも消える可能性があります。</p></section><section className="notice-card"><h2>旧版データ</h2><p>以前の画面でLocalStorageに保存した記録は削除せず、確認・書き出し用の旧版画面を残しています。</p><a className="legacy-link" href={`${import.meta.env.BASE_URL}legacy/`}>旧版の家計簿を開く</a></section></div>;
}

function pageFor(tab: AppTabId): React.JSX.Element {
  if (tab === 'home') return <HomePage />;
  if (tab === 'transactions') return <EmptyPage title="収支一覧" text="収支データはまだありません。" />;
  if (tab === 'register') return <EmptyPage title="登録" text="収入・支出の登録機能はPhase 3で実装します。" />;
  if (tab === 'budget') return <EmptyPage title="予算" text="予算はまだ設定されていません。" />;
  return <SettingsPage />;
}

export function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AppTabId>(readTab);
  useEffect(() => { const listener = (): void => setActiveTab(readTab()); window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener); }, []);
  const navigate = (tab: AppTabId): void => { window.location.hash = `#/${tab}`; setActiveTab(tab); };
  const title = APP_TABS.find((tab) => tab.id === activeTab)?.label ?? 'ホーム';
  return <><a className="skip-link" href="#main-content">本文へ移動</a><PwaUpdateBanner /><AppShell title={title} activeTab={activeTab} onSelectTab={navigate}>{pageFor(activeTab)}</AppShell></>;
}
