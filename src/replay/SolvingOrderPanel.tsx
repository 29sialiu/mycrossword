import type { ClueActivity } from './useReplayEngine';
import { formatDuration } from './replayUtils';

type Props = {
  activities: ClueActivity[];
  startTime: number | null;
  activeClueId: string | null;
  totalClues: number;
};

export function SolvingOrderPanel({
  activities,
  startTime,
  activeClueId,
  totalClues,
}: Props) {
  const completedCount = activities.filter((a) => a.completionTime !== null).length;

  function relTime(ts: number | null): string {
    if (ts === null || startTime === null) return '—';
    return formatDuration(ts - startTime);
  }

  return (
    <div className="solving-panel">
      <div className="solving-panel__header">
        <span className="solving-panel__title">Solving order</span>
        <span className="solving-panel__stats">
          {completedCount}/{totalClues} complete · {activities.length} attempted
        </span>
      </div>

      {/* Colour legend */}
      <div className="solving-panel__legend">
        <LegendItem color="#ef9a9a" label="Active cell" />
        <LegendItem color="#ffd54f" label="Correction" />
        <LegendItem color="#81c784" label="Clue complete" />
        <LegendItem color="#bbdefb" label="Filled" />
      </div>

      <div className="solving-panel__table-wrap">
        <table className="solving-panel__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Clue</th>
              <th>First try</th>
              <th>Completed</th>
              <th title="Times a letter was overwritten">Fixes</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity, idx) => {
              const isActive = activity.clueId === activeClueId;
              const isDone = activity.completionTime !== null;
              return (
                <tr
                  key={activity.clueId}
                  className={[
                    isActive ? 'solving-panel__row--active' : '',
                    isDone ? 'solving-panel__row--done' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td className="solving-panel__rank">{idx + 1}</td>
                  <td className="solving-panel__clue-id">{activity.clueLabel}</td>
                  <td className="solving-panel__time">
                    {relTime(activity.firstTypeTime ?? activity.firstFocusTime)}
                  </td>
                  <td className="solving-panel__time">
                    {isDone ? (
                      <span className="solving-panel__done-badge">
                        {relTime(activity.completionTime)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="solving-panel__fixes">
                    {activity.corrections > 0 ? (
                      <span className="solving-panel__fixes-badge">
                        {activity.corrections}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                </tr>
              );
            })}
            {activities.length === 0 && (
              <tr>
                <td colSpan={5} className="solving-panel__empty">
                  No events yet — press play or step forward
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="solving-panel__legend-item">
      <span
        className="solving-panel__legend-swatch"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
