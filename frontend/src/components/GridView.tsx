import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [items, setItems] = useState<BoardImage[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

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
          <ul className="grid" style={{ '--grid-min-size': GRID_MIN_SIZES[gridSize] } as React.CSSProperties}>
            {items.map((image) => (
              <li key={image.id}>
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
