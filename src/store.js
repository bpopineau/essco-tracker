// src/store.js
const hasStructuredClone = typeof structuredClone === 'function';
const clone = (v) => (hasStructuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

let debugMode = false;
export function enableDebug(flag = true) { debugMode = flag; }

/** shallow equality for plain objects */
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

export function createStore(initial, { undoDepth = 0 } = {}) {
  let initialState = clone(initial);
  let state = clone(initial);
  const subs = new Set();

  let pendingKeys = new Set();
  let flushQueued = false;
  let inBatch = false;

  let lastChangedKeys = [];
  let undoStack = [];
  let redoStack = [];

  function get() { return state; }
  function getLastChangedKeys() { return [...lastChangedKeys]; }

  // Helper function to validate patch input
  function validatePatch(patch) {
    return patch && typeof patch === 'object';
  }

  // Helper function to compare current state and new state
  function compareState(before, next) {
    return isPlainObject(before) && isPlainObject(next)
      ? shallowEqual(before, next)
      : Object.is(before, next);
  }

  // Helper function to apply patch value to existing state
  function applyPatch(currentValue, newValue) {
    if (isPlainObject(newValue) && isPlainObject(currentValue)) {
      return { ...currentValue, ...newValue };
    } else if (isPlainObject(newValue) && !isPlainObject(currentValue)) {
      return { ...newValue };
    } else {
      return newValue;
    }
  }

  // Helper function to detect changes and update pending keys
  function detectAndRecordChanges(key, before, next) {
    const isSame = compareState(before, next);
    if (!isSame) {
      state[key] = next;
      pendingKeys.add(key);
      return true;
    }
    return false;
  }

  function set(patch, opts = {}) {
    if (!validatePatch(patch)) return;

    let changed = false;
    if (undoDepth > 0 && !opts.silent) pushUndo();

    for (const [k, v] of Object.entries(patch)) {
      const before = state[k];
      const next = applyPatch(before, v);

      if (detectAndRecordChanges(k, before, next)) {
        changed = true;
      }
    }

    if (changed) {
      if (debugMode) console.log('[store] changed keys:', [...pendingKeys]);
      if (!opts.silent) scheduleFlush();
    }
  }

  function update(fn, opts) {
    const draft = clone(state);
    const patch = fn(draft) || {};
    set(patch, opts);
  }

  function replace(next, opts = {}) {
    if (undoDepth > 0 && !opts.silent) pushUndo();
    const nextState = clone(next) || {};
    const allKeys = new Set([...Object.keys(state), ...Object.keys(nextState)]);
    state = nextState;
    allKeys.forEach((k) => pendingKeys.add(k));
    if (debugMode) console.log('[store] replace all keys:', [...pendingKeys]);
    if (!opts.silent) scheduleFlush();
  }

  function reset(opts = {}) {
    replace(initialState, opts);
  }

  function subscribe(fn, deps) {
    const sub = { fn, deps };
    subs.add(sub);
    return () => subs.delete(sub);
  }

  function emit(changedKeys = Object.keys(state)) {
    dispatch(Array.from(new Set(changedKeys)));
  }

  function batch(run) {
    if (inBatch) return run();
    inBatch = true;
    try { run(); }
    finally {
      inBatch = false;
      scheduleFlush();
    }
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(clone(state));
    const prev = undoStack.pop();
    state = prev;
    pendingKeys = new Set(Object.keys(state));
    scheduleFlush();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(clone(state));
    const next = redoStack.pop();
    state = next;
    pendingKeys = new Set(Object.keys(state));
    scheduleFlush();
  }

  function pushUndo() {
    undoStack.push(clone(state));
    if (undoStack.length > undoDepth) undoStack.shift();
    redoStack.length = 0; // clear redo stack
  }

  function scheduleFlush() {
    if (inBatch) return;
    if (flushQueued) return;
    flushQueued = true;
    Promise.resolve().then(flush);
  }

  function flush() {
    if (!flushQueued) return;
    flushQueued = false;
    if (pendingKeys.size === 0) return;
    lastChangedKeys = Array.from(pendingKeys);
    pendingKeys.clear();
    dispatch(lastChangedKeys);
  }

  function dispatch(changedKeys) {
    subs.forEach(({ fn, deps }) => {
      try {
        if (!deps) {
          fn(state, changedKeys);
        } else if (Array.isArray(deps)) {
          if (changedKeys.some((k) => deps.includes(k))) fn(state, changedKeys);
        } else if (typeof deps === 'function') {
          if (deps(state, changedKeys)) fn(state, changedKeys);
        } else {
          fn(state, changedKeys);
        }
      } catch (err) {
        console.error('[store] subscriber error:', err);
      }
    });
  }

  return {
    get, set, update, subscribe, emit, replace, reset, batch,
    undo, redo, getLastChangedKeys
  };
}
