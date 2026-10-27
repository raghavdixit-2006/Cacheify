import LandingScripts from '../components/features/landing/LandingScripts.jsx';
import { Icon } from '../components/common/Icon.jsx';
import { apiOrigin, API_EXAMPLE_ORIGIN } from '../utils/config.js';

/**
 * Marketing landing page — 1:1 port of client/landing.html. Tailwind Play
 * CDN is loaded synchronously from the SSR stream (script + config in
 * document order, exactly like the original <head>), Bootstrap icons
 * replace the Material Symbols ligatures, and LandingScripts.jsx wires
 * the SDK switcher / copy buttons / mock REPL. Links are plain <a> so every
 * cross-page navigation is a full document load (no Tailwind preflight
 * bleeding into the app stylesheets like the original).
 */

export const metadata = {
  title: 'Cacheify - Enterprise Redis Cloud Platform',
};

const TAILWIND_CONFIG = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#dc2626',
        'primary-hover': '#b91c1c',
        'primary-container': '#fee2e2',
        'on-primary': '#ffffff',
        'on-primary-container': '#991b1b',
        secondary: '#ea580c',
        surface: '#ffffff',
        'surface-dim': '#f8fafc',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f8fafc',
        'surface-container': '#f1f5f9',
        'surface-container-high': '#e2e8f0',
        'surface-container-highest': '#cbd5e1',
        'on-surface': '#0f172a',
        'on-surface-variant': '#475569',
        outline: '#94a3b8',
        'outline-variant': '#e2e8f0',
        tertiary: '#dc2626',
        'tertiary-container': '#fef2f2',
        error: '#ba1a1a',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      spacing: {
        'margin-desktop': '4rem',
        'margin-tablet': '2rem',
        'space-sm': '0.5rem',
        gutter: '1.25rem',
        'space-md': '1rem',
        'space-xl': '2.5rem',
        margin: '1rem',
        'gutter-desktop': '1.5rem',
        'space-lg': '1.5rem',
        'space-2xl': '4rem',
        'space-xs': '0.25rem',
      },
      fontFamily: {
        'headline-sm': ['Geist', 'sans-serif'],
        'body-lg': ['Geist', 'sans-serif'],
        'label-sm': ['JetBrains Mono', 'monospace'],
        'code-md': ['JetBrains Mono', 'monospace'],
        'headline-lg': ['Geist', 'sans-serif'],
        'headline-md': ['Geist', 'sans-serif'],
        'body-sm': ['Geist', 'sans-serif'],
        'code-sm': ['JetBrains Mono', 'monospace'],
        'display-hero': ['Geist', 'sans-serif'],
        'headline-lg-mobile': ['Geist', 'sans-serif'],
        'display-hero-mobile': ['Geist', 'sans-serif'],
        'label-md': ['JetBrains Mono', 'monospace'],
        'body-md': ['Geist', 'sans-serif'],
      },
      fontSize: {
        'headline-sm': ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['17px', { lineHeight: '27px', fontWeight: '400' }],
        'label-sm': ['11px', { lineHeight: '15px', letterSpacing: '0.05em', fontWeight: '600' }],
        'code-md': ['13px', { lineHeight: '22px', fontWeight: '400' }],
        'headline-lg': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['22px', { lineHeight: '30px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-sm': ['13px', { lineHeight: '20px', fontWeight: '400' }],
        'code-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
        'display-hero': ['54px', { lineHeight: '62px', letterSpacing: '-0.035em', fontWeight: '800' }],
        'headline-lg-mobile': ['26px', { lineHeight: '34px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'display-hero-mobile': ['36px', { lineHeight: '44px', letterSpacing: '-0.025em', fontWeight: '800' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.03em', fontWeight: '600' }],
        'body-md': ['15px', { lineHeight: '24px', fontWeight: '400' }],
      },
    },
  },
};

const LOGO_SRC = 'https://lh3.googleusercontent.com/aida/AEtjO1VdeHuwPMa0CHIorR6VsjGzTp-SriCybpUp9Q2xw91cYihOxSRUgwrvxKUP20H27R8cfq_XAgLJb6UJlSgpjn09ParTeLzxePpDxEHjA88qnE4s938ivdbXG4y26VwD2EUVCvKQvvpxZLgV2hq7WjLEQ-12ZhMl_s-xcoyUCZZEbax7P0h8Eh7i4uwrEhG4NXH9rADVTI8NE_9tnfbCT8MLk06L2a41dXmIJ1ZDRbrcF2FPeRFO0e2Hmx3g';

const AI_PROMPT_TEXT = `You are wiring an application (server-side) to Cacheify - an HTTP REST front-end for Redis that speaks JSON from any language or framework.

1) ADD TO .ENV (create the file if it does not exist):
   CACHEIFY_BASE_URL=${API_EXAMPLE_ORIGIN}
   CACHEIFY_DB_ID=rdb_xxxxxxxx       # from the dashboard, Databases page
   CACHEIFY_API_KEY=rk_xxxxxxxx      # from the database page (or API Keys page);
                                      # exactly ONE active key per database

   Rules: .env is server-side only. Never commit it, never use the API key from
   browser code, never log it. If it leaks: revoke from the dashboard, mint a new one.

2) AUTH: every data-plane request sends this header:
   Authorization: Bearer <CACHEIFY_API_KEY>

3) ENVELOPE: every response is JSON:
   ok     -> {"success":true,"data":{...},"meta":{...}}
   failed -> {"success":false,"error":{"code":"ERR_...","message":"..."}}

4) STORE A VALUE WITH A 5-MINUTE TTL (the call you will use most):
   PUT  {BASE}/api/data/{dbId}/strings/{key}
   body {"value":"<string>","expiresInMs":300000}      -> 201, data.result = "OK"
   URL-encode the key (encodeURIComponent). 300000 ms = 5 minutes.

5) READ A VALUE (value + remaining TTL in one call):
   GET {BASE}/api/data/{dbId}/keys/{key}               -> 200, data.key.value, data.key.ttlMs
   Absent or expired key -> 404, error.code = ERR_NOT_FOUND (treat as a miss, Redis nil).

6) OTHER OPS:
   DELETE {BASE}/api/data/{dbId}/keys/{key}                          -> delete now
   POST   {BASE}/api/data/{dbId}/keys/{key}/expire {"expiresInMs":1500} -> re-arm TTL
   POST   {BASE}/api/data/{dbId}/command {"command":"SET","args":["k","v","EX","300"]} -> raw command
   POST   {BASE}/api/data/{dbId}/pipeline {"commands":[...1-50...]}  -> atomic batch

7) TTL SEMANTICS (mandatory expiry): every key ALWAYS has a TTL - "no expiry" is
   impossible here, so RAM can never leak through forgotten keys. Writes without
   an explicit expiry (plain SET, INCR, APPEND, LPUSH, RPUSH, SADD, HSET, ZADD,
   MSET) receive the default TTL of 24 hours. PERSIST is rejected with 422.
   The countdown lives on the server; expired keys vanish and reads return
   404 / null - no cron jobs, no sweeper logic. Data that must outlive a day:
   pass expiresInMs / EX on each write, or re-arm with POST .../expire.

8) VALIDATION: request bodies are strict - send exactly the documented fields and
   types; unexpected fields fail with 422 ERR_VALIDATION.

9) ACCOUNT GATE: accounts created after the email-verification rollout start
   UNVERIFIED - databases, API keys and the data plane answer 403 until the
   email code is verified (POST /api/auth/otp/request, then /api/auth/otp/verify
   {"code":"123456"}). Dashboards created before this show in the user profile.

10) DISCOVER MORE (machine-readable, safe to fetch):
    GET {BASE}/llms.txt           - agent quick index
    GET {BASE}/api/openapi.json   - full OpenAPI 3.1 spec

11) IF STUCK: check header is "Bearer <rk_...>" (one space), the key is not revoked
    (revoked -> 401) and its database id matches CACHEIFY_DB_ID.`;

export default function LandingPage() {
  /* Tailwind Play CDN in document order: library script, then the config
     script. Both sit in the SSR stream before any markup, exactly matching
     the blocking <head> scripts of the original landing.html. */
  const docsOrigin = apiOrigin();

  return (
    <>
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" />
      <script
        id="tailwind-config"
        dangerouslySetInnerHTML={{ __html: `tailwind.config=${JSON.stringify(TAILWIND_CONFIG)}` }}
      />
      <div className="relative w-full overflow-hidden">
        {/* AMBIENT CANVAS BACKDROP GLOW */}
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-red-100/70 via-rose-50/40 to-transparent rounded-full blur-[100px] pointer-events-none -z-10"></div>
        <div className="absolute top-[550px] -right-32 w-[550px] h-[450px] bg-orange-100/40 rounded-full blur-[110px] pointer-events-none -z-10"></div>
        <div className="absolute top-[750px] -left-32 w-[500px] h-[400px] bg-red-50/60 rounded-full blur-[100px] pointer-events-none -z-10"></div>
        <header className="fixed top-0 left-0 right-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="h-20 max-w-[1280px] mx-auto px-gutter-desktop flex items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-lg flex-shrink-0">
              <a className="flex items-center gap-space-sm" data-path="overview" href="/login">
                <img alt="Cacheify Brand Logo" className="h-8 w-auto object-contain" src={LOGO_SRC} />
                <span className="font-headline-sm text-headline-sm tracking-tight text-slate-900 font-bold">Cacheify</span>
              </a>
              <div className="hidden xl:flex items-center gap-space-xs px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-label-sm text-label-sm text-emerald-700 font-semibold">Free Platform - All Features Open</span>
              </div>
            </div>
            <nav className="hidden lg:flex items-center gap-1" data-active-classes="bg-slate-100 text-slate-900 font-headline-sm rounded-lg">
              <a className="font-body-sm text-body-sm px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium" href="#capabilities">Serverless Redis</a>
              <a className="font-body-sm text-body-sm px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium" href="#benchmark">Global Edge Cache</a>
              <a className="font-body-sm text-body-sm px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium" href="#capabilities">Vector Search</a>
              <a className="font-body-sm text-body-sm px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium" href="#capabilities">Pub/Sub &amp; Queues</a>
              <a className="font-body-sm text-body-sm px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium" href={`${docsOrigin}/llms.txt`}>Docs</a>
              <a className="font-body-sm text-body-sm px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium" href="#benchmark">Pricing</a>
            </nav>
            <div className="flex items-center gap-space-sm">
              <a className="hidden sm:flex items-center gap-space-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors font-medium" href="#capabilities">
                <Icon name="star-fill" className="text-[15px] text-amber-500" />
                <span className="font-label-sm text-label-sm text-slate-700">Free Forever</span>
              </a>
              <a className="hidden md:inline-flex font-body-sm text-body-sm px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium" data-path="login" href="/login">Sign In</a>
              <a className="inline-flex items-center font-headline-sm text-body-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-[0_4px_14px_rgba(220,38,38,0.35)] transition-all font-semibold" data-path="signup" href="/register">Start Free Cluster</a>
              <a className="w-8 h-8 rounded-full bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0 text-red-700" href="/login">
                <Icon name="person" className="text-[18px]" />
              </a>
            </div>
          </div>
        </header>
        <main className="w-full pt-20 bg-white">
          <div className="flex flex-col w-full">
            {/* 1. HERO SECTION */}
            <section aria-label="Hero Overview" className="max-w-[1280px] mx-auto px-gutter-desktop pt-space-xl pb-space-2xl flex flex-col items-center text-center relative" id="hero">
              {/* Announcement Pill */}
              <a className="group inline-flex items-center gap-space-xs px-3.5 py-1.5 rounded-full bg-red-50/90 border border-red-200/90 hover:border-red-300 hover:bg-red-100/80 transition-all shadow-xs" href="#benchmark">
                <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
                <span className="font-label-sm text-label-sm text-red-700 tracking-wide uppercase font-bold">Free For All Users</span>
                <span className="text-red-300 font-label-sm text-label-sm">|</span>
                <span className="font-body-sm text-body-sm text-slate-700 group-hover:text-red-700 flex items-center gap-1 font-medium">
                Isolated Redis databases, scoped API keys and quotas on every free plan
                  <Icon name="arrow_forward" className="text-[16px] text-red-600 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </a>
              {/* Headline & Subtitle */}
              <h1 className="mt-space-lg max-w-4xl font-display-hero text-display-hero text-slate-900 tracking-tight font-extrabold">
                Serverless Redis. Built for <span className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 bg-clip-text text-transparent">Ultra-Low Latency</span> at Global Scale.
              </h1>
              <p className="mt-space-md max-w-2xl font-body-lg text-body-lg text-slate-600 leading-relaxed">
                Isolated managed databases with real Redis semantics (strings, lists, sets, hashes, sorted sets), scoped read-only / read-write API keys, per-user quotas, mandatory TTL expiry (every key expires - 24h default, PERSIST disabled) and a live command console. 100% native Redis wire compatibility.
              </p>
              {/* Dual High-Contrast CTAs */}
              <div className="mt-space-xl flex flex-col sm:flex-row items-center justify-center gap-space-md w-full max-w-md">
                <a className="w-full sm:w-auto px-space-xl py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-headline-sm text-[15px] font-semibold shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-space-xs" href="/register">
                  <Icon name="bolt" className="text-[20px]" />
                  <span>Create Free Database</span>
                </a>
                <a className="w-full sm:w-auto px-space-lg py-3 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-headline-sm text-[15px] font-semibold border border-slate-300 shadow-xs hover:border-slate-400 active:scale-[0.98] transition-all flex items-center justify-center gap-space-xs" href="#interactive-repl">
                  <Icon name="terminal" className="text-[20px] text-red-600" />
                  <span>Run Live REPL</span>
                </a>
              </div>
              {/* Compliance & Micro-trust Badges */}
              <div className="mt-space-lg flex flex-wrap items-center justify-center gap-x-space-lg gap-y-space-xs text-slate-600 font-body-sm text-body-sm">
                <span className="flex items-center gap-1.5">
                  <Icon name="check_circle" className="text-[18px] text-red-600" />
                  5 isolated databases on the free plan
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="credit_card_off" className="text-[18px] text-red-600" />
                  No credit card needed
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="verified_user" className="text-[18px] text-red-600" />
                  Hashed keys, audited actions, TLS transport
                </span>
              </div>
              {/* Trust Logo Strip */}
              <div className="mt-space-2xl w-full pt-space-lg flex flex-col items-center">
                <p className="font-label-sm text-label-sm uppercase tracking-widest text-slate-400 font-semibold">Works with the tools you already ship</p>
                <div className="mt-space-md w-full flex flex-wrap items-center justify-center gap-x-space-2xl gap-y-space-md text-slate-600">
                  <div className="flex items-center gap-2 font-headline-sm text-body-md hover:text-slate-900 transition-colors font-medium">
                    <Icon name="change_history" className="text-[20px] text-red-600" /> Node.js
                  </div>
                  <div className="flex items-center gap-2 font-headline-sm text-body-md hover:text-slate-900 transition-colors font-medium">
                    <Icon name="cloud_queue" className="text-[20px] text-orange-600" /> Python
                  </div>
                  <div className="flex items-center gap-2 font-headline-sm text-body-md hover:text-slate-900 transition-colors font-medium">
                    <Icon name="database" className="text-[20px] text-emerald-600" /> Go
                  </div>
                  <div className="flex items-center gap-2 font-headline-sm text-body-md hover:text-slate-900 transition-colors font-medium">
                    <Icon name="layers" className="text-[20px] text-slate-900" /> cURL
                  </div>
                  <div className="flex items-center gap-2 font-headline-sm text-body-md hover:text-slate-900 transition-colors font-medium">
                    <Icon name="monitoring" className="text-[20px] text-purple-600" /> CI / Cron
                  </div>
                  <div className="flex items-center gap-2 font-headline-sm text-body-md hover:text-slate-900 transition-colors font-medium">
                    <Icon name="dns" className="text-[20px] text-amber-600" /> AI Agents
                  </div>
                </div>
              </div>
            </section>
            {/* 2. INTERACTIVE LIVE REDIS PLAYGROUND / REPL SECTION */}
            <section aria-label="Interactive Playground" className="max-w-[1280px] mx-auto px-gutter-desktop py-space-xl" id="interactive-repl">
              <div className="flex flex-col lg:flex-row items-stretch gap-space-lg bg-slate-900 text-slate-100 rounded-2xl p-space-md lg:p-space-lg shadow-2xl relative border border-slate-800">
                {/* Live Cluster Stat Top-Float Bar */}
                <div className="absolute -top-3.5 right-6 bg-slate-800 border border-slate-700/80 px-space-md py-1 rounded-full flex items-center gap-space-sm shadow-md">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="font-code-sm text-code-sm text-emerald-400 font-medium">ENGINE: LIVE HTTP COMMAND API</span>
                  <span className="font-code-sm text-code-sm text-slate-400">Bearer rk_ tokens</span>
                </div>
                {/* Left Column: Unified SDK Code Switcher */}
                <div className="flex-1 flex flex-col bg-slate-950/70 border border-slate-800/80 rounded-xl p-space-md overflow-hidden">
                  <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-slate-800">
                    <div className="flex items-center gap-1.5" id="sdk-tabs" role="tablist">
                      <button className="tab-btn px-3 py-1 rounded-md font-label-md text-label-md bg-red-600 text-white font-semibold active-tab" data-tab="ts">TypeScript</button>
                      <button className="tab-btn px-3 py-1 rounded-md font-label-md text-label-md text-slate-400 hover:text-white transition-colors" data-tab="py">Python</button>
                      <button className="tab-btn px-3 py-1 rounded-md font-label-md text-label-md text-slate-400 hover:text-white transition-colors" data-tab="go">Go</button>
                      <button className="tab-btn px-3 py-1 rounded-md font-label-md text-label-md text-slate-400 hover:text-white transition-colors" data-tab="curl">HTTP cURL</button>
                    </div>
                    <button className="flex items-center gap-1 text-slate-400 hover:text-white font-code-sm text-code-sm transition-colors px-2 py-1 rounded hover:bg-slate-800" id="copy-code-btn" title="Copy snippet">
                      <Icon name="content_copy" className="text-[16px]" />
                      <span>Copy</span>
                    </button>
                  </div>
                  {/* Code Snippet Area */}
                  <div className="relative flex-1 bg-black/40 p-space-md rounded-lg font-code-md text-code-md text-slate-200 overflow-x-auto border border-slate-800/50">
                    {/* TS / Node */}
                    <pre className="code-view leading-relaxed" id="code-ts"><span className="text-rose-400 font-semibold">const</span>{' res = '}<span className="text-rose-400 font-semibold">await</span>{' '}<span className="text-sky-300">fetch</span>{'('}<span className="text-emerald-300">{`${API_EXAMPLE_ORIGIN}/api/data/\${dbId}/command`}</span>{', {'}
{'\n'}{'  method: '}<span className="text-emerald-300">{'"POST"'}</span>{','}
{'\n'}{'  headers: {'}{' '}<span className="text-emerald-300">{'"content-type"'}</span>{': '}<span className="text-emerald-300">{'"application/json"'}</span>{', '}<span className="text-emerald-300">{'"authorization"'}</span>{': '}<span className="text-emerald-300">{`Bearer \${token}`}</span>{' },'}
{'\n'}{'  body: JSON.'}<span className="text-sky-300">stringify</span>{'({ command: '}<span className="text-emerald-300">{'"SET"'}</span>{', args: ['}<span className="text-emerald-300">{'"session:9942"'}</span>{', '}<span className="text-emerald-300">{'"active"'}</span>{', '}<span className="text-emerald-300">{'"EX"'}</span>{', '}<span className="text-emerald-300">{'"3600"'}</span>{'] })'}
{'\n'}{'});'}
{'\n\n'}
<span className="text-slate-500">{'// Scoped keys: read-only tokens are rejected for writes, allowed for reads'}</span>
{'\n'}<span className="text-rose-400 font-semibold">const</span>{' { data } = '}<span className="text-rose-400 font-semibold">await</span>{' res.'}<span className="text-sky-300">json</span>{'();'}
{'\n'}{'console.'}<span className="text-sky-300">log</span>{'(data.result);'}{' '}<span className="text-slate-500">{'// "OK"'}</span></pre>
                    {/* Python */}
                    <pre className="code-view hidden leading-relaxed" id="code-py"><span className="text-rose-400 font-semibold">import</span>{' requests'}
{'\n\n'}{'res = requests.'}<span className="text-sky-300">post</span>{'('}
{'\n'}{'    '}<span className="text-emerald-300">{`"${API_EXAMPLE_ORIGIN}/api/data/<dbId>/pipeline"`}</span>{','}
{'\n'}{'    headers={'}<span className="text-emerald-300">{'"Authorization"'}</span>{': '}<span className="text-emerald-300">{'"Bearer <rk_token>"'}</span>{'},'}
{'\n'}{'    json={'}<span className="text-emerald-300">{'"commands"'}</span>{': ['}
{'\n'}{'        {'}<span className="text-emerald-300">{'"command"'}</span>{': '}<span className="text-emerald-300">{'"HSET"'}</span>{', '}<span className="text-emerald-300">{'"args"'}</span>{': ['}<span className="text-emerald-300">{'"cart:7719"'}</span>{', '}<span className="text-emerald-300">{'"sku-1"'}</span>{', '}<span className="text-emerald-300">{'"2"'}</span>{']},'}

{'\n'}{'        {'}<span className="text-emerald-300">{'"command"'}</span>{': '}<span className="text-emerald-300">{'"HGETALL"'}</span>{', '}<span className="text-emerald-300">{'"args"'}</span>{': ['}<span className="text-emerald-300">{'"cart:7719"'}</span>{']},'}

{'\n'}{'    ]})'}
{'\n'}{'print(res.json()['}<span className="text-emerald-300">{'"data"'}</span>{']['}<span className="text-emerald-300">{'"results"'}</span>{'])'}</pre>
                    {/* Go */}
                    <pre className="code-view hidden leading-relaxed" id="code-go"><span className="text-rose-400 font-semibold">package</span>{' main'}
{'\n\n'}<span className="text-rose-400 font-semibold">import</span>{' ('}
{'\n'}{'    '}<span className="text-emerald-300">{'"bytes"'}</span>
{'\n'}{'    '}<span className="text-emerald-300">{'"net/http"'}</span>
{'\n'}{')'}
{'\n\n'}{'func '}<span className="text-sky-300">main</span>{'() {'}
{'\n'}{'    body := []'}<span className="text-sky-300">byte</span>{'(`{"command":"GET","args":["session:9942"]}`)'}
{'\n'}{'    req, _ := http.'}<span className="text-sky-300">NewRequest</span>{'('}<span className="text-emerald-300">{'"POST"'}</span>{','}
{'\n'}{'        '}<span className="text-emerald-300">{`"${API_EXAMPLE_ORIGIN}/api/data/<dbId>/command"`}</span>{', bytes.'}<span className="text-sky-300">NewReader</span>{'(body))'}
{'\n'}{'    req.Header.'}<span className="text-sky-300">Set</span>{'('}<span className="text-emerald-300">{'"Authorization"'}</span>{', '}<span className="text-emerald-300">{'"Bearer <rk_token>"'}</span>{')'}
{'\n'}{'    http.'}<span className="text-sky-300">DefaultClient</span>{'.'}<span className="text-sky-300">Do</span>{'(req)'}
{'\n'}{'}'}</pre>
                    {/* cURL */}
                    <pre className="code-view hidden leading-relaxed" id="code-curl"><span className="text-slate-500">{'# Execute Redis commands over plain HTTP - no TCP client needed'}</span>
{'\n'}{`curl -X POST ${API_EXAMPLE_ORIGIN}/api/data/$DB_ID/pipeline \\`}
{'\n'}{'  -H '}<span className="text-emerald-300">{'"Authorization: Bearer $RK_TOKEN"'}</span>{' \\'}
{'\n'}{'  -H '}<span className="text-emerald-300">{'"Content-Type: application/json"'}</span>{' \\'}
{'\n'}{'  -d '}<span className="text-emerald-300">{`'{
    "commands": [
      { "command": "SET", "args": ["page_views", "1"] },
      { "command": "INCR", "args": ["page_views"] }
    ]'}`}</span></pre>
                  </div>
                  {/* Feature Tagline under code */}
                  <div className="mt-space-sm flex items-center justify-between text-slate-400 font-body-sm text-body-sm px-space-xs">
                    <span className="flex items-center gap-1.5">
                      <Icon name="memory" className="text-[16px] text-red-400" />
                      Same protocol embedded or on your own Redis server
                    </span>
                    <span className="font-code-sm text-code-sm text-red-400 font-medium">Envelope: {'{ success, data }'}</span>
                  </div>
                </div>
                {/* Right Column: Live REPL Execution & Telemetry */}
                <div className="flex-1 flex flex-col bg-slate-950/70 border border-slate-800/80 rounded-xl p-space-md">
                  <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-slate-800">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="ml-space-sm font-label-md text-label-md text-slate-200 tracking-wide font-semibold">LIVE INTERACTIVE REPL</span>
                    </div>
                    <div className="flex items-center gap-1 font-code-sm text-code-sm text-emerald-400">
                      <Icon name="speed" className="text-[15px]" />
                      <span>Server-side permission checks</span>
                    </div>
                  </div>
                  {/* Interactive Stream Output Window */}
                  <div className="flex-1 bg-black/40 p-space-md rounded-lg font-code-md text-code-md space-y-space-sm overflow-y-auto max-h-[290px] border border-slate-800/50" id="repl-terminal">
                    <div className="flex items-start justify-between text-slate-300">
                      <div>
                        <span className="text-red-400">&gt;</span> <span className="text-amber-300 font-medium">SET</span> user:session:9942 <span className="text-emerald-300">&apos;{"{\"role\":\"admin\",\"cache\":\"hit\"}"}&apos;</span> EX 3600
                      </div>
                      <span className="text-emerald-400 font-code-sm text-code-sm ml-2 font-medium">OK</span>
                    </div>
                    <div className="flex items-start justify-between text-slate-300">
                      <div>
                        <span className="text-red-400">&gt;</span> <span className="text-amber-300 font-medium">HGETALL</span> cart:usr_7719
                      </div>
                      <span className="text-emerald-400 font-code-sm text-code-sm ml-2 font-medium">12 fields</span>
                    </div>
                    <div className="flex items-start justify-between text-slate-300">
                      <div>
                        <span className="text-red-400">&gt;</span> <span className="text-amber-300 font-medium">ZRANGE</span> leaderboard 0 5 WITHSCORES
                      </div>
                      <span className="text-emerald-400 font-code-sm text-code-sm ml-2 font-medium">5 members</span>
                    </div>
                    <div className="space-y-space-sm" id="repl-dynamic-rows"></div>
                    <div className="flex items-center gap-2 text-slate-100 pt-1">
                      <span className="text-red-400 font-bold">&gt;</span>
                      <input className="w-full bg-transparent border-0 outline-none text-slate-100 font-code-md text-code-md placeholder:text-slate-500 focus:ring-0" id="repl-input" placeholder="Try PING, INCR counter, GET user:session:9942..." type="text" />
                      <button className="px-3 py-1 bg-red-600 text-white font-label-sm text-label-sm rounded hover:bg-red-700 transition-colors font-semibold shadow-xs" id="repl-run-btn">Run</button>
                    </div>
                  </div>
                  {/* REPL Quick Run suggestions & Throughput banner */}
                  <div className="mt-space-md flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
                    <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-slate-400">
                      <span>Quick:</span>
                      <button className="quick-cmd px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-red-300 hover:text-white transition-colors border border-slate-700/60">PING</button>
                      <button className="quick-cmd px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-red-300 hover:text-white transition-colors border border-slate-700/60">INCR page_views</button>
                      <button className="quick-cmd px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-red-300 hover:text-white transition-colors border border-slate-700/60">GET user:session:9942</button>
                    </div>
                    <div className="flex items-center gap-1.5 font-code-sm text-code-sm text-slate-400">
                      <Icon name="sync" className="text-[16px] text-red-400" />
                      <span>Namespaced isolation per database</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            {/* 3. KEY PLATFORM CAPABILITIES (BENTO GRID WITH HOVER GLASS CARDS) */}
            <section aria-label="Key Platform Capabilities" className="max-w-[1280px] mx-auto px-gutter-desktop py-space-2xl" id="capabilities">
              <div className="flex flex-col items-start mb-space-xl">
                <div className="flex items-center gap-space-xs text-red-600 font-label-sm text-label-sm uppercase tracking-widest font-bold">
                  <Icon name="grid_view" className="text-[18px]" />
                  Engine Architecture
                </div>
                <h2 className="mt-space-xs font-headline-lg text-headline-lg text-slate-900 font-bold">
                  Engineered for real workloads without devops friction.
                </h2>
                <p className="font-body-md text-body-md text-slate-600 max-w-2xl mt-space-xs leading-relaxed">
                  Combines the familiar speed of Redis with hosting-grade safety: quotas, permissions, namespaces and audit logs.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
                {/* Card 1 */}
                <div className="group bg-white hover:bg-red-50/20 p-space-lg rounded-2xl border border-slate-200/90 hover:border-red-200 transition-all shadow-xs hover:shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-space-md group-hover:scale-110 transition-transform">
                      <Icon name="payments" className="text-[26px]" />
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">Free for everyone</h3>
                    <p className="mt-space-xs font-body-sm text-body-sm text-slate-600 leading-relaxed">
                      Register, create up to five isolated databases and start pushing keys immediately. No billing, no trial timers, no locked features.
                    </p>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-slate-100 flex items-center justify-between text-slate-500 font-label-sm text-label-sm">
                    <span>Plan: Free forever</span>
                    <span className="text-red-600 font-bold">$0.00</span>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="group bg-white hover:bg-red-50/20 p-space-lg rounded-2xl border border-slate-200/90 hover:border-red-200 transition-all shadow-xs hover:shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 mb-space-md group-hover:scale-110 transition-transform">
                      <Icon name="public" className="text-[26px]" />
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">True tenant isolation</h3>
                    <p className="mt-space-xs font-body-sm text-body-sm text-slate-600 leading-relaxed">
                      Every database is a sealed namespace. Cross-tenant access returns a 404 - the platform never confirms whether another user&apos;s database exists.
                    </p>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-slate-100 flex items-center justify-between text-slate-500 font-label-sm text-label-sm">
                    <span>Cross-tenant reads: 404</span>
                    <span className="text-red-600 font-bold">No leaks</span>
                  </div>
                </div>
                {/* Card 3 */}
                <div className="group bg-white hover:bg-red-50/20 p-space-lg rounded-2xl border border-slate-200/90 hover:border-red-200 transition-all shadow-xs hover:shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-space-md group-hover:scale-110 transition-transform">
                      <Icon name="neurology" className="text-[26px]" />
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">Scoped API keys with permissions</h3>
                    <p className="mt-space-xs font-body-sm text-body-sm text-slate-600 leading-relaxed">
                      Issue keys per database as read-only or read-write. Writes from a read-only key are refused before execution; every creation and revocation is audited.
                    </p>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-slate-100 flex items-center justify-between text-slate-500 font-label-sm text-label-sm">
                    <span>Enforced server-side</span>
                    <span className="text-red-600 font-bold">read-only / read-write</span>
                  </div>
                </div>
                {/* Card 4 */}
                <div className="group bg-white hover:bg-red-50/20 p-space-lg rounded-2xl border border-slate-200/90 hover:border-red-200 transition-all shadow-xs hover:shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 mb-space-md group-hover:scale-110 transition-transform">
                      <Icon name="http" className="text-[26px]" />
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">HTTP REST data plane</h3>
                    <p className="mt-space-xs font-body-sm text-body-sm text-slate-600 leading-relaxed">
                      One JSON endpoint executes real Redis commands: GET, SET, HGETALL, LPUSH, ZRANGE, EXPIRE, SCAN. Pipelines run bounded batches atomically.
                    </p>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-slate-100 flex items-center justify-between text-slate-500 font-label-sm text-label-sm">
                    <span>Bearer rk_ tokens</span>
                    <span className="text-red-600 font-bold">No TCP client needed</span>
                  </div>
                </div>
                {/* Card 5 */}
                <div className="group bg-white hover:bg-red-50/20 p-space-lg rounded-2xl border border-slate-200/90 hover:border-red-200 transition-all shadow-xs hover:shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-space-md group-hover:scale-110 transition-transform">
                      <Icon name="storage" className="text-[26px]" />
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">Bring your own Redis server</h3>
                    <p className="mt-space-xs font-body-sm text-body-sm text-slate-600 leading-relaxed">
                      Point REDIS_CONNECTION_STRING at a real Redis (managed or self-hosted) and every database becomes an isolated key-prefix namespace on that server, with your provider CA pinned.
                    </p>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-slate-100 flex items-center justify-between text-slate-500 font-label-sm text-label-sm">
                    <span>TLS + CA verification</span>
                    <span className="text-red-600 font-bold">Namespaced</span>
                  </div>
                </div>
                {/* Card 6 */}
                <div className="group bg-white hover:bg-red-50/20 p-space-lg rounded-2xl border border-slate-200/90 hover:border-red-200 transition-all shadow-xs hover:shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 mb-space-md group-hover:scale-110 transition-transform">
                      <Icon name="move_to_inbox" className="text-[26px]" />
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">Quotas, TTL and admin controls</h3>
                    <p className="mt-space-xs font-body-sm text-body-sm text-slate-600 leading-relaxed">
                      Per-user limits (databases, keys per database, value bytes) are enforced and rolled back atomically. TTL expiry is mandatory: every key carries an expiry (default 24h), so forgotten keys can never leak RAM. Admins can search users and edit quotas.
                    </p>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-slate-100 flex items-center justify-between text-slate-500 font-label-sm text-label-sm">
                    <span>Atomic violations rollback</span>
                    <span className="text-red-600 font-bold">ERR_QUOTA_EXCEEDED</span>
                  </div>
                </div>
              </div>
            </section>
            {/* 4. REAL-TIME PERFORMANCE & BENCHMARK COMPARISON */}
            <section aria-label="Benchmark Comparison" className="max-w-[1280px] mx-auto px-gutter-desktop py-space-xl" id="benchmark">
              {/* Metric Highlights */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-xl">
                <div className="bg-white p-space-lg rounded-2xl border border-slate-200/90 flex flex-col items-start shadow-xs hover:border-red-200 transition-all">
                  <span className="font-label-sm text-label-sm text-red-600 uppercase tracking-wider font-bold">Commands supported</span>
                  <span className="mt-1 font-display-hero text-display-hero text-slate-900 tracking-tight font-extrabold">40<span className="text-headline-md text-red-600">+</span></span>
                  <span className="font-body-sm text-body-sm text-slate-500 mt-1">Strings, keys, lists, sets, hashes, zsets</span>
                </div>
                <div className="bg-white p-space-lg rounded-2xl border border-slate-200/90 flex flex-col items-start shadow-xs hover:border-red-200 transition-all">
                  <span className="font-label-sm text-label-sm text-orange-600 uppercase tracking-wider font-bold">Keys per database</span>
                  <span className="mt-1 font-display-hero text-display-hero text-slate-900 tracking-tight font-extrabold">10K<span className="text-headline-md text-orange-600">+</span></span>
                  <span className="font-body-sm text-body-sm text-slate-500 mt-1">Free-plan default quota</span>
                </div>
                <div className="bg-white p-space-lg rounded-2xl border border-slate-200/90 flex flex-col items-start shadow-xs hover:border-red-200 transition-all">
                  <span className="font-label-sm text-label-sm text-emerald-600 uppercase tracking-wider font-bold">Native semantics</span>
                  <span className="mt-1 font-display-hero text-display-hero text-slate-900 tracking-tight font-extrabold">100<span className="text-headline-md text-emerald-600">%</span></span>
                  <span className="font-body-sm text-body-sm text-slate-500 mt-1">TTL, WRONGTYPE, pipelines, scan cursors</span>
                </div>
                <div className="bg-white p-space-lg rounded-2xl border border-slate-200/90 flex flex-col items-start shadow-xs hover:border-red-200 transition-all">
                  <span className="font-label-sm text-label-sm text-red-600 uppercase tracking-wider font-bold">Cost for everyone</span>
                  <span className="mt-1 font-display-hero text-display-hero text-slate-900 tracking-tight font-extrabold">$0</span>
                  <span className="font-body-sm text-body-sm text-slate-500 mt-1">Free platform, all features</span>
                </div>
              </div>
              {/* Architectural Comparison Table */}
              <div className="bg-white rounded-2xl p-space-lg overflow-x-auto shadow-sm border border-slate-200/90">
                <div className="mb-space-md">
                  <h3 className="font-headline-md text-headline-md text-slate-900 font-bold">How Cacheify compares</h3>
                  <p className="font-body-sm text-body-sm text-slate-500 mt-0.5">Side-by-side analysis for students, indie hackers and real projects.</p>
                </div>
                <table className="w-full text-left font-body-sm text-body-sm">
                  <thead>
                    <tr className="text-slate-500 font-label-md text-label-md uppercase tracking-wider border-b border-slate-100">
                      <th className="py-space-sm px-space-md">Capability</th>
                      <th className="py-space-sm px-space-md text-red-700 bg-red-50/70 rounded-t-lg font-bold">Cacheify</th>
                      <th className="py-space-sm px-space-md">Managed cloud Redis</th>
                      <th className="py-space-sm px-space-md">Self-hosted VM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-space-sm px-space-md font-semibold text-slate-900 flex items-center gap-2">
                        <Icon name="timer" className="text-[18px] text-red-600" />
                        Time to first key
                      </td>
                      <td className="py-space-sm px-space-md bg-red-50/50 font-code-sm text-code-sm text-red-700 font-bold">&lt; 30 seconds</td>
                      <td className="py-space-sm px-space-md text-slate-500">Account + billing + region</td>
                      <td className="py-space-sm px-space-md text-slate-500">Manual (hours)</td>
                    </tr>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-space-sm px-space-md font-semibold text-slate-900 flex items-center gap-2">
                        <Icon name="cable" className="text-[18px] text-red-600" />
                        Connection overhead
                      </td>
                      <td className="py-space-sm px-space-md bg-red-50/50 font-code-sm text-code-sm text-red-700 font-bold">Plain HTTP + JSON</td>
                      <td className="py-space-sm px-space-md text-slate-500">TCP client required</td>
                      <td className="py-space-sm px-space-md text-slate-500">TCP client + hardening</td>
                    </tr>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-space-sm px-space-md font-semibold text-slate-900 flex items-center gap-2">
                        <Icon name="electric_bolt" className="text-[18px] text-red-600" />
                        Permissions model
                      </td>
                      <td className="py-space-sm px-space-md bg-red-50/50 font-code-sm text-code-sm text-red-700 font-bold">Scoped keys: per DB, read-only or read-write</td>
                      <td className="py-space-sm px-space-md text-slate-500">Per-account ACLs</td>
                      <td className="py-space-sm px-space-md text-slate-500">Hand-managed users</td>
                    </tr>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-space-sm px-space-md font-semibold text-slate-900 flex items-center gap-2">
                        <Icon name="battery_0_bar" className="text-[18px] text-red-600" />
                        Cost
                      </td>
                      <td className="py-space-sm px-space-md bg-red-50/50 font-code-sm text-code-sm text-red-700 font-bold">$0.00 forever</td>
                      <td className="py-space-sm px-space-md text-slate-500">Usage-based billing</td>
                      <td className="py-space-sm px-space-md text-slate-500">VM + ops time</td>
                    </tr>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-space-sm px-space-md font-semibold text-slate-900 flex items-center gap-2">
                        <Icon name="language" className="text-[18px] text-red-600" />
                        Where data lives
                      </td>
                      <td className="py-space-sm px-space-md bg-red-50/50 rounded-b-lg font-code-sm text-code-sm text-red-700 font-bold">Your own Redis server (or embedded dev engine)</td>
                      <td className="py-space-sm px-space-md text-slate-500">Provider-controlled regions</td>
                      <td className="py-space-sm px-space-md text-slate-500">Your own box</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            {/* 5. DEVELOPER QUICK-START (2 MINUTES TO PRODUCTION) */}
            <section aria-label="Developer Workflow" className="max-w-[1280px] mx-auto px-gutter-desktop py-space-2xl" id="quickstart">
              <div className="text-center max-w-3xl mx-auto mb-space-2xl">
                <span className="font-label-sm text-label-sm text-red-600 uppercase tracking-widest font-bold">Immediate Onboarding</span>
                <h2 className="mt-space-xs font-headline-lg text-headline-lg text-slate-900 font-bold">From zero to your first key in 3 steps.</h2>
                <p className="font-body-md text-body-md text-slate-600 mt-space-xs leading-relaxed">
                  Engineered for developer happiness. No CLIs to install, no agents, no region picking.
                </p>
              </div>
              {/* 3-Step Process Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg relative">
                {/* Step 1 */}
                <div className="bg-white p-space-lg rounded-2xl border border-slate-200/90 flex flex-col justify-between shadow-xs hover:border-red-200 hover:shadow-md transition-all relative">
                  <div>
                    <div className="flex items-center justify-between mb-space-md">
                      <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center font-headline-sm text-headline-sm font-bold">1</div>
                      <span className="font-label-sm text-label-sm text-slate-400 font-semibold">01 / REGISTER</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">Create your free account</h3>
                    <p className="mt-space-xs font-body-sm text-body-sm text-slate-600 leading-relaxed">
                      Email and password. You get five isolated Redis databases with full quotas from the first minute.
                    </p>
                  </div>
                  <div className="mt-space-md p-space-sm bg-slate-50 border border-slate-200/70 rounded-lg font-code-sm text-code-sm text-slate-700">
                    <span className="text-red-600 font-bold">API:</span> POST /api/auth/register
                  </div>
                </div>
                {/* Step 2 */}
                <div className="bg-white p-space-lg rounded-2xl border border-slate-200/90 flex flex-col justify-between shadow-xs hover:border-red-200 hover:shadow-md transition-all relative">
                  <div>
                    <div className="flex items-center justify-between mb-space-md">
                      <div className="w-10 h-10 rounded-full bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center font-headline-sm text-headline-sm font-bold">2</div>
                      <span className="font-label-sm text-label-sm text-slate-400 font-semibold">02 / SCOPE A KEY</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">Issue a scoped API key</h3>
                    <p className="mt-space-xs font-body-sm text-body-sm text-slate-600 leading-relaxed">
                      Pick a database and a permission level. The plaintext token is shown once and stored only as a hash.
                    </p>
                  </div>
                  <div className="mt-space-md p-space-sm bg-slate-50 border border-slate-200/70 rounded-lg font-code-sm text-code-sm text-slate-700 flex items-center justify-between">
                    <span className="text-slate-900 font-medium font-code-sm">POST /api/api-keys</span>
                    <Icon name="download" className="text-[16px] text-red-600" />
                  </div>
                </div>
                {/* Step 3 */}
                <div className="bg-white p-space-lg rounded-2xl border border-slate-200/90 flex flex-col justify-between shadow-xs hover:border-red-200 hover:shadow-md transition-all relative">
                  <div>
                    <div className="flex items-center justify-between mb-space-md">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-headline-sm text-headline-sm font-bold">3</div>
                      <span className="font-label-sm text-label-sm text-slate-400 font-semibold">03 / SHIP</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">Call the data plane from anywhere</h3>
                    <p className="mt-space-xs font-body-sm text-body-sm text-slate-600 leading-relaxed">
                      Any HTTP client, any language, any cron job. The console in the UI uses the exact same API.
                    </p>
                  </div>
                  <div className="mt-space-md p-space-sm bg-slate-50 border border-slate-200/70 rounded-lg font-code-sm text-code-sm text-red-700 font-semibold flex items-center justify-between">
                    <span>POST /api/data/&lt;dbId&gt;/command</span>
                    <Icon name="rocket_launch" className="text-[16px] text-red-600" />
                  </div>
                </div>
              </div>
              {/* Copyable CLI / Environment Terminal Box */}
              <div className="mt-space-xl max-w-2xl mx-auto bg-slate-900 text-slate-100 p-space-md rounded-xl flex items-center justify-between shadow-md border border-slate-800">
                <div className="flex items-center gap-space-sm overflow-x-auto font-code-md text-code-md text-slate-200">
                  <span className="text-red-400 font-bold">$</span>
                  <span className="select-all">curl -X POST {API_EXAMPLE_ORIGIN}/api/data/$DB_ID/command -H &quot;Authorization: Bearer $RK_TOKEN&quot; -d &apos;{"{\"command\":\"PING\",\"args\":[]}"}&apos;</span>
                </div>
                <button className="ml-space-md flex-shrink-0 px-space-md py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-label-md text-label-md flex items-center gap-1 transition-colors border border-slate-700" id="copy-cli-btn">
                  <Icon name="content_copy" className="text-[16px]" />
                  <span id="cli-copy-text">Copy</span>
                </button>
              </div>
            </section>
            {/* 5b. AI SETUP PROMPT WIDGET */}
            <section aria-label="AI Setup Prompt" className="max-w-[1280px] mx-auto px-gutter-desktop py-space-2xl" id="ai-setup">
              <div className="text-center max-w-3xl mx-auto mb-space-2xl">
                <span className="font-label-sm text-label-sm text-red-600 uppercase tracking-widest font-bold">AI-Assisted Integration</span>
                <h2 className="mt-space-xs font-headline-lg text-headline-lg text-slate-900 font-bold">Let your AI do the wiring.</h2>
                <p className="font-body-md text-body-md text-slate-600 mt-space-xs leading-relaxed">
                  One prompt gives your AI assistant everything: what goes into .env, which endpoints to call, how TTL behaves. Copy, paste, ship.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-space-lg items-stretch">
                {/* .env card */}
                <div className="lg:col-span-2 bg-white p-space-lg rounded-2xl border border-slate-200/90 shadow-xs flex flex-col">
                  <div className="flex items-center gap-space-sm mb-space-md">
                    <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center"><Icon name="settings_suggest" className="text-[20px]" /></div>
                    <h3 className="font-headline-sm text-headline-sm text-slate-900 font-bold">.env your app needs</h3>
                  </div>
                  <p className="font-body-sm text-body-sm text-slate-600 leading-relaxed mb-space-md">
                    Three values, straight from the dashboard. Keep them server-side only: the API key is full access to its scoped database.
                  </p>
                  <div className="mb-space-md bg-slate-900 text-slate-100 p-space-md rounded-xl font-code-sm text-code-sm leading-relaxed border border-slate-800 select-all">
                    <span className="text-slate-500"># .env - server-side only, never commit</span><br />
                    <span className="text-red-400">CACHEIFY_BASE_URL</span>={API_EXAMPLE_ORIGIN}<br />
                    <span className="text-red-400">CACHEIFY_DB_ID</span>=rdb_&lt;from the Databases page&gt;<br />
                    <span className="text-red-400">CACHEIFY_API_KEY</span>=rk_&lt;one per database, from its page&gt;
                  </div>
                  <div className="mt-auto flex flex-col gap-space-sm font-label-sm text-label-sm">
                    <a className="px-space-md py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-space-xs transition-colors shadow-sm" href="/manual">
                      <Icon name="menu_book" className="text-[18px]" />
                      <span>The full manual for humans</span>
                    </a>
                    <div className="flex flex-col gap-1.5 text-slate-500 leading-snug">
                      <a className="font-code-sm text-code-sm hover:text-red-600 transition-colors font-mono" href={`${docsOrigin}/llms.txt`} target="_blank" rel="noopener">GET /llms.txt - agent quick index</a>
                      <a className="font-code-sm text-code-sm hover:text-red-600 transition-colors font-mono" href={`${docsOrigin}/api/openapi.json`} target="_blank" rel="noopener">GET /api/openapi.json - OpenAPI 3.1 spec</a>
                    </div>
                  </div>
                </div>
                {/* Prompt card */}
                <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-md flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between gap-space-md p-space-md pb-space-sm">
                    <div className="flex items-center gap-space-sm">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-red-400 flex items-center justify-center"><Icon name="smart_toy" className="text-[20px]" /></div>
                      <div>
                        <h3 className="font-headline-sm text-headline-sm text-white font-bold">The setup prompt</h3>
                        <p className="font-label-sm text-label-sm text-slate-400">Works in Cursor, Copilot, Claude, ChatGPT</p>
                      </div>
                    </div>
                    <button className="flex-shrink-0 px-space-md py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-label-md text-label-md flex items-center gap-1 transition-colors border border-slate-700" id="copy-prompt-btn" title="Copy the AI setup prompt">
                      <Icon name="content_copy" className="text-[16px]" />
                      <span id="prompt-copy-text">Copy</span>
                    </button>
                  </div>
                  <pre id="ai-prompt" className="flex-1 m-0 mx-space-md mb-space-md p-space-md bg-slate-950/60 border border-slate-800 rounded-lg text-slate-300 font-code-sm text-code-sm leading-relaxed overflow-auto max-h-[440px] select-all whitespace-pre-wrap">{AI_PROMPT_TEXT}</pre>
                </div>
              </div>
            </section>
            {/* 6. FINAL HIGH-CONVERTING CTA BANNER */}
            <section aria-label="Get Started" className="max-w-[1280px] mx-auto px-gutter-desktop py-space-2xl">
              <div className="relative bg-gradient-to-br from-red-600 via-red-600 to-rose-700 text-white p-space-xl lg:p-space-2xl rounded-3xl overflow-hidden shadow-xl shadow-red-500/20 flex flex-col items-center text-center">
                {/* Radial aura behind CTA */}
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-white/20 rounded-full blur-[90px] pointer-events-none"></div>
                <div className="inline-flex items-center gap-space-xs px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white font-label-sm text-label-sm uppercase tracking-wider mb-space-md border border-white/20 font-bold">
                  <Icon name="speed" className="text-[16px]" />
                  Free forever for all users
                </div>
                <h2 className="font-headline-lg text-headline-lg lg:text-display-hero text-white max-w-3xl tracking-tight font-extrabold">
                  Start building with isolated Redis in 30 seconds.
                </h2>
                <p className="mt-space-md font-body-lg text-body-lg text-red-50 max-w-xl leading-relaxed">
                  Five databases, thousands of keys, scoped API keys and full quotas - free for every user, with no upgrade gates or billing commitments.
                </p>
                <div className="mt-space-xl flex flex-col sm:flex-row items-center gap-space-md w-full max-w-md">
                  <a className="w-full sm:w-auto flex-1 px-space-xl py-3.5 rounded-lg bg-white hover:bg-slate-50 text-red-600 font-headline-sm text-[15px] font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-space-xs" href="/register">
                    <Icon name="bolt" className="text-[20px] text-red-600" />
                    <span>Create Free Database</span>
                  </a>
                  <a className="w-full sm:w-auto px-space-lg py-3.5 rounded-lg bg-red-700/60 hover:bg-red-700/90 text-white font-headline-sm text-[15px] font-semibold border border-white/25 transition-all flex items-center justify-center gap-space-xs" href="/login">
                    <Icon name="support_agent" className="text-[20px]" />
                    <span>Sign In</span>
                  </a>
                </div>
                <div className="mt-space-lg flex flex-wrap justify-center items-center gap-x-space-md gap-y-1 font-label-sm text-label-sm text-red-100/90 font-medium">
                  <span>No credit card</span>
                  <span>•</span>
                  <span>Native Redis semantics</span>
                  <span>•</span>
                  <span>Bring your own Redis server</span>
                </div>
              </div>
            </section>
          </div>
        </main>
        <footer className="w-full bg-slate-50 border-t border-slate-200/90 pt-space-2xl pb-space-xl">
          <div className="max-w-[1280px] mx-auto px-gutter-desktop">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-xl pb-space-2xl">
              <div className="lg:col-span-2 space-y-space-md">
                <div className="flex items-center gap-space-sm">
                  <img alt="Cacheify Brand Logo" className="h-8 w-auto object-contain" src={LOGO_SRC} />
                  <span className="font-headline-sm text-headline-sm text-slate-900 font-bold">Cacheify</span>
                </div>
                <p className="font-body-sm text-body-sm text-slate-600 max-w-sm leading-relaxed">Free managed Redis hosting for students, indie hackers and real production workloads: isolated databases, scoped API keys and a live command console - on the embedded engine or your own Redis server.</p>
                <div className="flex items-center gap-space-sm pt-space-xs">
                  <div className="flex items-center gap-space-xs px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-label-sm text-label-sm font-semibold">Free for all users</span>
                  </div>
                  <div className="flex items-center gap-space-xs px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    <Icon name="verified" className="text-[15px] text-red-600" />
                    <span className="font-label-sm text-label-sm font-semibold">Audit-logged actions</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-headline-sm text-body-md text-slate-900 font-bold mb-space-md">Platform</h4>
                <ul className="space-y-space-xs font-body-sm text-body-sm text-slate-600">
                  <li><a className="hover:text-red-600 transition-colors" href="/#capabilities">Isolated Databases</a></li>
                  <li><a className="hover:text-red-600 transition-colors" href="/#capabilities">Scoped API Keys</a></li>
                  <li><a className="hover:text-red-600 transition-colors" href="/#interactive-repl">Live Command Console</a></li>
                  <li><a className="hover:text-red-600 transition-colors" href="/#benchmark">Quotas &amp; Permissions</a></li>
                  <li><a className="hover:text-red-600 transition-colors" href="/#quickstart">Quick Start</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-headline-sm text-body-md text-slate-900 font-bold mb-space-md">Developers</h4>
                <ul className="space-y-space-xs font-body-sm text-body-sm text-slate-600">
                  <li><a className="hover:text-red-600 transition-colors" href={`${docsOrigin}/llms.txt`}>Agent / LLM index</a></li>
                  <li><a className="hover:text-red-600 transition-colors" href={`${docsOrigin}/api/openapi.json`}>OpenAPI 3.1 spec</a></li>
                  <li><a className="hover:text-red-600 transition-colors" href="/#quickstart">Data plane API</a></li>
                  <li><a className="hover:text-red-600 transition-colors" href="/#quickstart">Pipelines</a></li>
                  <li><a className="hover:text-red-600 transition-colors" href="/privacy">Privacy Policy</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-headline-sm text-body-md text-slate-900 font-bold mb-space-md">Trust &amp; Safety</h4>
                <ul className="space-y-space-xs font-body-sm text-body-sm text-slate-600">
                  <li><span className="inline-flex items-center gap-space-xs text-slate-800 font-medium"><Icon name="shield" className="text-[16px] text-red-600" />Hashed API keys</span></li>
                  <li><span className="inline-flex items-center gap-space-xs text-slate-800 font-medium"><Icon name="health_and_safety" className="text-[16px] text-red-600" />Server-side permissions</span></li>
                  <li><span className="inline-flex items-center gap-space-xs text-slate-800 font-medium"><Icon name="verified_user" className="text-[16px] text-red-600" />Tenant isolation (404s)</span></li>
                  <li><span className="inline-flex items-center gap-space-xs text-slate-800 font-medium"><Icon name="lock" className="text-[16px] text-red-600" />Rate limiting</span></li>
                </ul>
              </div>
            </div>
            <div className="pt-space-lg border-t border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-space-md font-body-sm text-body-sm text-slate-500">
              <p>© 2025 Cacheify. A free, open platform built as a college project.</p>
              <div className="flex items-center gap-space-lg">
                <a className="hover:text-slate-900 transition-colors" href="/privacy">Privacy Policy</a>
                <a className="hover:text-slate-900 transition-colors" href={`${docsOrigin}/api/openapi.json`}>API Reference</a>
                <a className="hover:text-slate-900 transition-colors" href="/login">Sign In</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
      <LandingScripts />
    </>
  );
}
