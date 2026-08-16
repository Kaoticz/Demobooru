import type { BoardImage, ImagesPage } from '../api/types';

let nextId = 1;

export function makeImage(overrides: Partial<BoardImage> = {}): BoardImage {
  const id = overrides.id ?? nextId++;
  return {
    id,
    url: `/api/files/${String(id).padStart(32, '0')}.png`,
    original_filename: `image${id}.png`,
    mime_type: 'image/png',
    size_bytes: 1024,
    created_at: '2026-08-01T12:00:00Z',
    tags: ['tag'],
    ...overrides,
  };
}

export function makePage(
  items: BoardImage[],
  opts: { page?: number; total?: number; totalPages?: number } = {},
): ImagesPage {
  const page = opts.page ?? 1;
  const total = opts.total ?? items.length;
  const totalPages = opts.totalPages ?? (total === 0 ? 0 : Math.ceil(total / 20));
  return { items, page, page_size: 20, total, total_pages: totalPages };
}
