'use strict';

/** Auth routes: HTTP transport only — no business logic here. */

const express = require('express');
const { validate, attachUser, rateLimit, requireAuth } = require('../../core/middleware');
const { ok } = require('../../core/envelope');
const service = require('./service');
const otpService = require('./otp');
const { registerSchema, loginSchema, otpRequestSchema, otpVerifySchema } = require('./schema');

const router = express.Router();

/* Generic public limiter (30/min per IP) for the auth surface. Sensitive
   endpoints carry stricter per-route limits below:
   - login/register: brute-force and mass-registration resistance
   - otp/request: email-bombing resistance (one IP requesting codes for
     many accounts would otherwise relay 30 mails/minute) */
const publicLimiter = rateLimit({ keyPrefix: 'auth' });
const loginLimiter = rateLimit({ keyPrefix: 'auth-login', max: 10 });
const registerLimiter = rateLimit({ keyPrefix: 'auth-register', max: 5 });
const otpRequestLimiter = rateLimit({ keyPrefix: 'auth-otp', max: 4 });

router.post(
  '/register',
  publicLimiter,
  registerLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const result = await service.register(req.body, { requestId: req.requestId });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  },
);

router.post(
  '/login',
  publicLimiter,
  loginLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const result = await service.login(req.body, { requestId: req.requestId });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  },
);

router.get(
  '/me',
  attachUser,
  requireAuth,
  async (req, res, next) => {
    try {
      return ok(res, { user: await service.me(req.user.id) });
    } catch (err) {
      return next(err);
    }
  },
);

/* Email verification (Brevo OTP): request the code, then verify it.
   Both operate on the factory-fresh session the account already holds. */
router.post(
  '/otp/request',
  publicLimiter,
  otpRequestLimiter,
  attachUser,
  requireAuth,
  async (req, res, next) => {
    try {
      const result = await otpService.requestOtp(req.user, { requestId: req.requestId });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  },
);

router.post(
  '/otp/verify',
  publicLimiter,
  attachUser,
  requireAuth,
  validate(otpVerifySchema),
  async (req, res, next) => {
    try {
      const result = await otpService.verifyOtp(req.user, req.body.code, { requestId: req.requestId });
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
