import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { BoardApp } from '../App';
import type { BoardImage } from '../api/types';
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
const mockedUploadImage = vi.mocked(client.uploadImage);
const user = userEvent.setup();

const TAGS_LABEL = 'Tags (space-separated)';

/** The upload form only renders once the listing has loaded. */
async function waitForForm() {
  await screen.findByLabelText('Image');
}

function renderBoard() {
  return render(
    <MemoryRouter>
      <BoardApp />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedFetchImages.mockResolvedValue(makePage([]));
  vi.mocked(client.fetchTags).mockResolvedValue({ tags: [] });
});

describe('upload form', () => {
  it('uploads the chosen file and tags, then refreshes the grid', async () => {
    mockedUploadImage.mockResolvedValue(makeImage({ id: 9 }));
    renderBoard();
    await waitForForm();

    const file = new File(['fake-png-bytes'], 'pic.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Image'), file);
    await user.type(screen.getByLabelText(TAGS_LABEL), 'cat dog');
    await user.click(screen.getByRole('button', { name: /^Upload$/ }));

    await waitFor(() =>
      expect(mockedUploadImage).toHaveBeenCalledWith(file, 'cat dog'),
    );
    // Form reset after success.
    await waitFor(() => expect(screen.getByLabelText(TAGS_LABEL)).toHaveValue(''));
    // Grid refreshed: initial fetch + post-upload fetch.
    await waitFor(() => expect(mockedFetchImages).toHaveBeenCalledTimes(2));
  });

  it('shows an in-progress state and blocks a second submit while uploading', async () => {
    let resolveUpload!: (image: BoardImage) => void;
    mockedUploadImage.mockReturnValue(
      new Promise<BoardImage>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    renderBoard();
    await waitForForm();

    const file = new File(['bytes'], 'slow.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Image'), file);
    await user.click(screen.getByRole('button', { name: /^Upload$/ }));

    expect(await screen.findByText('Uploading…')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Uploading…' });
    expect(submit).toBeDisabled();
    expect(screen.getByLabelText('Image')).toBeDisabled();

    resolveUpload(makeImage());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Upload$/ })).toBeEnabled(),
    );
  });

  it('surfaces a server validation error verbatim and keeps the entered values', async () => {
    mockedUploadImage.mockRejectedValue(new Error('at least one tag is required'));
    renderBoard();
    await waitForForm();

    const file = new File(['bytes'], 'keep.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Image'), file);
    await user.type(screen.getByLabelText(TAGS_LABEL), 'zz');
    await user.click(screen.getByRole('button', { name: /^Upload$/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('at least one tag is required');
    // The form retains what the user entered.
    expect(screen.getByLabelText(TAGS_LABEL)).toHaveValue('zz');
    expect(screen.getByLabelText('Image')).toBeEnabled();
  });

  it('requires a file before submitting', async () => {
    renderBoard();
    await waitForForm();

    await user.type(screen.getByLabelText(TAGS_LABEL), 'solo');
    await user.click(screen.getByRole('button', { name: /^Upload$/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'choose an image file first',
    );
    expect(mockedUploadImage).not.toHaveBeenCalled();
  });
});
