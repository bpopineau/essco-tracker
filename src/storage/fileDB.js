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
  try {
    if (!hasFSAccess) return false;
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
    const req = indexedDB.open(DB, 2); // bump version when schema changes
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const oldVersion = e.oldVersion || 0;
      // Create store if missing
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      } else {
        // Migration path: preserve and migrate records if new fields are added
        // (future-proof: add migration logic here for new fields)
        if (oldVersion < req.target.result.version) {
          const _store = req.transaction.objectStore(STORE);
          // Example: migrate records to add new fields with defaults
          // store.openCursor().onsuccess = function(event) {
          //   const cursor = event.target.result;
          //   if (cursor) {
          //     const value = cursor.value;
          //     // Add new fields if missing
          //     if (value.newField === undefined) value.newField = defaultValue;
          //     cursor.update(value);
          //     cursor.continue();
          //   }
          // };
        }
      }
      // Future migrations
      if (oldVersion < 2) {
        // example: add indexes, migrate fields without clearing
        const _store = req.transaction.objectStore(STORE);
        // store.createIndex('name', 'name', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
    req.onblocked = () => {
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
    if (!handle?.queryPermission) return true;
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
async function putHandle(handle) {
  const db = await open();
  const id = crypto.randomUUID();
  const record = await makeRecord(id, handle);
  await idbPut(tx(db, 'readwrite'), record);
  return id;
}

async function getHandle(id) {
  const db = await open();
  const rec = await idbGet(tx(db, 'readonly'), id);
  if (!rec) return null;
  return rec.handle ?? null;
}

async function getMeta(id) {
  const db = await open();
  const rec = await idbGet(tx(db, 'readonly'), id);
  if (!rec) return null;
  let stale = !rec.handle || !available();
  if (!stale && rec.handle) {
    if (!(await hasPermission(rec.handle, 'read'))) stale = true;
  }
  const { name, kind, type = null, size = null, lastModified = null, addedAt = null } = rec;
  return { id: rec.id, name, kind, type, size, lastModified, addedAt, stale };
}

async function delHandle(id) {
  const db = await open();
  await idbDelete(tx(db, 'readwrite'), id);
}

async function putHandleForKey(key, handle) {
  const db = await open();
  const record = await makeRecord(key, handle);
  await idbPut(tx(db, 'readwrite'), record);
  return key;
}
async function getHandleForKey(key) { return getHandle(key); }
async function delHandleForKey(key) { return delHandle(key); }

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

async function list() {
  const db = await open();
  const all = await idbAll(tx(db, 'readonly'));
  const result = [];
  for (const rec of all) {
    let stale = !rec.handle || !available();
    if (!stale && rec.handle) {
      if (!(await hasPermission(rec.handle, 'read'))) stale = true;
    }
    const { id, name, kind, type = null, size = null, lastModified = null, addedAt = null } = rec;
    result.push({ id, name, kind, type, size, lastModified, addedAt, stale });
  }
  return result;
}

async function getFile(id) {
  const handle = await getHandle(id);
  if (!handle || handle.kind !== 'file') return null;
  if (!(await ensurePermission(handle, 'read'))) return null;
  try {
    return await handle.getFile();
  } catch (err) {
    console.warn(`[fileDB] getFile failed for ${id}:`, err);
    return null;
  }
}

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
      handle = await window.chooseFileSystemEntries({ type: kind === 'directory' ? 'open-directory' : 'open-file' });
    }

    if (!handle) return null;

    const updated = await makeRecord(id, handle);
    await idbPut(tx(db, 'readwrite'), updated);

    const { name, type = null, size = null, lastModified = null, addedAt = null } = updated;
    return { id, name, kind: updated.kind, type, size, lastModified, addedAt, stale: false };
  } catch (err) {
    console.warn(`[fileDB] Relink failed for ${id}:`, err);
    return null;
  }
}

function available() {
  return hasFSAccess && canCloneHandle;
}

// ---- Internal helpers ----
async function makeRecord(id, handle) {
  const meta = await extractMeta(handle);
  if (hasFSAccess && canCloneHandle && handle) {
    try {
      return { id, handle, ...meta, addedAt: Date.now() };
    } catch (err) {
      console.warn(`[fileDB] Structured clone failed for ${id}, storing metadata only:`, err);
      return { id, handle: null, ...meta, addedAt: Date.now() };
    }
  }
  return { id, handle: null, ...meta, addedAt: Date.now() };
}

async function extractMeta(handle) {
  const kind = typeof handle?.kind === 'string' ? handle.kind : 'file';
  const name = typeof handle?.name === 'string' ? handle.name : (kind === 'directory' ? 'folder' : 'file');
  let type = null, size = null, lastModified = null;

  if (kind === 'file') {
    try {
      if (handle && typeof handle.getFile === 'function') {
        const file = await handle.getFile();
        type = file.type || null;
        size = typeof file.size === 'number' ? file.size : null;
        lastModified = typeof file.lastModified === 'number' ? file.lastModified : null;
      }
    } catch (err) {
      console.warn('[fileDB] extractMeta failed to get file metadata:', err);
    }
  }

  return { name, kind, type, size, lastModified };
}

export const fileDB = {
  putHandle,
  getHandle,
  delHandle,
  putHandleForKey,
  getHandleForKey,
  delHandleForKey,
  clearAll,
  available,
  getMeta,
  list,
  getFile,
  relink,
  ensurePermission
};

export { DB, STORE };
