import { registerSW } from 'virtual:pwa-register';
import {
  PWA_UPDATE_EVENT,
  PWA_UPDATE_REQUEST_EVENT,
  type ApplyPwaUpdate,
} from './components/PwaUpdateBanner';

let pendingUpdate: ApplyPwaUpdate | null = null;

function announcePendingUpdate(): void {
  if (pendingUpdate === null) return;
  window.dispatchEvent(
    new CustomEvent<ApplyPwaUpdate>(PWA_UPDATE_EVENT, { detail: pendingUpdate }),
  );
}

export function registerServiceWorker(): void {
  window.addEventListener(PWA_UPDATE_REQUEST_EVENT, announcePendingUpdate);

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      pendingUpdate = async (): Promise<void> => {
        pendingUpdate = null;
        await updateServiceWorker(true);
      };
      announcePendingUpdate();
    },
    onRegisterError(error) {
      console.error(
        'Service Workerの登録に失敗しました。',
        error instanceof Error ? error.message : 'unknown error',
      );
    },
  });
}
