import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { deleteImage, fetchImage } from '../api/client';
import { useApi } from '../hooks/useApi';
import SafeImage from './SafeImage';
import { ErrorState, LoadingState } from './States';

interface DetailViewProps {
  onSearch: (tags: string[]) => void;
  onDeleted: () => void;
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function DetailView({ onSearch, onDeleted }: DetailViewProps) {
  const { id } = useParams();
  const numericId = Number(id);
  const navigate = useNavigate();

  const { data, error, reload } = useApi(
    () => fetchImage(numericId),
    [numericId],
  );

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleting || !data) return;
    setDeleting(true);
    setDeleteError(null);
    deleteImage(data.id)
      .then(() => {
        onDeleted();
        navigate('/');
      })
      .catch((exc: unknown) => {
        setDeleteError(exc instanceof Error ? exc.message : String(exc));
        setDeleting(false);
      });
  };

  if (error) {
    return <ErrorState message={error} onRetry={reload} />;
  }
  if (!data) {
    return <LoadingState />;
  }

  return (
    <article className="detail">
      <button type="button" className="detail__back" onClick={() => navigate('/')}>
        ← Back to the grid
      </button>

      <div className="detail__image">
        <SafeImage src={data.url} alt={data.original_filename} className="detail__img" />
      </div>

      <ul className="chips">
        {data.tags.map((tag) => (
          <li key={tag}>
            <button
              type="button"
              className="chip"
              onClick={() => {
                onSearch([tag]);
                navigate('/');
              }}
            >
              {tag}
            </button>
          </li>
        ))}
      </ul>

      <dl className="detail__meta">
        <div>
          <dt>Uploaded</dt>
          <dd>{dateTimeFormat.format(new Date(data.created_at))}</dd>
        </div>
        <div>
          <dt>Original file</dt>
          <dd>{data.original_filename}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{formatSize(data.size_bytes)}</dd>
        </div>
      </dl>

      {!confirming ? (
        <button type="button" className="detail__delete" onClick={() => setConfirming(true)}>
          Delete this image
        </button>
      ) : (
        <div className="detail__confirm">
          <span>Delete this image permanently? This cannot be undone.</span>
          <button
            type="button"
            className="detail__delete"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={deleting}>
            Cancel
          </button>
        </div>
      )}
      {deleteError && (
        <p className="upload__error" role="alert">
          {deleteError}
        </p>
      )}
    </article>
  );
}
