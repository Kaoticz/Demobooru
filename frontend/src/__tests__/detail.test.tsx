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

const mockedFetchImage = vi.mocked(client.fetchImage);
const mockedDeleteImage = vi.mocked(client.deleteImage);
const mockedFetchImages = vi.mocked(client.fetchImages);
const user = userEvent.setup();

function renderBoardAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BoardApp />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedFetchImages.mockResolvedValue(makePage([]));
  mockedDeleteImage.mockResolvedValue(undefined);
  vi.mocked(client.fetchTags).mockResolvedValue({ tags: [] });
});

function sampleImage() {
  return makeImage({
    id: 7,
    original_filename: 'holiday photo.jpg',
    tags: ['alpha', 'beta'],
    size_bytes: 2048,
    created_at: '2026-08-16T10:30:00Z',
  });
}

describe('detail view', () => {
  it('renders the image with its tags, filename and upload time', async () => {
    mockedFetchImage.mockResolvedValue(sampleImage());
    renderBoardAt('/images/7');

    expect(await screen.findByRole('img', { name: 'holiday photo.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^alpha$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^beta$/ })).toBeInTheDocument();
    expect(screen.getByText('holiday photo.jpg')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
  });

  it('requires confirmation before deleting, then returns to the grid', async () => {
    mockedFetchImage.mockResolvedValue(sampleImage());
    renderBoardAt('/images/7');

    await user.click(await screen.findByRole('button', { name: 'Delete this image' }));

    // Nothing deleted yet; the confirmation step is showing.
    expect(mockedDeleteImage).not.toHaveBeenCalled();
    expect(screen.getByText(/delete this image permanently/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(mockedDeleteImage).toHaveBeenCalledWith(7));
    // Back on the grid: the listing endpoint is fetched again.
    await waitFor(() => expect(mockedFetchImages).toHaveBeenCalled());
    expect(screen.getByText('The board is empty')).toBeInTheDocument();
  });

  it('cancelling the confirmation does not delete', async () => {
    mockedFetchImage.mockResolvedValue(sampleImage());
    renderBoardAt('/images/7');

    await user.click(await screen.findByRole('button', { name: 'Delete this image' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockedDeleteImage).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'holiday photo.jpg' })).toBeInTheDocument();
  });

  it('clicking a tag searches for it from the detail view', async () => {
    mockedFetchImage.mockResolvedValue(sampleImage());
    renderBoardAt('/images/7');

    await user.click(await screen.findByRole('button', { name: /^beta$/ }));

    await waitFor(() =>
      expect(mockedFetchImages).toHaveBeenLastCalledWith({ page: 1, tags: ['beta'] }),
    );
    expect(screen.getByText(/^Searching for/)).toHaveTextContent('beta');
  });

  it('shows an error state for a nonexistent image', async () => {
    mockedFetchImage.mockRejectedValue(new Error('image 999 not found'));
    renderBoardAt('/images/999');

    expect(await screen.findByRole('alert')).toHaveTextContent('image 999 not found');
  });
});
