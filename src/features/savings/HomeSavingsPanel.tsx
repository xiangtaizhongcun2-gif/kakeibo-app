import type { SavingsSettings } from '../../domain/models';
import { createSavingsProgress } from './savingsModel';

interface HomeSavingsPanelProps {
  settings: SavingsSettings;
  onOpenSettings: () => void;
}

function formatYen(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value);
}

export function HomeSavingsPanel({
  settings,
  onOpenSettings,
}: HomeSavingsPanelProps): React.JSX.Element {
  const progress = createSavingsProgress(settings);

  return (
    <section className="savings-home-card" aria-labelledby="home-savings-title">
      <header className="savings-card-heading">
        <div>
          <p className="kicker">SAVINGS</p>
          <h2 id="home-savings-title">現在の貯金</h2>
        </div>
        <button type="button" className="text-button" onClick={onOpenSettings}>
          編集
        </button>
      </header>

      <strong className="savings-balance">{formatYen(settings.balanceYen)}</strong>

      {progress === null ? (
        <div className="savings-empty-goal">
          <p>貯金目標はまだ設定されていません。</p>
          <button type="button" className="secondary-button" onClick={onOpenSettings}>
            貯金目標を設定
          </button>
        </div>
      ) : (
        <div className="savings-goal-progress">
          <div className="savings-goal-line">
            <div>
              <small>目標</small>
              <strong>{progress.goalName}</strong>
            </div>
            <span>{formatYen(progress.goalAmountYen)}</span>
          </div>
          <div
            className="savings-progress-track"
            role="progressbar"
            aria-label={`${progress.goalName}の達成率`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.progressBarPercent}
          >
            <span style={{ width: `${progress.progressBarPercent}%` }} />
          </div>
          <div className="savings-progress-caption">
            <strong>{progress.progressPercent}%</strong>
            <span>
              {progress.isAchieved
                ? '目標を達成しました'
                : `あと${formatYen(progress.remainingYen)}`}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
