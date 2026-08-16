interface StateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: StateProps) {
  return <p className="state state--loading">{message}</p>;
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <p>Something went wrong: {message}</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
