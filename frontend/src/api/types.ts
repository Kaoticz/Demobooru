/** Wire-format types for the Demobooru API (field names match the JSON exactly). */

export interface BoardImage {
  id: number;
  url: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  tags: string[];
}

export interface ImagesPage {
  items: BoardImage[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface TagsResponse {
  tags: string[];
}
