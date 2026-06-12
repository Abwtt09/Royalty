// Secondary Firebase app — lets an admin create new accounts without
// being signed out themselves. We provision the auth account on the
// secondary instance, then immediately sign it out there.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { firebaseConfig, AUTH_DOMAIN_SUFFIX } from './firebase-config.js';

// Named instance — completely isolated auth state from the primary app.
const secondaryApp = initializeApp(firebaseConfig, 'admin-secondary');
const secondaryAuth = getAuth(secondaryApp);

/**
 * Create a brand-new account by username + password. Returns the new UID.
 * The currently-signed-in admin's session is *not* affected.
 */
export async function createUserAccount(username, password) {
  const u = String(username || '').trim().toLowerCase();
  if (!u) throw new Error('Username required');
  const id = u.includes('@') ? u : u + AUTH_DOMAIN_SUFFIX;
  const cred = await createUserWithEmailAndPassword(secondaryAuth, id, password);
  const uid = cred.user.uid;
  // Immediately sign out of the secondary instance.
  try { await signOut(secondaryAuth); } catch {}
  return uid;
}
