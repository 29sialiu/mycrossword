import { useCallback, useEffect, useRef } from 'react';
import type { CellChange, CellFocus } from '~/types';
import {
  initParticipant,
  initPuzzle,
  endPuzzle,
  logEvent,
  ParticipantMetadata,
  PuzzleMetadata,
} from '~/firebase/tracking';

interface UseFirebaseTrackingProps {
  participantId: string;
  puzzleId: string;
  participantMetadata?: ParticipantMetadata;
  puzzleMetadata?: PuzzleMetadata;
}

/**
 * Returns onCellFocus, onCellChange, and onComplete callbacks to pass
 * directly to <MyCrossword>.  All interactions are logged to Firestore.
 *
 * Firestore path:
 *   participants/{participantId}/puzzles/{puzzleId}/events/{auto-id}
 *
 * Usage:
 *   const { onCellFocus, onCellChange, onComplete } = useFirebaseTracking({
 *     participantId: 'participant_123',
 *     puzzleId: 'puzzle_1',
 *     participantMetadata: { condition: 'A' },
 *     puzzleMetadata: { puzzle_name: 'Guardian Cryptic 28505' },
 *   });
 *
 *   <MyCrossword
 *     ...
 *     onCellFocus={onCellFocus}
 *     onCellChange={onCellChange}
 *     onComplete={onComplete}
 *   />
 */
export function useFirebaseTracking({
  participantId,
  puzzleId,
  participantMetadata = {},
  puzzleMetadata = {},
}: UseFirebaseTrackingProps) {
  // Holds the most-recently focused clue so keypress events can include it
  const activeClueId = useRef<string | null>(null);

  useEffect(() => {
    initParticipant(participantId, participantMetadata).then(() =>
      initPuzzle(participantId, puzzleId, puzzleMetadata),
    );

    return () => {
      // Mark the puzzle ended when the component unmounts
      endPuzzle(participantId, puzzleId);
    };
    // Intentionally run only when the participant or puzzle changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, puzzleId]);

  // Fired when a cell is clicked or navigated to (arrow keys, tab, clue click)
  const onCellFocus = useCallback(
    (cellFocus: CellFocus) => {
      activeClueId.current = cellFocus.clueId;

      logEvent(participantId, puzzleId, {
        event_type: 'cell_focus',
        timestamp: Date.now(),
        cell: { row: cellFocus.pos.row, col: cellFocus.pos.col },
        clue_id: cellFocus.clueId,
      });
    },
    [participantId, puzzleId],
  );

  // Fired when a character is typed or erased
  const onCellChange = useCallback(
    (cellChange: CellChange) => {
      logEvent(participantId, puzzleId, {
        event_type: 'keypress',
        timestamp: Date.now(),
        cell: { row: cellChange.pos.row, col: cellChange.pos.col },
        // undefined guess means the cell was cleared (Backspace / Delete)
        key: cellChange.guess ?? 'Backspace',
        previous_value: cellChange.previousGuess ?? '',
        new_value: cellChange.guess ?? '',
        clue_id: activeClueId.current,
      });
    },
    [participantId, puzzleId],
  );

  // Fired when the puzzle is completed
  const onComplete = useCallback(() => {
    endPuzzle(participantId, puzzleId);
  }, [participantId, puzzleId]);

  return { onCellFocus, onCellChange, onComplete };
}
