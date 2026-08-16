import { useCallback, useEffect, useState } from 'react';

type Health = {
  status: string;
  database: string;
};

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/health')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`health endpoint returned ${response.status}`);
        }
        return (await response.json()) as Health;
      })
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return (
    <main className="placeholder">
      <h1>Demobooru</h1>
      <p>Tag-based image board — development skeleton.</p>
      {loading && <p className="placeholder__status">Checking backend…</p>}
      {error && (
        <p className="placeholder__error">
          Backend unavailable: {error}{' '}
          <button type="button" onClick={checkHealth}>
            Retry
          </button>
        </p>
      )}
      {health && (
        <p className="placeholder__status">
          Backend: {health.status} · database: {health.database}
        </p>
      )}
    </main>
  );
}
