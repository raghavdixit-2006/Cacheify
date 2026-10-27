'use strict';

/** Profile page data: what the user saves about themselves on the site.
    Stored in MongoDB (user's own NoSQL store), keyed by the account's
    stable public user id. Feature-gated on MONGODB_URI. */

const { z } = require('zod');

const saveSchema = z.strictObject({
  displayName: z.string().trim().max(80).default(''),
  bio: z.string().trim().max(500).default(''),
  avatarColor: z.string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #ef4444')
    .default('#ef4444'),
});

module.exports = { saveSchema };
