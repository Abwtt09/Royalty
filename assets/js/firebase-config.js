// Firebase Web SDK initialization — VIREA
// Uses the v10 modular SDK loaded from gstatic CDN (see <script type="module"> in HTML).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyAEFm83gIzL9DXDNd-H1fWvzVZR9M1X4bw',
  authDomain: 'virea-fa2f8.firebaseapp.com',
  projectId: 'virea-fa2f8',
  storageBucket: 'virea-fa2f8.firebasestorage.app',
  messagingSenderId: '384216970684',
  appId: '1:384216970684:web:0c5feeaf8ebfa393e327b9',
  measurementId: 'G-44MTYPS10X',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Persistent offline cache — subsequent page loads serve data from IndexedDB
// immediately while syncing fresh data in the background.
//
// Uses persistentSingleTabManager (not MultipleTab) to avoid cross-tab
// IndexedDB lock contention on Firebase Hosting. With the multi-tab manager,
// if a previous session left an orphaned heartbeat in IndexedDB the new
// instance waits indefinitely for the lock, queuing every getDoc/onSnapshot
// call silently forever — the exact "stuck loading screen" bug.
// Single-tab manager never acquires a cross-tab lock, so initialization is
// instant and reliable on every page load.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});

// Secure asset endpoint (preset is unsigned so the secret stays on the server).
export const CLOUDINARY = {
  cloudName: 'dbyl89hl1',
  uploadPreset: 'Royalty_unsigned',
};

// Synthetic domain for username-based auth. Users type a plain username; the
// app appends this suffix so we can still use Firebase's email/password
// backend without exposing email semantics in the UI.
export const AUTH_DOMAIN_SUFFIX = '@royalty.local';
