// src/storage.js

const STORAGE_KEY = 'essco_tracker_db_v1';
let saveTimer = null;
let persistFilter = null;

// --- Simple event system for status changes ---
const statusListeners = new Set();
function emitStatus(status) {
  statusListeners.forEach(fn => {
    try { fn(status); } catch { /* noop */ }
  });
}

export const storage = {
  onStatusChange(fn) {
    if (typeof fn === 'function') statusListeners.add(fn);
    return () => statusListeners.delete(fn);
  },

  async load(schema) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
        return typeof structuredClone === 'function'
          ? structuredClone(schema)
          : safeParse(JSON.stringify(schema), schema);
      }

      const parsed = safeParse(raw, {});
      const needsReplace =
        parsed.version !== schema.version ||
        parsed.dev_seed !== schema.dev_seed;

      if (needsReplace) {
        const merged = { ...parsed, ...schema };
        const migrated = this.migrate ? this.migrate(merged, parsed.version ?? 1) : merged;
        console.info(`[storage] Schema replace. From version ${parsed.version} → ${schema.version}`);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }

      const stable = this.migrate ? this.migrate(parsed, parsed.version ?? 1) : parsed;
      return stable;
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
      return typeof structuredClone === 'function'
        ? structuredClone(schema)
        : safeParse(JSON.stringify(schema), schema);
    }
  },

  save(state) {
    if (saveTimer) clearTimeout(saveTimer);
    emitStatus('saving');
    const ss = document.getElementById('saveStatus');
    if (ss) ss.textContent = 'Saving…';

    saveTimer = setTimeout(() => {
      idle(() => {
        try {
          localStorage.setItem(STORAGE_KEY, serialize(state));
          emitStatus('idle');
          const el = document.getElementById('saveStatus');
          if (el) el.textContent = 'All changes saved';
        } catch (err) {
          emitStatus('error');
          const el = document.getElementById('saveStatus');
          if (el) el.textContent = 'Save error';
          console.error('[storage] save error:', err);
        }
      });
    }, 250);
  },

  saveNow(state) {
    if (saveTimer) clearTimeout(saveTimer);
    try {
      localStorage.setItem(STORAGE_KEY, serialize(state));
      emitStatus('idle');
      const el = document.getElementById('saveStatus');
      if (el) el.textContent = 'All changes saved';
    } catch (err) {
      emitStatus('error');
      const el = document.getElementById('saveStatus');
      if (el) el.textContent = 'Save error';
      console.error('[storage] saveNow error:', err);
    }
  },

  exportJSON(state) {
    const blob = new Blob(
      [JSON.stringify(persistFilter ? persistFilter(state) : state, null, 2)],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    const ymd = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `essco-tracker-${ymd}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  },

  async importJSON(file, opts = {}) {
    const { strategy = 'merge', after } = opts;
    const text = await file.text();
    const incoming = safeParse(text, {});
    const current = safeParse(localStorage.getItem(STORAGE_KEY) || '{}', {});

    const incomingVersion = incoming.version ?? 1;
    const preparedIncoming = this.migrate ? this.migrate(incoming, incomingVersion) : incoming;

    let merged;
    if (strategy === 'replace') {
      merged = preparedIncoming;
    } else {
      merged = { ...current, ...preparedIncoming, version: preparedIncoming.version ?? current.version ?? 1 };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    if (typeof after === 'function') after(merged);
    return merged;
  },

  migrate(snapshot, _fromVersion) {
    void _fromVersion;
    return snapshot;
  },

  configure(opts = {}) {
    const { persistFilter: filter } = opts;
    persistFilter = typeof filter === 'function' ? filter : null;
  },

  attachAutosave(store, options = {}) {
    const {
      debounce = 300,
      ignoreKeysPrefix = ['ui'],
      persistFilter: filter
    } = options;

    if (filter) this.configure({ persistFilter: filter });

    let timer = null;
    return store.subscribe((state, changedKeys = []) => {
      if (
        ignoreKeysPrefix.length &&
        changedKeys.length &&
        changedKeys.every((k) => ignoreKeysPrefix.some((p) => k === p || k.startsWith(p + '.')))
      ) {
        return;
      }

      if (timer) clearTimeout(timer);
      emitStatus('saving');
      const ss = document.getElementById('saveStatus');
      if (ss) ss.textContent = 'Saving…';
      timer = setTimeout(() => this.save(state), debounce);
    });
  }
};

// --- Helpers ---
function serialize(state) {
  const snapshot = typeof structuredClone === 'function'
    ? structuredClone(state)
    : JSON.parse(JSON.stringify(state));
  const toSave = persistFilter ? persistFilter(snapshot) : snapshot;
  return JSON.stringify(toSave);
}

function safeParse(str, fallback) {
  try { return JSON.parse(str); }
  catch { return fallback; }
}

function idle(cb) {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(cb, { timeout: 1000 });
  }
  return setTimeout(cb, 0);
}

export { STORAGE_KEY };
