# Framework clients — one platform, four ways to talk to it

Every script in this folder runs **the identical scenario** against the platform
REST API, but each uses its own ecosystem's dedicated HTTP client, and each
writes the expiry in a **different Redis idiom**. Run them and diff the traces:
the API contract stays identical, the wire behavior (headers, batching, UA) differs per framework.

## Run

```text
node tests/clients/run-all.mjs        # runs the four native clients, prints the matrix
npm run test:clients                  # same via npm
node tests/clients/run-docker.mjs     # dockerized Java, Go, Spring Boot clients
npm run test:clients:docker           # same via npm
node tests/clients/node-client.mjs    # or run one at a time
python tests/clients/python-client.py
powershell -NoProfile -ExecutionPolicy Bypass -File tests\clients\powershell-client.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests\clients\curl-client.ps1
```

## Dockerized clients (Java, Go, Spring Boot)

`run-docker.mjs` runs the heavyweight ecosystems inside containers, so **no
JDK, Go toolchain, or Maven is needed on the host**:

| Container client | Dedicated HTTP module | Docker image |
|---|---|---|
| Java | `java.net.http.HttpClient` (JDK built-in since 11) | `eclipse-temurin:17-alpine` |
| Go | `net/http` (stdlib) | `golang:alpine` |
| Spring Boot 3 | `RestTemplate` + Jackson | `maven:3.9-eclipse-temurin-17` |

- Containers reach the host server on `http://host.docker.internal:3000`
  (Docker Desktop's host alias); images auto-pull on first run.
- `fw-m2` (Maven repo) and `fw-gocache` (Go build cache) are named volumes, so
  repeat runs skip the dependency downloads.
- Spring runs in non-web mode (`--spring.main.web-application-type=none`) so
  only the scenario executes, no embedded Tomcat.
- Fun contrast: the JDK ships **no JSON parser**, so `JavaClient.java`
  hand-rolls a ~100-line one — Node/Python/Spring all get JSON for free.

Prerequisites: a running server (`npm start`), Node 18+, Python + `requests`,
and curl (all present on Windows 10/11 by default). Override the target with
`RH_BASE_URL`, the account with `RH_EMAIL` / `RH_PASSWORD`.

## The scenario (identical for every client)

| # | Step | Endpoint | Expectation |
|---|------|----------|-------------|
| 0 | login, receive session token | `POST /api/auth/login` | `data.token` |
| 1 | spin up a dedicated lab DB | `POST /api/databases` | 201, isolated keyspace |
| 2 | mint a scoped API key (rw) | `POST /api/api-keys` | plaintext returned **once** |
| 3 | save a value **with expiry** (idiom varies per framework) | `POST /api/data/{dbId}/command` | `OK` |
| 4 | pipeline: atomic `INCR` ×3 | `POST /api/data/{dbId}/pipeline` | `[1, 2, 3]` |
| 5 | read the value back | `GET` command | byte-for-byte round trip |
| 6 | probe TTL on the **remote server**, not locally | `TTL` command | `5 … 1` |
| 7 | key is visible while fresh | `EXISTS` command | `1` |
| 8 | wait 6.5 s (server-side expiry, no client help) | — | — |
| 9 | read the expired key | `GET` command | **Redis nil → JSON `null`** |
| 10 | probe TTL after expiry | `TTL` command | **`-2` (no such key)** |
| 11 | revoke the key, then try again | `DELETE /api/api-keys/{id}` | **401 envelope** |
| 12 | teardown cascade | `DELETE /api/databases/{dbId}` | keys + scoped keys gone |

Expiry is enforced **server-side and lazily**: the first read after
`expires_at` deletes the row and answers nil, exactly like Redis. Nothing in
any framework can resurrect the key.

## The four expiry idioms — same `expires_at` underneath

| Client | Transport module | Idiom used |
|--------|------------------|------------|
| Node.js | native `fetch` (undici, no packages) | `SET key val EX 5` (inline seconds) |
| Python | `requests` | `SETEX key 5 val` (classic two-arg) |
| PowerShell | `Invoke-RestMethod` (/.NET HttpClient) | `SET key val PX 5000` (milliseconds) |
| cURL | `curl.exe`, one process per request | `SET`, then `EXPIRE key 5` (two-step) |
| Java (docker) | JDK `java.net.http.HttpClient` | `SET key val EX 5` |
| Go (docker) | stdlib `net/http` | `SET key val EX 5` |
| Spring Boot (docker) | `RestTemplate` + Jackson | `SET key val EX 5` |

## How each framework "sends" differently (what the traces show)

- **Node fetch**: sets only the headers you give it — no default `User-Agent`.
- **Python requests**: sends `User-Agent: python-requests/x.y`, `Accept-Encoding: gzip, deflate`, keep-alive sessions.
- **PowerShell Invoke-RestMethod**: .NET HttpClient, no UA unless you pass one.
- **cURL**: every header and body built by hand, visible in the trace line.
- **Java (JDK HttpClient)**: claims `User-Agent: Java-http-client/17…` — visible server-side.
- **Go (net/http)**: claims `User-Agent: Go-http-client/2.0`.
- **Spring Boot RestTemplate**: delegates to the JDK engine, so it also sends
  `Java-http-client/…` — the framework wraps the JDK client underneath.
- The API key only ever travels as `Authorization: Bearer rk_…`; traces mask it to `rk_XXXXXXXX…`.

## REST-native alternatives this suite does not exercise

- `PUT /api/data/{dbId}/strings/{key}` with `expiresInMs` — expiry without Redis idioms.
- `POST /api/data/{dbId}/keys/{key}/expire` (`expiresInMs`) and `DELETE …/expire` = persist.
- `GET /api/data/{dbId}/keys?pattern=fw:*` — cursor-based key browsing.

## Hygiene

- Each run **self-heals**: labs named `fw-lab-<lang>-<epoch>` from a crashed
  previous run are swept before creating a fresh one.
- Teardown always runs (`finally`): API key revoked, lab DB deleted
  (cascade wipes its keys), temp request files removed (cURL client).
