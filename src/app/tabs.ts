export type AppTabId = 'home' | 'transactions' | 'register' | 'budget' | 'settings';

export interface AppTab {
  id: AppTabId;
  label: string;
}

export const APP_TABS: readonly AppTab[] = [
  { id: 'home', label: 'ホーム' },
  { id: 'transactions', label: '収支一覧' },
  { id: 'register', label: '登録' },
  { id: 'budget', label: '予算' },
  { id: 'settings', label: '設定' },
] as const;

export function isAppTabId(value: string): value is AppTabId {
  return APP_TABS.some((tab) => tab.id === value);
}
