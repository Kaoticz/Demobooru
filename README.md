# Demobooru, tag-based image board

A small, deliberately minimal booru-style image board: upload images, tag them,
search by exact tags, browse newest-first.

**The project ships with no images.** You upload your own images through the app.

## Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Backend  | Python 3.14, FastAPI, SQLAlchemy 2, Alembic     |
| Database | PostgreSQL 18                                   |
| Frontend | React 19 + TypeScript, Vite dev server          |
| Tests    | pytest (backend), Vitest + RTL (frontend)       |
| Types    | mypy (strict) + basedpyright, backend code      |
| Runtime  | Docker Compose, hot reloading on both app tiers |

## Tests

Backend (pytest, runs inside the backend container against an isolated
`demobooru_test` database, your board's data is never touched):

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

Static type checking for the backend (mypy in strict mode and basedpyright,
both configured in `backend/pyproject.toml`, both run inside the backend
container, no local Python tooling needed):

```sh
docker compose exec backend mypy
docker compose exec backend basedpyright
```

No authentication anywhere, the board is fully anonymous by design.

## Prerequisites

- Docker Engine (with the Compose v2 plugin)

## Start

```sh
docker compose up -d --build
```

- Frontend: http://localhost:5174
- Backend API: http://localhost:8001/api/health
- PostgreSQL: `localhost:5433` (user `demobooru`, password `demobooru_demo`, db `demobooru`)

On first start the backend waits for PostgreSQL, applies all Alembic
migrations automatically, then begins serving. No manual setup steps required.

## Hot reloading

- **Backend**: the container runs `uvicorn --reload` watching `backend/app`.
  Editing any Python file there restarts the API automatically.
- **Frontend**: the container runs the Vite dev server; editing anything under
  `frontend/src` updates the browser via HMR without a rebuild.

File watching uses polling on both sides by default
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
serves), you should never need to run them by hand in normal use.

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
re-applied automatically).

Uploaded images survive ordinary restarts (`docker compose restart` /
`docker compose down` without `-v`), only the explicit volume wipe removes
them.
