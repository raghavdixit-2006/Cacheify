/** Profile service wrappers: the data the user saves on their profile page. */

import { api } from './api.js';

export function getProfile() {
  return api.get('/api/profile');
}

export function saveProfile(patch) {
  return api.put('/api/profile', patch);
}

export function getCommandUsage() {
  return api.get('/api/profile/command-usage');
}
