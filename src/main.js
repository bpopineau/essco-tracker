// src/main.js

// ---------- Imports ----------
import { buildSchema } from './schema.js';
import { storage } from './storage.js';
import { createStore } from './store.js';
import { BUILD_VERSION } from './version.js';
import { mountHeader } from './views/header.js';
import { mountInsights } from './views/insights.js';
import { mountNotes } from './views/notes.js';
import { mountSidebar } from './views/sidebar.js';
import { mountTasks } from './views/tasks.js';

// ---------- Dev_Mode ----------
const DEV_MODE = true; // set to false in production
const schema = buildSchema(DEV_MODE);

// ---------- Boot ----------
(async function main(){
  const initial = await storage.load(schema);
  const store = createStore(initial);

  // Persist on changes (debounced inside storage.save)
  store.subscribe((state)=> storage.save(state));

  // Sidebar
  mountSidebar(
    document.getElementById('projList'),
    document.getElementById('search'),
    store
  );

  // Header
  mountHeader({
    projTitleEl: document.getElementById('projTitle'),
    projMetaEl: document.getElementById('projMeta'),
    statusBadgeEl: document.getElementById('statusBadge'),
    exportBtn: document.getElementById('btnExport'),
    importInput: document.getElementById('importFile'),
    newNoteBtn: document.getElementById('newNoteBtn'),
    newTaskBtn: document.getElementById('newTaskBtn'),
  }, store);

  // Dev-only Reset Seed button (you already had this pattern)
  if (DEV_MODE) {
    const actionsRow = document.querySelector('header .row');
    if (actionsRow) {
      const resetBtn = document.createElement('button');
      resetBtn.className = 'ghost';
      resetBtn.textContent = 'Reset Seed';
      resetBtn.style.marginLeft = '8px';
      resetBtn.title = 'Clear local data and reload default seed';
      resetBtn.onclick = async () => {
        if (!confirm('Reset local data to the default seed? This will clear your current changes.')) return;
        try {
          localStorage.removeItem('essco_tracker_db_v1');
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter(k => k.startsWith('essco-cache-')).map(k => caches.delete(k)));
          }
        } finally {
          location.reload();
        }
      };
      actionsRow.appendChild(resetBtn);
    }
  }

  // Views
  mountNotes(document.getElementById('notes'), store);
  mountTasks(document.getElementById('tasks'), store);
  mountInsights(document.getElementById('insights'), store);

  // Tabs (top-level app tabs)
  document.querySelectorAll('.tabs .tab').forEach(t=>t.addEventListener('click', ()=>{
    const tab = t.dataset.tab;
    store.set({ ui: { ...store.get().ui, activeTab: tab }});
  }));

  // React to tab changes
  store.subscribe((state, keys)=>{
    if (!keys.includes('ui')) return;
    const active = state.ui.activeTab;
    const sections = { notes:'#notes', tasks:'#tasks', insights:'#insights' };
    for (const [k, sel] of Object.entries(sections)){
      document.querySelector(sel).style.display = (k===active) ? 'grid' : 'none';
      document.querySelector(`[data-tab="${k}"]`)?.classList.toggle('active', k===active);
      document.querySelector(`[data-tab="${k}"]`)?.setAttribute('aria-selected', String(k===active));
    }
    if (active === 'insights') window.dispatchEvent(new Event('resize'));
  });

  // Initial render
  store.emit();

  // Service worker: versioned register + auto-reload on update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(BUILD_VERSION)}`);
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
    console.log('ESSCO build', BUILD_VERSION, 'DEV_MODE:', DEV_MODE ? 'dev' : 'prod');
  }
})();
