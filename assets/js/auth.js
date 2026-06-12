// Auth helpers — sign in, sign out, redirect guards.
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { auth, AUTH_DOMAIN_SUFFIX } from './firebase-config.js';

/**
 * Sign in by username. Internally we attach a fixed domain suffix so the
 * underlying auth provider sees a valid identifier — the suffix is never shown
 * to the user.
 */
export function signIn(username, password) {
  const u = String(username || '').trim().toLowerCase();
  const id = u.includes('@') ? u : u + AUTH_DOMAIN_SUFFIX;
  return signInWithEmailAndPassword(auth, id, password);
}
export const signOut = () => fbSignOut(auth);
export const subscribeAuth = (cb) => onAuthStateChanged(auth, cb);

/**
 * Re-authenticate then update the current user's password.
 */
export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

/** Strip the internal suffix so we can display just the username. */
export function displayUsername(idOrEmail) {
  const s = String(idOrEmail || '');
  return s.endsWith(AUTH_DOMAIN_SUFFIX) ? s.slice(0, -AUTH_DOMAIN_SUFFIX.length) : s;
}

/**
 * Redirect-guard for dashboard pages.
 * Returns a Promise that resolves once a signed-in user is known, otherwise
 * navigates to login.html. Rejects with Error('auth_timeout') if Firebase
 * does not respond within timeoutMs (default 10 s).
 */
export function requireAuth({ redirectTo = 'login.html', timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub();
      reject(new Error('auth_timeout'));
    }, timeoutMs);

    const unsub = onAuthStateChanged(auth, (user) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      if (user) resolve(user);
      else window.location.replace(redirectTo);
    });
  });
}
