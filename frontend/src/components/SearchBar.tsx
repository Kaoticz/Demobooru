import { useState, type FormEvent } from 'react';

interface SearchBarProps {
  activeQuery: string[];
  onSearch: (tags: string[]) => void;
  onClear: () => void;
}

export default function SearchBar({ activeQuery, onSearch, onClear }: SearchBarProps) {
  const [draft, setDraft] = useState('');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const tags = draft.trim().split(/\s+/).filter(Boolean);
    onSearch(tags);
  };

  return (
    <div className="searchbar">
      <form onSubmit={onSubmit} className="searchbar__form">
        <input
          type="text"
          value={draft}
          placeholder="Search tags (space-separated, exact match)"
          aria-label="Search tags"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>
      {activeQuery.length > 0 && (
        <p className="searchbar__active">
          Searching for <strong>{activeQuery.join(' ')}</strong>
          <button type="button" onClick={onClear} className="searchbar__clear">
            Clear
          </button>
        </p>
      )}
    </div>
  );
}
