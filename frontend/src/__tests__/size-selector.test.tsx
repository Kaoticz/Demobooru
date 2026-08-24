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
  localStorage.clear();
});

describe('size selector', () => {
  it('renders three size buttons when the board has images', async () => {
    mockedFetchImages.mockResolvedValue(makePage([makeImage()]));

    renderBoard();

    await screen.findByRole('img');
    expect(screen.getByRole('radio', { name: 'S' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'M' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'L' })).toBeInTheDocument();
  });

  it('defaults to medium with no localStorage value', async () => {
    mockedFetchImages.mockResolvedValue(makePage([makeImage()]));

    renderBoard();

    await screen.findByRole('img');
    expect(screen.getByRole('radio', { name: 'M' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'S' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'L' })).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking a size updates the active button', async () => {
    mockedFetchImages.mockResolvedValue(makePage([makeImage()]));

    renderBoard();

    await screen.findByRole('img');
    await user.click(screen.getByRole('radio', { name: 'L' }));

    expect(screen.getByRole('radio', { name: 'L' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'M' })).toHaveAttribute('aria-checked', 'false');
  });

  it('persists the size choice to localStorage', async () => {
    mockedFetchImages.mockResolvedValue(makePage([makeImage()]));

    renderBoard();

    await screen.findByRole('img');
    await user.click(screen.getByRole('radio', { name: 'S' }));

    expect(localStorage.getItem('demobooru-grid-size')).toBe('small');
  });

  it('restores size from localStorage on load', async () => {
    localStorage.setItem('demobooru-grid-size', 'large');
    mockedFetchImages.mockResolvedValue(makePage([makeImage()]));

    renderBoard();

    await screen.findByRole('img');
    expect(screen.getByRole('radio', { name: 'L' })).toHaveAttribute('aria-checked', 'true');
  });

  it('does not render the size selector when the board is empty', async () => {
    mockedFetchImages.mockResolvedValue(makePage([]));

    renderBoard();

    await screen.findByText('The board is empty');
    expect(screen.queryByRole('radio', { name: 'S' })).not.toBeInTheDocument();
  });
});
