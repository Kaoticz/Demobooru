"""Pytest configuration: isolated test database, clean state per test.

Runs inside the backend container. Uses a dedicated `demobooru_test` database
(separate from the development `demobooru` database) and a throwaway upload
directory. The environment overrides below must be set before any `app`
module is imported, which is why they live at module level of this file —
pytest imports conftest before collecting tests.
"""

import os
import shutil
from collections.abc import Iterator

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://demobooru:demobooru_demo@database:5432/demobooru_test",
)

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["UPLOAD_DIR"] = "/tmp/demobooru-test-uploads"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from tests.helpers import TEST_UPLOAD_DIR  # noqa: E402


def _ensure_test_database_exists() -> None:
    """Create demobooru_test if missing (connects to the maintenance db)."""
    server_url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    server_engine = create_engine(server_url, isolation_level="AUTOCOMMIT")
    with server_engine.connect() as connection:
        exists = connection.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'demobooru_test'")
        ).scalar()
        if not exists:
            _ = connection.execute(text("CREATE DATABASE demobooru_test"))
    server_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> Iterator[None]:
    """Bring the test database to the latest migration before any test."""
    _ensure_test_database_exists()
    command.upgrade(Config("/app/alembic.ini"), "head")
    yield


@pytest.fixture(autouse=True)
def clean_state(
    migrated_database: None,  # pyright: ignore[reportUnusedParameter] - fixture injection orders this after the session fixture
) -> Iterator[None]:
    """Every test starts from empty tables and an empty upload directory."""
    from app.database import engine

    with engine.begin() as connection:
        _ = connection.execute(
            text("TRUNCATE TABLE image_tags, images, tags RESTART IDENTITY CASCADE")
        )
    shutil.rmtree(TEST_UPLOAD_DIR, ignore_errors=True)
    yield


@pytest.fixture()
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
