/**
 * Privacy policy page (public, viewable signed-out and signed-in).
 * Plain language, no dark patterns. Sections mirror what the platform
 * actually does: metadata in the control plane, key data in the embedded
 * store or the operator's Redis server, API keys hashed, plaintext shown once.
 */

import { Icon } from '../components/common/Icon.jsx';

const SECTIONS = [
  {
    id: 'what-this-service-is',
    title: 'What this service is',
    body: [
      'Cacheify is a hosting front-end for Redis: you create logical databases and manage their keys, either in the web UI or with scoped API keys.',
      'Depending on the deployment, the data plane runs either on the platform\'s embedded engine or directly against a real Redis server that the operator configured. In both cases authorization, quotas and permissions are enforced by the platform before any command executes.',
    ],
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    list: [
      'Account e-mail address and a password hash (never the password itself).',
      'Platform metadata: list of your logical databases (names, descriptions, status), API key records and audit-log entries (who created or revoked a key, who flushed or deleted a database).',
      'API key metadata: name, a short token prefix for identification, and the time a key was last used.',
      'Key data you write. In embedded mode it is stored in the platform\'s database; in remote mode it lives on the operator\'s Redis server. In both modes it is scoped to your database and removed on expiry.',
    ],
  },
  {
    id: 'what-we-never-do',
    title: 'What we never do with key data',
    list: [
      'We never write key values to application logs, analytics events or error reports.',
      'We never sell, share or use stored values for profiling, advertising or model training.',
      'API keys are stored as one-way hashes. The full token is displayed exactly once at creation and cannot be recovered afterwards.',
      'Connection credentials to backing Redis servers are stored server-side in the operator\'s environment configuration and are never shown in the UI, API responses or logs.',
    ],
  },
  {
    id: 'cookies-and-tokens',
    title: 'Cookies and tokens',
    body: [
      'After signing in, the web UI keeps a signed session token in your browser\'s local storage. It is sent with each request and expires; you can end a session at any time with Sign out.',
      'The marketing site and console run no advertising, no analytics and no third-party tracking scripts.',
    ],
  },
  {
    id: 'retention-and-deletion',
    title: 'Retention and deletion',
    list: [
      'Deleting a database removes it from the platform and, in remote mode, deletes all keys under its namespace from the Redis provider.',
      'Revoking an API key immediately invalidates it; deleting a database immediately invalidates (and removes) any keys scoped to it.',
      'Every Redis key expires. The platform default is 24 hours, and an expiry is required on every write.',
      'The console does not expose a self-service account-deletion action. Account records and audit history are retained until the operator removes them; contact the operator for a removal request.',
    ],
  },
  {
    id: 'security-measures',
    title: 'Security measures',
    list: [
      'Passwords are stored as salted one-way hashes.',
      'API keys are hashed; transmission is over your local connection or the transport layer configured by the operator (TLS/CA verification for remote providers is never bypassed).',
      'Every request carries a request id; writes to keys, databases and API keys are recorded in the audit log with actor, action and target.',
      'Rate limiting, quota limits and permission levels (read-only / read-write, per-database scoping) are enforced server-side.',
      'Cross-tenant requests return 404 rather than confirming that another account\'s database exists.',
    ],
  },
  {
    id: 'third-parties',
    title: 'Third parties',
    body: [
      'The platform itself talks only to you and, if the operator configured one, to the backing Redis server. A hosted Redis provider sees the traffic and data of your databases under its own privacy terms.',
      'If e-mail verification is enabled, the operator may use Brevo or an SMTP relay to deliver the one-time code. That provider receives the recipient address and the message content needed to deliver it.',
    ],
  },
  {
    id: 'changes-to-this-policy',
    title: 'Changes to this policy',
    body: [
      'If the policy materially changes, the operator will update this page before or with the change. The effective version is always the one shown here.',
    ],
  },
];

const FACTS = [
  {
    icon: 'shield-lock',
    title: 'Keys are hashed',
    detail: 'Plaintext is shown once and never recoverable.',
  },
  {
    icon: 'eye',
    title: 'No analytics',
    detail: 'No ad scripts, trackers or third-party analytics.',
  },
  {
    icon: 'braces',
    title: 'Values stay scoped',
    detail: 'Key data is isolated per database and never logged.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="privacy-page">
      <header className="privacy-hero">
        <div className="privacy-hero-copy">
          <p className="dash-eyebrow">
            <span className="dot" aria-hidden="true" />
            Trust and data
          </p>
          <h1>Privacy, in plain language.</h1>
          <p>
            What Cacheify collects, what it deliberately does not, and what happens
            when a database, a key or an account is removed. No dark patterns.
          </p>
          <div className="privacy-facts">
            {FACTS.map((fact) => (
              <div className="privacy-fact" key={fact.title}>
                <span className="privacy-fact-icon">
                  <Icon name={fact.icon} />
                </span>
                <span>
                  <strong>{fact.title}</strong>
                  <small>{fact.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="privacy-hero-panel">
          <span className="privacy-hero-panel-label">Policy scope</span>
          <dl>
            <div>
              <dt>Control plane</dt>
              <dd>Account, database metadata, audit log</dd>
            </div>
            <div>
              <dt>Data plane</dt>
              <dd>Embedded store or operator-managed Redis</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>Signed token in browser local storage</dd>
            </div>
            <div>
              <dt>Tracking</dt>
              <dd>None</dd>
            </div>
          </dl>
          <p>Last reviewed October 2026</p>
        </div>
      </header>

      <div className="privacy-layout">
        <aside className="docs-toc privacy-toc" aria-label="On this page">
          <p className="docs-toc-title">On this page</p>
          <nav>
            {SECTIONS.map((section) => (
              <a href={`#${section.id}`} key={section.id}>{section.title}</a>
            ))}
          </nav>
        </aside>

        <div className="privacy-body">
          {SECTIONS.map((section) => (
            <section className="privacy-section" id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {(section.body || []).map((paragraph, index) => (
                <p className="privacy-text" key={`${section.id}-body-${index}`}>{paragraph}</p>
              ))}
              {section.list ? (
                <ul className="privacy-list">
                  {section.list.map((item, index) => (
                    <li className="privacy-list-item" key={`${section.id}-item-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
