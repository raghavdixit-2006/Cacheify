'use strict';

/** SMTP connectivity diagnostic for the OTP mailer (scripts/mail-diagnose.js).
 *
 * Uses the same env contract (.env via the built-in loader) and the same
 * transport shape as server/modules/integrations/brevo.js, printing only
 * non-secret configuration. With no argument it verifies the connection;
 * `node scripts/mail-diagnose.js <recipient>` also sends a test mail. */

const { config } = require('../server/core/env');
const { warn } = require('../server/core/logger');

function mask(value) {
  if (!value) return '(not set)';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}...${value.slice(-2)}`;
}

async function main() {
  const integrations = config.integrations;
  console.log('--- transport selection ---');
  console.log('brevoApiKey :', integrations.brevoApiKey ? mask(integrations.brevoApiKey) : '(not set)');
  console.log('senderEmail :', integrations.senderEmail || '(not set)');
  console.log('mailHost    :', integrations.mailHost ? `${integrations.mailHost}:${integrations.mailPort}` : '(not set)');
  console.log('mailUsername:', mask(integrations.mailUsername));
  console.log('mailPassword:', mask(integrations.mailPassword));
  console.log('mailFrom    :', integrations.mailFrom || '(not set)');

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    console.error('FATAL: nodemailer is not installed:', err.message);
    process.exit(2);
  }

  const transport = nodemailer.createTransport({
    host: integrations.mailHost,
    port: integrations.mailPort,
    secure: integrations.mailPort === 465,
    auth: { user: integrations.mailUsername, pass: integrations.mailPassword },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  });

  console.log('--- transport.verify() ---');
  try {
    await transport.verify();
    console.log('OK: SMTP handshake and authentication succeeded');
  } catch (err) {
    console.error('FAIL:', err.message);
    process.exit(1);
  }

  const recipient = process.argv[2];
  if (!recipient) {
    console.log('Tip: pass a recipient to send a test mail: node scripts/mail-diagnose.js you@example.com');
    return;
  }

  console.log(`--- sending test mail to ${recipient} ---`);
  try {
    const info = await transport.sendMail({
      from: integrations.mailFrom,
      to: recipient,
      subject: 'Cacheify SMTP test',
      text: 'If you received this, the SMTP relay path works.',
    });
    console.log('OK: accepted by relay, messageId =', info.messageId, 'response =', info.response);
  } catch (err) {
    console.error('FAIL:', err.message);
    const dt = Date.now();
    warn('mail_diagnose_error', { message: String(err.message).slice(0, 240), at: dt });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
