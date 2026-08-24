import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { BoardImage } from '../api/types';
import { fetchImages } from '../api/client';
import ImageCard from './ImageCard';
import SizeSelector from './SizeSelector';
import type { GridSize } from './SizeSelector';
import { ErrorState, LoadingState } from './States';
import UploadForm from './UploadForm';

const GRID_MIN_SIZES: Record<GridSize, string> = {
  small: '150px',
  medium: '220px',
  large: '350px',
};

interface GridViewProps {
  query: string[];
  reloadKey: number;
  onUploaded: () => void;
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
}

export default function GridView({
  query,
  reloadKey,
  onUploaded,
  gridSize,
  onGridSizeChange,
}: GridViewProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<BoardImage[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  const queryKey = query.join(' ');

  // Reset and fetch page 1 when query or reloadKey changes.
  const resetAndFetch = useCallback(async (tags: string[], fetchPage: number) => {
    fetchingRef.current = true;
    setInitialLoading(true);
    setError(null);
    try {
      const result = await fetchImages({
        page: fetchPage,
        tags: tags.length > 0 ? tags : undefined,
      });
      setItems(result.items);
      setTotalPages(result.total_pages);
      setPage(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInitialLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    resetAndFetch(query, 1);
  }, [queryKey, reloadKey, resetAndFetch]);

  // Load the next page and append items.
  const loadMore = useCallback(async () => {
    if (fetchingRef.current || page >= totalPages) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await fetchImages({
        page: nextPage,
        tags: query.length > 0 ? query : undefined,
      });
      setItems((prev) => [...prev, ...result.items]);
      setPage(nextPage);
      setTotalPages(result.total_pages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [query, page, totalPages]);

  // IntersectionObserver: call loadMore when the sentinel is visible.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      () => {
        if (loadMoreRef.current) loadMoreRef.current();
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [queryKey, reloadKey]);

  // --- Keyboard navigation ---

  const getColumns = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return 1;
    const minSizeStr = getComputedStyle(grid).getPropertyValue('--grid-min-size').trim();
    const minSize = parseFloat(minSizeStr) || 220;
    return Math.max(1, Math.floor(grid.clientWidth / minSize));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (items.length === 0) return;

      const key = e.key;
      if (
        !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'PageDown', 'Home', 'End'].includes(key)
      ) {
        return;
      }

      e.preventDefault();
      const cols = getColumns();

      switch (key) {
        case 'ArrowRight':
          setFocusedIndex((prev) => (prev === null ? 0 : Math.min(prev + 1, items.length - 1)));
          break;
        case 'ArrowLeft':
          setFocusedIndex((prev) => (prev === null ? 0 : Math.max(prev - 1, 0)));
          break;
        case 'ArrowDown':
          setFocusedIndex((prev) => {
            const next = prev === null ? 0 : prev + cols;
            return Math.min(next, items.length - 1);
          });
          break;
        case 'ArrowUp':
          setFocusedIndex((prev) => {
            const next = prev === null ? 0 : prev - cols;
            return Math.max(next, 0);
          });
          break;
        case 'Home':
          setFocusedIndex(0);
          break;
        case 'End':
          setFocusedIndex(items.length - 1);
          break;
        case 'Enter':
          setFocusedIndex((prev) => {
            if (prev !== null && prev < items.length) {
              navigate(`/images/${items[prev].id}`);
            }
            return prev;
          });
          break;
        case 'Escape':
          setFocusedIndex((prev) => {
            if (prev !== null) {
              const image = items[prev];
              const li = itemRefs.current.get(image.id);
              li?.blur();
            }
            return null;
          });
          break;
        case 'PageDown':
          if (page >= totalPages) {
            // Already at the end — move to last item.
            setFocusedIndex(items.length - 1);
          }
          // If more pages exist, loadMore will be triggered by scroll;
          // also allow explicit PageDown to trigger it.
          loadMoreRef.current?.();
          break;
      }
    },
    [items, getColumns, navigate, page, totalPages],
  );

  // Focus the <li> when focusedIndex changes.
  useEffect(() => {
    if (focusedIndex === null || focusedIndex >= items.length) return;
    const image = items[focusedIndex];
    const li = itemRefs.current.get(image.id);
    if (li) {
      li.scrollIntoView({ block: 'nearest' });
      li.focus();
    }
  }, [focusedIndex, items]);

  // Reset focus when the query changes.
  useEffect(() => {
    setFocusedIndex(null);
  }, [queryKey]);

  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={() => resetAndFetch(query, 1)} />;
  }
  if (initialLoading) {
    return <LoadingState />;
  }

  const isBoardEmpty = items.length === 0;
  const isSearch = query.length > 0;
  const hasMore = page < totalPages;

  return (
    <section className="grid-view">
      <UploadForm onUploaded={onUploaded} />

      {isBoardEmpty && isSearch && (
        <div className="state state--empty">
          <h2>No results</h2>
          <p>
            No images match <strong>{query.join(' ')}</strong>. Nothing carries
            all of those tags.
          </p>
        </div>
      )}
      {isBoardEmpty && !isSearch && (
        <div className="state state--empty">
          <h2>The board is empty</h2>
          <p>Upload the first image with the form above — it will appear here.</p>
        </div>
      )}

      {!isBoardEmpty && (
        <>
          <div className="grid-controls">
            <SizeSelector value={gridSize} onChange={onGridSizeChange} />
          </div>
          <ul
            ref={gridRef}
            className="grid"
            style={{ '--grid-min-size': GRID_MIN_SIZES[gridSize] } as React.CSSProperties}
            onKeyDown={handleKeyDown}
          >
            {items.map((image, index) => (
              <li
                key={image.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(image.id, el);
                  else itemRefs.current.delete(image.id);
                }}
                tabIndex={focusedIndex === index ? 0 : -1}
                className={focusedIndex === index ? 'grid-item--focused' : undefined}
                onFocus={() => setFocusedIndex(index)}
              >
                <ImageCard image={image} />
              </li>
            ))}
          </ul>
          {loadingMore && <p className="state state--loading">Loading more…</p>}
          {!hasMore && items.length > 0 && (
            <p className="grid-end">End of results</p>
          )}
          {error && items.length > 0 && (
            <p className="grid-error">
              Failed to load more — <button type="button" onClick={() => loadMore()}>retry</button>
            </p>
          )}
          <div ref={sentinelRef} className="grid-sentinel" />
        </>
      )}
    </section>
  );
}
