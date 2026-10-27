/**
 * Privacy policy page (public, viewable signed-out and signed-in).
 * Plain language, no dark patterns. Sections mirror what the platform
 * actually does: metadata only, Redis data plane passes through,
 * API keys hashed, plaintext shown once.
 */

import { Icon } from '../components/common/Icon.jsx';
import Footer from '../components/layout/Footer.jsx';

const SECTIONS = [
  {
    title: 'What this service is',
    body: [
      'Cacheify is a hosting front-end for Redis: you create logical databases and manage their keys, either in the web UI or with scoped API keys.',
      'Depending on the deployment, the data plane runs either on the platform\'s embedded dev engine or directly against a real Redis server that the operator configured. In both cases authorization, quotas and permissions are enforced by the platform before any command executes.',
    ],
  },
  {
    title: 'What we collect',
    list: [
      'Account e-mail address and a password hash (never the password itself).',
      'Platform metadata: list of your logical databases (names, descriptions, status), API key records and audit-log entries (who created or revoked a key, who flushed or deleted a database).',
      'API key metadata: name, a short token prefix for identification, and the time a key was last used.',
    ],
  },
  {
    title: 'What we never store or read',
    list: [
      'We never store your Redis key contents: values pass through memory only to serve your request and are not logged, copied or analyzed.',
      'API keys are stored as one-way hashes. The full token is displayed exactly once at creation and cannot be recovered afterwards.',
      'Connection credentials to backing Redis servers are stored server-side in the operator\'s environment configuration and are never shown in the UI, API responses or logs.',
    ],
  },
  {
    title: 'Cookies and tokens',
    body: [
      'After signing in, the web UI keeps a signed session token in your browser\'s local storage. It is sent with each request and expires; you can end a session at any time with Sign out.',
      'We run no advertising, no analytics and no third-party tracking scripts.',
    ],
  },
  {
    title: 'Data retention and deletion',
    list: [
      'Deleting a database removes it from the platform and, on a real Redis provider, deletes all keys under its namespace from the provider.',
      'Revoking an API key immediately invalidates it; deleting a database immediately invalidates (and removes) any keys scoped to it.',
      'Deleting your account removes your user record, databases, scoped API keys and audit history associated with them.',
    ],
  },
  {
    title: 'Security measures',
    list: [
      'Passwords are stored as salted one-way hashes.',
      'API keys are hashed; transmission is over your local connection or the transport layer configured by the operator (TLS/CA verification for remote providers is never bypassed).',
      'Every request carries a request id; writes to keys, databases and API keys are recorded in the audit log with actor, action and target.',
      'Rate limiting, quota limits and permission levels (read-only / read-write, per-database scoping) are enforced server-side.',
    ],
  },
  {
    title: 'Third parties',
    body: [
      'The platform itself talks only to you and (if the operator configured one) to the backing Redis server. If the platform is connected to a hosted Redis provider such as Upstash, botkeep, or any other hosted Redis, that provider sees the traffic and data of your databases under its own privacy terms.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'If the policy materially changes, the operator will update this page before or with the change. The effective version is always the one shown here.',
    ],
  },
];

function formatDate() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PrivacyPage() {
  return (
    <div className="privacy-page">
      {/* Hero section with theme GIF */}
      <div className="privacy-hero">
        <div className="privacy-gif-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="privacy-gif" src="https://media.giphy.com/media/3o7TKSjVBFNtAl5qEw/giphy.gif" alt="Redis database caching animation" loading="lazy" />
        </div>
        <div className="page-toolbar">
          <div className="page-heading" style={{ margin: '0' }}>
            <h1>
              <Icon name="shield-lock" />
              {' '}
              Privacy policy
            </h1>
            <p>What Cacheify collects, what it deliberately does not, and what happens when you delete things.</p>
          </div>
        </div>
      </div>

      <p className="privacy-updated">{`Last updated: ${formatDate()}`}</p>

      {SECTIONS.map((section) => (
        <div className="card privacy-card" key={section.title}>
          <h2 className="privacy-section-title">{section.title}</h2>
          {(section.body || []).map((paragraph) => (
            <p className="privacy-text" key={paragraph}>{paragraph}</p>
          ))}
          {section.list ? (
            <ul className="privacy-list">
              {section.list.map((item) => (
                <li className="privacy-list-item" key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}

      {/* Global footer with attribution */}
      <Footer />
    </div>
  );
}
