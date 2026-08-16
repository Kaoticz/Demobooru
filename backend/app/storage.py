"""Filesystem storage for uploaded images.

Stored files live under the configured upload directory with generated,
non-guessable names. The user's original filename is never used as a path.
No image processing happens here or anywhere else — bytes in, bytes out.
"""

import re
import secrets
from pathlib import Path

from app.config import get_settings

EXTENSION_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

ALLOWED_MIME_TYPES = frozenset(EXTENSION_BY_MIME)

# Stored names are exactly 32 hex characters plus a known extension; the
# serving endpoint enforces this shape, which also rules out path traversal.
STORED_FILENAME_PATTERN = re.compile(r"^[0-9a-f]{32}\.(jpg|png|gif|webp)$")

MAX_ORIGINAL_FILENAME_LENGTH = 512


def upload_root() -> Path:
    root = Path(get_settings().upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def generate_stored_filename(mime_type: str) -> str:
    """A non-guessable storage name that keeps the type's extension."""
    return f"{secrets.token_hex(16)}{EXTENSION_BY_MIME[mime_type]}"


def save_file(data: bytes, mime_type: str) -> str:
    """Write upload bytes to storage; returns the stored filename."""
    filename = generate_stored_filename(mime_type)
    (upload_root() / filename).write_bytes(data)
    return filename


def delete_file(filename: str) -> None:
    """Remove a stored file; a file that is already gone is not an error."""
    path = upload_root() / filename
    path.unlink(missing_ok=True)


def file_path(filename: str) -> Path | None:
    """Path for a stored filename, or None if the name is not well-formed."""
    if not STORED_FILENAME_PATTERN.fullmatch(filename):
        return None
    return upload_root() / filename


def stored_files() -> list[str]:
    """All stored filenames currently on disk (test/debug helper)."""
    root = upload_root()
    return sorted(p.name for p in root.iterdir() if p.is_file())
