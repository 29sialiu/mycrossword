import type { GuardianCrossword, GuardianClue } from '~/types';

export type CellKey = string; // `${row},${col}`

export function cellKey(row: number, col: number): CellKey {
  return `${row},${col}`;
}

/** Returns all grid cells occupied by a clue, in order. */
export function getClueCells(
  clue: GuardianClue,
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < clue.length; i++) {
    if (clue.direction === 'across') {
      cells.push({ row: clue.position.y, col: clue.position.x + i });
    } else {
      cells.push({ row: clue.position.y + i, col: clue.position.x });
    }
  }
  return cells;
}

/** Map from clue ID → its cells. */
export function buildClueToCells(
  data: GuardianCrossword,
): Map<string, Array<{ row: number; col: number }>> {
  const map = new Map<string, Array<{ row: number; col: number }>>();
  for (const clue of data.entries) {
    map.set(clue.id, getClueCells(clue));
  }
  return map;
}

/** Set of CellKeys that belong to at least one clue (i.e. not blocked). */
export function buildWhiteCells(data: GuardianCrossword): Set<CellKey> {
  const whites = new Set<CellKey>();
  for (const clue of data.entries) {
    for (const cell of getClueCells(clue)) {
      whites.add(cellKey(cell.row, cell.col));
    }
  }
  return whites;
}

/** Map from CellKey → clue IDs that pass through that cell. */
export function buildCellToClues(
  data: GuardianCrossword,
): Map<CellKey, string[]> {
  const map = new Map<CellKey, string[]>();
  for (const clue of data.entries) {
    for (const cell of getClueCells(clue)) {
      const key = cellKey(cell.row, cell.col);
      const existing = map.get(key) ?? [];
      existing.push(clue.id);
      map.set(key, existing);
    }
  }
  return map;
}

/** Map from CellKey → the number label shown in that cell (top-left). */
export function buildCellNumbers(
  data: GuardianCrossword,
): Map<CellKey, number> {
  const map = new Map<CellKey, number>();
  for (const clue of data.entries) {
    const key = cellKey(clue.position.y, clue.position.x);
    if (!map.has(key)) {
      map.set(key, clue.number);
    }
  }
  return map;
}

/** Format a millisecond duration as M:SS */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
