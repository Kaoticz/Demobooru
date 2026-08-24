import { render, screen } from '@testing-library/react';
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
const mockedFetchTags = vi.mocked(client.fetchTags);
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
  mockedFetchTags.mockResolvedValue({ tags: [] });
});

describe('grid view', () => {
  it('renders images from the API as clickable cards', async () => {
    mockedFetchImages.mockResolvedValue(
      makePage([
        makeImage({ id: 1, original_filename: 'one.png', tags: ['cat'] }),
        makeImage({ id: 2, original_filename: 'two.png', tags: ['dog'] }),
      ]),
    );

    renderBoard();

    expect(await screen.findByRole('img', { name: 'one.png' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'two.png' })).toBeInTheDocument();
    expect(mockedFetchImages).toHaveBeenCalledWith({ page: 1, tags: undefined });
  });

  it('shows the empty-board state pointing at the upload form', async () => {
    mockedFetchImages.mockResolvedValue(makePage([]));

    renderBoard();

    expect(await screen.findByText('The board is empty')).toBeInTheDocument();
    expect(screen.getByText(/upload the first image/i)).toBeInTheDocument();
    expect(screen.queryByText('End of results')).not.toBeInTheDocument();
  });

  it('shows an error state with retry when the API is unreachable', async () => {
    mockedFetchImages.mockRejectedValue(new Error('cannot reach the server — is the stack running?'));

    renderBoard();

    expect(await screen.findByRole('alert')).toHaveTextContent('cannot reach the server');
    mockedFetchImages.mockResolvedValue(makePage([makeImage()]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('img')).toBeInTheDocument();
  });

  it('loads the first page and shows end-of-results for a single page', async () => {
    mockedFetchImages.mockResolvedValue(
      makePage(
        [makeImage({ id: 1 }), makeImage({ id: 2 })],
        { page: 1, total: 2, totalPages: 1 },
      ),
    );

    renderBoard();

    await screen.findByRole('img', { name: 'image1.png' });
    expect(screen.getByRole('img', { name: 'image2.png' })).toBeInTheDocument();
    expect(mockedFetchImages).toHaveBeenCalledTimes(1);
    expect(mockedFetchImages).toHaveBeenCalledWith({ page: 1, tags: undefined });
  });

  it('clicking a tag in the tag panel searches for it', async () => {
    mockedFetchImages.mockResolvedValue(makePage([]));
    mockedFetchTags.mockResolvedValue({ tags: ['animal', 'cat'] });

    renderBoard();

    await user.click(await screen.findByRole('button', { name: /^cat$/ }));
    expect(mockedFetchImages).toHaveBeenLastCalledWith({ page: 1, tags: ['cat'] });
    expect(screen.getByText(/^Searching for/)).toHaveTextContent('cat');
  });
});
