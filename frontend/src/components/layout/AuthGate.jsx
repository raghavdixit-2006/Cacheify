'use client';

/**
 * Auth gate: session guard, first-login onboarding boot and session
 * revalidation. Ported from the vanilla app.js render()/guard logic.
 *
 * Decision matrix (mirrors app.js):
 * - public login/register + signed in -> /verify (unverified) or /databases
 * - public info pages (privacy/manual) stay viewable signed in or out
 * - protected page + signed out -> /login
 * - admin page + role !== admin -> forbidden card (no redirect)
 * - unverified session on non-verify pages -> /verify
 * - /verify with verified session -> /databases
 */

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from '../../hooks/index.js';
import Navbar from './Navbar.jsx';
import { getSession, onboardingSkipped } from '../../store/store.js';
import { matchRoute, Routes } from '../../router/routes.js';
import { navigate } from '../../router/navigate.js';
import { refreshSession } from '../../services/authService.js';
import { getProfile } from '../../services/profileService.js';

function Forbidden() {
  return (
    <div className="card auth-card">
      <h1>Admin access required</h1>
      <p className="muted">Your account does not have permission to view this page.</p>
      <Link href="/databases" className="btn btn-primary">Back to overview</Link>
    </div>
  );
}

function decide(session, pathname) {
  const matched = matchRoute(pathname);
  if (!matched) return { kind: 'render' };
  const { route } = matched;

  if (route.access === 'public') {
    // Only auth screens bounce signed-in users away; informational public
    // pages (privacy policy) stay viewable while signed in.
    if (session && (route.page === 'login' || route.page === 'register')) {
      // Unverified sessions land on the dedicated verify screen; verified
      // ones go straight into the app.
      return {
        kind: 'replace',
        path: session.user.emailVerified === false ? Routes.verify : Routes.databases,
      };
    }
    return { kind: 'render' };
  }

  if (!session) {
    return { kind: 'replace', path: Routes.login };
  }
  if (route.access === 'admin' && session.user.role !== 'admin') {
    return { kind: 'forbidden' };
  }
  // Email verification gate: OTP is only for email verification, so
  // unverified accounts get shunted to the dedicated /verify page instead
  // of a banner on top of every locked app page.
  if (session.user.emailVerified === false && route.page !== 'verify') {
    return { kind: 'replace', path: Routes.verify };
  }
  if (route.page === 'verify' && session.user.emailVerified !== false) {
    return { kind: 'replace', path: Routes.databases };
  }
  return { kind: 'render' };
}

export default function AuthGate({ children }) {
  const session = useSession();
  const pathname = usePathname() || '';
  const decision = decide(session, pathname);

  useEffect(() => {
    if (decision.kind === 'replace') navigate(decision.path, { replace: true });
  }, [decision]);

  useEffect(() => {
    /* Keep stale sessions honest: revalidate the user on focus/visibility. */
    function onVisibility() {
      if (document.visibilityState === 'visible' && getSession()) {
        refreshSession().catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    if (getSession()) {
      refreshSession().catch(() => {});
    }

    /* First-login onboarding gate for restored sessions: accounts that never
       completed their profile (and never skipped) are sent to the profile
       editor on boot. Mongo outages never gate restored sessions. */
    void (async () => {
      const restored = getSession();
      if (!restored || restored.user.emailVerified === false || restored.user.role === 'admin') return;
      if (onboardingSkipped(restored.user.id)) return;
      try {
        const { data } = await getProfile();
        if (data.profile && data.profile.updatedAt === null && window.location.pathname !== '/profile') {
          navigate(Routes.profile);
        }
      } catch (_err) {
        /* Mongo unreachable: degrade gracefully */
      }
    })();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <main id="app-main" className="app-main" tabIndex={-1}>
        {decision.kind === 'render' ? children : decision.kind === 'forbidden' ? <Forbidden /> : null}
      </main>
    </div>
  );
}
