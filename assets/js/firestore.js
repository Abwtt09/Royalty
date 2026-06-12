// Firestore data layer — properties, projects, contacts.
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase-config.js';

/* ───────────────────────── properties ───────────────────────── */

export async function createProperty(data) {
  const ref = await addDoc(collection(db, 'properties'), {
    ...data,
    createdAt: Date.now(),
  });
  return ref.id;
}

export const updateProperty = (id, data) =>
  updateDoc(doc(db, 'properties', id), { ...data, updatedAt: Date.now() });

export const deleteProperty = (id) => deleteDoc(doc(db, 'properties', id));

export async function getProperty(id) {
  const snap = await getDoc(doc(db, 'properties', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listProperties(opts = {}) {
  const constraints = [orderBy('createdAt', 'desc')];
  if (opts.status) constraints.push(where('status', '==', opts.status));
  if (opts.category) constraints.push(where('category', '==', opts.category));
  if (opts.featured !== undefined) constraints.push(where('featured', '==', opts.featured));
  if (opts.max) constraints.push(limit(opts.max));
  const snap = await getDocs(query(collection(db, 'properties'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Live subscription — calls cb(properties[]) every time the data changes. */
export function watchProperties(cb, onErr) {
  const q = query(collection(db, 'properties'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => { cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
    onErr || ((e) => console.error('[watchProperties]', e.message)),
  );
}

export function watchAttachments(cb, onErr) {
  const q = query(collection(db, 'attachments'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => { cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
    onErr || ((e) => console.error('[watchAttachments]', e.message)),
  );
}

export function watchLogs(cb, max = 8, onErr) {
  const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(max));
  return onSnapshot(
    q,
    (snap) => { cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
    onErr || ((e) => console.error('[watchLogs]', e.message)),
  );
}

/** Live message inbox (direct + broadcast, merged + sorted client-side). */
export function watchMessagesForUser(uid, cb, onErr) {
  let direct = [];
  let broadcast = [];
  const merge = () => {
    const seen = new Map();
    for (const m of [...direct, ...broadcast]) seen.set(m.id, m);
    const out = Array.from(seen.values());
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(out);
  };
  const errHandler = onErr || ((e) => console.error('[watchMessages]', e.message));
  const unsubA = onSnapshot(
    query(collection(db, 'messages'), where('toUids', 'array-contains', uid)),
    (snap) => { direct = snap.docs.map((d) => ({ id: d.id, ...d.data() })); merge(); },
    errHandler,
  );
  const unsubB = onSnapshot(
    query(collection(db, 'messages'), where('toAll', '==', true)),
    (snap) => { broadcast = snap.docs.map((d) => ({ id: d.id, ...d.data() })); merge(); },
    errHandler,
  );
  return () => { unsubA(); unsubB(); };
}

/* ───────────────────────── projects ───────────────────────── */

export async function createProject(data) {
  const ref = await addDoc(collection(db, 'projects'), { ...data, createdAt: Date.now() });
  return ref.id;
}

export const updateProject = (id, data) => updateDoc(doc(db, 'projects', id), data);
export const deleteProject = (id) => deleteDoc(doc(db, 'projects', id));

export async function getProject(id) {
  const snap = await getDoc(doc(db, 'projects', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listProjects(max) {
  const constraints = [orderBy('createdAt', 'desc')];
  if (max) constraints.push(limit(max));
  const snap = await getDocs(query(collection(db, 'projects'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ───────────────────────── internal staff messaging ───────────────────────── */

/**
 * Send a message from the current user to a set of recipients.
 *   { fromUid, fromName, subject, body, toUids: [uid], toAll: bool,
 *     channels: { email: bool, sms: bool }, recipientsSummary: string }
 * Each message stores a `readBy` map ({ uid: timestamp }) updated by the
 * recipient's client when they open it.
 */
export async function sendMessage(data) {
  const ref = await addDoc(collection(db, 'messages'), {
    ...data,
    readBy: {},
    createdAt: Date.now(),
  });
  return ref.id;
}

/** Inbox: all messages the given user can read (addressed to them OR to all). */
export async function listMessagesForUser(uid) {
  // Two queries — direct + broadcast — merged client-side.
  const direct = await getDocs(
    query(collection(db, 'messages'), where('toUids', 'array-contains', uid)),
  );
  const broadcast = await getDocs(
    query(collection(db, 'messages'), where('toAll', '==', true)),
  );
  const seen = new Set();
  const out = [];
  for (const d of [...direct.docs, ...broadcast.docs]) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push({ id: d.id, ...d.data() });
  }
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

/** Sent: messages I authored. */
export async function listMessagesSentBy(uid) {
  const snap = await getDocs(
    query(collection(db, 'messages'), where('fromUid', '==', uid), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function markMessageRead(id, uid) {
  return updateDoc(doc(db, 'messages', id), { [`readBy.${uid}`]: Date.now() });
}

export const deleteMessage = (id) => deleteDoc(doc(db, 'messages', id));

/* ───────────────────────── taxonomy ───────────────────────── */

const TAXONOMY_COLLECTIONS = new Set(['locations', 'features', 'amenities', 'types', 'categories']);

function assertTaxonomyCollection(name) {
  if (!TAXONOMY_COLLECTIONS.has(name)) throw new Error(`Unknown taxonomy collection: ${name}`);
}

export async function listTaxonomy(collectionName) {
  assertTaxonomyCollection(collectionName);
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const setTaxonomy = (collectionName, slug, name) => {
  assertTaxonomyCollection(collectionName);
  return setDoc(doc(db, collectionName, slug), { name, slug });
};

export const deleteTaxonomy = (collectionName, id) => {
  assertTaxonomyCollection(collectionName);
  return deleteDoc(doc(db, collectionName, id));
};

/* ───────────────────────── users / profile ───────────────────────── */

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function listUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const setUserProfile = (uid, data) =>
  setDoc(doc(db, 'users', uid), data, { merge: true });

export const updateUserRole = (uid, role) =>
  updateDoc(doc(db, 'users', uid), { role });

export const deleteUser = (uid) => deleteDoc(doc(db, 'users', uid));

/**
 * Soft-disable a user. They stay in the auth provider (so we don't need the
 * Admin SDK), but the dashboard kicks them out the next time they try to load.
 */
export const disableUser = (uid) => updateDoc(doc(db, 'users', uid), { disabled: true });
export const enableUser  = (uid) => updateDoc(doc(db, 'users', uid), { disabled: false });

/* ───────────────────────── attachments (docs, contracts, letters) ───────────────────────── */

export async function listAttachments() {
  const snap = await getDocs(query(collection(db, 'attachments'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAttachment(data) {
  const ref = await addDoc(collection(db, 'attachments'), { ...data, createdAt: Date.now() });
  return ref.id;
}

export const deleteAttachment = (id) => deleteDoc(doc(db, 'attachments', id));

/* ───────────────────────── activity logs ───────────────────────── */

export async function logActivity({ action, targetType, targetId, userId, meta }) {
  try {
    await addDoc(collection(db, 'logs'), {
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      userId: userId ?? null,
      meta: meta ?? null,
      timestamp: Date.now(),
    });
  } catch (e) {
    // logging must never break the user flow
    console.warn('logActivity failed:', e.message);
  }
}

export async function listLogs(max = 20) {
  const snap = await getDocs(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ───────────────────────── property deed documents ───────────────────────── */

/**
 * Each property can have multiple deed/plan documents attached to it.
 * These live in a sub-collection propertyDocs/{docId} with:
 *   propertyId, title, docType (deed|plan|other), fileUrl, fileName,
 *   fileSize, extracted { parcelNo, ownerName, area, lat, lng, location },
 *   createdAt, createdBy
 */
export async function listPropertyDocs(propertyId) {
  const q = query(
    collection(db, 'propertyDocs'),
    where('propertyId', '==', propertyId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createPropertyDoc(data) {
  const ref = await addDoc(collection(db, 'propertyDocs'), {
    ...data,
    createdAt: Date.now(),
  });
  return ref.id;
}

export const deletePropertyDoc = (id) => deleteDoc(doc(db, 'propertyDocs', id));

export const updatePropertyDoc = (id, data) =>
  updateDoc(doc(db, 'propertyDocs', id), data);

/** Watch all docs for a property in real-time. */
export function watchPropertyDocs(propertyId, cb, onErr) {
  const q = query(
    collection(db, 'propertyDocs'),
    where('propertyId', '==', propertyId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onErr || ((e) => console.error('[watchPropertyDocs]', e.message)),
  );
}

/* ───────────────────────── property boundary ───────────────────────── */

/**
 * Save or clear the GeoJSON boundary polygon for a property.
 * source: 'extracted' | 'manual' | 'imported' | null
 */
export function updatePropertyBoundary(id, boundary, source) {
  const data = {
    boundary: boundary ?? null,
    boundarySource: source ?? null,
    updatedAt: Date.now(),
  };
  return updateDoc(doc(db, 'properties', id), data);
}

/* ───────────────────────── bulk property import ───────────────────────── */

/** Import an array of property objects in one batch. Returns array of created IDs. */
export async function importProperties(rows, userId) {
  const ids = [];
  for (const row of rows) {
    const ref = await addDoc(collection(db, 'properties'), {
      ...row,
      createdBy: userId,
      createdAt: Date.now(),
    });
    ids.push(ref.id);
  }
  return ids;
}
