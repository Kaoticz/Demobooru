import { useState, type ChangeEvent, type FormEvent } from 'react';

import { uploadImage } from '../api/client';

interface UploadFormProps {
  onUploaded: () => void;
}

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

export default function UploadForm({ onUploaded }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files && event.target.files.length > 0 ? event.target.files[0] : null);
    setError(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!file) {
      setError('choose an image file first');
      return;
    }
    setBusy(true);
    setError(null);
    uploadImage(file, tags)
      .then(() => {
        setFile(null);
        setTags('');
        onUploaded();
      })
      .catch((exc: unknown) => {
        setError(exc instanceof Error ? exc.message : String(exc));
      })
      .finally(() => setBusy(false));
  };

  return (
    <form className="upload" onSubmit={onSubmit}>
      <div className="upload__fields">
        <label className="upload__file">
          <span>Image</span>
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={onFileChange}
            disabled={busy}
          />
        </label>
        <label className="upload__tags">
          <span>Tags (space-separated)</span>
          <input
            type="text"
            value={tags}
            placeholder="landscape sunset_road"
            onChange={(event) => setTags(event.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" disabled={busy} className="upload__submit">
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {file && !busy && <p className="upload__hint">Ready to upload: {file.name}</p>}
      {busy && <p className="upload__hint">Uploading — the request blocks until it is stored…</p>}
      {error && (
        <p className="upload__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
