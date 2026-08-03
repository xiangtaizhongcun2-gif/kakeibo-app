import { useEffect, useState } from 'react';

export const PWA_UPDATE_EVENT = 'my-kakeibo:pwa-update';
export const PWA_UPDATE_REQUEST_EVENT = 'my-kakeibo:pwa-update-request';
export type ApplyPwaUpdate = () => Promise<void>;

export function PwaUpdateBanner(): React.JSX.Element | null {
  const [applyUpdate, setApplyUpdate] = useState<ApplyPwaUpdate | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const listener = (event: Event): void =>
      setApplyUpdate(() => (event as CustomEvent<ApplyPwaUpdate>).detail);

    window.addEventListener(PWA_UPDATE_EVENT, listener);
    window.dispatchEvent(new Event(PWA_UPDATE_REQUEST_EVENT));

    return () => window.removeEventListener(PWA_UPDATE_EVENT, listener);
  }, []);

  if (applyUpdate === null) return null;

  const update = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      await applyUpdate();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <aside className="update-banner" role="status">
      <div>
        <strong>新しいバージョンがあります</strong>
        <p>保存データはそのまま、アプリだけを更新します。</p>
      </div>
      <button type="button" disabled={isUpdating} onClick={() => void update()}>
        {isUpdating ? '更新中…' : '更新'}
      </button>
    </aside>
  );
}
