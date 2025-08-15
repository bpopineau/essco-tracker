// src/storage.js

const STORAGE_KEY = 'essco_tracker_db_v1';
let saveTimer = null;

// Optional persistence filter (set via configure/attachAutosave)
//   (state) => prunedState
let persistFilter = null;

// Serialize safely with optional filter
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

export const storage = {
  /**
   * Load snapshot from localStorage, seeding with provided schema if empty/broken.
   * If version or dev_seed changed, prefer the schema (schema wins over stored data).
   * Provides a hook for future migrations via storage.migrate().
   */
  async load(schema) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
        return typeof structuredClone === 'function' ? structuredClone(schema) : safeParse(JSON.stringify(schema), schema);
      }

      const parsed = safeParse(raw, {});
      // If version OR dev_seed flips, prefer the new schema.
      const needsReplace =
        parsed.version !== schema.version ||
        parsed.dev_seed !== schema.dev_seed;

      if (needsReplace) {
        // Schema wins: ensures dev→prod clears sample data; prod→dev loads samples.
        // Keep behavior consistent with your previous implementation.
        const merged = { ...parsed, ...schema };
        // Allow a migration step (no-op by default)
        const migrated = this.migrate ? this.migrate(merged, parsed.version ?? 1) : merged;

        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }

      // If versions match, still allow light migration (future-proof)
      const stable = this.migrate ? this.migrate(parsed, parsed.version ?? 1) : parsed;
      return stable;
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
      return typeof structuredClone === 'function' ? structuredClone(schema) : safeParse(JSON.stringify(schema), schema);
    }
  },

  /**
   * Debounced save. Updates #saveStatus if present.
   */
  save(state) {
    if (saveTimer) clearTimeout(saveTimer);
    const ss = document.getElementById('saveStatus');
    if (ss) ss.textContent = 'Saving…';

    saveTimer = setTimeout(() => {
      idle(() => {
        try {
          localStorage.setItem(STORAGE_KEY, serialize(state));
          const el = document.getElementById('saveStatus');
          if (el) el.textContent = 'All changes saved';
        } catch (err) {
          const el = document.getElementById('saveStatus');
          if (el) el.textContent = 'Save error';
          // eslint-disable-next-line no-console
          console.error('[storage] save error:', err);
        }
      });
    }, 250);
  },

  /**
   * Immediate save (no debounce). Handy for import/replace/reset flows.
   */
  saveNow(state) {
    if (saveTimer) clearTimeout(saveTimer);
    try {
      localStorage.setItem(STORAGE_KEY, serialize(state));
      const el = document.getElementById('saveStatus');
      if (el) el.textContent = 'All changes saved';
    } catch (err) {
      const el = document.getElementById('saveStatus');
      if (el) el.textContent = 'Save error';
      // eslint-disable-next-line no-console
      console.error('[storage] saveNow error:', err);
    }
  },

  /**
   * Export current state as prettified JSON (respects persistFilter if set).
   */
  exportJSON(state) {
    const blob = new Blob([JSON.stringify(persistFilter ? persistFilter(state) : state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const ymd = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `essco-tracker-${ymd}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  },

  /**
   * Import a JSON snapshot from a File/Blob.
   * Options:
   *  - strategy: 'merge' (default) shallow merges into current; 'replace' overwrites all.
   *  - after: (merged) => void   callback once localStorage is updated.
   */
  async importJSON(file, opts = {}) {
    const { strategy = 'merge', after } = opts;
    const text = await file.text();
    const incoming = safeParse(text, {});
    const current = safeParse(localStorage.getItem(STORAGE_KEY) || '{}', {});

    // Optionally allow a migration step for incoming data
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

  /**
   * Provide a migration hook. No-op by default.
   * @param {object} snapshot - candidate state
   * @param {number|string} fromVersion - version number read from snapshot
   * @returns {object} migrated snapshot
   */
  migrate(snapshot /* , fromVersion */) {
    // Example scaffold (leave empty for now):
    // if (Number(fromVersion) < 2) { snapshot.newField ??= []; }
    return snapshot;
  },

  /**
   * Configure persistence behavior.
   *  - persistFilter: (state) => prunedState (e.g., delete state.ui)
   */
  configure({ persistFilter: filter } = {}) {
    persistFilter = typeof filter === 'function' ? filter : null;
  },

  /**
   * Connect autosave to the store with ignore rules.
   *  - options.debounce: ms (default 300)
   *  - options.ignoreKeysPrefix: ['ui'] (skip emits that only touch these top-level keys)
   *  - options.persistFilter: (state) => prunedState
   */
  attachAutosave(store, options = {}) {
    const {
      debounce = 300,
      ignoreKeysPrefix = ['ui'],
      persistFilter: filter
    } = options;

    if (filter) this.configure({ persistFilter: filter });

    let timer = null;
    return store.subscribe((state, changedKeys = []) => {
      // If all changed keys are ignorable, skip
      if (
        ignoreKeysPrefix.length &&
        changedKeys.length &&
        changedKeys.every((k) => ignoreKeysPrefix.some((p) => k === p || k.startsWith(p + '.')))
      ) {
        return;
      }

      if (timer) clearTimeout(timer);
      const ss = document.getElementById('saveStatus');
      if (ss) ss.textContent = 'Saving…';
      timer = setTimeout(() => this.save(state), debounce);
    });
  }
};

export { STORAGE_KEY };
