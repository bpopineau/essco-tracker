// src/storage/fileDB.js
// IndexedDB-backed storage for FileSystemHandles
const DB = 'essco_fs';
const STORE = 'handles';

function open() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => res(e.target.result);
    req.onerror = () => rej(req.error);
  });
}

async function putHandle(handle) {
  const db = await open();
  const id = crypto.randomUUID();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id, handle });
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  return id;
}

async function getHandle(id) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(id);
    rq.onsuccess = () => res(rq.result?.handle || null);
    rq.onerror = () => rej(rq.error);
  });
}

async function delHandle(id) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

// Optional key-based helpers (handy for future “backupDir” etc.)
async function putHandleForKey(key, handle) {
  const db = await open();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: key, handle });
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  return key;
}
async function getHandleForKey(key) { return getHandle(key); }
async function delHandleForKey(key) { return delHandle(key); }

export const fileDB = {
  putHandle,
  getHandle,
  delHandle,
  putHandleForKey,
  getHandleForKey,
  delHandleForKey
};
