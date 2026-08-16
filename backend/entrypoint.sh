#!/bin/sh
# Backend container entrypoint:
#   1. wait until the database genuinely accepts connections
#   2. apply any outstanding Alembic migrations
#   3. hand over to the API server (default CMD)
# The API never serves against an unmigrated or unreachable database.
set -e

echo "[entrypoint] waiting for database to accept connections..."
python - <<'PY'
import os
import sys
import time

from sqlalchemy import create_engine, text

engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
last_error = None
for attempt in range(1, 61):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("[entrypoint] database is ready")
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001 - any driver error means "not ready"
        last_error = exc
        print(f"[entrypoint] not ready yet (attempt {attempt}/60): {exc}")
        time.sleep(1)
print(f"[entrypoint] ERROR: database never became ready: {last_error}", file=sys.stderr)
sys.exit(1)
PY

if [ -f alembic.ini ]; then
    echo "[entrypoint] applying database migrations..."
    attempt=1
    applied=0
    while [ "$attempt" -le 3 ]; do
        if alembic upgrade head; then
            applied=1
            break
        fi
        echo "[entrypoint] migration attempt ${attempt} failed; retrying in 2s"
        attempt=$((attempt + 1))
        sleep 2
    done
    if [ "$applied" -ne 1 ]; then
        echo "[entrypoint] ERROR: migrations failed after 3 attempts; refusing to serve" >&2
        exit 1
    fi
    echo "[entrypoint] migrations applied"
else
    echo "[entrypoint] no alembic.ini present; skipping migrations"
fi

exec "$@"
