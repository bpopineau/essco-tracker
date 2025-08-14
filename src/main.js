// src/main.js

// ---------- Imports ----------
import { schemaV1 } from './schema.js';
import { storage } from './storage.js';
import { createStore } from './store.js';
import { clear, el } from './ui/dom.js';
import { fmtDate } from './utils/date.js';
import { BUILD_VERSION } from './version.js';
import { mountInsights } from './views/insights.js';
import { mountNotes } from './views/notes.js';
import { mountTasks } from './views/tasks.js';

// ---------- Sidebar ----------
function mountSidebar(listEl, searchEl, store){
  function render(){
    const state = store.get();
    const term = (state.ui.searchTerm || '').toLowerCase();
    clear(listEl);
    state.projects
      .filter(p=>{
        const pm = state.users.find(u=>u.id===p.pm_user_id)?.name || '';
        return [p.name,p.client,p.job_number,pm].join(' ').toLowerCase().includes(term);
      })
      .forEach(p=>{
        const active = p.id === state.ui.selectedProjectId;
        const item = el('div', { className: 'proj' + (active ? ' active' : '') });
        item.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${p.job_number}</strong> — ${p.name}</div>
            <span class="pill">${p.status}</span>
          </div>
          <div class="meta">
            <span>Client: ${p.client}</span>
            <span>PM: ${state.users.find(u=>u.id===p.pm_user_id)?.name||'—'}</span>
            <span>Start: ${p.start_date?fmtDate(p.start_date):'—'}</span>
          </div>`;
        item.addEventListener('click', ()=>{
          store.set({ ui: { ...state.ui, selectedProjectId: p.id }});
        });
        listEl.appendChild(item);
      });
  }

  searchEl.addEventListener('input', ()=>{
    const ui = store.get().ui;
    store.set({ ui: { ...ui, searchTerm: searchEl.value.trim() } });
  });

  store.subscribe((_, keys)=>{ if (keys.some(k=>['projects','users','ui'].includes(k))) render(); });
  render();
}

// ---------- Header ----------
function mountHeader(refs, store){
  const { projTitleEl, projMetaEl, statusBadgeEl, exportBtn, importInput, newNoteBtn, newTaskBtn } = refs;
  const getUser = (id)=> store.get().users.find(u=>u.id===id);
  const getProject = ()=> store.get().projects.find(p=>p.id===store.get().ui.selectedProjectId);

  function render(){
    const p = getProject(); if (!p) return;
    projTitleEl.textContent = `${p.job_number} — ${p.name}`;
    projMetaEl.textContent = `Client: ${p.client} • PM: ${getUser(p.pm_user_id)?.name||'—'} • Started: ${p.start_date?fmtDate(p.start_date):'—'}`;
    statusBadgeEl.textContent = p.status;
    statusBadgeEl.style.borderColor = p.status==='active' ? '#345' : '#444';
  }

  exportBtn.addEventListener('click', ()=> storage.exportJSON(store.get()));
  importInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if (!file) return;
    const merged = await storage.importJSON(file);
    store.update(()=>merged);
  });

  newTaskBtn.addEventListener('click', ()=>{
    store.set({ ui: { ...store.get().ui, activeTab: 'tasks' } });
    setTimeout(()=>document.getElementById('qaTitle')?.focus(), 0);
  });

  newNoteBtn.addEventListener('click', ()=>{
    store.set({ ui: { ...store.get().ui, activeTab: 'notes' } });
    setTimeout(()=>document.getElementById('noteBody')?.focus(), 0);
  });

  store.subscribe((_, keys)=>{ if (keys.includes('projects') || keys.includes('ui')) render(); });
  render();
}

// ---------- Boot ----------
(async function main(){
  // Load state and create evented store
  const initial = await storage.load(schemaV1);
  const store = createStore(initial);

  // Persist on any change (debounced in storage.save)
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

  // Service worker: versioned register + auto-reload when a new SW takes control
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(BUILD_VERSION)}`);
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
    console.log('ESSCO build', BUILD_VERSION);
  }
})();
