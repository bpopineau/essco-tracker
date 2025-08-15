// src/storage/fileDB.js
// IndexedDB-backed storage for FileSystemHandles (when supported).
// Falls back to storing lightweight metadata if the File System Access API
// or structured-clone of handles isn’t available (e.g., Firefox, older Safari).

const DB = 'essco_fs';
const STORE = 'handles';

// ---- Capability detection ----
const hasFSAccess =
  typeof window !== 'undefined' &&
  ('showOpenFilePicker' in window || 'chooseFileSystemEntries' in window || 'showDirectoryPicker' in window);

const canCloneHandle = (() => {
  // Some browsers claim support but can’t structured-clone handles into IDB.
  // We can’t synthesize a handle without a user gesture, so this is best-effort.
  try {
    if (!hasFSAccess) return false;
    // If the browser supports File System Access APIs, assume clone works;
    // actual failure will be caught at put() time and we’ll fallback to metadata.
    const mc = new MessageChannel();
    mc.port1.postMessage({ ok: true });
    mc.port1.close(); mc.port2.close();
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
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
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
      db.onversionchange = () => db.close(); // don’t block upgrades
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
    req.onblocked = () => {
      // Not fatal; most apps will keep using the old connection until reload.
      // eslint-disable-next-line no-console
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

function idbAll(store) {
  return new Promise((res, rej) => {
    if ('getAll' in store) {
      const rq = store.getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => rej(rq.error);
    } else {
      // Safari fallback: cursor
      const out = [];
      const rq = store.openCursor();
      rq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { out.push(cursor.value); cursor.continue(); }
        else res(out);
      };
      rq.onerror = () => rej(rq.error);
    }
  });
}

// ---- Permission helpers ----
async function hasPermission(handle, mode = 'read') {
  try {
    if (!handle?.queryPermission) return true; // older impls → assume yes
    return (await handle.queryPermission({ mode })) === 'granted';
  } catch { return false; }
}

async function ensurePermission(handle, mode = 'read') {
  try {
    if (!handle) return false;
    if (!handle.requestPermission || !handle.queryPermission) return true;
    if (await hasPermission(handle, mode)) return true;
    return (await handle.requestPermission({ mode })) === 'granted';
  } catch { return false; }
}

// ---- Public API ----
// Stores a FileSystemHandle when possible; otherwise stores a lightweight stub.
// Returns the generated id.
async function putHandle(handle) {
  const db = await open();

  const id = crypto.randomUUID();
  const record = await makeRecord(id, handle);
  await idbPut(tx(db, 'readwrite'), record);
  return id;
}

// Retrieves the previously stored handle (or null if unavailable).
async function getHandle(id) {
  const db = await open();
  const rec = await idbGet(tx(db, 'readonly'), id);
  if (!rec) return null;
  return rec.handle ?? null;
}

// Simple metadata lookup (never returns the handle)
async function getMeta(id) {
  const db = await open();
  const rec = await idbGet(tx(db, 'readonly'), id);
  if (!rec) return null;
  // compute stale status on the fly
  const stale = !rec.handle || !available();
  const { name, kind, type = null, size = null, lastModified = null, addedAt = null } = rec;
  return { id: rec.id, name, kind, type, size, lastModified, addedAt, stale };
}

async function delHandle(id) {
  const db = await open();
  await idbDelete(tx(db, 'readwrite'), id);
}

// Optional key-based helpers (e.g., a pinned directory)
async function putHandleForKey(key, handle) {
  const db = await open();
  const record = await makeRecord(key, handle);
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

// List all records (no handles), useful for attachments UIs
async function list() {
  const db = await open();
  const all = await idbAll(tx(db, 'readonly'));
  return all.map((rec) => {
    const stale = !rec.handle || !available();
    const { id, name, kind, type = null, size = null, lastModified = null, addedAt = null } = rec;
    return { id, name, kind, type, size, lastModified, addedAt, stale };
  });
}

// Try to fetch a File object for a file handle (null if missing/denied)
async function getFile(id) {
  const handle = await getHandle(id);
  if (!handle || handle.kind !== 'file') return null;
  if (!(await ensurePermission(handle, 'read'))) return null;
  try {
    return await handle.getFile();
  } catch { return null; }
}

// Relink a missing/stale entry by prompting the user to pick a new file/dir
async function relink(id, opts = {}) {
  const db = await open();
  const rec = await idbGet(tx(db, 'readonly'), id);
  if (!rec) return null;
  if (!hasFSAccess) return null;

  const kind = opts.kind || rec.kind || 'file';

  try {
    let handle = null;
    if (kind === 'directory' && 'showDirectoryPicker' in window) {
      handle = await window.showDirectoryPicker(opts.pickerOptions || {});
    } else if ('showOpenFilePicker' in window) {
      const picks = await window.showOpenFilePicker(opts.pickerOptions || {});
      handle = picks && picks[0] ? picks[0] : null;
    } else if ('chooseFileSystemEntries' in window) {
      // Legacy (Chrome 80ish)
      handle = await window.chooseFileSystemEntries({ type: kind === 'directory' ? 'open-directory' : 'open-file' });
    }

    if (!handle) return null;

    const updated = await makeRecord(id, handle);
    await idbPut(tx(db, 'readwrite'), updated);

    // Return fresh metadata to caller
    const { name, type = null, size = null, lastModified = null, addedAt = null } = updated;
    return { id, name, kind: updated.kind, type, size, lastModified, addedAt, stale: false };
  } catch {
    return null;
  }
}

// Returns whether the environment can store and retrieve real FileSystemHandles.
function available() {
  return hasFSAccess && canCloneHandle;
}

// ---- Internal helpers ----
async function makeRecord(id, handle) {
  const meta = await extractMeta(handle);
  if (hasFSAccess && canCloneHandle && handle) {
    try {
      // Rely on browser to structured-clone the FileSystemHandle into IDB
      return { id, handle, ...meta, addedAt: Date.now() };
    } catch {
      // Fallback to metadata-only record
      return { id, handle: null, ...meta, addedAt: Date.now() };
    }
  }
  return { id, handle: null, ...meta, addedAt: Date.now() };
}

async function extractMeta(handle) {
  // Safely derive a display name/kind and light file metadata (if available)
  const kind = typeof handle?.kind === 'string' ? handle.kind : 'file';
  const name = typeof handle?.name === 'string' ? handle.name : (kind === 'directory' ? 'folder' : 'file');

  let type = null, size = null, lastModified = null;

  if (kind === 'file') {
    try {
      // If the handle can produce a File, capture cheap metadata for the UI
      if (handle && typeof handle.getFile === 'function') {
        const file = await handle.getFile();
        type = file.type || null;
        size = typeof file.size === 'number' ? file.size : null;
        lastModified = typeof file.lastModified === 'number' ? file.lastModified : null;
      }
    } catch {
      // ignore; metadata remains nulls
    }
  }

  return { name, kind, type, size, lastModified };
}

export const fileDB = {
  // existing
  putHandle,
  getHandle,
  delHandle,
  putHandleForKey,
  getHandleForKey,
  delHandleForKey,
  clearAll,
  available,

  // new helpers
  getMeta,
  list,
  getFile,
  relink,
  ensurePermission
};

export { DB, STORE };
