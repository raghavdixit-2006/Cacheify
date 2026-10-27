'use strict';

/**
 * Brevo account + sender diagnostic (no mail is sent).
 * Prints which senders exist on the Brevo account and whether each one is
 * verified — the usual root cause of "250 accepted, but mail never arrives".
 */

const { config } = require('../server/core/env');

async function main() {
  const apiKey = config.integrations.brevoApiKey;
  const senderEmail = config.integrations.senderEmail || '(not set)';
  console.log('platform senderEmail (BREVO_SENDER_EMAIL):', senderEmail);

  if (!apiKey) {
    console.log('BREVO_API_KEY is not set — the platform uses the SMTP relay or MOCK mode.');
  }

  const resp = await fetch('https://api.brevo.com/v3/senders', {
    headers: { 'api-key': apiKey, accept: 'application/json' },
  });
  console.log(`GET /v3/senders -> ${resp.status}`);
  if (!resp.ok) {
    console.log('note: an invalid/hard-blocked key shows here as 401; status only, no secrets.');
    return;
  }
  const data = await resp.json();
  const senders = Array.isArray(data.senders) ? data.senders : [];
  if (senders.length === 0) {
    console.log('No senders configured on this Brevo account at all — create/verify one in Brevo → Senders.');
    return;
  }
  for (const sender of senders) {
    console.log(
      `- ${sender.email} name="${sender.name || ''}" id=${sender.id} verified=${sender.verified ?? '(field missing)'}`,
    );
  }
  void senderEmail;
}

main().catch((err) => {
  console.error('senders check failed:', err.message);
  process.exit(1);
});
