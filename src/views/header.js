
// src/views/header.js
import { storage } from '../storage.js';
import { fmtDate } from '../utils/date.js';

export function mountHeader(refs, store){
  const { projTitleEl, projMetaEl, statusBadgeEl, exportBtn, importInput, newNoteBtn, newTaskBtn } = refs;

  const getUser    = (id)=> store.get().users.find(u=>u.id===id);
  const getProject = ()=> store.get().projects.find(p=>p.id===store.get().ui.selectedProjectId);

  // Add a "Delete Project…" button to the header actions row
  const actionsRow = document.querySelector('header .row');
  let delBtn = actionsRow.querySelector('#btnDeleteProject');
  if (!delBtn){
    delBtn = document.createElement('button');
    delBtn.id = 'btnDeleteProject';
    delBtn.className = 'ghost';
    delBtn.textContent = 'Delete Project…';
    delBtn.style.marginLeft = '8px';
    actionsRow.appendChild(delBtn);
    delBtn.addEventListener('click', ()=> openDeleteProjectModal(store));
  }

  function render(){
    const p = getProject(); if (!p) return;
    projTitleEl.textContent = `${p.job_number} — ${p.name}`;
    projMetaEl.textContent  = `Client: ${p.client} • PM: ${getUser(p.pm_user_id)?.name||'—'} • Started: ${p.start_date?fmtDate(p.start_date):'—'}`;
    statusBadgeEl.textContent = p.status;
    statusBadgeEl.style.borderColor = p.status==='active' ? '#345' : '#444';
    delBtn.disabled = !p; // nothing selected
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

function openDeleteProjectModal(store){
  const state = store.get();
  const pid = state.ui.selectedProjectId;
  const proj = state.projects.find(p=>p.id===pid);
  if (!proj) { alert('No project selected.'); return; }

  const tasks = state.tasks.filter(t=>t.project_id===pid);
  const notes = state.notes.filter(n=>n.project_id===pid);

  const modal = document.createElement('div');
  modal.className = 'modal';
  const panel = document.createElement('div');
  panel.className = 'panel';

  const head = document.createElement('div');
  head.className = 'row';
  const h3 = document.createElement('h3'); h3.textContent = 'Delete Project';
  const close = document.createElement('button'); close.className = 'ghost'; close.textContent = '×';
  close.onclick = ()=> modal.remove();
  head.append(h3, close);

  const body = document.createElement('div');
  body.style.marginTop = '8px';
  body.innerHTML = `
    <div class="muted" style="margin-bottom:8px">
      You are about to remove <strong>${proj.job_number} — ${proj.name}</strong>.
    </div>
    <div class="grid" style="gap:6px">
      <div><span class="pill">Tasks: ${tasks.length}</span> <span class="pill">Notes: ${notes.length}</span></div>
      <label class="muted">Type the job number to confirm: <strong>${proj.job_number}</strong></label>
      <input id="confirmStr" placeholder="Job number" />
    </div>
  `;

  const actions = document.createElement('div');
  actions.className = 'row';
  actions.style.marginTop = '10px';
  actions.style.justifyContent = 'space-between';

  const archiveBtn = document.createElement('button');
  archiveBtn.className = 'ghost';
  archiveBtn.textContent = 'Archive instead';
  archiveBtn.onclick = ()=>{
    store.update(s=>({ ...s, projects: s.projects.map(p=>p.id===pid? { ...p, status:'archived' } : p) }));
    modal.remove();
  };

  const right = document.createElement('div');
  right.className = 'row';
  const cancel = document.createElement('button'); cancel.className = 'ghost'; cancel.textContent = 'Cancel';
  cancel.onclick = ()=> modal.remove();
  const del = document.createElement('button'); del.className = 'primary'; del.textContent = 'Delete';
  del.disabled = true;

  right.append(cancel, del);
  actions.append(archiveBtn, right);

  panel.append(head, body, actions);
  modal.append(panel);
  document.body.appendChild(modal);

  const input = body.querySelector('#confirmStr');
  input.addEventListener('input', ()=>{
    del.disabled = input.value.trim() !== proj.job_number;
  });

  del.onclick = ()=>{
    // hard delete: project + all related tasks/notes
    store.update(s=>{
      const others = s.projects.filter(p=>p.id !== pid);
      const nextSelected = others[0]?.id || null;
      return {
        ...s,
        projects: others,
        tasks: s.tasks.filter(t=>t.project_id !== pid),
        notes: s.notes.filter(n=>n.project_id !== pid),
        ui: { ...s.ui, selectedProjectId: nextSelected || s.ui.selectedProjectId }
      };
    });
    modal.remove();
  };
}
