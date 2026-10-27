# Redis Hosting Platform

A self-contained, multi-user Redis hosting platform: isolated Redis-compatible databases
per user, a REST/JSON data plane, HTTP API keys, per-user quotas, and a compact web
console with an admin control plane.

## Quick start

```powershell
npm install
npm start                # http://127.0.0.1:3000
# run checks
npm test
```

Bootstrap an administrator (either works):

```powershell
$env:ADMIN_EMAIL="admin@example.test"; $env:ADMIN_PASSWORD="change-me-min-8"; npm start
# or, to seed into an existing data directory:
npm run seed:admin
```

## What it does

- **Accounts**: register/login (bcrypt + HMAC session tokens that rotate when a user is
  suspended, a role changes, or an admin rotates access).
- **Hosted databases**: each user gets isolated, Redis-compatible logical databases
  (`string`, `list`, `set`, `hash`, `zset`). Two data-plane backends:
  - **Embedded (default, dev)**: a Redis-semantics engine persisted in SQLite (WAL)
    inside `data/` — zero external dependencies, fully transactional writes.
  - **Remote (production)**: set `REDIS_CONNECTION_STRING` and every hosted database
    becomes an isolated key-prefix namespace (`rh:<namespace>:<key>`) on *your real
    Redis server*; commands execute natively, TTL expiry is Redis-native. See
    "Remote mode" below.
- **Data plane**: `/api/data/:dbId/command` executes one Redis-style command
  (`GET`/`SET`/`HSET`/`RPUSH`/`ZADD`/`KEYS`/`SCAN`/`TTL`/`PEXPIRE`/...); `/pipeline`
  executes a bounded list atomically. Convenience endpoints exist for key browsing,
  key details, deletion, and TTL management.
- **Database settings**: a dedicated `/databases/:id/settings` page — identity
  (rename/description), lifecycle (archive = read-only / restore), the API keys
  scoped to that database, and a danger zone (`POST /api/databases/:id/flush`
  wipes its keys but keeps the database; delete removes everything including
  scoped API keys).
- **API keys**: hashed (`SHA-256`), shown once, revocable, and **scoped**: every key is
  issued for exactly one database with an explicit permission level —
  - `read-write`: full data access for that database (commands, pipeline, REST writes, TTL, flush);
  - `read-only`: reads only — every mutating command is refused with `403 ERR_FORBIDDEN`
    before execution (command classification is server-side, not client-side).
  - Keys cannot reach any other database (404, same as cross-tenant). Key tokens
    (`rk_...`) authenticate the data plane the same way session tokens do; unscoped
    legacy keys (created before this change) keep full account access.
- **Privacy policy**: `/privacy` — a public page describing what the platform collects,
  never stores and deletes (see it in the navbar).
- **Quotas**: per-user max databases, max keys per database, and max serialized value
  bytes; violations roll back atomically and return `ERR_QUOTA_EXCEEDED`.
- **Admin control plane**: list/search users, edit quotas, suspend/reactivate,
  promote/demote, and view usage stats. Suspensions rotate sessions immediately.
- **Web console**: overview dashboard, split-view key browser/editor, command console,
  API key management screens, admin screens. Semantic HTML with `aria-*` states,
  Bootstrap Icons iconography, no emojis.

## Architecture

```
server/
├── index.js              # bootstrap: listener, TTL sweeper, graceful shutdown
├── app.js                # express assembly + SPA/static serving
├── openapi.js            # machine-readable OpenAPI 3.1 + /llms.txt agent index
├── core/                 # env (fail-fast), db singleton + migrations, errors,
│                         # middleware (authN/authZ/rate limit/validation), crypto,
│                         # logger (structured, redacted), envelopes, audit, DTOs
└── modules/
    ├── auth/             # register, login, me   (route -> service -> dal -> schema)
    ├── databases/        # CRUD + stats + cascade delete
    ├── apikeys/          # create (shown once), list, revoke
    ├── data/             # engine (Redis semantics over SQLite) + service + routes
    └── users/            # admin control plane (list, patch status/role/quotas, stats)
../frontend/               # Next.js App Router UI (separate package, port 3001)
scripts/                  # smoke-test (embedded, end-to-end), smoke-remote (real Redis), admin seed
data/                     # SQLite platform.db (created at runtime)
```

Rules enforced throughout: controllers never touch SQL; services never parse requests;
every endpoint is `authenticate -> validate -> authorize -> service -> DAL -> DTO`;
all list endpoints are cursor-paginated; errors use deterministic envelopes.

## API

See `/api/openapi.json` and `/llms.txt` at runtime (agent-readable index).

Response envelope:

```json
{ "success": true, "data": { ... }, "meta": { "cursor": 42 } }
{ "success": false, "error": { "code": "ERR_VALIDATION", "message": "...", "details": [{ "field": "email", "issue": "Invalid" }] } }
```

Status mapping is deterministic: `401` unauthenticated, `403` forbidden/quota,
`404` (used even for cross-tenant misses, to avoid existence leaks),
`409` conflicts, `413` payload, `422` validation and Redis-semantics errors
(WRONGTYPE etc. surface as `ERR_REDIS`), `429` rate limited.

## Remote mode (your real Redis server)

Set `REDIS_CONNECTION_STRING` in `.env` (or the shell) and restart. The data plane then
executes on the real Redis server via `ioredis`:

- **Multi-tenancy on one server**: each hosted database gets a random namespace
  (`rh:a1b2c3d4e5f6:<key>`, prefix configurable via `REDIS_KEY_PREFIX`). Commands are
  rewritten at the driver boundary (key args, `KEYS`/`SCAN` patterns, `FLUSHDB` over
  scoped `SCAN`), so tenants never see each other's keys. Deleting a hosted database
  removes its namespace keys from the server first.
- **What changes vs embedded**: TTL/expiry, atomicity and deletion are native Redis
  semantics; pipelines execute sequentially (not one rollback unit); key sizes use
  `MEMORY USAGE` where the provider supports it (shown as `-` otherwise); pre-existing
  embedded keys stay in `data/` and simply stop being served once remote mode is on.
- **Limits to know**: the shared server has no per-tenant Redis auth — isolation is
  namespace-scoped access controls on this platform; anyone with direct server
  credentials can see all keys. Some managed providers disable `MEMORY USAGE`/`TYPE`
  bulk introspection; the platform degrades gracefully (size `-`).
- **TLS with a provider CA**: servers whose certificate chains to a provider-issued
  CA (TLS required, e.g. managed clouds) need `REDIS_TLS_CA_FILE=path/to/ca.pem` and
  a `rediss://` URI. The provider CA is added to the trust set; certificate and
  hostname verification are never disabled without exception. Plain `redis://` URIs
  are upgraded to TLS automatically when a CA file is configured.

Validate with (skips automatically when the variable is unset; the string itself is
loaded from `.env` by the server and never printed):

```powershell
node scripts/smoke-remote.js
```

## Configuration

Environment variables (or a local `.env`; never commit real secrets):

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` requires a strong `JWT_SECRET` |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | |
| `JWT_SECRET` | ephemeral in dev | required (>= 32 chars) in production |
| `DATA_DIR` | `./data` | SQLite directory (platform metadata + embedded engine data) |
| `REDIS_CONNECTION_STRING` | unset | remote data plane; scheme optional, `rediss://` for TLS |
| `REDIS_KEY_PREFIX` | `rh:` | root prefix in front of every namespace in remote mode |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | empty | bootstrap admin at startup |
| `QUOTA_MAX_DATABASES` / `QUOTA_MAX_KEYS_PER_DB` / `QUOTA_MAX_VALUE_BYTES` | 5 / 10000 / 512 KiB | defaults for new users |
| `RATE_LIMIT_*` | window 60s, 30 public / 240 authed | in-memory fixed window |

## Testing

```powershell
npm test
```

Runs `scripts/smoke-test.js`: boots the app on an ephemeral port with an isolated data
directory and exercises registration, login, cross-tenant 404s, database CRUD, every
data type through the console API, quotas (key count, value size, database count),
API keys (create/use/revoke), suspension with token rotation, admin authorization,
rate limiting, and cascade deletes.

For deployments with a real Redis server, `scripts/smoke-remote.js` runs the same class
of end-to-end checks against it (namespace isolation, all data types, TTL/persist,
pipelines, quotas, scoped `FLUSHDB`, cascade delete with remote cleanup).
