// src/storage/fileDB.js
// IndexedDB-backed storage for FileSystemHandles (when supported).
// Falls back to storing lightweight metadata if the File System Access API
// or structured-clone of handles isn’t available (e.g., Firefox, older Safari).

const DB = 'essco_fs';
const STORE = 'handles';

// ---- Capability detection ----
const hasFSAccess =
  typeof window !== 'undefined' &&
  ('showOpenFilePicker' in window || 'chooseFileSystemEntries' in window);

const canCloneHandle = (() => {
  // Some browsers claim support but can’t structured-clone handles into IDB.
  // We detect minimally by trying a postMessage clone to a MessageChannel.
  try {
    if (!hasFSAccess) return false;
    const mc = new MessageChannel();
    const port = mc.port1;
    // We can’t create a handle without user gesture, so this is best-effort:
    // assume true; browsers that really can’t clone usually fail at put() time.
    port.postMessage({ ok: true });
    port.close();
    mc.port2.close();
    return true;
  } catch {
    return false;
  }
})();

// ---- IndexedDB helpers (with cached connection) ----
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    // Guard: some environments disable IDB (Safari private mode).
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      // Auto-close on versionchange so we don’t block upgrades
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
    req.onblocked = () => {
      // Not fatal; leave resolve pending so caller can retry later if desired.
      // Most apps will just continue using the previous version until reload.
      console.warn('[fileDB] IndexedDB open blocked; reload might be needed');
    };
  });
  return dbPromise;
}

function tx(db, mode = 'readonly') {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function idbPut(store, value) {
  return new Promise((res, rej) => {
    const rq = store.put(value);
    rq.onsuccess = () => res();
    rq.onerror = () => rej(rq.error);
  });
}

function idbGet(store, key) {
  return new Promise((res, rej) => {
    const rq = store.get(key);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}

function idbDelete(store, key) {
  return new Promise((res, rej) => {
    const rq = store.delete(key);
    rq.onsuccess = () => res();
    rq.onerror = () => rej(rq.error);
  });
}

// ---- Public API ----
// Stores a FileSystemHandle when possible; otherwise stores a lightweight stub.
// Returns the generated id.
async function putHandle(handle) {
  const db = await open();

  const id = crypto.randomUUID();
  const record = makeRecord(id, handle);
  await idbPut(tx(db, 'readwrite'), record);
  return id;
}

// Retrieves the previously stored handle (or null if unavailable).
// If running in a non-supporting browser, this returns null; you can still
// inspect metadata by calling getMeta(id) if you add such a method later.
async function getHandle(id) {
  const db = await open();
  const rec = await idbGet(tx(db, 'readonly'), id);
  if (!rec) return null;
  // Only return a real handle if we stored one
  return rec.handle ?? null;
}

async function delHandle(id) {
  const db = await open();
  await idbDelete(tx(db, 'readwrite'), id);
}

// Optional key-based helpers (e.g., a pinned directory)
async function putHandleForKey(key, handle) {
  const db = await open();
  const record = makeRecord(key, handle);
  await idbPut(tx(db, 'readwrite'), record);
  return key;
}
async function getHandleForKey(key) { return getHandle(key); }
async function delHandleForKey(key) { return delHandle(key); }

// Utility: wipe all stored handles (not typically used in app flow)
async function clearAll() {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    const rq = store.clear();
    rq.onsuccess = () => res();
    rq.onerror = () => rej(rq.error);
  });
}

// Returns whether the environment can store and retrieve real FileSystemHandles.
function available() {
  return hasFSAccess && canCloneHandle;
}

// ---- Internal helpers ----
function makeRecord(id, handle) {
  // If FS Access or structured-clone is not available, store only metadata.
  // This keeps UI counts/names working, but open() will be null.
  const meta = extractMeta(handle);
  if (hasFSAccess && canCloneHandle && handle) {
    try {
      // Rely on browser to structured-clone the FileSystemHandle into IDB
      return { id, handle, name: meta.name, kind: meta.kind };
    } catch {
      // Fallback to metadata-only record
      return { id, handle: null, name: meta.name, kind: meta.kind };
    }
  }
  return { id, handle: null, name: meta.name, kind: meta.kind };
}

function extractMeta(handle) {
  // Safely derive a display name/kind from the handle if present
  const name = typeof handle?.name === 'string' ? handle.name : 'file';
  const kind = typeof handle?.kind === 'string' ? handle.kind : 'file';
  return { name, kind };
}

export const fileDB = {
  putHandle,
  getHandle,
  delHandle,
  putHandleForKey,
  getHandleForKey,
  delHandleForKey,
  clearAll,
  available
};
