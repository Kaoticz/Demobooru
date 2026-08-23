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
| Backend  | Python 3.14, FastAPI, SQLAlchemy 2, Alembic     |
| Database | PostgreSQL 18 (Docker volume for persistence)   |
| Frontend | React 19 + TypeScript, Vite dev server          |
| Tests    | pytest (backend), Vitest + RTL (frontend)       |
| Types    | mypy (strict) + basedpyright, backend code      |
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

Static type checking for the backend (mypy in strict mode and basedpyright,
both configured in `backend/pyproject.toml`, both run inside the backend
container — no local Python tooling needed):

```sh
docker compose exec backend mypy
docker compose exec backend basedpyright
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

- Frontend: http://localhost:5174
- Backend API: http://localhost:8001/api/health
- PostgreSQL: `localhost:5433` (user `demobooru`, password `demobooru_demo`, db `demobooru`)

On first start the backend waits for PostgreSQL, applies all Alembic
migrations automatically, then begins serving. No manual setup steps.

### Why PostgreSQL is on port 5433

The conventional 5432 is very likely already used by another local PostgreSQL
instance (for example the one another tool on this machine relies on), so this
stack deliberately publishes on **5433** instead. To change any published port,
copy `env.example` to `.env` and adjust `DB_HOST_PORT`, `BACKEND_HOST_PORT`,
or `FRONTEND_HOST_PORT`.

Every variable the stack reads is documented in [`env.example`](env.example)
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
- **Pinned dependencies**: the backend's dependencies live in
  `backend/pyproject.toml`, split into runtime dependencies and a `dev`
  profile (`[dependency-groups]`) carrying pytest, httpx2 and the type
  checkers mypy and basedpyright. Both lists are complete, fully pinned
  transitive closures (not just direct requirements) for reproducible
  builds; the container installs both so tests and type checking run
  inside it. To upgrade, edit the pins there and rebuild; regenerate the
  lists with `docker compose exec backend pip freeze`.

## Repository layout

Enough orientation for a coding agent (or a human) seeing this for the first
time:

```
.
├── docker-compose.yml        three services: database, backend, frontend
├── env.example                every environment variable, with defaults
├── backend/                  Python / FastAPI
│   ├── app/
│   │   ├── main.py           app wiring: CORS, router, /api/health
│   │   ├── routes.py         all REST endpoints (upload/list/search/detail/
│   │   │                     delete/tags/file serving)
│   │   ├── models.py         SQLAlchemy models: images, tags, image_tags
│   │   ├── schemas.py        Pydantic response models
│   │   ├── tags.py           tag normalization + concurrency-safe resolution
│   │   ├── storage.py        upload-directory handling, generated filenames
│   │   ├── config.py         environment-driven settings
│   │   └── database.py       engine, session factory, get_db dependency
│   ├── alembic/              migrations (versions/ holds the revisions)
│   ├── tests/                pytest suite (tests through the HTTP layer)
│   ├── pyproject.toml        pinned deps (runtime + dev profile), mypy/
│   │                         basedpyright config
│   └── entrypoint.sh         wait for DB → apply migrations → run server
├── frontend/                 React 19 + TypeScript / Vite
│   └── src/
│       ├── api/              typed API client (client.ts) and wire types
│       ├── components/       grid, pagination, upload form, search bar,
│       │                     tag panel, detail view, shared states
│       ├── hooks/            useApi (loading/error/retry data fetching)
│       └── __tests__/        Vitest + RTL tests (API layer mocked)
└── docs/tickets/             the three demo tickets (see below)
```

Behavioral notes worth knowing when changing things:

- The browser talks only to the Vite dev server (`/api/*` proxied), never to
  the backend origin directly.
- Uploads are stored in the `uploads` Docker volume under generated hex
  names; the original filename lives only in the database.
- Deleting an image also deletes tags that would otherwise be attached to
  nothing.

## Demo workflow

This repository is the base for demonstrating a coding agent:

1. `docker compose up -d --build` — the board comes up empty (no images are
   bundled; upload your own through the app, ideally a couple of large phone
   photos so the Tier 3 complaint feels real).
2. Pick a ticket from `docs/tickets/` and point the agent at it. The tickets
   are deliberately underspecified — the design decisions are the demo.
3. Both app tiers hot-reload, so the agent's edits become visible live
   without rebuilding anything.
4. Both test suites run inside the containers with the commands above, so
   "make the tests pass" is demoable too.

## The demo tickets

The three tickets in [`docs/tickets/`](docs/tickets/) describe real,
desirable improvements — grid browsing comfort, tag discovery, large-upload
handling and search exclusions. They are written like normal GitHub issues
and are **deliberately not implemented**; they exist so the demonstrated
agent can be pointed at them. Increasing scope from frontend-only (ticket 1)
to full-stack (ticket 3).

## Troubleshooting

Failures actually hit while building this project:

- **`permission denied ... /var/run/docker.sock`** — your user is not in the
  `docker` group. Fix: `sudo usermod -aG docker $USER`, then log out and
  back in (or start a shell with `newgrp docker`).
- **`port is already allocated` / address in use** — one of the published
  ports (5433, 8001, 5174) is taken on the host. Copy `env.example` to
  `.env` and change `DB_HOST_PORT` / `BACKEND_HOST_PORT` /
  `FRONTEND_HOST_PORT`. Note PostgreSQL is on 5433 precisely to avoid the
  usual 5432 collision; if you change it, any host tooling must follow.
- **Backend container restarts endlessly with migration errors** — check
  `docker compose logs backend`. The backend refuses to serve against a
  broken schema by design. A `docker compose down -v` resets everything
  (destructive: deletes images and database).
- **Frontend shows "Backend unavailable"** — the backend takes a few seconds
  to wait for the database and apply migrations on first start; use the
  Retry button. If it persists, the backend logs have the reason.
- **File watching feels CPU-hungry** — both watchers poll by default for
  cross-platform reliability; on Linux you can set
  `WATCHFILES_FORCE_POLLING=false` and `VITE_USE_POLLING=false` in `.env`.
- **Two checkouts cannot run at the same time** — the Compose project name
  is fixed (`name: demobooru` in `docker-compose.yml`), so a second clone of
  this repository on the same machine would *share* containers, volumes, and
  ports with the first instead of running alongside it. One board per
  machine; `docker compose down` from the first checkout before starting a
  second.
- **Never run `npm`/`pip` on the host** — everything runs inside the
  containers; the frontend's `node_modules` volume is intentionally isolated
  from anything on your host.
