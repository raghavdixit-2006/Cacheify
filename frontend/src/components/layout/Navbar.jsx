'use client';

/**
 * Global navigation: stable placement, sign-in/utility tools top-right.
 * Live status pill retained from the landing header motif.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../common/Icon.jsx';
import { Routes } from '../../router/routes.js';
import { useSession } from '../../hooks/index.js';
import { navigate } from '../../router/navigate.js';
import { logout } from '../../services/authService.js';

function handleLogout() {
  logout();
  navigate(Routes.login);
}

export default function Navbar() {
  const session = useSession();
  const currentPath = usePathname() || '';

  const links = [
    { href: Routes.databases, label: 'Dashboard', iconName: 'grid-1x2' },
    { href: Routes.apiKeys, label: 'API Keys', iconName: 'key' },
    { href: Routes.profile, label: 'Profile', iconName: 'person-circle' },
    ...(session && session.user.role === 'admin' ? [{ href: Routes.admin, label: 'Admin', iconName: 'people' }] : []),
  ];

  return (
    <header id="app-navbar" className="app-navbar">
      <div className="navbar-row">
        <Link href={session ? Routes.databases : Routes.login} className="navbar-brand">
          <span className="navbar-logo" aria-hidden="true">
            <Icon name="bolt" />
          </span>
          <span>Cacheify</span>
        </Link>

        <div className="navbar-status" aria-hidden="true">
          <span className="dot" />
          <span>Operational</span>
        </div>

        {session ? (
          <ul className="navbar-links">
            {links.map((item) => {
              const isCurrent = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={isCurrent ? 'page' : undefined}>
                    <Icon name={item.iconName} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="navbar-user">
          {/* Privacy policy is reachable logged-out and signed-in alike. */}
          <Link
            href={Routes.privacy}
            className="btn btn-ghost"
            aria-current={currentPath === Routes.privacy ? 'page' : undefined}
            style={{ marginRight: '8px' }}
          >
            <Icon name="shield-lock" />
            <span>Privacy</span>
          </Link>

          {session ? (
            <>
              <span className="email">
                <span className="avatar" aria-hidden="true">
                  {(session.user.email || '?').charAt(0).toUpperCase()}
                </span>
                <span title={session.user.email}>{session.user.email}</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Sign out"
                data-agent-action="logout"
                onClick={handleLogout}
              >
                <Icon name="box-arrow-right" />
                <span>Sign out</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
