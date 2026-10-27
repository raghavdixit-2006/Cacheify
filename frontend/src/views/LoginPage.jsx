'use client';

/** Login page: instant access, low friction, inline validation on blur. */

import Link from 'next/link';
import { useRef, useState } from 'react';
import AuthCard from '../components/layout/AuthCard.jsx';
import Field from '../components/common/Field.jsx';
import { login, startSession } from '../services/authService.js';
import { getProfile } from '../services/profileService.js';
import { onboardingSkipped } from '../store/store.js';
import { errorToMessage, validateEmail, validatePassword } from '../utils/validators.js';
import { navigate } from '../router/navigate.js';
import { Routes } from '../router/routes.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const emailFieldRef = useRef(null);
  const passwordFieldRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setAlert(null);

    const validEmail = emailFieldRef.current.validate();
    const validPassword = passwordFieldRef.current.validate();
    if (!validEmail || !validPassword) {
      setBusy(false);
      return;
    }

    setBusy(true);
    try {
      const { data } = await login({ email: email.trim(), password });
      startSession(data);
      // First-login chain: unverified -> /verify; verified but incomplete
      // profile (and not previously skipped) -> /profile onboarding; else app.
      if (data.user.emailVerified === false) {
        navigate(Routes.verify);
        return;
      }
      const skipped = onboardingSkipped(data.user.id);
      let incomplete = !skipped;
      if (!skipped) {
        try {
          const { data: profileData } = await getProfile();
          incomplete = Boolean(profileData.profile && profileData.profile.updatedAt === null);
        } catch (_err) {
          incomplete = false; // never gate sign-in on a Mongo outage
        }
      }
      navigate(incomplete ? Routes.profile : Routes.databases);
    } catch (err) {
      setAlert(errorToMessage(err, 'Sign in failed'));
      setBusy(false);
      emailFieldRef.current.focus();
    }
  }

  return (
    <AuthCard
      heading="Sign in"
      lead="Welcome back. Manage your Redis databases from anywhere."
      footer={<p className="muted">No account yet? <Link href={Routes.register}>Create one</Link></p>}
    >
      <form noValidate onSubmit={handleSubmit}>
        <Field
          ref={emailFieldRef}
          id="login-email"
          label="Email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onValueChange={setEmail}
          validate={validateEmail}
        />
        <Field
          ref={passwordFieldRef}
          id="login-password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onValueChange={setPassword}
          validate={validatePassword}
        />
        <p className="inline-error" role="alert" hidden={!alert}>{alert}</p>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>Sign in</button>
        </div>
      </form>
    </AuthCard>
  );
}
