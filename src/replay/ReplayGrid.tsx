import { useMemo } from 'react';
import type { GuardianCrossword } from '~/types';
import type { ReplayState } from './useReplayEngine';
import {
  cellKey,
  buildWhiteCells,
  buildCellNumbers,
  buildCellToClues,
} from './replayUtils';

// ---------------------------------------------------------------------------
// Cell colour palette
// Priority: active > corrected > completed > filled > empty > blocked
// ---------------------------------------------------------------------------
const COLOR = {
  blocked: '#2c2c2c',
  active: '#ef9a9a',    // red — cursor is here right now
  corrected: '#ffd54f', // amber — letter was overwritten at least once
  completed: '#81c784', // green — all cells in this clue are filled
  filled: '#bbdefb',    // blue — has a letter, clue not yet complete
  empty: '#ffffff',     // white
  border: '#999',
  borderActive: '#c62828',
  text: '#1a1a1a',
  numText: '#444',
};

const CELL_SIZE = 38; // px

type Props = {
  crosswordData: GuardianCrossword;
  state: ReplayState;
};

export function ReplayGrid({ crosswordData, state }: Props) {
  const { rows, cols } = crosswordData.dimensions;

  const whiteCells = useMemo(
    () => buildWhiteCells(crosswordData),
    [crosswordData],
  );
  const cellNumbers = useMemo(
    () => buildCellNumbers(crosswordData),
    [crosswordData],
  );
  const cellToClues = useMemo(
    () => buildCellToClues(crosswordData),
    [crosswordData],
  );

  function getCellColor(row: number, col: number): string {
    const key = cellKey(row, col);
    if (!whiteCells.has(key)) return COLOR.blocked;

    const isActive =
      state.activeCell?.row === row && state.activeCell?.col === col;
    if (isActive) return COLOR.active;

    if (state.correctedCells.has(key)) return COLOR.corrected;

    const clueIds = cellToClues.get(key) ?? [];
    const isCompleted = clueIds.some((id) => state.completedClues.has(id));
    if (isCompleted) return COLOR.completed;

    if (state.guesses.has(key)) return COLOR.filled;

    return COLOR.empty;
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
    gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px)`,
    gap: 0,
    border: `2px solid ${COLOR.border}`,
    width: 'fit-content',
  };

  return (
    <div style={gridStyle} aria-label="Crossword replay grid">
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const key = cellKey(row, col);
          const isWhite = whiteCells.has(key);
          const isActive =
            state.activeCell?.row === row && state.activeCell?.col === col;
          const num = cellNumbers.get(key);
          const guess = state.guesses.get(key);
          const bg = getCellColor(row, col);

          return (
            <div
              key={key}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: bg,
                border: isActive
                  ? `2px solid ${COLOR.borderActive}`
                  : `1px solid ${COLOR.border}`,
                boxSizing: 'border-box',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isWhite && num !== undefined && (
                <span
                  style={{
                    position: 'absolute',
                    top: 1,
                    left: 2,
                    fontSize: 9,
                    lineHeight: 1,
                    color: COLOR.numText,
                    userSelect: 'none',
                  }}
                >
                  {num}
                </span>
              )}
              {guess && (
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    color: COLOR.text,
                    userSelect: 'none',
                  }}
                >
                  {guess}
                </span>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
