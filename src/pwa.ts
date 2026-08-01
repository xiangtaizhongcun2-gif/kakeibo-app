import { registerSW } from 'virtual:pwa-register';
import { PWA_UPDATE_EVENT, type ApplyPwaUpdate } from './components/PwaUpdateBanner';

export function registerServiceWorker(): void {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      const applyUpdate: ApplyPwaUpdate = () => updateServiceWorker(true);
      window.dispatchEvent(new CustomEvent<ApplyPwaUpdate>(PWA_UPDATE_EVENT, { detail: applyUpdate }));
    },
    onRegisterError(error) {
      console.error('Service Workerの登録に失敗しました。', error instanceof Error ? error.message : 'unknown error');
    },
  });
}
