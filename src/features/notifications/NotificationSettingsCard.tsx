import { useState } from 'react';
import type { NotificationSettings } from '../../domain/models';
import type { SettingsRepository } from '../../data/repositories/settingsRepository';
import type { SystemNotificationGateway } from './browserNotificationGateway';
import './notifications.css';

interface NotificationSettingsCardProps {
  settings: NotificationSettings;
  settingsRepository: SettingsRepository;
  gateway: SystemNotificationGateway;
  onChanged: () => Promise<void>;
}

function permissionLabel(settings: NotificationSettings): string {
  if (settings.lastKnownPermission === 'granted') return '許可済み';
  if (settings.lastKnownPermission === 'denied') return 'ブロックされています';
  if (settings.lastKnownPermission === 'unsupported') return 'この環境では利用できません';
  return '未確認';
}

export function NotificationSettingsCard({
  settings,
  settingsRepository,
  gateway,
  onChanged,
}: NotificationSettingsCardProps): React.JSX.Element {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const run = async (
    operation: () => Promise<void>,
    successMessage: string,
  ): Promise<void> => {
    setMessage('');
    setError('');
    setIsWorking(true);
    try {
      await operation();
      await onChanged();
      setMessage(successMessage);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '通知設定を変更できませんでした。');
    } finally {
      setIsWorking(false);
    }
  };

  const toggleInApp = async (): Promise<void> => {
    const enabled = !settings.inAppEnabled;
    await run(
      async () => {
        await settingsRepository.updateNotificationSettings({ inAppEnabled: enabled });
      },
      enabled ? 'アプリ内通知をONにしました。' : 'アプリ内通知をOFFにしました。',
    );
  };

  const requestSystemPermission = async (): Promise<void> => {
    setMessage('');
    setError('');
    setIsWorking(true);
    try {
      const permission = await gateway.requestPermission();
      await settingsRepository.updateNotificationSettings({
        lastKnownPermission: permission,
        systemNotificationEnabled: permission === 'granted',
      });
      await onChanged();
      if (permission === 'granted') {
        setMessage('システム通知を許可してONにしました。');
      } else if (permission === 'denied') {
        setError('通知がブロックされました。再度許可する場合はSafariまたは端末の設定を確認してください。');
      } else if (permission === 'unsupported') {
        setError('このブラウザではシステム通知を利用できません。');
      } else {
        setMessage('通知の許可はまだ完了していません。');
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '通知権限を確認できませんでした。');
    } finally {
      setIsWorking(false);
    }
  };

  const toggleSystem = async (): Promise<void> => {
    if (settings.lastKnownPermission !== 'granted') return;
    const enabled = !settings.systemNotificationEnabled;
    await run(
      async () => {
        await settingsRepository.updateNotificationSettings({
          systemNotificationEnabled: enabled,
        });
      },
      enabled ? 'システム通知をONにしました。' : 'システム通知をOFFにしました。',
    );
  };

  const canRequestPermission =
    settings.lastKnownPermission === 'default' ||
    settings.lastKnownPermission === 'denied';

  return (
    <section className="settings-card notification-settings-card">
      <h2>予算超過の通知</h2>
      <p className="settings-description">
        月予算を実際に超えたときだけ通知します。予算へ近づいた段階では通知しません。同じ月・同じ通知方法では1回だけ通知します。
      </p>

      {(message !== '' || error !== '') && (
        <div
          className={error === '' ? 'status-message success' : 'status-message error'}
          role="status"
        >
          {error === '' ? message : error}
        </div>
      )}

      <div className="notification-setting-list">
        <label className="notification-setting-row">
          <span>
            <strong>アプリ内通知</strong>
            <small>My家計簿を開いているとき、画面上部に超過を表示します。</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.inAppEnabled}
            disabled={isWorking}
            onChange={() => void toggleInApp()}
          />
        </label>

        <div className="notification-system-row">
          <div className="notification-system-heading">
            <span>
              <strong>システム通知</strong>
              <small>ホーム画面へ追加したPWAなど、対応環境で端末の通知を表示します。</small>
            </span>
            <b>{permissionLabel(settings)}</b>
          </div>

          {settings.lastKnownPermission === 'granted' ? (
            <label className="notification-system-toggle">
              <span>システム通知を使用する</span>
              <input
                type="checkbox"
                role="switch"
                checked={settings.systemNotificationEnabled}
                disabled={isWorking}
                onChange={() => void toggleSystem()}
              />
            </label>
          ) : (
            <>
              <p>
                通知権限は、このボタンを押したときだけ確認します。許可しなくてもアプリ内通知は利用できます。
              </p>
              <button
                type="button"
                className="secondary-button notification-permission-button"
                disabled={isWorking || !canRequestPermission}
                onClick={() => void requestSystemPermission()}
              >
                {isWorking ? '確認中…' : 'システム通知を許可'}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
