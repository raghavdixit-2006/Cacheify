'use strict';

/** Profile service: domain rules for the user's saved profile data. */

const audit = require('../../core/audit');
const errors = require('../../core/errors');
const mongo = require('../integrations/mongo');

const DEFAULTS = Object.freeze({
  displayName: '',
  bio: '',
  avatarColor: '#ef4444',
});

function shape(doc) {
  if (!doc) return { ...DEFAULTS, updatedAt: null };
  return {
    displayName: doc.displayName || DEFAULTS.displayName,
    bio: doc.bio || DEFAULTS.bio,
    avatarColor: doc.avatarColor || DEFAULTS.avatarColor,
    updatedAt: doc.updatedAt || null,
  };
}

async function getProfile(user) {
  if (!mongo.configured()) return shape(null); // graceful: defaults until Mongo is wired
  const profiles = await mongo.profileCollection();
  const doc = await profiles.findOne({ _id: user.public_id });
  return shape(doc);
}

async function saveProfile(user, patch, context = {}) {
  const nowIso = new Date().toISOString();
  if (!mongo.configured()) {
    throw new errors.ServiceUnavailableError(
      'Profiles are unavailable: MONGODB_URI is not configured on the server',
    );
  }
  const profiles = await mongo.profileCollection();
  await profiles.updateOne(
    { _id: user.public_id },
    {
      $set: {
        email: user.email,
        displayName: patch.displayName,
        bio: patch.bio,
        avatarColor: patch.avatarColor,
        updatedAt: nowIso,
      },
      $setOnInsert: { createdAt: nowIso },
    },
    { upsert: true },
  );
  audit.record({
    actorUserId: user.id,
    action: 'profile.update',
    targetType: 'profile',
    targetId: user.public_id,
    requestId: context.requestId,
  });
  return {
    ...patch,
    email: user.email,
    updatedAt: nowIso,
  };
}

module.exports = { getProfile, saveProfile };
