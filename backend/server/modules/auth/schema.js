'use strict';

/** Input validation schemas (strict mode; unknown fields stripped). */

const { z } = require('zod');

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const registerSchema = z.strictObject({ ...credentials.shape });

const loginSchema = z.strictObject({ ...credentials.shape });

/* Email-verification OTP: code is a 6-digit string; requesting needs no body. */
const otpRequestSchema = z.strictObject({});

const otpVerifySchema = z.strictObject({
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be a 6-digit verification code'),
});

module.exports = { registerSchema, loginSchema, otpRequestSchema, otpVerifySchema };
