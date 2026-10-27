/**
 * Developer manual (public, viewable signed-out and signed in).
 * How Cacheify works: the REST contract, environment variables, TTL and
 * expiry semantics, framework cookbook, status codes, security, and the
 * Spring Boot RedisTemplate integration path. Every snippet mirrors the
 * behavior verified by tests/clients (7 framework clients + REST probe).
 */

import { Icon } from '../components/common/Icon.jsx';
import BackHomeButton from '../components/common/BackHomeButton.jsx';
import { API_EXAMPLE_ORIGIN } from '../utils/config.js';

const ENV_BLOCK = `# .env - server-side only, never commit it
CACHEIFY_BASE_URL=${API_EXAMPLE_ORIGIN}
CACHEIFY_DB_ID=rdb_xxxxxxxx        # from the dashboard, Databases page
CACHEIFY_API_KEY=rk_xxxxxxxx       # from the API Keys page, shown ONCE`;

const ENDPOINTS = [
  ['POST', '/api/auth/login', 'Sign in, get the session token'],
  ['POST', '/api/auth/otp/request', 'Send the email-verification code (new accounts must verify)'],
  ['POST', '/api/auth/otp/verify', 'Verify the 6-digit code, unlock databases/keys/data plane'],
  ['GET', '/api/profile', 'Your saved profile data (MongoDB-backed)'],
  ['PUT', '/api/profile', 'Save profile data {"displayName","bio","avatarColor"}'],
  ['GET', '/api/databases', 'List your databases'],
  ['POST', '/api/databases/{dbId}/api-keys', 'Mint THIS database\'s API key (plaintext returned once)'],
  ['GET', '/api/databases/{dbId}/api-key', 'Current active key for a database (or null)'],
  ['POST', '/api/api-keys', 'Mint a scoped key by databaseId (plaintext once)'],
  ['DELETE', '/api/api-keys/{id}', 'Revoke a key (immediate, next call 401)'],
  ['POST', '/api/data/{dbId}/command', 'Run one Redis command'],
  ['POST', '/api/data/{dbId}/pipeline', 'Atomic batch of 1-50 commands'],
  ['GET', '/api/data/{dbId}/keys?pattern=&cursor=', 'Browse keys (cursor paging)'],
  ['GET', '/api/data/{dbId}/keys/{key}', 'Key detail: value + ttlMs'],
  ['PUT', '/api/data/{dbId}/strings/{key}', 'Save a string, optional expiresInMs'],
  ['DELETE', '/api/data/{dbId}/keys/{key}', 'Delete a key'],
  ['POST', '/api/data/{dbId}/keys/{key}/expire', 'Re-arm a TTL (expiresInMs)'],
  ['GET', '/api/openapi.json', 'Machine-readable OpenAPI 3.1 contract'],
];

const HTTP_CURL = `curl -X PUT "${API_EXAMPLE_ORIGIN}/api/data/$DB_ID/strings/otp%3Auser%40mail.com" \\
  -H "Authorization: Bearer $RK_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"value":"<otp-hash>","expiresInMs":300000}'`;

const HTTP_PYTHON = `import os, requests

base = os.environ["CACHEIFY_BASE_URL"]
auth = {"Authorization": "Bearer " + os.environ["CACHEIFY_API_KEY"]}

# save with a 5-minute TTL
requests.put(f"{base}/api/data/{os.environ['CACHEIFY_DB_ID']}/strings/otp:user@mail.com",
             headers=auth, json={"value": otp_hash, "expiresInMs": 300000})

# read back: value + remaining TTL in one call
detail = requests.get(f"{base}/api/data/{os.environ['CACHEIFY_DB_ID']}/keys/otp:user@mail.com",
                      headers=auth).json()
value, ttl_ms = detail["data"]["key"]["value"], detail["data"]["key"]["ttlMs"]`;

const HTTP_NODE = `const base = process.env.CACHEIFY_BASE_URL;
const auth = { Authorization: \`Bearer \${process.env.CACHEIFY_API_KEY}\` };

// save with a 5-minute TTL
await fetch(\`\${base}/api/data/\${process.env.CACHEIFY_DB_ID}/strings/otp:user@mail.com\`, {
  method: 'PUT',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ value: otpHash, expiresInMs: 300000 }),
});

// read back
const { key } = await (await fetch(
  \`\${base}/api/data/\${process.env.CACHEIFY_DB_ID}/keys/otp:user@mail.com\`,
  { headers: auth },
)).json();  // key.value, key.ttlMs  (404 when absent or expired)`;

const SPRING_CLASS = `package com.whyql.whyql.auth.store;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

/**
 * Same OtpStore interface, Cacheify over HTTP instead of the Redis protocol.
 * storeOtpHash  -> PUT    /api/data/{dbId}/strings/{key}  (expiresInMs)
 * getOtpHash    -> GET    /api/data/{dbId}/keys/{key}     (value + ttlMs)
 * deleteOtpHash -> DELETE /api/data/{dbId}/keys/{key}
 */
@Repository
public class HttpOtpStore implements OtpStore {

  private static final Duration TTL = Duration.ofMinutes(5); // expires_in 300000 ms
  private static final String PREFIX = "whyql:otp:";

  private final RestTemplate http;
  private final String baseUrl;
  private final String dbId;
  private final String apiKey;

  public HttpOtpStore(RestTemplate cacheifyRestTemplate,
                      @Value("\${cacheify.base-url}") String baseUrl,
                      @Value("\${cacheify.database-id}") String dbId,
                      @Value("\${cacheify.api-key}") String apiKey) {
    this.http = cacheifyRestTemplate;
    this.baseUrl = baseUrl;
    this.dbId = dbId;
    this.apiKey = apiKey;
  }

  @Override
  public void storeOtpHash(String email, String otpHash) {
    http.exchange(url("strings", email), HttpMethod.PUT,
        json(Map.of("value", otpHash, "expiresInMs", TTL.toMillis())), String.class);
  }

  @Override
  public Optional<String> getOtpHash(String email) {
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> env = http.getForObject(url("keys", email), Map.class);
      Map<String, Object> data = (Map<String, Object>) env.get("data");
      Map<String, Object> key = (Map<String, Object>) data.get("key");
      return Optional.ofNullable((String) key.get("value"));
    } catch (HttpStatusCodeException expiredOrMissing) {
      return Optional.empty();     // 404: never issued, consumed, or expired
    }
  }

  @Override
  public void deleteOtpHash(String email) {
    http.exchange(url("keys", email), HttpMethod.DELETE, json(null), String.class);
  }

  private String url(String resource, String email) {
    return baseUrl + "/api/data/" + dbId + "/" + resource + "/"
        + URLEncoder.encode(PREFIX + email.toLowerCase(), StandardCharsets.UTF_8);
  }

  private static HttpEntity<Map<String, Object>> json(Map<String, Object> body) {
    HttpHeaders headers = new HttpHeaders();
    headers.set("Authorization", "Bearer " + apiKey);
    headers.set("Content-Type", "application/json");
    return new HttpEntity<>(body, headers);
  }
}`;

const SPRING_CONFIG = `# application.properties (values come from the environment, never hardcoded)
cacheify.base-url=\${CACHEIFY_BASE_URL:${API_EXAMPLE_ORIGIN}}
cacheify.database-id=\${CACHEIFY_DB_ID:}
cacheify.api-key=\${CACHEIFY_API_KEY:}`;

const SPRING_BEAN = `@Bean
RestTemplate cacheifyRestTemplate() {
  var factory = new SimpleClientHttpRequestFactory();
  factory.setConnectTimeout(5_000);
  factory.setReadTimeout(10_000);
  return new RestTemplate(factory);
}`;

const ERRORS = [
  ['401', 'ERR_UNAUTHORIZED', 'Missing / invalid / revoked token. Revoked keys fail with exactly this.'],
  ['403', 'ERR_FORBIDDEN', 'Permission denied: read-only key used for a write, or a key outside its database.'],
  ['403', 'ERR_QUOTA_EXCEEDED', 'Plan quota reached (databases, keys, or bytes).'],
  ['404', 'ERR_NOT_FOUND', 'Unknown or expired key / database. Treat as a miss, like Redis nil.'],
  ['409', 'ERR_CONFLICT', 'A resource rule was hit - typically minting a second key for a database that already has one active.'],
  ['413', 'ERR_PAYLOAD_TOO_LARGE', 'Value above the account limit.'],
  ['422', 'ERR_VALIDATION', 'Strict body validation: wrong field, wrong type, unknown extra field.'],
  ['429', 'ERR_RATE_LIMITED', 'Too many requests; back off and retry.'],
  ['503', 'ERR_SERVICE_UNAVAILABLE', 'Backing Redis unreachable; retry with backoff.'],
];

const FAQ = [
  ['Can I connect with a Redis client (redis://, ioredis, redis-py, Lettuce, StringRedisTemplate)?',
   'No. Those clients speak the raw Redis protocol (RESP) over TCP; Cacheify speaks HTTP + JSON on an HTTP port. Point RESP clients at a real Redis server you control, or keep them and use the HTTP store implementation shown in the Spring section - both patterns work; mixing the two does not.'],
  ['Can I create a second API key for one database?',
   'No - a database has exactly one active API key at a time. A second creation attempt returns 409 ERR_CONFLICT. To rotate: revoke the existing key, then mint a new one (the database page and the API keys page both manage this).'],
  ['What is the connection string for a database?',
   '{BASE}/api/data/{dbId} - shown on the database page with a copy action. All data calls live under it (strings/, keys/, expire, command), authorized with the database\'s single active API key as a bearer token.'],
  ['Are values just strings?',
   'The strings endpoint stores strings; JSON.stringify structures before storing and parse after reading. The command plane supports the wider Redis types with full engine semantics.'],
  ['I lost the API key plaintext. Now what?',
   'Revoke it from the API Keys page and mint a new one. Plaintext is shown exactly once at creation, stored hashed, and never recoverable - by design.'],
  ['Do expired keys need cleanup?',
   'No. Expiry is enforced server-side: the first read after expiry removes the key and answers 404 / null. Delete-then-expire TTL endpoints handle the rare manual cases.'],
  ['Does the web console use a different API?',
   'No - the console is a regular client of the same data plane you call from code. What you test in the console is exactly what your app runs.'],
];

/* ------------------------------------------------------------------ */

const SECTIONS = [
  {
    icon: 'info-circle',
    title: 'What Cacheify is',
    body: [
      'Cacheify is a hosting front-end for Redis: sign up, create isolated logical databases, and work with their keys from the web UI or from any HTTP client using scoped API keys. Quotas, permissions (read-only / read-write), rate limits and an audit log are enforced by the platform before a command ever touches Redis.',
      'The data plane runs either on the platform\'s embedded dev engine or directly against a real Redis server the operator configured. In both modes the client-facing contract is identical HTTP + JSON.',
    ],
  },
  {
    icon: 'terminal',
    title: 'The one rule every client must know',
    body: [
      'Cacheify speaks HTTP/JSON on an HTTP port. It is not a Redis protocol (RESP) server. Any HTTP client - fetch, requests, RestTemplate, Invoke-RestMethod, curl - is your Redis client. This is why the same call works identically from seven different ecosystems; the tests folder in the repository proves it live, framework by framework.',
      'Native Redis clients (ioredis, redis-py, go-redis, Lettuce, Spring\'s RedisTemplate) open a TCP socket and speak RESP - they will not work against an HTTP endpoint. Point them at a real Redis server, or keep your code and call Cacheify through a thin store implementation (the Spring section below does exactly that).',
    ],
  },
  {
    icon: 'key',
    title: 'Quick start in four calls',
    list: [
      'Register: POST /api/auth/register {"email":"...","password":"..."} - then login the same way; the session token comes back in data.token.',
      'Create a database: POST /api/databases {"name":"my-db"} - you get up to five, each fully quota- allotd and isolated.',
      'Mint a scoped key: POST /api/databases/{dbId}/api-keys {"name":"my-app","permission":"read-write"} - the plaintext (rk_...) is shown once; store it in your server\'s .env. Exactly one active key per database: revoke the current key first to mint a replacement.',
      'Use the data plane with only that key: the connection string is {BASE}/api/data/{dbId} - PUT /strings/..., GET /keys/..., as shown in the next sections. Your app never needs your account password.',
    ],
  },
  {
    icon: 'gear',
    title: 'Environment reference (.env)',
    body: [
      'Three values go into the server that calls the platform. Nothing else is required; no SDK ships, no client library to install.',
    ],
    code: [{ label: '.env (server-side only)', text: ENV_BLOCK }],
    list: [
      'Server-side only: the API key is database-wide access for its scope. Never ship it to a browser, never commit it, never log it.',
      'The plaintext is shown exactly once at creation and stored hashed; losing it means revoking and re-minting.',
      'CACHEIFY_BASE_URL changes to your deployed origin when the platform is not on localhost.',
    ],
  },
  {
    icon: 'database',
    title: 'Data-plane endpoint reference',
    body: [
      'Every response uses the envelope {"success":true,"data":...} or {"success":false,"error":{"code":"ERR_...","message":"..."}}. Redis nil is represented as null; missing or expired keys surface as 404.',
    ],
    table: ENDPOINTS,
  },
  {
    icon: 'clock',
    title: 'TTL and expiry semantics',
    list: [
      'MANDATORY EXPIRY: every key always has a TTL - "no expiry" is not a state a key can be in. Writes without an explicit expiry (plain SET, INCR, APPEND, LPUSH, RPUSH, SADD, HSET, ZADD) receive the platform default TTL of 24 hours.',
      'Keep an eye on countdown-style data you intend to last longer than a day: either set an explicit expiresInMs / EX on each write, or re-arm with POST /keys/{key}/expire.',
      'expiresInMs is always MILLISECONDS: a 5-minute OTP lives for 300000 ms, exactly like Redis "SET key val EX 300" in the command plane.',
      'The countdown lives on the server. After it reaches zero the first read deletes the key and answers 404 ERR_NOT_FOUND - no sweeper jobs, no cron, no application restart logic.',
      'GET /keys/{key} returns ttlMs so you can show countdowns without extra calls.',
      'POST /keys/{key}/expire re-arms a TTL on an existing key. PERSIST is disabled (422): removing an expiry would create an immortal key.',
      'These semantics are identical in the embedded engine and against a real backing Redis - verified live by the framework test kit.',
    ],
  },
  {
    icon: 'braces',
    title: 'Framework cookbook',
    body: [
      'Save an OTP-shaped value with a 5-minute TTL, then read it back - the two calls an auth flow needs. Snippets are exercised daily by the repository\'s test clients.',
    ],
    code: [
      { label: 'cURL', text: HTTP_CURL },
      { label: 'Python (requests)', text: HTTP_PYTHON },
      { label: 'Node.js (native fetch)', text: HTTP_NODE },
    ],
  },
  {
    icon: 'braces',
    title: 'Spring Boot: keep your RedisTemplate code, bridge the transport',
    body: [
      'Spring\'s StringRedisTemplate speaks the Redis protocol over TCP - perfect against a real Redis you host yourself, but it cannot talk to an HTTP port. Your own RedisOtpStore therefore works when spring.data.redis points at a genuine Redis server, and not against Cacheify.',
      'Because your persistence layer hides behind the OtpStore interface, the clean integration is a second @Repository for the HTTP transport with the exact same methods. Autowire one or the other by configuration; your service layer never learns about Cacheify.',
    ],
    code: [
      { label: 'application.properties', text: SPRING_CONFIG },
      { label: 'RestTemplate bean (any @Configuration class)', text: SPRING_BEAN },
      { label: 'HttpOtpStore.java', text: SPRING_CLASS },
    ],
    list: [
      'Expires after exactly 5 minutes, enforced server-side - same as opsForValue().set(key, hash, TTL).',
      'getOtpHash: 404 (expired, consumed, or never issued) maps to Optional.empty() - identical behavior to a Redis nil read.',
      'URL-encode the key name (URLEncoder covers ":" and "@" in e-mails).',
      'Keep the API key in application.properties sourced from environment variables, and use a read-write key scoped to this database only.',
      'Traffic between your service and Cacheify stays internal: no key material in logs, no plaintext ever shipped to clients.',
    ],
  },
  {
    icon: 'shield-lock',
    title: 'Status codes and error codes',
    table2: ERRORS,
  },
  {
    icon: 'person-circle',
    title: 'Security and operations',
    list: [
      'Keys are scoped per database and per permission level; a read-only key receives 403 on any write attempt - enforced server-side, not client-side.',
      'Revocation is immediate: the next request with a revoked key fails with 401 ERR_UNAUTHORIZED.',
      'Every request carries a request id; writes and lifecycle changes (key created / revoked, database flushed / deleted) land in the audit log.',
      'Rate limiting and quotas are server-side; 429 tells you to back off.',
      'Redis connection credentials live in the operator\'s server configuration and are never exposed to users.',
    ],
  },
  {
    icon: 'info-circle',
    title: 'Building with AI agents',
    body: [
      'The landing page ships a one-shot "AI setup prompt" (copy button included) that tells any AI assistant what to add to .env, which endpoints to call, and how TTL works. For deeper discovery, point agents at the machine-readable document: GET /llms.txt (quick index) and GET /api/openapi.json (full OpenAPI 3.1 spec). Both are fetchable and safe to hand to a coding agent.',
    ],
  },
  {
    icon: 'hand-index',
    title: 'FAQ',
    faq: FAQ,
  },
];

/* ------------------------------------------------------------------ */

const PRE_STYLE = {
  margin: '0',
  padding: '14px 16px',
  background: '#0f172a',
  color: '#e2e8f0',
  border: '1px solid #1e293b',
  borderRadius: '10px',
  overflow: 'auto',
  fontFamily: "'JetBrains Mono',ui-monospace,monospace",
  fontSize: '12.5px',
  lineHeight: 1.65,
  maxHeight: '420px',
};

function CodeBlock({ label, text }) {
  return (
    <div style={{ margin: '10px 0 4px' }}>
      {label ? (
        <div className="mono" style={{ fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', fontWeight: '700' }}>{label}</div>
      ) : null}
      <pre style={PRE_STYLE}>{text}</pre>
    </div>
  );
}

function SectionTable({ headers, rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr>
          {headers.map((header) => (
            <th
              key={header}
              style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e2e8f0', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', whiteSpace: 'nowrap' }}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[1]} style={{ borderBottom: '1px solid #e2e8f0' }}>
            {row.map((cell, i) => (
              <td
                key={i}
                className={i === 0 ? 'mono' : undefined}
                style={{
                  padding: '8px 10px',
                  verticalAlign: 'top',
                  ...(i === 0 ? { fontWeight: '700', color: '#b91c1c', whiteSpace: 'nowrap' } : null),
                  ...(i === 1 ? { fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: '12px', color: '#334155', paddingRight: '16px' } : null),
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ManualPage() {
  return (
    <div>
      <div className="page-toolbar" style={{ margin: '12px 0 16px' }}>
        <div className="page-heading" style={{ margin: '0' }}>
          <h1>
            <Icon name="menu-book" />
            {' '}
            Developer manual
          </h1>
          <p>The full contract for humans: environment variables, endpoints, TTL semantics, framework recipes (including Spring Boot), errors and security.</p>
        </div>
      </div>

      <p className="muted" style={{ margin: '0 0 20px' }}>
        {`Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
      </p>

      {SECTIONS.map((section, sectionIndex) => (
        <div className="card" key={`${sectionIndex}-${section.title}`} style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '17px', margin: '0 0 10px' }}>
            <Icon name={section.icon} />
            {` ${section.title}`}
          </h2>

          {(section.body || []).map((paragraph) => (
            <p style={{ margin: '0 0 10px' }} key={paragraph}>{paragraph}</p>
          ))}

          {section.list ? (
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              {section.list.map((item) => (
                <li style={{ marginBottom: '6px' }} key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          {(section.code || []).map((code) => (
            <CodeBlock key={code.label} label={code.label} text={code.text} />
          ))}

          {section.table ? <SectionTable headers={['Method', 'Path', 'Purpose']} rows={section.table} /> : null}
          {section.table2 ? <SectionTable headers={['Status', 'Code', 'Meaning']} rows={section.table2} /> : null}

          {section.faq ? section.faq.map(([question, answer]) => (
            <div key={question}>
              <p style={{ fontWeight: '700', margin: '12px 0 4px' }}>{question}</p>
              <p style={{ margin: '0 0 6px' }}>{answer}</p>
            </div>
          )) : null}
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
        <BackHomeButton />
      </div>
    </div>
  );
}
