import {
  doc,
  setDoc,
  collection,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CellFocusEvent = {
  event_type: 'cell_focus';
  timestamp: number;
  cell: { row: number; col: number };
  clue_id: string;
};

export type KeypressEvent = {
  event_type: 'keypress';
  timestamp: number;
  cell: { row: number; col: number };
  // The character typed, or 'Backspace' / 'Delete' for erasure
  key: string;
  previous_value: string;
  new_value: string;
  // clue that was active when the key was pressed
  clue_id: string | null;
};

export type TrackingEvent = CellFocusEvent | KeypressEvent;

export type ParticipantMetadata = {
  condition?: string;
  [key: string]: unknown;
};

export type PuzzleMetadata = {
  puzzle_name?: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Participant session
// ---------------------------------------------------------------------------

/**
 * Creates (or overwrites) the participant document.
 * Call once when the participant starts the experiment.
 */
export async function initParticipant(
  participantId: string,
  metadata: ParticipantMetadata = {},
): Promise<void> {
  await setDoc(doc(db, 'participants', participantId), {
    metadata: {
      ...metadata,
      start_time: Date.now(),
      end_time: null,
    },
  });
}

/**
 * Stamps the participant document with an end time.
 * Call when the participant finishes all puzzles.
 */
export async function endParticipant(participantId: string): Promise<void> {
  await updateDoc(doc(db, 'participants', participantId), {
    'metadata.end_time': Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Puzzle session
// ---------------------------------------------------------------------------

/**
 * Creates the puzzle document under the participant.
 * Call when the participant starts a new puzzle.
 */
export async function initPuzzle(
  participantId: string,
  puzzleId: string,
  metadata: PuzzleMetadata = {},
): Promise<void> {
  await setDoc(
    doc(db, 'participants', participantId, 'puzzles', puzzleId),
    {
      puzzle_metadata: {
        ...metadata,
        start_time: Date.now(),
        end_time: null,
      },
    },
  );
}

/**
 * Stamps the puzzle document with an end time.
 * Call when the participant finishes or abandons a puzzle.
 */
export async function endPuzzle(
  participantId: string,
  puzzleId: string,
): Promise<void> {
  await updateDoc(
    doc(db, 'participants', participantId, 'puzzles', puzzleId),
    { 'puzzle_metadata.end_time': Date.now() },
  );
}

// ---------------------------------------------------------------------------
// Event logging
// ---------------------------------------------------------------------------

/**
 * Appends a single event to the puzzle's events subcollection.
 * Events are stored as individual documents (auto-ID) so there is no
 * document-size limit.  Firestore orders them by insertion time.
 */
export async function logEvent(
  participantId: string,
  puzzleId: string,
  event: TrackingEvent,
): Promise<void> {
  const id = `${event.timestamp}_${Math.random().toString(36).slice(2, 8)}`;
  await setDoc(
    doc(collection(db, 'participants', participantId, 'puzzles', puzzleId, 'events'), id),
    event,
  );
}
