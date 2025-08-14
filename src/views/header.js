// src/views/header.js
import { storage } from '../storage.js';
import { fmtDate } from '../utils/date.js';

export function mountHeader(refs, store){
  const { projTitleEl, projMetaEl, statusBadgeEl, exportBtn, importInput, newNoteBtn, newTaskBtn } = refs;

  const getUser    = (id)=> store.get().users.find(u=>u.id===id);
  const getProject = ()=> store.get().projects.find(p=>p.id===store.get().ui.selectedProjectId);

  function render(){
    const p = getProject(); if (!p) return;
    projTitleEl.textContent = `${p.job_number} — ${p.name}`;
    projMetaEl.textContent  = `Client: ${p.client} • PM: ${getUser(p.pm_user_id)?.name||'—'} • Started: ${p.start_date?fmtDate(p.start_date):'—'}`;
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
