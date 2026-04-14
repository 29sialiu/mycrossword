import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from './config';
import type { TrackingEvent } from './tracking';

export type PuzzleData = {
  puzzle_metadata: {
    start_time: number;
    end_time: number | null;
    puzzle_name?: string;
    [key: string]: unknown;
  };
};

/**
 * Fetches all events for a participant/puzzle, sorted by timestamp ascending.
 */
export async function getPuzzleEvents(
  participantId: string,
  puzzleId: string,
): Promise<TrackingEvent[]> {
  const snap = await getDocs(
    collection(
      db,
      'participants',
      participantId,
      'puzzles',
      puzzleId,
      'events',
    ),
  );
  const events = snap.docs.map((d) => d.data() as TrackingEvent);
  return events.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Fetches metadata for a specific puzzle session.
 */
export async function getPuzzleData(
  participantId: string,
  puzzleId: string,
): Promise<PuzzleData | null> {
  const snap = await getDoc(
    doc(db, 'participants', participantId, 'puzzles', puzzleId),
  );
  return snap.exists() ? (snap.data() as PuzzleData) : null;
}

/**
 * Lists all puzzle IDs recorded under a participant.
 */
export async function getParticipantPuzzleIds(
  participantId: string,
): Promise<string[]> {
  const snap = await getDocs(
    collection(db, 'participants', participantId, 'puzzles'),
  );
  return snap.docs.map((d) => d.id);
}
