import type {
  AppMetadata,
  DisplaySettings,
  NotificationSettings,
  OnboardingState,
} from '../../domain/models';
import { currentUtcIsoDateTime } from '../../domain/valueObjects';
import { appDatabase, type MyKakeiboDatabase } from '../database';

export class SettingsRepository {
  constructor(private readonly database: MyKakeiboDatabase = appDatabase) {}

  async getDisplaySettings(): Promise<DisplaySettings> {
    const settings = await this.database.displaySettings.get('display-settings');
    if (settings === undefined) throw new Error('表示設定が初期化されていません。');
    return settings;
  }

  async updateDisplaySettings(
    changes: Partial<Omit<DisplaySettings, 'id' | 'updatedAt'>>,
  ): Promise<DisplaySettings> {
    const current = await this.getDisplaySettings();
    const updated: DisplaySettings = {
      ...current,
      ...changes,
      id: 'display-settings',
      updatedAt: currentUtcIsoDateTime(),
    };
    await this.database.displaySettings.put(updated);
    return updated;
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    const settings = await this.database.notificationSettings.get('notification-settings');
    if (settings === undefined) throw new Error('通知設定が初期化されていません。');
    return settings;
  }

  async updateNotificationSettings(
    changes: Partial<Omit<NotificationSettings, 'id' | 'updatedAt'>>,
  ): Promise<NotificationSettings> {
    const current = await this.getNotificationSettings();
    const updated: NotificationSettings = {
      ...current,
      ...changes,
      id: 'notification-settings',
      updatedAt: currentUtcIsoDateTime(),
    };
    await this.database.notificationSettings.put(updated);
    return updated;
  }

  async getOnboardingState(): Promise<OnboardingState> {
    const state = await this.database.onboardingStates.get('onboarding');
    if (state === undefined) throw new Error('初期設定状態が初期化されていません。');
    return state;
  }

  async updateOnboardingState(
    changes: Partial<Omit<OnboardingState, 'id' | 'updatedAt'>>,
  ): Promise<OnboardingState> {
    const current = await this.getOnboardingState();
    const updated: OnboardingState = {
      ...current,
      ...changes,
      id: 'onboarding',
      updatedAt: currentUtcIsoDateTime(),
    };
    await this.database.onboardingStates.put(updated);
    return updated;
  }

  async getAppMetadata(): Promise<AppMetadata> {
    const metadata = await this.database.appMetadata.get('metadata');
    if (metadata === undefined) throw new Error('アプリ情報が初期化されていません。');
    return metadata;
  }
}
