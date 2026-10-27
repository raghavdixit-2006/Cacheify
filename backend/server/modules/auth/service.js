'use strict';

/** Auth service: registration, login, session derivation. Pure domain rules. */

const bcrypt = require('bcryptjs');
const { config } = require('../../core/env');
const { signToken } = require('../../core/crypto');
const { toPublicUser } = require('../../core/dto');
const errors = require('../../core/errors');
const audit = require('../../core/audit');
const dal = require('./dal');
const otp = require('./otp');

function issueSession(user) {
  return signToken({ kind: 'session', sub: user.id, role: user.role, tv: user.token_version });
}

/** Dummy bcrypt target for timing-equalized login: when the account does not
    exist we still run a full bcrypt comparison so response latency cannot be
    used to probe which emails are registered (account-enumeration defense).
    Computed at module load with the same cost factor as real hashes so the
    timing profile matches exactly. */
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('timing-equalizer-dummy-credential', config.bcryptCost);

async function register({ email, password }, context = {}) {
  const existing = await dal.findByEmail(email);
  if (existing) {
    // Do not disclose account existence beyond the generic conflict.
    throw new errors.ConflictError('An account with this email already exists');
  }
  const passwordHash = bcrypt.hashSync(password, config.bcryptCost);
  // New accounts start unverified: the platform gate (requireVerifiedEmail)
  // unlocks databases/keys/data plane only after the Brevo email OTP step.
  const user = await dal.insertUser({ email, passwordHash, emailVerified: 0 });
  await audit.record({
    actorUserId: user.id,
    action: 'user.register',
    targetType: 'user',
    targetId: user.public_id,
    requestId: context.requestId,
  });
  return { token: issueSession(user), user: toPublicUser(user), verificationRequired: true };
}

async function login({ email, password }, context = {}) {
  const user = await dal.findByEmail(email);
  // Always run exactly one bcrypt comparison (real hash or dummy target) so
  // the timing profile is identical whether or not the email exists.
  const hashOk = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_BCRYPT_HASH);
  if (!user || !hashOk) {
    throw new errors.UnauthorizedError('Invalid email or password');
  }
  if (user.status !== 'active') {
    throw new errors.ForbiddenError('This account is suspended. Contact an administrator.');
  }
  await audit.record({
    actorUserId: user.id,
    action: 'user.login',
    targetType: 'user',
    targetId: user.public_id,
    requestId: context.requestId,
  });
  return { token: issueSession(user), user: toPublicUser(user) };
}

async function me(userId) {
  const user = await dal.findById(userId);
  if (!user) throw new errors.UnauthorizedError();
  return toPublicUser(user);
}

module.exports = { register, login, me, issueSession };
