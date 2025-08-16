# Action Plan (from "works ok" → "rock solid")

Replaced outdated dev flag with `DEV`. ✅

- Add lint + type checking (JS projects still).

```
npm i -D eslint prettier typescript @tsconfig/recommended @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

Add // @ts-check to key files and fix the easy warnings.

Done when: hooks fire on commit; lints pass; DEV toggles console logs & debug UI.

---

1) Service Worker: reliability & updates

Files: sw.js, src/main.js, index.html
- Navigation fallback (offline SPA works):

```
// sw.js (inside fetch)
if (event.request.mode === 'navigate') {
  event.respondWith((async () => {
    try { return await fetch(event.request); }
    catch {
      const cache = await caches.open(CACHE);
      return (await cache.match(INDEX)) || Response.error();
    }
  })());
  return;
}
```

- Cache strategy:
  - JS/CSS → network-first, fallback cache.
  - Icons/fonts → cache-first.
  - Delete old caches on activate; await clients.claim().
  - Update UX: in main.js, listen for SW updates and prompt:

```
navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
navigator.serviceWorker.register('/sw.js?v=' + BUILD_VERSION).then(reg => {
  if (reg.waiting) promptReload(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    sw?.addEventListener('statechange', () => {
      if (sw.state === 'installed' && reg.waiting) promptReload(reg.waiting);
    });
  });
});
function promptReload(worker){ showToast('Update available', 'Reload', () => worker.postMessage({type:'SKIP_WAITING'})); }
```

- Preload entry modules in index.html:

```
<link rel="modulepreload" href="./src/main.js">
```

Test: DevTools → Offline → reload; app shell loads and is usable. Trigger new build; you see “Update available” toast; clicking reload updates.

Done when: offline navigations work; stale caches are cleaned; update prompt works.

---

2) Persistence: move to IndexedDB (keep localStorage only for tiny UI prefs)

Files: src/storage/indexed.js (new), src/storage.js, src/schema.js, src/store.js
- Add a minimal IDB wrapper (no framework needed):

```
// src/storage/indexed.js
import { openDB } from 'idb'; // npm i idb
const DB_NAME = 'essco';
const DB_VER  = 1;
export const dbp = openDB(DB_NAME, DB_VER, {
  upgrade(db) {
    db.createObjectStore('projects', { keyPath: 'id' });
    db.createObjectStore('tasks',    { keyPath: 'id' }).createIndex('byProject','projectId');
    db.createObjectStore('notes',    { keyPath: 'id' }).createIndex('byProject','projectId');
    db.createObjectStore('meta');
  }
});
export async function put(store, value){ return (await dbp).put(store, value); }
export async function get(store, key){ return (await dbp).get(store, key); }
export async function all(store){ return (await dbp).getAll(store); }
export async function txWrite(fn){ const db = await dbp; const tx = db.transaction(['projects','tasks','notes','meta'],'readwrite'); await fn(tx); await tx.done; }
```

- Swap whole-state saves for per-entity saves.
  In your current storage.js, replace the blob localStorage.setItem('state', …) with a queue that writes only changed entities to the right store via txWrite.
- Boot sequence:
  1. Read UI prefs from localStorage (theme, last project, etc.).
  2. Load entities from IDB into memory store.
  3. If no IDB data but localStorage.state exists → run one-time migration below.
- One-time migration from localStorage:

```
// src/storage/migrate-local-to-idb.js
import { txWrite } from './indexed.js';
export async function migrateFromLocalStorage() {
  const raw = localStorage.getItem('state'); if (!raw) return false;
  const state = JSON.parse(raw);
  await txWrite(tx => {
    const p = tx.objectStore('projects'); state.projects.forEach(x=>p.put(x));
    const t = tx.objectStore('tasks');    state.tasks.forEach(x=>t.put(x));
    const n = tx.objectStore('notes');    state.notes.forEach(x=>n.put(x));
    tx.objectStore('meta').put(3,'schemaVersion');
  });
  // Keep UI prefs; remove heavy blob:
  localStorage.removeItem('state');
  return true;
}
```

- Export/Import path: read/write from IDB, not in-memory blobs.
- Schema version: store meta.schemaVersion; refuse future versions; upgrade older via step functions (see §4).

Test: Create items → reload → items persist. Populate 5k tasks → typing stays responsive (no long “save” jank).

Done when: app no longer serializes giant JSON blobs; persistence is chunked; migration runs once then disappears.

---

3) Store: selective subscriptions (stop full re-renders)

Files: src/store.js, views
- Add a slice selector:

```
export function select(selector, onChange){
  let prev = selector(get());
  return subscribe(state => {
    const next = selector(state);
    if (!shallowEqual(next, prev)) { const old=prev; prev=next; onChange(next, old); }
  });
}
```

- Refactor views to subscribe to slices (tasks only, ui.activeProject, etc.), not the whole state.
- Debounce filters/search (150–250ms) in tasks/notes views.

Test: Switching tabs doesn’t re-mount unrelated panels; search doesn’t freeze while typing.

Done when: state changes re-render only the affected view region.

---

4) List virtualization (tasks & notes)

Files: src/views/tasks.js, src/views/notes.js, src/ui/virtual.js (new)
- Create a tiny virtual scroller (fixed or average row height):

```
// src/ui/virtual.js
export function mountVirtualList(container, {items, rowHeight, renderRow}){
  const viewport = container;
  const spacerTop = document.createElement('div');
  const spacerBot = document.createElement('div');
  const list = document.createElement('div');
  viewport.replaceChildren(spacerTop, list, spacerBot);

  let scrollTop = 0;
  function paint(){
    const vh = viewport.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 10);
    const end   = Math.min(items.length, Math.ceil((scrollTop + vh)/rowHeight) + 10);
    spacerTop.style.height = (start*rowHeight)+'px';
    spacerBot.style.height = ((items.length-end)*rowHeight)+'px';
    list.replaceChildren(...items.slice(start,end).map(renderRow));
  }
  viewport.addEventListener('scroll', () => { scrollTop = viewport.scrollTop; paint(); }, { passive:true });
  paint();
  return { update(newItems){ items = newItems; paint(); } };
}
```

- Use it in tasks/notes instead of rendering all rows.

Test: With 5k items, scroll remains smooth; memory stays flat.

Done when: large lists are snappy.

---

5) Schema migrations & validation

Files: src/schema.js, src/storage/migrations/*.js, src/storage/import-export.js
- Add stepwise migrators:

```
export const SCHEMA_VERSION = 3;
export const migrators = {
  1: data => {/* …to v2… */ return data2},
  2: data => {/* …to v3… */ return data3},
};
export function migrate(data, from){
  let cur = from;
  while (cur < SCHEMA_VERSION){ data = migrators[cur](data); cur++; }
  return data;
}
```

- Validate imports (use zod or hand checks) before writing to IDB; refuse future versions with a friendly error.
- Merge strategy: project IDs are keys; on conflict, keep newer updatedAt and record a conflict note.

Test: Import v1/v2 exports → they upgrade; importing v99 is rejected with a clear message.

Done when: imports never brick the store; upgrades are deterministic.

---

6) Accessibility & UX polish

Files: src/ui/*, src/views/*, CSS
- Icon-only buttons → add aria-label.
- Tabs → ensure aria-selected + tabindex=0/-1 and focus moves to active tabpanel.
- Contrast check for muted/amber colors; adjust if any fail WCAG AA.
- Reduced motion: respect prefers-reduced-motion for any transitions.

Test: Keyboard-only navigation works end-to-end; Lighthouse a11y ≥ 90.

Done when: basic a11y audits pass; no unlabeled controls.

---

7) Security: CSP & file access fallback

Files: index.html, src/storage/fileDB.js, views that show attachments
- Add a CSP meta (tight but workable for SPA):

```
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self';
  worker-src 'self';
  base-uri 'none';
  form-action 'self';
">
```

- Attachment fallback: when File System Access API is missing, store metadata only and show a call-to-action: “Open file (you’ll be prompted to pick it)”.

Test: Safari/Firefox paths don’t throw; UI explains limited access.

Done when: CSP doesn’t block app; attachment UX degrades gracefully.

---

8) E2E Smoke Tests (catch regressions)

Files: .github/workflows/ci.yml (optional), tests/smoke.spec.ts
- Install Playwright:

```
npm i -D @playwright/test
npx playwright install
```

- Write 3 smokes:
  1. Load app → create project → add task → reload → task persists.
  2. Toggle offline → navigate → shell loads.
  3. Trigger SW update → see “Update available” → reload applies it.
- (Optional) Add CI to run lints + smokes on push.

Done when: the three smokes pass locally.

---

9) Docs & rollout
- README: add “Dev vs Prod”, “Data locations (IDB/UI prefs)”, “Backup/Export”, “Offline behavior”.
- CHANGELOG: note the IDB migration and SW changes.
- One-time release script: bump BUILD_VERSION, build (if applicable), push.

