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
  mockedFetchImages.mockResolvedValue(
    makePage([
      makeImage({ id: 1, original_filename: 'alpha.png', tags: ['cat'] }),
      makeImage({ id: 2, original_filename: 'beta.png', tags: ['dog'] }),
      makeImage({ id: 3, original_filename: 'gamma.png', tags: ['bird'] }),
    ]),
  );
});

describe('keyboard navigation', () => {
  it('ArrowRight moves focus to the next item', async () => {
    renderBoard();
    const firstCard = await screen.findByRole('img', { name: 'alpha.png' });
    const firstLi = firstCard.closest('li')!;

    firstLi.focus();
    await user.keyboard('{ArrowRight}');

    const secondCard = screen.getByRole('img', { name: 'beta.png' });
    expect(secondCard.closest('li')).toHaveFocus();
  });

  it('ArrowLeft moves focus to the previous item', async () => {
    renderBoard();
    const secondCard = await screen.findByRole('img', { name: 'beta.png' });
    const secondLi = secondCard.closest('li')!;

    secondLi.focus();
    await user.keyboard('{ArrowLeft}');

    const firstCard = screen.getByRole('img', { name: 'alpha.png' });
    expect(firstCard.closest('li')).toHaveFocus();
  });

  it('ArrowRight at the last item stays on the last item', async () => {
    renderBoard();
    const thirdCard = await screen.findByRole('img', { name: 'gamma.png' });
    const thirdLi = thirdCard.closest('li')!;

    thirdLi.focus();
    await user.keyboard('{ArrowRight}');

    expect(thirdLi).toHaveFocus();
  });

  it('ArrowLeft at the first item stays on the first item', async () => {
    renderBoard();
    const firstCard = await screen.findByRole('img', { name: 'alpha.png' });
    const firstLi = firstCard.closest('li')!;

    firstLi.focus();
    await user.keyboard('{ArrowLeft}');

    expect(firstLi).toHaveFocus();
  });

  it('Escape clears focus', async () => {
    renderBoard();
    const firstCard = await screen.findByRole('img', { name: 'alpha.png' });
    const firstLi = firstCard.closest('li')!;

    firstLi.focus();
    expect(firstLi).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(firstLi).not.toHaveFocus();
  });

  it('Home moves focus to the first item', async () => {
    renderBoard();
    const thirdCard = await screen.findByRole('img', { name: 'gamma.png' });
    const thirdLi = thirdCard.closest('li')!;

    thirdLi.focus();
    await user.keyboard('{Home}');

    const firstCard = screen.getByRole('img', { name: 'alpha.png' });
    expect(firstCard.closest('li')).toHaveFocus();
  });

  it('End moves focus to the last item', async () => {
    renderBoard();
    const firstCard = await screen.findByRole('img', { name: 'alpha.png' });
    const firstLi = firstCard.closest('li')!;

    firstLi.focus();
    await user.keyboard('{End}');

    const thirdCard = screen.getByRole('img', { name: 'gamma.png' });
    expect(thirdCard.closest('li')).toHaveFocus();
  });

  it('focused item has the focus CSS class', async () => {
    renderBoard();
    const firstCard = await screen.findByRole('img', { name: 'alpha.png' });
    const firstLi = firstCard.closest('li')!;

    // Use keyboard to set focus via React state, not direct DOM focus.
    firstLi.focus();
    await user.keyboard('{ArrowRight}');
    // Now the second item should be focused via React state.
    const secondCard = screen.getByRole('img', { name: 'beta.png' });
    expect(secondCard.closest('li')).toHaveClass('grid-item--focused');
  });

  it('arrow keys do not fire when focus is outside the grid', async () => {
    renderBoard();
    await screen.findByRole('img', { name: 'alpha.png' });

    // Focus the search bar — arrow keys should not affect the grid.
    const searchInput = screen.getByLabelText('Search tags');
    searchInput.focus();
    await user.keyboard('{ArrowRight}');

    // No grid item should have the focus class.
    const items = screen.getAllByRole('listitem');
    const focusedItems = items.filter((li) => li.classList.contains('grid-item--focused'));
    expect(focusedItems).toHaveLength(0);
  });
});
