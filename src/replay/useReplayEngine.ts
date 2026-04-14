import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import type { GuardianCrossword } from '~/types';
import type { TrackingEvent } from '~/firebase/tracking';
import { cellKey, buildClueToCells, type CellKey } from './replayUtils';

export type ReplayState = {
  guesses: Map<CellKey, string>;
  activeCell: { row: number; col: number } | null;
  activeClueId: string | null;
  completedClues: Set<string>;
  correctedCells: Set<CellKey>;
};

export type ClueActivity = {
  clueId: string;
  clueLabel: string;
  firstFocusTime: number | null;
  firstTypeTime: number | null;
  completionTime: number | null;
  corrections: number;
};

// ---------------------------------------------------------------------------
// Pure helper — build replay state by replaying events[0..index)
// ---------------------------------------------------------------------------

function buildStateAt(
  events: TrackingEvent[],
  index: number,
  clueToCells: Map<string, Array<{ row: number; col: number }>>,
): ReplayState {
  const guesses = new Map<CellKey, string>();
  const correctedCells = new Set<CellKey>();
  let activeCell: { row: number; col: number } | null = null;
  let activeClueId: string | null = null;

  const limit = Math.min(index, events.length);
  for (let i = 0; i < limit; i++) {
    const event = events[i];
    if (event.event_type === 'cell_focus') {
      activeCell = event.cell;
      activeClueId = event.clue_id;
    } else if (event.event_type === 'keypress') {
      activeCell = event.cell;
      activeClueId = event.clue_id;
      const key = cellKey(event.cell.row, event.cell.col);
      if (event.new_value === '') {
        guesses.delete(key);
      } else {
        if (event.previous_value !== '') {
          correctedCells.add(key);
        }
        guesses.set(key, event.new_value);
      }
    }
  }

  const completedClues = new Set<string>();
  for (const [clueId, cells] of clueToCells) {
    if (cells.every((c) => !!guesses.get(cellKey(c.row, c.col)))) {
      completedClues.add(clueId);
    }
  }

  return { guesses, activeCell, activeClueId, completedClues, correctedCells };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReplayEngine(
  events: TrackingEvent[],
  crosswordData: GuardianCrossword | null,
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(2);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clueToCells = useMemo(
    () =>
      crosswordData
        ? buildClueToCells(crosswordData)
        : new Map<string, Array<{ row: number; col: number }>>(),
    [crosswordData],
  );

  // Grid + focus state at the current replay position
  const state = useMemo(
    () => buildStateAt(events, currentIndex, clueToCells),
    [events, currentIndex, clueToCells],
  );

  // Reset position whenever a new event set is loaded
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [events]);

  // -------------------------------------------------------------------------
  // Solving-order analysis (up to currentIndex)
  // -------------------------------------------------------------------------

  const solvingOrder = useMemo((): ClueActivity[] => {
    if (!crosswordData) return [];

    const firstFocus = new Map<string, number>();
    const firstType = new Map<string, number>();
    const correctionsMap = new Map<string, number>();
    const completionMap = new Map<string, number>();
    const localGuesses = new Map<CellKey, string>();

    const limit = Math.min(currentIndex, events.length);
    for (let i = 0; i < limit; i++) {
      const event = events[i];

      if (event.event_type === 'cell_focus') {
        if (!firstFocus.has(event.clue_id)) {
          firstFocus.set(event.clue_id, event.timestamp);
        }
      }

      if (event.event_type === 'keypress') {
        const key = cellKey(event.cell.row, event.cell.col);

        // First character typed for this clue
        if (event.clue_id !== null && event.new_value !== '') {
          if (!firstType.has(event.clue_id)) {
            firstType.set(event.clue_id, event.timestamp);
          }
        }

        // Correction = overwriting a non-empty cell
        if (
          event.clue_id !== null &&
          event.previous_value !== '' &&
          event.new_value !== ''
        ) {
          correctionsMap.set(
            event.clue_id,
            (correctionsMap.get(event.clue_id) ?? 0) + 1,
          );
        }

        // Update local guess grid
        if (event.new_value === '') {
          localGuesses.delete(key);
        } else {
          localGuesses.set(key, event.new_value);
        }

        // Check whether any clue that uses this cell just became complete (or incomplete)
        for (const [clueId, cells] of clueToCells) {
          if (!cells.some((c) => cellKey(c.row, c.col) === key)) continue;
          const nowComplete = cells.every(
            (c) => !!localGuesses.get(cellKey(c.row, c.col)),
          );
          if (nowComplete && !completionMap.has(clueId)) {
            completionMap.set(clueId, event.timestamp);
          } else if (!nowComplete) {
            completionMap.delete(clueId);
          }
        }
      }
    }

    return crosswordData.entries
      .map((clue) => ({
        clueId: clue.id,
        clueLabel: `${clue.humanNumber} ${clue.direction}`,
        firstFocusTime: firstFocus.get(clue.id) ?? null,
        firstTypeTime: firstType.get(clue.id) ?? null,
        completionTime: completionMap.get(clue.id) ?? null,
        corrections: correctionsMap.get(clue.id) ?? 0,
      }))
      .filter((c) => c.firstFocusTime !== null || c.firstTypeTime !== null)
      .sort((a, b) => {
        const ta = a.firstTypeTime ?? a.firstFocusTime ?? Infinity;
        const tb = b.firstTypeTime ?? b.firstFocusTime ?? Infinity;
        return ta - tb;
      });
  }, [currentIndex, events, crosswordData, clueToCells]);

  // -------------------------------------------------------------------------
  // Playback controls
  // -------------------------------------------------------------------------

  const stepForward = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, events.length));
  }, [events.length]);

  const stepBack = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const seek = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, events.length)));
    },
    [events.length],
  );

  const play = useCallback(() => setIsPlaying(true), []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying) return;

    if (currentIndex >= events.length) {
      setIsPlaying(false);
      return;
    }

    const current = events[currentIndex];
    const next = events[currentIndex + 1];

    let delay: number;
    if (!next) {
      delay = 800;
    } else {
      // Real elapsed time between events, scaled by speed, capped at 1.5 s
      delay = Math.min((next.timestamp - current.timestamp) / speed, 1500);
      delay = Math.max(delay, 16);
    }

    timerRef.current = setTimeout(() => {
      setCurrentIndex((i) => Math.min(i + 1, events.length));
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIndex, events, speed]);

  // -------------------------------------------------------------------------
  // Timing helpers
  // -------------------------------------------------------------------------

  const startTime = events.length > 0 ? events[0].timestamp : null;
  const endTime =
    events.length > 0 ? events[events.length - 1].timestamp : null;
  const currentTime =
    currentIndex > 0
      ? events[Math.min(currentIndex, events.length) - 1].timestamp
      : null;

  return {
    state,
    currentIndex,
    totalEvents: events.length,
    isPlaying,
    speed,
    solvingOrder,
    startTime,
    currentTime,
    endTime,
    play,
    pause,
    seek,
    stepForward,
    stepBack,
    setSpeed,
  };
}
