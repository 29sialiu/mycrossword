# MyCrossword

A research tool for running crossword-solving experiments. Participants solve NYT Mini crosswords in the browser while every interaction (cell focus, keypress, completion) is logged to Firebase. A built-in replay viewer lets you reconstruct and visualise any participant's solving session.

---

## Project structure

```
src/
  App.tsx                  # Entry point — Play and Replay viewer tabs
  puzzles/
    puz/                   # Drop .puz files here
    index.ts               # Auto-generated puzzle data (run convert-puzzles)
  replay/                  # Replay viewer components and logic
scripts/
  convert-puz.ts           # .puz → TypeScript data converter
lib/
  components/              # MyCrossword React component library
  firebase/
    config.ts              # Firebase initialisation
    tracking.ts            # Event logging (writes)
    reader.ts              # Event fetching (reads)
  hooks/
    useFirebaseTracking/   # Connects MyCrossword callbacks to Firebase
```

---

## Setup

**1. Install dependencies**

```sh
npm install
```

**2. Configure Firebase**

Copy `.env.example` to `.env` and fill in your Firebase project credentials:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

**3. Set Firestore security rules**

The replay viewer reads from Firestore, so your rules need to allow reads. In the Firebase console under **Firestore → Rules**:

```
match /participants/{participantId}/{document=**} {
  allow read, write: if true; // tighten before any public deployment
}
```

---

## Adding puzzles

Puzzles are sourced as `.puz` files (Across Lite format) from tools such as [xwords.app](https://q726kbxun.github.io/xwords/xwords.html).

**1.** Download `.puz` files and name them by date:
```
2024-10-31-mini.puz
2024-11-01-mini.puz
```

**2.** Place them in `src/puzzles/puz/`

**3.** Run the converter:
```sh
npm run convert-puzzles
```

This parses each `.puz` file and regenerates `src/puzzles/index.ts` with the crossword data. The puzzle list in both the Play tab and the Replay viewer updates automatically.

---

## Running the experiment

```sh
npm run dev
```

The app opens at `localhost:5173` with two tabs:

### Play tab

Participants solve crosswords here. Every interaction is logged to Firestore under:

```
participants/{participantId}/
  puzzles/{puzzleId}/
    events/{timestamp_random}   ← one document per event
```

Each event document contains:

| Field | Description |
|---|---|
| `event_type` | `'cell_focus'` or `'keypress'` |
| `timestamp` | Unix ms |
| `cell` | `{ row, col }` |
| `clue_id` | Active clue ID |
| `key` | *(keypress only)* Character typed, or `'Backspace'` |
| `previous_value` | *(keypress only)* Cell contents before the keypress |
| `new_value` | *(keypress only)* Cell contents after the keypress |

The participant ID and condition are set in `src/App.tsx`:

```ts
const PARTICIPANT_ID = 'participant_123';
```

### Replay viewer tab

Load any recorded session by entering a participant ID and selecting a puzzle, then use the playback controls to step through the session.

**Grid colours**

| Colour | Meaning |
|---|---|
| Red | Cell currently focused |
| Amber | Cell that was overwritten at least once |
| Green | All cells in this clue are filled |
| Blue | Cell has a letter, clue not yet complete |
| White | Empty |

**Solving order panel**

Shows clues ranked by when the participant first typed in them, with first-attempt time, completion time, and correction count — all relative to the start of the session.

**Playback controls**

Step back/forward one event at a time, or play continuously at 0.5×–10× real-time speed. The scrubber lets you jump to any point in the session.

---

## Development scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run convert-puzzles` | Convert `.puz` files to TypeScript data |
| `npm run build` | Build the component library |
| `npm run test` | Run unit tests |
| `npm run typecheck` | Type-check without building |

---

## Tech stack

- **React 18** + **TypeScript**
- **Vite** — dev server and build tool
- **Zustand** — crossword grid state
- **Firebase / Firestore** — event storage and retrieval
