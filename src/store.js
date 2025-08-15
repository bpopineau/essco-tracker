
// src/store.js

// Small, dependency-free observable store with micro-batched emits.
// Backwards-compatible API: get, set, update, subscribe, emit.
// New helpers: replace, reset, batch, subscribe with deps/predicate.

const hasStructuredClone = typeof structuredClone === 'function';
const clone = (v) => (hasStructuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** shallow equality for plain objects (used to suppress no-op emits) */
function shallowEqual(a, b) {
  if (a === b) return true;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    const k = ak[i];
    if (!Object.prototype.hasOwnProperty.call(b, k) || a[k] !== b[k]) return false;
  }
  return true;
}

export function createStore(initial) {
  let initialState = clone(initial);
  let state = clone(initial);
  const subs = new Set(); // { fn, deps } where deps: undefined | string[] | (state, changedKeys)=>bool

  // micro-batch emit support
  let pendingKeys = new Set();
  let flushQueued = false;
  let inBatch = false;

  function get() { return state; }

  /**
   * set(patch, opts?)
   * - shallow-merges plain-object values into existing keys
   * - replaces arrays/primitives
   * - opts.silent: true → update state without notifying (use cautiously)
   */
  function set(patch, opts = {}) {
    if (!patch || typeof patch !== 'object') return;

    let changed = false;

    for (const [k, v] of Object.entries(patch)) {
      const before = state[k];

      let next;
      if (isPlainObject(v) && isPlainObject(before)) {
        next = { ...before, ...v };
      } else if (isPlainObject(v) && !isPlainObject(before)) {
        // avoid spreading undefined/null
        next = { ...v };
      } else {
        next = v;
      }

      // Suppress no-op changes (helps keep subscribers calm)
      const isSame = isPlainObject(before) && isPlainObject(next)
        ? shallowEqual(before, next)
        : Object.is(before, next);

      if (!isSame) {
        state[k] = next;
        pendingKeys.add(k);
        changed = true;
      }
    }

    if (changed && !opts.silent) scheduleFlush();
  }

  /**
   * update(fn) -> calls fn(clone(state)), expects a PATCH object back.
   * Keeps your existing calling convention.
   */
  function update(fn, opts) {
    const draft = clone(state);
    const patch = fn(draft) || {};
    set(patch, opts);
  }

  /**
   * Replace entire state in one shot (e.g., after import).
   * Emits once with union of keys.
   */
  function replace(next, opts = {}) {
    const nextState = clone(next) || {};
    const allKeys = new Set([...Object.keys(state), ...Object.keys(nextState)]);
    state = nextState;
    allKeys.forEach((k) => pendingKeys.add(k));
    if (!opts.silent) scheduleFlush();
  }

  /** Reset to the original initial state captured at store creation */
  function reset(opts = {}) {
    replace(initialState, opts);
  }

  /**
   * Subscribe to changes.
   * - subscribe(fn) → called on any emit
   * - subscribe(fn, ['tasks','projects']) → only when any of those keys change
   * - subscribe(fn, (state, changedKeys) => boolean) → custom predicate
   * Returns an unsubscribe function.
   */
  function subscribe(fn, deps) {
    const sub = { fn, deps };
    subs.add(sub);
    return () => subs.delete(sub);
  }

  /**
   * Emit now (mostly for internal/testing). If changedKeys omitted, notifies as if all keys changed.
   */
  function emit(changedKeys = Object.keys(state)) {
    // Direct emit bypasses batching
    dispatch(Array.from(new Set(changedKeys)));
  }

  /** Group multiple set()/update()/replace() calls into a single emit. */
  function batch(run) {
    if (inBatch) return run(); // nested batch
    inBatch = true;
    try { run(); }
    finally {
      inBatch = false;
      scheduleFlush();
    }
  }

  /* ---------------- internal ---------------- */

  function scheduleFlush() {
    if (inBatch) return; // let batch() end trigger the flush
    if (flushQueued) return;
    flushQueued = true;
    // microtask queue; Promise.then is widely supported
    Promise.resolve().then(flush);
  }

  function flush() {
    if (!flushQueued) return;
    flushQueued = false;

    if (pendingKeys.size === 0) return;
    const changed = Array.from(pendingKeys);
    pendingKeys.clear();

    dispatch(changed);
  }

  function dispatch(changedKeys) {
    // Notify all subscribers; honor deps filters
    subs.forEach(({ fn, deps }) => {
      try {
        if (!deps) {
          fn(state, changedKeys);
        } else if (Array.isArray(deps)) {
          // any intersection?
          if (changedKeys.some((k) => deps.includes(k))) fn(state, changedKeys);
        } else if (typeof deps === 'function') {
          if (deps(state, changedKeys)) fn(state, changedKeys);
        } else {
          // unknown deps type; default to notify
          fn(state, changedKeys);
        }
      } catch (err) {
        // Don't let one bad subscriber block others
        // eslint-disable-next-line no-console
        console.error('[store] subscriber error:', err);
      }
    });
  }

  return { get, set, update, subscribe, emit, replace, reset, batch };
}
