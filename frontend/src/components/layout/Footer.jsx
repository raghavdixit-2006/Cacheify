/**
 * Global footer: structured product, developer, company and security links.
 * Used by the marketing page and the public information routes.
 */

import Link from 'next/link';
import Brand from '../common/Brand.jsx';
import { apiOrigin } from '../../utils/config.js';

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'Databases', href: '/databases' },
      { label: 'API keys', href: '/api-keys' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Console', href: '/login' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: '/manual' },
      { label: 'Quick start', href: '/#quickstart' },
      { label: 'API reference', href: `${apiOrigin()}/api/openapi.json`, external: true },
      { label: 'Agent index', href: `${apiOrigin()}/llms.txt`, external: true },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Engineering notes', href: '/blog' },
      { label: 'Create account', href: '/register' },
      { label: 'Sign in', href: '/login' },
      { label: 'Privacy policy', href: '/privacy' },
    ],
  },
  {
    title: 'Security',
    links: [
      { label: 'Tenant isolation', href: '/manual#security' },
      { label: 'Scoped keys', href: '/manual#security' },
      { label: 'TTL enforcement', href: '/manual#ttl-and-expiry' },
      { label: 'Error contracts', href: '/manual#errors' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Brand href="/" />
          <p>
            Serverless Redis with isolated databases, scoped API keys and a
            plain HTTP data plane. Free to start, no card required.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div className="footer-col" key={column.title}>
            <h3>{column.title}</h3>
            <ul>
              {column.links.map((link) => (
                <li key={`${column.title}-${link.label}`}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="footer-bottom">
        <p>{`\u00A9 ${new Date().getFullYear()} Cacheify. Built for builders.`}</p>
        <div className="footer-legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/manual">Documentation</Link>
          <Link href="/blog">Notes</Link>
          <span>Made by Rahul Gheek</span>
        </div>
      </div>
    </footer>
  );
}
