// src/main.js

// ---------- Imports ----------
import { buildSchema } from './schema.js';
import { storage } from './storage.js';
import { createStore } from './store.js';
import { toast } from './ui/dom.js';
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

  // Ensure a selected project on first load/import
  if (!store.get().ui.selectedProjectId && store.get().projects.length) {
    const first = store.get().projects[0].id;
    store.set({ ui: { ...store.get().ui, selectedProjectId: first } });
  }

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

  // Dev-only Reset Seed button
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
      const pane = document.querySelector(sel);
      if (pane) pane.style.display = (k===active) ? 'grid' : 'none';
      const tabEl = document.querySelector(`[data-tab="${k}"]`);
      tabEl?.classList.toggle('active', k===active);
      tabEl?.setAttribute('aria-selected', String(k===active));
    }
    if (active === 'insights') window.dispatchEvent(new Event('resize'));
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const active = store.get().ui.activeTab;

    // Focus project search
    if (e.key === '/') {
      const box = document.getElementById('search');
      if (box) { e.preventDefault(); box.focus(); box.select?.(); }
      return;
    }
    // New note
    if (e.key.toLowerCase() === 'n') {
      if (active !== 'notes') store.set({ ui: { ...store.get().ui, activeTab: 'notes' } });
      document.getElementById('newNoteBtn')?.click();
      return;
    }
    // Quick add task
    if (e.key.toLowerCase() === 't') {
      if (active !== 'tasks') store.set({ ui: { ...store.get().ui, activeTab: 'tasks' } });
      document.getElementById('newTaskBtn')?.click();
      return;
    }
  });

  // Initial render
  store.emit();

  // Service worker: versioned register + toast-based update prompt
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(BUILD_VERSION)}`).then((reg)=>{
      // If a waiting worker already exists, prompt now
      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateToast(reg);
      }
      // When a new worker is found and installed, prompt to refresh
      reg.addEventListener('updatefound', ()=>{
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', ()=>{
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(reg);
          }
        });
      });
    }).catch(err=>{
      console.warn('[sw] register failed:', err);
    });

    // Reload after skipWaiting activates the new worker
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });

    console.log('ESSCO build', BUILD_VERSION, 'DEV_MODE:', DEV_MODE ? 'dev' : 'prod');
  }
})();

/* ------------ helpers ------------ */
function showUpdateToast(reg){
  toast('An update is ready.', {
    type: 'info',
    action: {
      label: 'Refresh',
      onClick: () => {
        try {
          reg.waiting?.postMessage?.({ type: 'SKIP_WAITING' });
        } catch {}
      }
    }
  });
}
