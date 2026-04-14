#!/usr/bin/env node
/**
 * Converts .puz files (Across Lite format) to a GuardianCrossword-compatible
 * TypeScript data file at src/puzzles/index.ts.
 *
 * Usage:
 *   npm run convert-puzzles
 *
 * Workflow:
 *   1. Download .puz files from https://q726kbxun.github.io/xwords/xwords.html
 *   2. Place them in src/puzzles/puz/  (name them YYYY-MM-DD-mini.puz)
 *   3. Run: npm run convert-puzzles
 *   4. Restart the dev server — the new puzzles appear automatically
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// .puz parser types
// ---------------------------------------------------------------------------

interface PuzCell {
  number: number;
  row: number;
  col: number;
  hasAcross: boolean;
  hasDown: boolean;
}

interface PuzClue {
  number: number;
  direction: 'across' | 'down';
  text: string;
}

interface ParsedPuz {
  title: string;
  author: string;
  width: number;
  height: number;
  solution: string[][];
  numberedCells: PuzCell[];
  clues: PuzClue[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parsePuz(buffer: Buffer): ParsedPuz {
  const magic = buffer.toString('ascii', 0x02, 0x0e);
  if (!magic.startsWith('ACROSS&DOWN')) {
    throw new Error('Not a valid .puz file (bad magic string)');
  }

  const width = buffer[0x2c];
  const height = buffer[0x2d];
  const numClues = buffer.readUInt16LE(0x2e);

  // Solution grid starts at byte 0x34
  const HEADER_SIZE = 0x34;
  const solution: string[][] = [];
  for (let row = 0; row < height; row++) {
    const rowArr: string[] = [];
    for (let col = 0; col < width; col++) {
      rowArr.push(
        String.fromCharCode(buffer[HEADER_SIZE + row * width + col]),
      );
    }
    solution.push(rowArr);
  }

  // Skip state grid (same size), then read null-terminated strings
  let offset = HEADER_SIZE + width * height * 2;

  function readString(): string {
    const start = offset;
    while (offset < buffer.length && buffer[offset] !== 0) {
      offset++;
    }
    const str = buffer.toString('latin1', start, offset);
    offset++; // consume null terminator
    return str;
  }

  const title = readString();
  const author = readString();
  readString(); // copyright — discard

  // Standard crossword cell numbering: scan left-to-right, top-to-bottom.
  // A cell is numbered if it starts a 2+ letter across or down word.
  const numberedCells: PuzCell[] = [];
  let cellNum = 1;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (solution[row][col] === '.') continue;

      const startsAcross =
        (col === 0 || solution[row][col - 1] === '.') &&
        col + 1 < width &&
        solution[row][col + 1] !== '.';

      const startsDown =
        (row === 0 || solution[row - 1][col] === '.') &&
        row + 1 < height &&
        solution[row + 1][col] !== '.';

      if (startsAcross || startsDown) {
        numberedCells.push({
          number: cellNum,
          row,
          col,
          hasAcross: startsAcross,
          hasDown: startsDown,
        });
        cellNum++;
      }
    }
  }

  // Read clues in .puz order: for each numbered cell, across before down
  const clues: PuzClue[] = [];
  for (const cell of numberedCells) {
    if (cell.hasAcross) {
      clues.push({
        number: cell.number,
        direction: 'across',
        text: readString(),
      });
    }
    if (cell.hasDown) {
      clues.push({
        number: cell.number,
        direction: 'down',
        text: readString(),
      });
    }
  }

  if (clues.length !== numClues) {
    console.warn(
      `  Warning: expected ${numClues} clues from header, parsed ${clues.length}`,
    );
  }

  return { title, author, width, height, solution, numberedCells, clues };
}

// ---------------------------------------------------------------------------
// Convert parsed .puz to GuardianCrossword-compatible plain object
// ---------------------------------------------------------------------------

interface EntryObject {
  id: string;
  number: number;
  humanNumber: string;
  direction: 'across' | 'down';
  clue: string;
  position: { x: number; y: number };
  length: number;
  solution: string;
  group: string[];
  separatorLocations: Record<string, never>;
}

interface CrosswordObject {
  id: string;
  number: number;
  name: string;
  crosswordType: 'nyt-mini';
  date: number;
  dimensions: { cols: number; rows: number };
  solutionAvailable: boolean;
  entries: EntryObject[];
}

function toCrosswordObject(
  puz: ParsedPuz,
  id: string,
  name: string,
  dateMs: number,
): CrosswordObject {
  const entries: EntryObject[] = [];

  for (const clue of puz.clues) {
    const cell = puz.numberedCells.find((c) => c.number === clue.number);
    if (!cell) {
      console.warn(`  Could not find cell for clue ${clue.number}-${clue.direction}`);
      continue;
    }

    let length = 0;
    let solution = '';

    if (clue.direction === 'across') {
      let col = cell.col;
      while (col < puz.width && puz.solution[cell.row][col] !== '.') {
        solution += puz.solution[cell.row][col];
        col++;
        length++;
      }
    } else {
      let row = cell.row;
      while (row < puz.height && puz.solution[row][cell.col] !== '.') {
        solution += puz.solution[row][cell.col];
        row++;
        length++;
      }
    }

    entries.push({
      id: `${clue.number}-${clue.direction}`,
      number: clue.number,
      humanNumber: String(clue.number),
      direction: clue.direction,
      clue: clue.text,
      position: { x: cell.col, y: cell.row },
      length,
      solution,
      group: [`${clue.number}-${clue.direction}`],
      separatorLocations: {},
    });
  }

  return {
    id,
    number: dateMs,
    name,
    crosswordType: 'nyt-mini',
    date: dateMs,
    dimensions: { cols: puz.width, rows: puz.height },
    solutionAvailable: true,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileNameToId(filename: string): string {
  return path.basename(filename, '.puz');
}

function idToDisplayName(id: string): string {
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return `NYT Mini \u2013 ${date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`;
  }
  return id;
}

function idToDateMs(id: string): number {
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  }
  return Date.now();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const PUZ_DIR = path.join(ROOT, 'src', 'puzzles', 'puz');
const OUT_FILE = path.join(ROOT, 'src', 'puzzles', 'index.ts');

if (!fs.existsSync(PUZ_DIR)) {
  fs.mkdirSync(PUZ_DIR, { recursive: true });
}

const puzFiles = fs
  .readdirSync(PUZ_DIR)
  .filter((f) => f.endsWith('.puz'))
  .sort(); // alphabetical = chronological for YYYY-MM-DD filenames

if (puzFiles.length === 0) {
  console.log('No .puz files found in src/puzzles/puz/ — writing empty puzzle list.');
}

const crosswords: CrosswordObject[] = [];

for (const file of puzFiles) {
  const filePath = path.join(PUZ_DIR, file);
  const id = fileNameToId(file);
  process.stdout.write(`  Converting ${file} ...`);

  try {
    const buffer = fs.readFileSync(filePath);
    const puz = parsePuz(buffer);
    const dateMs = idToDateMs(id);
    const name = puz.title.trim() || idToDisplayName(id);
    const cw = toCrosswordObject(puz, id, name, dateMs);
    crosswords.push(cw);
    console.log(` ✓  (${puz.width}×${puz.height}, ${cw.entries.length} entries)`);
  } catch (err) {
    console.error(` ✗  ${(err as Error).message}`);
  }
}

// Serialize each CrosswordObject as a JSON literal embedded in TypeScript.
// JSON.stringify output is valid TypeScript — double-quoted strings are fine.
function indent(str: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return str
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}

const puzzleEntries = crosswords
  .map((cw) => {
    const dataJson = JSON.stringify(cw, null, 2);
    return [
      `  {`,
      `    id: '${cw.id}',`,
      `    name: ${JSON.stringify(cw.name)},`,
      `    data: ${indent(dataJson, 4).trimStart()} as GuardianCrossword,`,
      `  }`,
    ].join('\n');
  })
  .join(',\n');

const output = `\
// AUTO-GENERATED by scripts/convert-puz.ts — do not edit by hand.
// Re-run:  npm run convert-puzzles
import type { GuardianCrossword } from '~/types';

export type PuzzleEntry = {
  id: string;
  name: string;
  data: GuardianCrossword;
};

export const puzzles: PuzzleEntry[] = [
${puzzleEntries}
];
`;

fs.writeFileSync(OUT_FILE, output, 'utf-8');
console.log(`\nWrote ${crosswords.length} puzzle(s) to src/puzzles/index.ts`);
