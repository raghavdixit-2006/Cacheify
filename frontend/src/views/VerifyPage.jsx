'use client';

/**
 * Verify page: dedicated email-verification screen (Brevo OTP).
 *
 * Unverified accounts are redirected here from every authenticated page;
 * the OTP flow exists only for email verification, never for anything else.
 * On success the session is updated in place and the user proceeds to the
 * databases overview.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/common/Icon.jsx';
import { Button } from '../components/common/atoms.jsx';
import { requestOtp, verifyOtp } from '../services/authService.js';
import { getSession, updateUser } from '../store/store.js';
import { showToast } from '../components/common/toasts.js';
import { navigate } from '../router/navigate.js';
import { Routes } from '../router/routes.js';

const EMPTY = ['', '', '', '', '', ''];

export default function VerifyPage() {
  const [digits, setDigits] = useState(EMPTY);
  const [status, setStatus] = useState({ text: '', kind: '' });
  const [shake, setShake] = useState(false);
  const inputRefs = useRef([]);
  const busyRef = useRef(false);

  const session = getSession();
  const email = (session && session.user && session.user.email) || '';

  useEffect(() => {
    if (inputRefs.current[0]) inputRefs.current[0].focus();
  }, []);

  function setStatusOk(text) {
    setStatus({ text, kind: 'otp-status-ok' });
  }

  function setStatusError(text) {
    setStatus({ text, kind: 'otp-status-error' });
  }

  async function submit(codeDigits) {
    if (busyRef.current) return;
    const code = (codeDigits || digits).join('');
    if (!/^\d{6}$/.test(code)) {
      setStatusError('Please enter all 6 digits.');
      return;
    }
    busyRef.current = true;
    try {
      await verifyOtp(code);
      updateUser({ emailVerified: true });
      setStatusOk('Email verified. Redirecting…');
      showToast('Email verified. Everything is unlocked.', 'success');
      // First-login chain: verification -> complete account details -> app.
      setTimeout(() => navigate(Routes.profile), 800);
    } catch (err) {
      setStatusError(err.message || 'Verification failed');
      /* Shake the inputs on error */
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      busyRef.current = false;
    }
  }

  async function resend() {
    setStatus({ text: 'Sending code...', kind: '' });
    try {
      const { data } = await requestOtp();
      setStatusOk(data.devCodeOverride
        ? `Dev mode (no email provider configured). Code: ${data.devCodeOverride}`
        : 'Code sent. Check your inbox.');
    } catch (err) {
      setStatusError(err.message || 'Could not send the code');
    }
  }

  /* Auto-focus next box on input */
  function handleInput(index, value) {
    const nextDigits = [...digits];
    nextDigits[index] = value;
    setDigits(nextDigits);
    if (/^\d$/.test(value) && index < 5) {
      const next = inputRefs.current[index + 1];
      if (next) next.focus();
    }
    if (index === 5 && /^\d$/.test(value)) {
      void submit(nextDigits);
    }
  }

  /* Paste support: spread 6 chars across boxes */
  function handlePaste(event) {
    event.preventDefault();
    const paste = (event.clipboardData || window.clipboardData).getData('text');
    const pasted = paste.replace(/\D/g, '').slice(0, 6);
    const nextDigits = EMPTY.map((_, j) => pasted[j] || '');
    setDigits(nextDigits);
    const target = inputRefs.current[Math.min(pasted.length, 5)];
    if (target) target.focus();
    if (pasted.length === 6) {
      void submit(nextDigits);
    }
  }

  return (
    <div className="card verify-card">
      <div className="verify-header">
        <h2 className="verify-title">
          <Icon name="exclamation-triangle" />
          {' '}
          Verify your email
        </h2>
        <p className="verify-text">
          {email
            ? `We sent a 6-digit code to ${email}. Enter it below to unlock databases, API keys and the data plane. Use "Resend code" if it did not arrive (60s cooldown applies).`
            : 'Enter the 6-digit code we sent to your email address to unlock databases, API keys and the data plane.'}
        </p>
      </div>

      <div className={`otp-row${shake ? ' otp-shake' : ''}`}>
        {digits.map((value, index) => (
          <input
            key={index}
            ref={(node) => { inputRefs.current[index] = node; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className="otp-input"
            aria-label={`Digit ${index + 1}`}
            value={value}
            autoFocus={index === 0}
            onChange={(event) => handleInput(index, event.target.value)}
            onKeyDown={(event) => {
              /* Auto-focus previous box on backspace when empty */
              if (event.key === 'Backspace' && !event.target.value && index > 0) {
                inputRefs.current[index - 1].focus();
              }
            }}
            onPaste={handlePaste}
          />
        ))}
      </div>

      <p className={`otp-status${status.kind ? ` ${status.kind}` : ''}`}>{status.text}</p>

      <div className="verify-actions">
        <Button label="Verify code" iconName="check-lg" variant="primary" onClick={() => void submit()} />
        <Button label="Resend code" iconName="envelope" variant="secondary" onClick={() => void resend()} />
      </div>
    </div>
  );
}
