"""Tag parsing, normalization, and resolution.

Booru convention: tags are lowercase, space-separated in input, underscores
stand for spaces inside a tag (`landscape_photo`). Permitted characters are
`a-z`, `0-9`, `_`, `-`, up to 64 characters.
"""

import re

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models import Tag

MAX_TAG_LENGTH = 64

TAG_PATTERN = re.compile(r"^[a-z0-9_-]+$")


class TagValidationError(ValueError):
    """Raised when a tag string cannot be normalized into valid tags."""


def normalize_tags(raw: str | None) -> list[str]:
    """Normalize a raw tag string into a de-duplicated list of valid tags.

    Trim, lowercase, split on any whitespace, and drop duplicates while
    keeping first-seen order. Raises TagValidationError when the result would
    be empty or contain an invalid tag.
    """
    if raw is None:
        raise TagValidationError("a tags field is required")
    parts = raw.strip().lower().split()
    seen: set[str] = set()
    ordered: list[str] = []
    for part in parts:
        if part not in seen:
            seen.add(part)
            ordered.append(part)
    if not ordered:
        raise TagValidationError("at least one tag is required")
    for tag in ordered:
        if len(tag) > MAX_TAG_LENGTH or not TAG_PATTERN.fullmatch(tag):
            raise TagValidationError(
                f"invalid tag '{tag}': tags may use lowercase letters, digits, "
                f"underscores and hyphens, up to {MAX_TAG_LENGTH} characters"
            )
    return ordered


def get_or_create_tag(db: Session, name: str) -> Tag:
    """Return the Tag row for a normalized name, creating it if needed.

    Safe under concurrency: two transactions introducing the same new tag
    both resolve to a single row. The INSERT uses ON CONFLICT DO NOTHING
    against the unique index, so a losing racer simply selects the winner's
    row instead of surfacing a constraint violation.
    """
    tag = db.scalar(select(Tag).where(Tag.name == name))
    if tag is not None:
        return tag

    stmt = pg_insert(Tag).values(name=name).on_conflict_do_nothing(
        index_elements=["name"]
    )
    db.execute(stmt)
    tag = db.scalar(select(Tag).where(Tag.name == name))
    if tag is None:  # pragma: no cover - defensive; see docstring
        raise RuntimeError(f"tag '{name}' disappeared after insert")
    return tag
