import { fetchTags } from '../api/client';
import { useApi } from '../hooks/useApi';
import { ErrorState } from './States';

interface TagPanelProps {
  reloadKey: number;
  onSearch: (tags: string[]) => void;
}

export default function TagPanel({ reloadKey, onSearch }: TagPanelProps) {
  const { data, loading, error, reload } = useApi(fetchTags, [reloadKey]);

  return (
    <nav className="tag-panel" aria-label="Tags">
      <h2 className="tag-panel__title">Tags</h2>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <p className="state state--loading">Loading tags…</p>}
      {data &&
        (data.tags.length === 0 ? (
          <p className="tag-panel__empty">No tags yet — tag your first upload.</p>
        ) : (
          <ul className="tag-panel__list">
            {data.tags.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  className="chip"
                  onClick={() => onSearch([tag])}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </nav>
  );
}
