'use strict';

/** Transactional-email integration for the signup OTP mail.
 *
 * Transport selection follows .env.example:
 *   1. Brevo REST API (BREVO_API_KEY [+ required BREVO_SENDER_EMAIL]).
 *   2. SMTP relay (MAIL_HOST + MAIL_USERNAME/MAIL_PASSWORD + MAIL_FROM),
 *      intended for the Brevo SMTP relay (smtp-relay.brevo.com:2525) but it
 *      works with any SMTP provider.
 *   3. MOCK mode: no credentials -> no network call; the OTP code is returned
 *      to the caller so local/dev flows can complete. Production with a
 *      configured provider NEVER echoes the code. */

const { config } = require('../../core/env');
const { info, warn } = require('../../core/logger');
const errors = require('../../core/errors');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

function mockMode() {
  return !config.integrations.brevoApiKey && !config.integrations.mailHost;
}

/** Pre-flight validation mirroring the .env.example contract. Throws a
    ServiceUnavailableError naming the missing variables when a transport is
    half-configured (e.g. API key without sender, host without credentials). */
function assertConfigured() {
  if (config.integrations.brevoApiKey) {
    if (!config.integrations.senderEmail) {
      throw new errors.ServiceUnavailableError(
        'Email sending is misconfigured: BREVO_SENDER_EMAIL is required when BREVO_API_KEY is set',
      );
    }
    return 'brevo-api';
  }
  if (config.integrations.mailHost) {
    if (!config.integrations.mailUsername || !config.integrations.mailPassword || !config.integrations.mailFrom) {
      throw new errors.ServiceUnavailableError(
        'Email sending is misconfigured: MAIL_USERNAME, MAIL_PASSWORD and MAIL_FROM are required when MAIL_HOST is set',
      );
    }
    return 'smtp';
  }
  throw new errors.ServiceUnavailableError(
    'Email sending is misconfigured: set BREVO_API_KEY (+BREVO_SENDER_EMAIL) or the MAIL_* SMTP block',
  );
}

async function sendViaBrevoApi(email, code, ttlMinutes) {
  const body = {
    sender: { name: config.integrations.senderName, email: config.integrations.senderEmail },
    to: [{ email }],
    subject: `${code} is your Cacheify verification code`,
    htmlContent: `
      <p>Hello,</p>
      <p>Your Cacheify verification code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>This code expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.</p>`,
    textContent: `Your Cacheify verification code is ${code} (expires in ${ttlMinutes} minutes).`,
  };
  let res;
  try {
    res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': config.integrations.brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    warn('otp_email_network_error', { message: String(err && err.message).slice(0, 120) });
    throw new errors.ServiceUnavailableError('Email sending failed: provider unreachable');
  }
  if (!res.ok) {
    warn('otp_email_provider_error', { status: res.status });
    throw new errors.ServiceUnavailableError('Email sending failed: provider rejected the request');
  }
}

async function sendViaSmtp(email, code, ttlMinutes) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    warn('otp_email_missing_dependency', { message: String(err && err.message).slice(0, 120) });
    throw new errors.ServiceUnavailableError('Email sending failed: nodemailer is not installed');
  }
  const transport = nodemailer.createTransport({
    host: config.integrations.mailHost,
    port: config.integrations.mailPort,
    secure: config.integrations.mailPort === 465,
    auth: { user: config.integrations.mailUsername, pass: config.integrations.mailPassword },
  });
  try {
    await transport.sendMail({
      from: config.integrations.mailFrom,
      to: email,
      subject: `${code} is your Cacheify verification code`,
      html: `
        <p>Hello,</p>
        <p>Your Cacheify verification code is:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
        <p>This code expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.</p>`,
      text: `Your Cacheify verification code is ${code} (expires in ${ttlMinutes} minutes).`,
    });
  } catch (err) {
    warn('otp_email_smtp_error', { message: String(err && err.message).slice(0, 120) });
    throw new errors.ServiceUnavailableError('Email sending failed: SMTP relay unreachable or rejected the message');
  }
}

/** Send the email-verification OTP. Returns { delivered, devCode? } where
    devCode is present ONLY in mock mode (no provider configured). */
async function sendOtpEmail(email, code, ttlMinutes) {
  if (mockMode()) {
    info('otp_email_mock', { emailDomain: (email.split('@')[1] || '').slice(0, 40) });
    return { delivered: true, devCode: code };
  }
  const transport = assertConfigured();
  if (transport === 'brevo-api') {
    await sendViaBrevoApi(email, code, ttlMinutes);
  } else {
    await sendViaSmtp(email, code, ttlMinutes);
  }
  return { delivered: true };
}

module.exports = { sendOtpEmail, mockMode };
