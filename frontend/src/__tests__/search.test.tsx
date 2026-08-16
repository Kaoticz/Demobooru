import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { BoardApp } from '../App';
import * as client from '../api/client';
import { makeImage, makePage } from '../test/factories';

vi.mock('../api/client', () => ({
  fetchImages: vi.fn(),
  fetchImage: vi.fn(),
  fetchTags: vi.fn(),
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}));

const mockedFetchImages = vi.mocked(client.fetchImages);
const user = userEvent.setup();

function renderBoard() {
  return render(
    <MemoryRouter>
      <BoardApp />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(client.fetchTags).mockResolvedValue({ tags: [] });
});

describe('search', () => {
  it('submits space-separated tags and shows the active query', async () => {
    mockedFetchImages.mockResolvedValue(
      makePage([makeImage({ id: 1, tags: ['cat', 'dog'] })]),
    );
    renderBoard();

    await user.type(screen.getByLabelText('Search tags'), 'cat dog');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() =>
      expect(mockedFetchImages).toHaveBeenLastCalledWith({ page: 1, tags: ['cat', 'dog'] }),
    );
    expect(await screen.findByText('cat dog', { selector: 'strong' })).toBeInTheDocument();
  });

  it('shows a no-results state that names the query', async () => {
    mockedFetchImages.mockResolvedValue(makePage([]));
    renderBoard();

    await user.type(screen.getByLabelText('Search tags'), 'zebra quux');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.getByText(/no images match/i)).toHaveTextContent('zebra quux');
    // Distinct from the empty-board state.
    expect(screen.queryByText('The board is empty')).not.toBeInTheDocument();
  });

  it('clearing the search returns to browsing everything', async () => {
    mockedFetchImages.mockResolvedValue(makePage([]));
    renderBoard();

    await user.type(screen.getByLabelText('Search tags'), 'cat');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));
    expect(await screen.findByText(/^Searching for/)).toHaveTextContent('cat');

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() =>
      expect(mockedFetchImages).toHaveBeenLastCalledWith({ page: 1, tags: undefined }),
    );
    await screen.findByText('The board is empty'); // back to unfiltered view
  });

  it('searching from a later page resets to the first page of results', async () => {
    const items = (page: number) =>
      Array.from({ length: 3 }, (_, i) => makeImage({ id: page * 100 + i }));
    mockedFetchImages.mockImplementation(({ page }) =>
      Promise.resolve(makePage(items(page), { page, total: 45, totalPages: 3 })),
    );
    renderBoard();

    await user.click(await screen.findByRole('button', { name: 'Next →' }));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tags'), 'cat');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() =>
      expect(mockedFetchImages).toHaveBeenLastCalledWith({ page: 1, tags: ['cat'] }),
    );
  });
});
