import { useEffect } from 'react';

import { fetchImages } from '../api/client';
import { useApi } from '../hooks/useApi';
import ImageCard from './ImageCard';
import Pagination from './Pagination';
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
  page: number;
  setPage: (page: number) => void;
  reloadKey: number;
  onUploaded: () => void;
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
}

export default function GridView({
  query,
  page,
  setPage,
  reloadKey,
  onUploaded,
  gridSize,
  onGridSizeChange,
}: GridViewProps) {
  const { data, loading, error, reload } = useApi(
    () => fetchImages({ page, tags: query.length > 0 ? query : undefined }),
    [page, query.join(' '), reloadKey],
  );

  // Never strand the user on a page that no longer exists (e.g. they deleted
  // the last image of the final page): step back to the last real page.
  useEffect(() => {
    if (data && data.total_pages > 0 && page > data.total_pages) {
      setPage(data.total_pages);
    }
  }, [data, page, setPage]);

  if (error) {
    return <ErrorState message={error} onRetry={reload} />;
  }
  if (!data) {
    return <LoadingState />;
  }

  const isBoardEmpty = data.total === 0;
  const isSearch = query.length > 0;

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
            {data.items.map((image) => (
              <li key={image.id}>
                <ImageCard image={image} />
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.total_pages} onPage={setPage} />
          {loading && <p className="state state--loading">Refreshing…</p>}
        </>
      )}
    </section>
  );
}
