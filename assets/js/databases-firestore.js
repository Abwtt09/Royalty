// Database builder — Firestore layer.
// Collections:
//   databases/{dbId}                → schema (name, description, icon, fields[])
//   databases/{dbId}/records/{id}   → dynamic records keyed by field IDs
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, limit, onSnapshot, writeBatch, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase-config.js';

export function genFieldId() {
  return 'fld_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ──────────────── Databases ──────────────── */

export async function createDatabase(data, userId) {
  const ref = await addDoc(collection(db, 'databases'), {
    name: data.name,
    description: data.description || '',
    category: data.category || '',
    icon: data.icon || 'database',
    fields: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: userId || null,
  });
  return ref.id;
}

export async function getDatabase(id) {
  const snap = await getDoc(doc(db, 'databases', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listDatabases() {
  const snap = await getDocs(query(collection(db, 'databases'), orderBy('createdAt', 'desc')));
  const dbs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  await Promise.all(
    dbs.map(async (database) => {
      try {
        const countSnap = await getCountFromServer(collection(db, 'databases', database.id, 'records'));
        database.recordCount = countSnap.data().count;
      } catch {
        database.recordCount = 0;
      }
    }),
  );
  return dbs;
}

export async function updateDatabase(id, data) {
  await updateDoc(doc(db, 'databases', id), { ...data, updatedAt: Date.now() });
}

export async function deleteDatabase(id) {
  const records = await getDocs(collection(db, 'databases', id, 'records'));
  const batch = writeBatch(db);
  records.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'databases', id));
  await batch.commit();
}

export function watchDatabase(id, cb, onErr) {
  return onSnapshot(
    doc(db, 'databases', id),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onErr || ((e) => console.error('[watchDatabase]', e.message)),
  );
}

/* ──────────────── Fields (stored inside database doc) ──────────────── */

export async function addField(dbId, field) {
  const dbRef = doc(db, 'databases', dbId);
  const snap = await getDoc(dbRef);
  if (!snap.exists()) throw new Error('Database not found');
  const fields = snap.data().fields || [];
  const newField = { ...field, id: genFieldId(), order: fields.length };
  await updateDoc(dbRef, { fields: [...fields, newField], updatedAt: Date.now() });
  return newField;
}

export async function updateField(dbId, fieldId, updates) {
  const dbRef = doc(db, 'databases', dbId);
  const snap = await getDoc(dbRef);
  if (!snap.exists()) throw new Error('Database not found');
  const fields = (snap.data().fields || []).map((f) => (f.id === fieldId ? { ...f, ...updates } : f));
  await updateDoc(dbRef, { fields, updatedAt: Date.now() });
}

export async function deleteField(dbId, fieldId) {
  const dbRef = doc(db, 'databases', dbId);
  const snap = await getDoc(dbRef);
  if (!snap.exists()) throw new Error('Database not found');
  const fields = (snap.data().fields || []).filter((f) => f.id !== fieldId);
  await updateDoc(dbRef, { fields, updatedAt: Date.now() });
}

/* ──────────────── Records ──────────────── */

export async function createRecord(dbId, data, userId) {
  const ref = await addDoc(collection(db, 'databases', dbId, 'records'), {
    ...data,
    _createdAt: Date.now(),
    _updatedAt: Date.now(),
    _createdBy: userId || null,
  });
  return ref.id;
}

export async function listRecords(dbId, opts = {}) {
  const constraints = [orderBy('_createdAt', 'asc')];
  if (opts.max) constraints.push(limit(opts.max));
  const snap = await getDocs(query(collection(db, 'databases', dbId, 'records'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateRecord(dbId, recordId, data) {
  await updateDoc(doc(db, 'databases', dbId, 'records', recordId), { ...data, _updatedAt: Date.now() });
}

export async function deleteRecord(dbId, recordId) {
  await deleteDoc(doc(db, 'databases', dbId, 'records', recordId));
}

export async function duplicateRecord(dbId, recordId, userId) {
  const snap = await getDoc(doc(db, 'databases', dbId, 'records', recordId));
  if (!snap.exists()) throw new Error('Record not found');
  // eslint-disable-next-line no-unused-vars
  const { id: _id, _createdAt, _updatedAt, _createdBy, ...data } = snap.data();
  return createRecord(dbId, data, userId);
}

export async function reorderFields(dbId, orderedFields) {
  const fields = orderedFields.map((f, i) => ({ ...f, order: i }));
  await updateDoc(doc(db, 'databases', dbId), { fields, updatedAt: Date.now() });
}

export async function importRecords(dbId, rows, userId) {
  const ids = [];
  const BATCH_SIZE = 400;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const row of chunk) {
      const ref = doc(collection(db, 'databases', dbId, 'records'));
      batch.set(ref, {
        ...row,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
        _createdBy: userId || null,
      });
      ids.push(ref.id);
    }
    await batch.commit();
  }
  return ids;
}
