# Demobooru — tag-based image board

A small, deliberately minimal booru-style image board: upload images, tag them,
search by exact tags, browse newest-first. It exists as the base project for a
coding-agent demo — the three feature tickets in `docs/tickets/` are meant to
be implemented live on top of this foundation, and everything here is
deliberately kept simple enough to leave room for them.

**The project ships with no images.** There are no seeds, no placeholders, no
bundled sample content. A fresh start shows an empty board; you upload your own
images through the app.

## Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2, Alembic     |
| Database | PostgreSQL 17 (Docker volume for persistence)   |
| Frontend | React 19 + TypeScript, Vite dev server          |
| Tests    | pytest (backend), Vitest + RTL (frontend)       |
| Runtime  | Docker Compose, hot reloading on both app tiers |

## Tests

Backend (pytest, runs inside the backend container against an isolated
`demobooru_test` database — your board's data is never touched):

```sh
docker compose exec backend pytest
```

Frontend (Vitest + React Testing Library, runs inside the frontend container;
the API layer is mocked, no backend needed):

```sh
docker compose exec frontend npm test
```

Type-check the frontend with:

```sh
docker compose exec frontend npm run typecheck
```

No authentication anywhere — the board is fully anonymous by design.

## Prerequisites

- Docker Engine (with the Compose v2 plugin)

That's it. Node and Python are only needed inside the containers; the host
needs neither.

## Start

```sh
docker compose up -d --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/health
- PostgreSQL: `localhost:5433` (user `demobooru`, password `demobooru_demo`, db `demobooru`)

On first start the backend waits for PostgreSQL, applies all Alembic
migrations automatically, then begins serving. No manual setup steps.

### Why PostgreSQL is on port 5433

The conventional 5432 is very likely already used by another local PostgreSQL
instance (for example the one another tool on this machine relies on), so this
stack deliberately publishes on **5433** instead. To change any published port,
copy `.env.example` to `.env` and adjust `DB_HOST_PORT`, `BACKEND_HOST_PORT`,
or `FRONTEND_HOST_PORT`.

Every variable the stack reads is documented in [`.env.example`](.env.example)
with demo-safe defaults; the stack runs fine with no `.env` at all.

## Hot reloading

- **Backend**: the container runs `uvicorn --reload` watching `backend/app`.
  Editing any Python file there restarts the API automatically (visible in
  `docker compose logs backend -f`).
- **Frontend**: the container runs the Vite dev server; editing anything under
  `frontend/src` updates the browser via HMR without a rebuild.

**Polling caveat:** file watching uses polling on both sides
(`WATCHFILES_FORCE_POLLING=true` / `VITE_USE_POLLING=true`) because native
filesystem events do not reliably propagate into containers on every host
platform (macOS/Windows Docker Desktop in particular). Polling costs a little
CPU but works everywhere. On a Linux host you may set either variable to
`false` in `.env` to switch back to event-based watching.

The browser talks to the backend through the Vite dev-server proxy
(`/api/*` → backend), so the frontend code never hardcodes a backend origin.
The proxy target is configurable via `API_TARGET`.

## Database migrations

Migrations are **applied automatically on backend startup** (before the API
serves) — you never run them by hand in normal use.

To add a migration after changing `backend/app/models.py`:

```sh
docker compose exec backend alembic revision --autogenerate -m "describe change"
# review the generated file under backend/alembic/versions/, then:
docker compose restart backend
```

## Wiping everything back to empty

This removes **all** uploaded images and database content, permanently:

```sh
docker compose down -v
```

Then `docker compose up -d` starts again from a clean slate (migrations are
re-applied automatically). `down -v` deletes the named volumes, including
`uploads` (stored image files) and `postgres_data`.

Uploaded images survive ordinary restarts (`docker compose restart` /
`docker compose down` without `-v`) — only the explicit volume wipe removes
them.

## Design decisions worth knowing

- **Tag format**: tags are lowercase, space-separated when typed, and may
  contain `a-z`, `0-9`, `_` (for multi-word tags, booru-style) and `-`, up to
  64 characters. The server normalizes input (trim, lowercase, split on
  whitespace, de-duplicate) and rejects anything else with a clear message.
- **Search** is exact-match implicit-AND: `cat dog` means "has cat AND dog".
  No operators, negation, partial matching, or suggestions.

- **Stored files**: uploads are kept in a Docker volume under non-guessable
  generated names (`<random>.<ext>`); the user's original filename is
  preserved only in the database. Files are served by the API at
  `/api/files/<stored-name>`.
- **Concurrent tag creation**: if two uploads simultaneously introduce the same
  new tag, the unique constraint on `tags.name` makes one win; the loser
  resolves to the existing row instead of erroring (insert-with-`ON CONFLICT`
  semantics in the tag-resolution code). No user-visible failure.
- **Orphaned tags**: when deleting an image would leave a tag attached to
  nothing, that tag is deleted too. The tag panel always reflects tags
  actually in use.
- **Rejected uploads** leave nothing behind: no file on disk, no database row.
