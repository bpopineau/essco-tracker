// src/views/sidebar.js
import { clear, el } from '../ui/dom.js';
import { fmtDate } from '../utils/date.js';

export function mountSidebar(listEl, searchEl, store){
  function render(){
    const state = store.get();
    const term = (state.ui.searchTerm || '').toLowerCase();
    clear(listEl);

    state.projects
      .filter(p=>{
        const pm = state.users.find(u=>u.id===p.pm_user_id)?.name || '';
        return [p.name, p.client, p.job_number, pm].join(' ').toLowerCase().includes(term);
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
