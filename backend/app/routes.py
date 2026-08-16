"""REST API routes for the image board.

Everything here is synchronous by design: upload blocks until the file is
stored and the database record is written; there is no background processing
of any kind.
"""

import math

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Image, Tag, image_tags
from app.schemas import ImageOut, PageOut, TagListOut, image_to_out
from app.storage import (
    ALLOWED_MIME_TYPES,
    MAX_ORIGINAL_FILENAME_LENGTH,
    delete_file,
    file_path,
    save_file,
)
from app.tags import TagValidationError, get_or_create_tag, normalize_tags

router = APIRouter(prefix="/api")

# Fixed page size for the grid; a deliberate simplification.
PAGE_SIZE = 20

_FILE_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def _max_upload_bytes() -> int:
    return get_settings().max_upload_mb * 1024 * 1024


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=message)


@router.post("/images", status_code=201, response_model=ImageOut)
def upload_image(
    tags: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ImageOut:
    """Store one image file plus its tags, synchronously.

    The response is returned only after the file is on disk and the database
    record (including tag links) is committed. A rejected or failed upload
    leaves nothing behind. An absent or empty tags field is a validation
    error ("at least one tag required"), not a schema error.
    """
    try:
        tag_names = normalize_tags(tags)
    except TagValidationError as exc:
        raise _bad_request(str(exc)) from exc

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise _bad_request(
            f"unsupported file type '{file.content_type or 'unknown'}': "
            "allowed types are JPEG, PNG, GIF and WebP"
        )

    max_bytes = _max_upload_bytes()
    if file.size is not None and file.size > max_bytes:
        raise _bad_request(
            f"file is too large: {file.size} bytes exceeds the "
            f"{get_settings().max_upload_mb} MB limit"
        )

    data = file.file.read()
    if not data:
        raise _bad_request("uploaded file is empty")
    if len(data) > max_bytes:
        raise _bad_request(
            f"file is too large: {len(data)} bytes exceeds the "
            f"{get_settings().max_upload_mb} MB limit"
        )

    original_filename = file.filename or "upload"
    if len(original_filename) > MAX_ORIGINAL_FILENAME_LENGTH:
        raise _bad_request(
            f"original filename is too long "
            f"(max {MAX_ORIGINAL_FILENAME_LENGTH} characters)"
        )

    stored_filename = save_file(data, file.content_type)
    try:
        tag_objects = [get_or_create_tag(db, name) for name in tag_names]
        image = Image(
            filename=stored_filename,
            original_filename=original_filename,
            mime_type=file.content_type,
            size_bytes=len(data),
            tags=tag_objects,
        )
        db.add(image)
        db.commit()
        db.refresh(image)  # load the server-generated created_at
    except Exception as exc:
        db.rollback()
        # Keep disk and database consistent: no orphaned file on a failed write.
        delete_file(stored_filename)
        raise HTTPException(
            status_code=500, detail="upload failed; nothing was saved"
        ) from exc

    return image_to_out(image)


@router.get("/images", response_model=PageOut)
def list_images(
    page: int = Query(default=1, ge=1),
    tags: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> PageOut:
    """List images newest-first, optionally filtered to images carrying ALL
    of the given (exact-match) tags. Page-based pagination at PAGE_SIZE."""
    try:
        tag_names = normalize_tags(tags) if tags and tags.strip() else []
    except TagValidationError as exc:
        raise _bad_request(str(exc)) from exc

    query = select(Image)
    for name in tag_names:
        query = query.where(Image.tags.any(Tag.name == name))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    items = list(
        db.scalars(
            query.order_by(Image.created_at.desc(), Image.id.desc())
            .offset((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
        )
    )

    return PageOut(
        items=[image_to_out(image) for image in items],
        page=page,
        page_size=PAGE_SIZE,
        total=total,
        total_pages=math.ceil(total / PAGE_SIZE),
    )


@router.get("/images/{image_id}", response_model=ImageOut)
def get_image(image_id: int, db: Session = Depends(get_db)) -> ImageOut:
    image = db.get(Image, image_id)
    if image is None:
        raise HTTPException(status_code=404, detail=f"image {image_id} not found")
    return image_to_out(image)


@router.delete("/images/{image_id}", status_code=204)
def delete_image(image_id: int, db: Session = Depends(get_db)) -> Response:
    image = db.get(Image, image_id)
    if image is None:
        raise HTTPException(status_code=404, detail=f"image {image_id} not found")

    db.delete(image)
    # Flush so this image's join rows are gone from the database before the
    # orphan check below runs (the session has autoflush disabled).
    db.flush()
    # Policy: a tag attached to nothing is removed with its last image, so the
    # tag list always reflects tags actually in use.
    db.execute(
        Tag.__table__.delete().where(
            ~exists(select(1).where(image_tags.c.tag_id == Tag.id))
        )
    )
    db.commit()
    delete_file(image.filename)
    return Response(status_code=204)


@router.get("/tags", response_model=TagListOut)
def list_tags(db: Session = Depends(get_db)) -> TagListOut:
    """All tags currently in use, alphabetically. Names only — no counts."""
    names = list(
        db.scalars(
            select(Tag.name)
            .where(exists(select(1).where(image_tags.c.tag_id == Tag.id)))
            .order_by(Tag.name)
        )
    )
    return TagListOut(tags=names)


@router.get("/files/{filename}")
def get_file(filename: str) -> FileResponse:
    path = file_path(filename)
    if path is None or not path.is_file():
        # Badly shaped names and missing files look identical from outside.
        raise HTTPException(status_code=404, detail=f"file '{filename}' not found")
    return FileResponse(path, media_type=_FILE_MEDIA_TYPES[path.suffix])
