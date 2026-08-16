"""Database models for the image board.

Deliberately minimal: no processing-status, thumbnail, or async-pipeline
fields exist anywhere in this schema on purpose — those belong to a later
feature, not to the foundation.
"""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


image_tags = Table(
    "image_tags",
    Base.metadata,
    Column[int](
        "image_id",
        ForeignKey("images.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column[int](
        "tag_id",
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    # The composite primary key covers lookups starting from image_id;
    # tag_id-leading lookups (which images carry this tag?) need their own.
    Index("ix_image_tags_tag_id", "tag_id"),
)


class Image(Base):
    __tablename__: str = "images"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Generated, non-guessable storage name (not the user's filename).
    filename: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    # Newest-first listing is the primary browse order.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    tags: Mapped[list["Tag"]] = relationship(
        secondary=image_tags,
        back_populates="images",
        lazy="selectin",
    )


class Tag(Base):
    __tablename__: str = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Normalized, unique tag name (lowercase, underscores for spaces).
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    images: Mapped[list["Image"]] = relationship(
        secondary=image_tags,
        back_populates="tags",
    )
