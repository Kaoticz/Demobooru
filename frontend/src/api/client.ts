/** Typed API client. Every request and response has an explicit type;
 *  there are no untyped escape hatches. */

import type { BoardImage, ImagesPage, TagsResponse } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function errorMessage(response: Response): Promise<string> {
  const fallback = `request failed with status ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (body !== null && typeof body === 'object' && 'detail' in body) {
      const detail: unknown = (body as { detail: unknown }).detail;
      if (typeof detail === 'string') return detail;
      return JSON.stringify(detail);
    }
  } catch {
    // no JSON body — fall through to the generic message
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('cannot reach the server — is the stack running?', 0);
  }
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function fetchImages(params: { page: number; tags?: string[] }): Promise<ImagesPage> {
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  if (params.tags && params.tags.length > 0) {
    search.set('tags', params.tags.join(' '));
  }
  return request<ImagesPage>(`/api/images?${search.toString()}`);
}

export function fetchImage(id: number): Promise<BoardImage> {
  return request<BoardImage>(`/api/images/${id}`);
}

export function fetchTags(): Promise<TagsResponse> {
  return request<TagsResponse>('/api/tags');
}

export function uploadImage(file: File, tags: string): Promise<BoardImage> {
  const form = new FormData();
  form.append('file', file);
  form.append('tags', tags);
  return request<BoardImage>('/api/images', { method: 'POST', body: form });
}

export function deleteImage(id: number): Promise<void> {
  return request<void>(`/api/images/${id}`, { method: 'DELETE' });
}
