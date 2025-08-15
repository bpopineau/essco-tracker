// src/views/header.js
import { storage } from '../storage.js';
import { el, toast } from '../ui/dom.js';
import { fmtDate } from '../utils/date.js';

export function mountHeader(refs, store){
  const { projTitleEl, projMetaEl, statusBadgeEl, exportBtn, importInput, newNoteBtn, newTaskBtn } = refs;

  const getUser    = (id)=> store.get().users.find(u=>u.id===id);
  const getProject = ()=> store.get().projects.find(p=>p.id===store.get().ui.selectedProjectId);

  // Ensure a save-status slot exists
  let saveStatus = document.getElementById('saveStatus');
  if (!saveStatus) {
    const headerEl = projTitleEl.closest('header') || document.querySelector('header');
    if (headerEl) {
      const statusSlot = el('small', { id:'saveStatus', className:'muted', style:'margin-left:auto' });
      headerEl.appendChild(statusSlot);
      saveStatus = statusSlot;
    }
  }

  // Listen to storage autosave events for feedback
  if (typeof storage.onStatusChange === 'function') {
    storage.onStatusChange((status) => {
      if (saveStatus) {
        saveStatus.textContent =
          status === 'saving' ? 'Saving…' :
          status === 'error'  ? 'Save failed' :
          status === 'idle'   ? 'All changes saved' : '';
      }
    });
  }

  // Attachments capability banner (info only)
  const headerEl = projTitleEl.closest('header') || document.querySelector('header');
  if (headerEl && !document.getElementById('attBanner')) {
    try {
      const supported = !!(window.fileDB && window.fileDB.available && window.fileDB.available());
      if (!supported) {
        const banner = el('div', {
          id:'attBanner',
          className:'badge',
          style:'margin:8px 16px 0 auto; display:inline-flex; align-items:center; gap:8px'
        }, ['ℹ️ Full attachments work best in Chrome/Edge on desktop']);
        headerEl.appendChild(banner);
      }
    } catch {
      // no-op if fileDB unavailable
    }
  }

  // Add Delete Project button to header actions
  const actionsRow = document.querySelector('header .row') || headerEl;
  let delBtn = actionsRow?.querySelector('#btnDeleteProject');
  if (actionsRow && !delBtn){
    delBtn = el('button', {
      id:'btnDeleteProject',
      className:'ghost',
      textContent:'Delete Project…',
      style:'margin-left:8px'
    });
    actionsRow.appendChild(delBtn);
    delBtn.addEventListener('click', ()=> openDeleteProjectModal(store, delBtn));
  }

  function render(){
    const p = getProject(); if (!p) return;
    projTitleEl.textContent = `${p.job_number} — ${p.name}`;
    projMetaEl.textContent  = `Client: ${p.client} • PM: ${getUser(p.pm_user_id)?.name||'—'} • Started: ${p.start_date?fmtDate(p.start_date):'—'}`;
    statusBadgeEl.textContent = p.status;
    statusBadgeEl.style.borderColor = p.status==='active' ? '#345' : '#444';
    if (delBtn) delBtn.disabled = !p;
  }

  exportBtn.addEventListener('click', ()=>{
    storage.exportJSON(store.get());
    toast('Export started', { type:'success' });
  });

  importInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if (!file) return;
    openImportModal(file, store, importInput);
  });

  newTaskBtn.addEventListener('click', ()=>{
    store.set({ ui: { ...store.get().ui, activeTab: 'tasks' } });
    setTimeout(()=>document.getElementById('qaTitle')?.focus(), 0);
  });

  newNoteBtn.addEventListener('click', ()=>{
    store.set({ ui: { ...store.get().ui, activeTab: 'notes' } });
    setTimeout(()=>document.getElementById('noteBody')?.focus(), 0);
  });

  // Granular subscription: only re-render on relevant keys
  store.subscribe((_, keys)=>{
    if (keys.some(k => k.startsWith('projects') || k === 'ui.selectedProjectId' || k.startsWith('users'))) {
      render();
    }
  });
  render();
}

/* ---------------- Import Modal ---------------- */
function openImportModal(file, store, inputEl){
  const modal = el('div', { className:'modal' });
  const panel = el('div', { className:'panel', role:'dialog', ariaModal:'true' });

  const headingId = 'imp_' + Math.random().toString(36).slice(2,8);
  const head = el('div', { className:'row' });
  head.append(
    el('h3', { id: headingId, textContent:'Import Data' }),
    el('button', { className:'btn-icon', title:'Close', 'aria-label':'Close', onclick:()=>closeModal() }, '×')
  );
  panel.setAttribute('aria-labelledby', headingId);

  const descId = 'imp_desc_' + Math.random().toString(36).slice(2,8);
  panel.setAttribute('aria-describedby', descId);

  const name = file.name || 'backup.json';
  const body = el('div', { className:'grid', style:'gap:8px;margin-top:8px', id: descId });

  const mergeId = 'opt_merge_' + Math.random().toString(36).slice(2,6);
  const replId  = 'opt_repl_'  + Math.random().toString(36).slice(2,6);

  body.append(
    el('div', { className:'muted' }, `Choose how to apply “${name}”.`),
    el('label', { className:'row', style:'gap:8px;align-items:center' }, [
      el('input', { type:'radio', name:'impMode', id: mergeId, value:'merge', checked:true }),
      el('div', {}, [
        el('strong', { textContent:'Merge (recommended)' }),
        el('div', { className:'muted' }, 'Keep your current data, overwrite conflicts from the file.')
      ])
    ]),
    el('label', { className:'row', style:'gap:8px;align-items:center' }, [
      el('input', { type:'radio', name:'impMode', id: replId, value:'replace' }),
      el('div', {}, [
        el('strong', { textContent:'Replace (wipe current)' }),
        el('div', { className:'muted' }, 'Completely replace current data with the file contents.')
      ])
    ])
  );

  const actions = el('div', { className:'row', style:'margin-top:10px;justify-content:flex-end' });
  const cancel = el('button', { className:'ghost', textContent:'Cancel', onclick:()=>closeModal() });
  const ok  = el('button', { className:'primary', textContent:'Import' });
  actions.append(cancel, ok);

  panel.append(head, body, actions);
  modal.append(panel);
  document.body.appendChild(modal);

  ok.onclick = async ()=>{
    const mode = panel.querySelector('input[name="impMode"]:checked')?.value || 'merge';
    try{
      let imported = await storage.importJSON(file, { strategy: mode });
      // Apply schema migration before replacing
      if (typeof storage.migrate === 'function') {
        imported = storage.migrate(imported, imported.version || null);
      }
      if (typeof store.replace === 'function') store.replace(imported);
      else store.update(()=>imported);
      toast(`Import complete (${mode})`, { type:'success' });
    }catch(err){
      toast('Import failed', { type:'error' });
      console.error('[header] import error:', err);
    }finally{
      if (inputEl) inputEl.value = '';
      closeModal();
    }
  };

  trapFocus(modal, panel);
  function closeModal(){
    modal.remove();
  }
}

/* ---------------- Delete Project Modal ---------------- */
function openDeleteProjectModal(store){
  const state = store.get();
  const pid = state.ui.selectedProjectId;
  const proj = state.projects.find(p=>p.id===pid);
  if (!proj) { toast('No project selected.', { type:'error' }); return; }

  const tasks = state.tasks.filter(t=>t.project_id===pid);
  const notes = state.notes.filter(n=>n.project_id===pid);

  const modal = el('div', { className:'modal' });
  const panel = el('div', { className:'panel', role:'dialog', ariaModal:'true' });

  const headingId = 'del_' + Math.random().toString(36).slice(2,8);
  const head = el('div', { className:'row' });
  head.append(
    el('h3', { id: headingId, textContent: 'Delete Project' }),
    el('button', { className:'btn-icon', title:'Close', 'aria-label':'Close', onclick:()=>closeModal() }, '×')
  );
  panel.setAttribute('aria-labelledby', headingId);

  const body = el('div', { style:'margin-top:8px' });
  body.append(
    el('div', { className:'muted', style:'margin-bottom:8px' }, [
      'You are about to remove ',
      el('strong', { textContent: `${proj.job_number} — ${proj.name}` }),
      '.'
    ]),
    el('div', { className:'grid', style:'gap:6px' }, [
      el('div', {}, [
        el('span', { className:'pill', textContent:`Tasks: ${tasks.length}` }),
        document.createTextNode(' '),
        el('span', { className:'pill', textContent:`Notes: ${notes.length}` })
      ]),
      el('label', { className:'muted' }, [
        'Type the job number to confirm: ',
        el('strong', { textContent: proj.job_number })
      ]),
      el('input', { id:'confirmStr', placeholder:'Job number' })
    ])
  );

  const actions = el('div', { className:'row', style:'margin-top:10px;justify-content:space-between' });
  const archiveBtn = el('button', { className:'ghost' }, 'Archive instead');
  archiveBtn.onclick = ()=>{
    store.update(s=>({ projects: s.projects.map(p=>p.id===pid? { ...p, status:'archived' } : p) }));
    closeModal();
    toast('Project archived', { type:'success' });
  };

  const right = el('div', { className:'row' });
  const cancel = el('button', { className:'ghost', textContent:'Cancel', onclick:()=>closeModal() });
  const del = el('button', { className:'primary', textContent:'Delete', disabled:true });
  right.append(cancel, del);
  actions.append(archiveBtn, right);

  panel.append(head, body, actions);
  modal.append(panel);
  document.body.appendChild(modal);

  const input = body.querySelector('#confirmStr');
  input.addEventListener('input', ()=>{ del.disabled = input.value.trim() !== proj.job_number; });

  del.onclick = ()=>{
    const snapshot = store.get();
    const toRestore = {
      project: proj,
      tasks: snapshot.tasks.filter(t=>t.project_id===pid),
      notes: snapshot.notes.filter(n=>n.project_id===pid),
      wasSelected: snapshot.ui.selectedProjectId === pid
    };
    store.update(s=>{
      const others = s.projects.filter(p=>p.id !== pid);
      const nextSelected = others[0]?.id || null;
      return {
        projects: others,
        tasks: s.tasks.filter(t=>t.project_id !== pid),
        notes: s.notes.filter(n=>n.project_id !== pid),
        ui: { ...s.ui, selectedProjectId: nextSelected || s.ui.selectedProjectId }
      };
    });
    closeModal();
    toast(`Deleted project ${proj.job_number} — ${proj.name}`, {
      type:'warn',
      action: {
        label:'Undo',
        onClick: ()=>{
          store.update(s=>({
            projects: [toRestore.project, ...s.projects],
            tasks: [...s.tasks, ...toRestore.tasks],
            notes: [...s.notes, ...toRestore.notes],
            ui: { ...s.ui, selectedProjectId: toRestore.wasSelected ? toRestore.project.id : s.ui.selectedProjectId }
          }));
          toast('Restored', { type:'success' });
        }
      }
    });
  };

  trapFocus(modal, panel);
  function closeModal(){
    modal.remove();
  }
}

/* ---------------- Focus Trap Helper ---------------- */
function trapFocus(modal, panel){
  const prev = document.activeElement;
  const focusables = () => Array.from(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(el => !el.hasAttribute('disabled'));
  (focusables()[0] || panel).focus();

  function onKey(e){
    if (e.key === 'Escape') { e.preventDefault(); modal.remove(); }
    if (e.key === 'Enter' && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
      e.preventDefault();
      const primary = panel.querySelector('button.primary:not(:disabled)');
      primary?.click();
    }
    if (e.key === 'Tab'){
      const els = focusables(); if (!els.length) return;
      const idx = els.indexOf(document.activeElement);
      let next = idx + (e.shiftKey ? -1 : 1);
      if (next < 0) next = els.length - 1;
      if (next >= els.length) next = 0;
      els[next].focus();
      e.preventDefault();
    }
  }
  modal.addEventListener('keydown', onKey);
  modal.addEventListener('remove', ()=>{ if (prev && typeof prev.focus === 'function') prev.focus(); });
}
