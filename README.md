# Redis Hosting Platform — two-app workspace

| App        | Path       | Serves                          | Dev port |
| ---------- | ---------- | ------------------------------- | -------- |
| `backend/` | Express 5  | REST API + docs (`/api`, `/api/openapi.json`, `/llms.txt`) | **3000** |
| `frontend/`| Next.js 16 (App Router, JavaScript) | the entire UI (landing + console) | **3001** |

The frontend is the only app that serves HTML. The backend is API-only: every
page route responds with a JSON 404 envelope, and CORS is restricted to the
frontend origins (`CORS_ORIGINS`).

## Quick start (two terminals)

```powershell
# terminal 1 — API
cd backend
npm install
npm start                 # http://127.0.0.1:3000

# terminal 2 — UI
cd frontend
npm install
npm run dev               # http://localhost:3001  (script pins -p 3001)
```

## Configuration

- `backend/.env` — all backend config; copy keys from `backend/.env.example`.
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://127.0.0.1:3000`
  (inlined at build time; empty value means same-origin deployment).
  `frontend/.env.example` documents it.

## Checks

```powershell
cd backend;  npm test     # 30-check end-to-end smoke suite (uses a temp Mongo database)
```

Further documentation lives in each app: `backend/README.md`, `frontend/README.md`.
