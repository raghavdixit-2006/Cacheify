'use strict';

/** One-shot OTP delivery check against the live server (scripts/otp-flow-check.js).
 *
 * Registers a throwaway account, requests the verification code, and reports
 * which branch the mailer took: devCodeOverride (mock, no email) or sent:true
 * (real email delivered through the configured transport). */

const base = process.argv[2] || 'http://127.0.0.1:3000';
const email = `otp-check-${Date.now()}@gmail.com`;
const password = 'otp-flow-check-9';

async function call(method, path, body, cookie, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') };
}

async function main() {
  const reg = await call('POST', '/api/auth/register', { email, password });
  console.log('register:', reg.status, reg.json && reg.json.data && reg.json.data.token ? '(token received)' : JSON.stringify(reg.json));
  if (reg.status !== 200) process.exit(1);
  const token = reg.json.data.token;

  const otp = await call('POST', '/api/auth/otp/request', null, null, token);
  const data = otp.json.data || {};
  console.log('otp/request:', otp.status);
  if (data.devCodeOverride) {
    console.log('MOCK mode: code surfaced locally (', data.devCodeOverride, ') - no email was sent');
  } else if (data.sent) {
    console.log('REAL send: email delivered through the configured transport to', email);
  } else {
    console.log(JSON.stringify(otp.json));
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
