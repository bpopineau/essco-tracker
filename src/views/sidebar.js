// src/views/sidebar.js
import { clear, el, highlightText, on, toast } from '../ui/dom.js';
import { fmtDate } from '../utils/date.js';

const makeId = (prefix)=> prefix + Math.random().toString(36).slice(2,8);

export function mountSidebar(listEl, searchEl, store){
  // Inject "+ Project" button next to the search input (once)
  let addBtn = searchEl.parentElement.querySelector('#btnNewProject');
  if (!addBtn) {
    addBtn = el('button', {
      id:'btnNewProject',
      className:'ghost',
      textContent:'+ Project',
      style:'margin-top:8px;width:100%',
      title:'Create a new project'
    });
    searchEl.parentElement.appendChild(addBtn);
    addBtn.addEventListener('click', ()=> openCreateProjectModal(store, addBtn));
  }

  // Delegated: select project (mouse)
  const _offSelect = on(listEl, 'click', '.proj', (e) => {
    if (e.target.closest('[data-del]')) return; // ignore delete clicks
    const item = e.delegateTarget;
    const id = item?.dataset?.id;
    if (!id) return;
    const _s = store.get();
    store.set({ ui: { ..._s.ui, selectedProjectId: id }});
  });

  // Delegated: select project (keyboard: Enter/Space)
  const _offSelectKey = on(listEl, 'keydown', '.proj', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const item = e.delegateTarget;
    const id = item?.dataset?.id;
    if (!id) return;
    const s = store.get();
    store.set({ ui: { ...s.ui, selectedProjectId: id }});
  });

  // Delegated: delete project with Undo (restores tasks/notes too)
  const _offDelete = on(listEl, 'click', '[data-del]', (e) => {
    e.stopPropagation();
    const item = e.target.closest('.proj');
    const id = item?.dataset?.id;
    if (!id) return;

    const s = store.get();
    const proj = s.projects.find(p => p.id === id);
    if (!proj) return;

    // Gather related data so undo can restore cleanly
    const tasksToRemove = s.tasks.filter(t => t.project_id === id);
    const notesToRemove = s.notes.filter(n => n.project_id === id);

    const wasSelected   = s.ui.selectedProjectId === id;
    const remainingProj = s.projects.filter(p => p.id !== id);
    const nextSelected  = wasSelected
      ? (remainingProj[0]?.id ?? null)
      : s.ui.selectedProjectId;

    // Remove now
    store.update(st => ({
      projects: st.projects.filter(p => p.id !== id),
      tasks: st.tasks.filter(t => t.project_id !== id),
      notes: st.notes.filter(n => n.project_id !== id),
      ui: { ...st.ui, selectedProjectId: nextSelected }
    }));

    // Offer undo
    toast(`Deleted project ${proj.job_number} — ${proj.name}`, {
      type: 'warn',
      action: {
        label: 'Undo',
        onClick: () => {
          store.update(st => ({
            projects: [proj, ...st.projects],
            tasks: [...st.tasks, ...tasksToRemove],
            notes: [...st.notes, ...notesToRemove],
            ui: { ...st.ui, selectedProjectId: wasSelected ? proj.id : st.ui.selectedProjectId }
          }));
          toast('Restored', { type:'success' });
        }
      }
    });
  });

  function render(){
    const state = store.get();
    const term = (state.ui.searchTerm || '').toLowerCase();
    clear(listEl);

    state.projects
      .filter(p=>{
        const pm = state.users.find(u=>u.id===p.pm_user_id)?.name || '';
        return [p.name, p.client, p.job_number, pm, p.status].join(' ').toLowerCase().includes(term);
      })
      .forEach(p=>{
        const active = p.id === state.ui.selectedProjectId;

        // Build item DOM (focusable & labelled)
        const item = el('div', {
          className: 'proj' + (active ? ' active' : ''),
          dataset:{ id: p.id },
          role: 'button',
          tabIndex: 0,
          ariaSelected: String(active)
        });

        const top = el('div', { style:'display:flex;justify-content:space-between;align-items:center;gap:8px' });
        const title = el('div');
        title.append(
          el('strong', { textContent: p.job_number }),
          document.createTextNode(' — '),
          el('span', { textContent: p.name })
        );

        const right = el('div', { className:'row', style:'gap:6px;align-items:center' });
        const statusChip = el('span', { className:'pill', textContent: p.status, ariaLabel:`Status: ${p.status}` });
        const delBtn = el('button', {
          className:'btn-icon ghost',
          title:'Delete project',
          'aria-label':'Delete project',
          dataset:{ del:'' }
        }, '🗑');

        right.append(statusChip, delBtn);
        top.append(title, right);

        const meta = el('div', { className:'meta' });
        meta.append(
          el('span', { textContent: `Client: ${p.client}` }),
          el('span', { textContent: `PM: ${state.users.find(u=>u.id===p.pm_user_id)?.name || '—'}` }),
          el('span', { textContent: `Start: ${p.start_date ? fmtDate(p.start_date) : '—'}` })
        );

        item.append(top, meta);

        // Search highlight across all visible text
        if (term) highlightText(item, term);

        listEl.appendChild(item);
      });
  }

  // Search wiring
  searchEl.addEventListener('input', ()=>{
    const ui = store.get().ui || {};
    store.set({ ui: { ...ui, searchTerm: searchEl.value.trim() } });
  });

  // Re-render on relevant changes
  store.subscribe((_, keys)=>{ if (keys.some(k=>['projects','users','ui'].includes(k))) render(); });

  // Initial paint
  render();

  // Optional: cleanup if you ever unmount the sidebar
  // return () => { offSelect(); offSelectKey(); offDelete(); };
}

/* ----------------- Modal: Create Project ----------------- */
function openCreateProjectModal(store, _triggerBtn){
  const state = store.get();
  const modal = el('div', { className:'modal' });
  const panel = el('div', { className:'panel', role:'dialog', ariaModal:'true' });

  const headingId = makeId('proj_');
  const head = el('div', { className:'row' });
  head.append(
    el('h3', { id: headingId, textContent:'New Project' }),
    el('button', { className:'btn-icon', title:'Close', 'aria-label':'Close', onclick:()=>closeModal() }, '×')
  );
  panel.setAttribute('aria-labelledby', headingId);

  const form = el('div', { className:'grid', style:'gap:8px;margin-top:8px' });
  const job   = el('input', { placeholder:'Job # (e.g., 1357)' });
  const name  = el('input', { placeholder:'Project name' });
  const client= el('input', { placeholder:'Client' });
  const pmSel = el('select');
  state.users.forEach(u=> pmSel.appendChild(el('option', { value:u.id, textContent:u.name })));
  if (state.users[0]) pmSel.value = state.users[0].id;
  const status= el('select');
  status.innerHTML = `<option value="active" selected>active</option><option value="hold">hold</option><option value="archived">archived</option>`;
  const start = el('input', { type:'date' });

  form.append(
    el('div', {}, [el('small',{className:'muted',textContent:'Job number'}), job]),
    el('div', {}, [el('small',{className:'muted',textContent:'Name'}), name]),
    el('div', {}, [el('small',{className:'muted',textContent:'Client'}), client]),
    el('div', {}, [el('small',{className:'muted',textContent:'PM'}), pmSel]),
    el('div', {}, [el('small',{className:'muted',textContent:'Status'}), status]),
    el('div', {}, [el('small',{className:'muted',textContent:'Start date'}), start]),
  );

  const actions = el('div', { className:'row', style:'margin-top:10px;justify-content:flex-end' });
  const save = el('button', { className:'primary', textContent:'Create' });
  const cancel = el('button', { className:'ghost', textContent:'Cancel', onclick:()=>closeModal() });
  actions.append(cancel, save);

  panel.append(head, form, actions);
  modal.append(panel);
  document.body.appendChild(modal);

  // Focus management (trap + restore)
  const prevFocus = document.activeElement;
  const focusables = () => Array.from(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
  (focusables()[0] || panel).focus();

  function onKey(e){
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    if (e.key === 'Enter' && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
      e.preventDefault(); save.click();
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

  function closeModal(){
    modal.removeEventListener('keydown', onKey);
    modal.remove();
    if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
  }

  save.onclick = ()=>{
    const job_number = job.value.trim();
    const pname = name.value.trim();
    if (!job_number || !pname){
      toast('Job # and Name are required.', { type:'error' });
      return;
    }
    const proj = {
      id: makeId('p'),
      job_number,
      name: pname,
      client: client.value.trim() || '—',
      status: status.value,
      pm_user_id: pmSel.value,
      start_date: start.value || null
    };
    store.update(s=>({
      projects: [proj, ...s.projects],
      ui: { ...s.ui, selectedProjectId: proj.id }
    }));
    closeModal();
    toast('Project created', { type:'success', action:{ label:'Open', onClick:()=> {
      const ui = store.get().ui || {};
      store.set({ ui: { ...ui, selectedProjectId: proj.id } });
    } }});
  };
}
