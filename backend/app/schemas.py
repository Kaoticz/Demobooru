"""Pydantic response models for the API."""

from datetime import datetime

from pydantic import BaseModel

from app.models import Image


class ImageOut(BaseModel):
    id: int
    url: str
    original_filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime
    tags: list[str]


class PageOut(BaseModel):
    items: list[ImageOut]
    page: int
    page_size: int
    total: int
    total_pages: int


class TagListOut(BaseModel):
    tags: list[str]


class HealthOut(BaseModel):
    status: str
    database: str


def image_to_out(image: Image) -> ImageOut:
    return ImageOut(
        id=image.id,
        url=f"/api/files/{image.filename}",
        original_filename=image.original_filename,
        mime_type=image.mime_type,
        size_bytes=image.size_bytes,
        created_at=image.created_at,
        tags=[tag.name for tag in image.tags],
    )
