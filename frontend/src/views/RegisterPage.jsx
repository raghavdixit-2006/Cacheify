'use client';

/** Register page: minimal fields, deferred choices, instant gratification. */

import Link from 'next/link';
import { useRef, useState } from 'react';
import AuthCard from '../components/layout/AuthCard.jsx';
import Field from '../components/common/Field.jsx';
import { register, startSession } from '../services/authService.js';
import { errorToMessage, validateEmail, validatePassword } from '../utils/validators.js';
import { navigate } from '../router/navigate.js';
import { Routes } from '../router/routes.js';

export default function RegisterPage() {
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

    const okEmail = emailFieldRef.current.validate();
    const okPassword = passwordFieldRef.current.validate();
    if (!okEmail || !okPassword) {
      setBusy(false);
      return;
    }

    setBusy(true);
    try {
      const { data } = await register({ email: email.trim(), password });
      startSession(data);
      navigate(data.user.emailVerified === false ? Routes.verify : Routes.databases);
    } catch (err) {
      setAlert(errorToMessage(err, 'Registration failed'));
      setBusy(false);
    }
  }

  return (
    <AuthCard
      heading="Create your account"
      lead="Start with up to 5 isolated Redis databases. No payment details needed."
      footer={<p className="muted"><Link href={Routes.login}>Sign in instead</Link></p>}
    >
      <form noValidate onSubmit={handleSubmit}>
        <Field
          ref={emailFieldRef}
          id="register-email"
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
          id="register-password"
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onValueChange={setPassword}
          validate={validatePassword}
        />
        <p className="inline-error" role="alert" hidden={!alert}>{alert}</p>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>Create account</button>
        </div>
      </form>
    </AuthCard>
  );
}
