import { useState, useCallback } from 'react';
import type { GuardianCrossword } from '~/types';
import { getPuzzleEvents, getPuzzleData } from '~/firebase/reader';
import type { TrackingEvent } from '~/firebase/tracking';
import { useReplayEngine } from './useReplayEngine';
import { ReplayGrid } from './ReplayGrid';
import { SolvingOrderPanel } from './SolvingOrderPanel';
import { formatDuration } from './replayUtils';
import { puzzles } from '../puzzles';
import './ReplayViewer.css';

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10] as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReplayViewer() {
  const [participantId, setParticipantId] = useState('');
  const [selectedCrosswordId, setSelectedCrosswordId] = useState(
    puzzles.length > 0 ? puzzles[0].id : '',
  );
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [crosswordData, setCrosswordData] = useState<GuardianCrossword | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [puzzleName, setPuzzleName] = useState<string | null>(null);

  const engine = useReplayEngine(events, crosswordData);

  const handleLoad = useCallback(async () => {
    const pid = participantId.trim();
    if (!pid) {
      setError('Enter a participant ID.');
      return;
    }
    setLoading(true);
    setError(null);
    setEvents([]);
    setCrosswordData(null);

    try {
      const puzzleDef = puzzles.find((p) => p.id === selectedCrosswordId);
      if (!puzzleDef) {
        setError('Selected puzzle not found.');
        setLoading(false);
        return;
      }

      const [eventsResult, puzzleDataResult] = await Promise.all([
        getPuzzleEvents(pid, selectedCrosswordId),
        getPuzzleData(pid, selectedCrosswordId),
      ]);
      const crosswordDataResult = puzzleDef.data;

      if (eventsResult.length === 0) {
        setError(
          `No events found for participant "${pid}" / puzzle "${selectedCrosswordId}". ` +
            'Check the participant ID and make sure Firestore read rules allow access.',
        );
        setLoading(false);
        return;
      }

      setEvents(eventsResult);
      setCrosswordData(crosswordDataResult);
      setPuzzleName(
        puzzleDataResult?.puzzle_metadata.puzzle_name ?? puzzleDef.name,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `Firebase error: ${err.message}`
          : 'Unknown error loading data.',
      );
    } finally {
      setLoading(false);
    }
  }, [participantId, selectedCrosswordId]);

  const totalDuration =
    engine.startTime !== null && engine.endTime !== null
      ? engine.endTime - engine.startTime
      : null;
  const elapsedDuration =
    engine.startTime !== null && engine.currentTime !== null
      ? engine.currentTime - engine.startTime
      : null;

  const isLoaded = crosswordData !== null && events.length > 0;

  return (
    <div className="rv">
      {/* ------------------------------------------------------------------ */}
      {/* Load panel                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="rv__load-panel">
        <div className="rv__load-row">
          <label className="rv__label" htmlFor="rv-participant">
            Participant ID
          </label>
          <input
            id="rv-participant"
            className="rv__input"
            type="text"
            placeholder="e.g. participant_123"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
          />
        </div>
        <div className="rv__load-row">
          <label className="rv__label" htmlFor="rv-crossword">
            Puzzle
          </label>
          <select
            id="rv-crossword"
            className="rv__select"
            value={selectedCrosswordId}
            onChange={(e) => setSelectedCrosswordId(e.target.value)}
          >
            {puzzles.length === 0 ? (
              <option value="">No puzzles loaded</option>
            ) : (
              puzzles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          className="rv__btn rv__btn--primary"
          onClick={handleLoad}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Load'}
        </button>

        {error && <p className="rv__error">{error}</p>}

        {isLoaded && (
          <p className="rv__loaded-badge">
            ✓ {events.length} events · {puzzleName}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Replay body                                                         */}
      {/* ------------------------------------------------------------------ */}
      {isLoaded && crosswordData && (
        <>
          <div className="rv__body">
            {/* Grid */}
            <div className="rv__grid-wrap">
              <ReplayGrid crosswordData={crosswordData} state={engine.state} />
            </div>

            {/* Solving order panel */}
            <SolvingOrderPanel
              activities={engine.solvingOrder}
              startTime={engine.startTime}
              activeClueId={engine.state.activeClueId}
              totalClues={crosswordData.entries.length}
            />
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Playback controls                                               */}
          {/* ---------------------------------------------------------------- */}
          <div className="rv__controls">
            {/* Transport */}
            <div className="rv__transport">
              <button
                className="rv__btn"
                onClick={() => engine.seek(0)}
                title="Go to start"
              >
                &#x23EE;
              </button>
              <button
                className="rv__btn"
                onClick={engine.stepBack}
                title="Step back"
              >
                &#x23EA;
              </button>
              <button
                className="rv__btn rv__btn--play"
                onClick={engine.isPlaying ? engine.pause : engine.play}
                title={engine.isPlaying ? 'Pause' : 'Play'}
              >
                {engine.isPlaying ? '⏸' : '▶'}
              </button>
              <button
                className="rv__btn"
                onClick={engine.stepForward}
                title="Step forward"
              >
                &#x23E9;
              </button>
              <button
                className="rv__btn"
                onClick={() => engine.seek(engine.totalEvents)}
                title="Go to end"
              >
                &#x23ED;
              </button>
            </div>

            {/* Speed */}
            <div className="rv__speed">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={`rv__btn rv__btn--speed ${engine.speed === s ? 'rv__btn--speed-active' : ''}`}
                  onClick={() => engine.setSpeed(s)}
                >
                  {s}×
                </button>
              ))}
            </div>

            {/* Scrubber */}
            <div className="rv__scrubber-wrap">
              <input
                type="range"
                className="rv__scrubber"
                min={0}
                max={engine.totalEvents}
                value={engine.currentIndex}
                onChange={(e) => engine.seek(Number(e.target.value))}
              />
              <span className="rv__time-label">
                {elapsedDuration !== null
                  ? formatDuration(elapsedDuration)
                  : '0:00'}
                {' / '}
                {totalDuration !== null ? formatDuration(totalDuration) : '0:00'}
                {' · '}
                {engine.currentIndex}/{engine.totalEvents} events
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
