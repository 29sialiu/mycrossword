import { MyCrossword } from '../dist/main';
import { useFirebaseTracking } from '../lib/hooks/useFirebaseTracking/useFirebaseTracking';
import '../dist/style.css';
import { useState } from 'react';
import './App.css';
import { ReplayViewer } from './replay/ReplayViewer';
import { puzzles } from './puzzles';

type AppMode = 'play' | 'replay';

const THEME_OPTIONS = [
  'red',
  'pink',
  'purple',
  'deepPurple',
  'indigo',
  'blue',
  'lightBlue',
  'cyan',
  'teal',
  'green',
  'deepOrange',
  'blueGrey',
] as const;

type Theme = (typeof THEME_OPTIONS)[number];

// In a real experiment these would come from Empirica or a login step.
const PARTICIPANT_ID = 'participant_123';

// Extracted so that useFirebaseTracking only mounts when actually playing
function PlayMode() {
  const [theme, setTheme] = useState<Theme>('blue');
  const [complete, setComplete] = useState(false);
  const [selectedId, setSelectedId] = useState(
    puzzles.length > 0 ? puzzles[0].id : '',
  );

  const selectedPuzzle = puzzles.find((p) => p.id === selectedId);

  const { onCellFocus, onCellChange, onComplete: firebaseOnComplete } =
    useFirebaseTracking({
      participantId: PARTICIPANT_ID,
      puzzleId: selectedId,
      puzzleMetadata: { puzzle_name: selectedPuzzle?.name },
    });

  const handlePuzzleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedId(e.target.value);
    setComplete(false);
  };

  if (puzzles.length === 0) {
    return (
      <main className="Page__main">
        <p style={{ color: '#666', padding: 16 }}>
          No puzzles loaded yet. Add <code>.puz</code> files to{' '}
          <code>src/puzzles/puz/</code> and run{' '}
          <code>npm run convert-puzzles</code>.
        </p>
      </main>
    );
  }

  if (!selectedPuzzle) {
    return null;
  }

  return (
    <main className="Page__main">
      <div className="Page__controls">
        {puzzles.length > 1 && (
          <div className="Page__control">
            <label htmlFor="puzzle-selector">Puzzle</label>
            <select
              id="puzzle-selector"
              onChange={handlePuzzleChange}
              value={selectedId}
            >
              {puzzles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="Page__control">
          <label htmlFor="theme-selector">Theme</label>
          <select
            id="theme-selector"
            onChange={(e) => setTheme(e.target.value as Theme)}
            value={theme}
          >
            {THEME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        {complete && (
          <div className="Page__alert">
            <div className="Page__alertIcon">
              <span>✔</span>
            </div>
            <span>Complete</span>
          </div>
        )}
      </div>
      <MyCrossword
        cellSize={50}
        id={`nyt-mini.${selectedId}`}
        data={selectedPuzzle.data}
        onCellFocus={onCellFocus}
        onCellChange={onCellChange}
        onComplete={() => {
          setComplete(true);
          firebaseOnComplete();
        }}
        theme={theme}
      />
    </main>
  );
}

function App() {
  const [appMode, setAppMode] = useState<AppMode>('play');

  return (
    <div className="Page">
      <div className="Page__banner">
        <h3>MyCrossword</h3>
        <div className="Page__mode-tabs">
          <button
            className={`Page__mode-tab ${appMode === 'play' ? 'Page__mode-tab--active' : ''}`}
            onClick={() => setAppMode('play')}
          >
            Play
          </button>
          <button
            className={`Page__mode-tab ${appMode === 'replay' ? 'Page__mode-tab--active' : ''}`}
            onClick={() => setAppMode('replay')}
          >
            Replay viewer
          </button>
        </div>
      </div>

      {appMode === 'replay' ? (
        <main className="Page__main">
          <ReplayViewer />
        </main>
      ) : (
        <PlayMode />
      )}
    </div>
  );
}

export default App;
