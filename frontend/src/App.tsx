import { useCallback, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import DetailView from './components/DetailView';
import GridView from './components/GridView';
import SearchBar from './components/SearchBar';
import type { GridSize } from './components/SizeSelector';
import TagPanel from './components/TagPanel';

const STORAGE_KEY = 'demobooru-grid-size';

function readGridSize(): GridSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'small' || stored === 'medium' || stored === 'large') return stored;
  } catch {
    // localStorage unavailable — fall through to default
  }
  return 'medium';
}

/** The board itself: layout, search/page state, and routes.
 *  App wraps this in a BrowserRouter; tests wrap it in a MemoryRouter. */
export function BoardApp() {
  const [query, setQuery] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [gridSize, setGridSizeState] = useState<GridSize>(readGridSize);

  const setGridSize = useCallback((size: GridSize) => {
    setGridSizeState(size);
    try {
      localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // silently ignore — preference just won't persist
    }
  }, []);

  const runSearch = useCallback((tags: string[]) => {
    setQuery(tags);
    setPage(1);
  }, []);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  // A new upload should be immediately visible: reset any search and go to
  // the first page, then refresh the grid and tag panel.
  const handleUploaded = useCallback(() => {
    runSearch([]);
    refresh();
  }, [runSearch, refresh]);

  const handleDeleted = useCallback(() => {
    runSearch([]);
    refresh();
  }, [runSearch, refresh]);

  return (
    <div className="layout">
      <header className="header">
        <h1 className="brand">Demobooru</h1>
        <SearchBar
          activeQuery={query}
          onSearch={runSearch}
          onClear={() => runSearch([])}
        />
      </header>
      <aside className="sidebar">
        <TagPanel reloadKey={reloadKey} onSearch={runSearch} />
      </aside>
      <main className="content">
        <Routes>
          <Route
            path="/"
            element={
              <GridView
                query={query}
                page={page}
                setPage={setPage}
                reloadKey={reloadKey}
                onUploaded={handleUploaded}
                gridSize={gridSize}
                onGridSizeChange={setGridSize}
              />
            }
          />
          <Route
            path="/images/:id"
            element={<DetailView onSearch={runSearch} onDeleted={handleDeleted} />}
          />
          <Route path="*" element={<p className="state state--empty">Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <BoardApp />
    </BrowserRouter>
  );
}
