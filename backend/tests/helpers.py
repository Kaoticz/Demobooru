"""Shared helpers for backend tests: in-memory PNG generation, no fixtures."""

import struct
import zlib
from pathlib import Path

TEST_UPLOAD_DIR = Path("/tmp/demobooru-test-uploads")


def _png_chunk(kind: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", crc)


def make_png(
    width: int = 1, height: int = 1, rgb: tuple[int, int, int] = (200, 60, 60)
) -> bytes:
    """A tiny valid PNG, generated in memory (no fixture files in the repo)."""
    scanline = b"\x00" + bytes(rgb) * width
    raw = scanline * height
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(raw))
        + _png_chunk(b"IEND", b"")
    )


def upload(client, tags: str, *, filename: str = "test.png", data: bytes | None = None,
           content_type: str = "image/png"):
    """POST an upload with sensible defaults; returns the response."""
    return client.post(
        "/api/images",
        files={"file": (filename, data if data is not None else make_png(), content_type)},
        data={"tags": tags},
    )
