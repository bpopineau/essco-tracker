// src/store.js
export function createStore(initial) {
  let state = structuredClone(initial);
  const subs = [];

  function get() { return state; }

  function set(patch) {
    const changed = [];
    for (const [k, v] of Object.entries(patch)) {
      const before = state[k];
      if (typeof v === 'object' && v && !Array.isArray(v)) {
        state[k] = { ...before, ...v };
      } else {
        state[k] = v;
      }
      changed.push(k);
    }
    emit(changed);
  }

  function update(fn) {
    const next = fn(structuredClone(state));
    set(next);
  }

  function subscribe(fn) {
    subs.push(fn);
    return () => {
      const i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  function emit(changedKeys = Object.keys(state)) {
    subs.forEach(fn => fn(state, changedKeys));
  }

  return { get, set, update, subscribe, emit };
}
