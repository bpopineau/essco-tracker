
// src/views/sidebar.js
import { clear, el } from '../ui/dom.js';
import { fmtDate } from '../utils/date.js';

const makeId = (prefix)=> prefix + Math.random().toString(36).slice(2,8);

export function mountSidebar(listEl, searchEl, store){
  // Inject "+ Project" button next to the search input
  let addBtn = searchEl.parentElement.querySelector('#btnNewProject');
  if (!addBtn) {
    addBtn = el('button', { id:'btnNewProject', className:'ghost', textContent:'+ Project', style:'margin-top:8px;width:100%' });
    searchEl.parentElement.appendChild(addBtn);
    addBtn.addEventListener('click', ()=> openCreateProjectModal(store));
  }

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

function openCreateProjectModal(store){
  const state = store.get();
  const modal = el('div', { className:'modal' });
  const panel = el('div', { className:'panel' });

  const head = el('div', { className:'row' });
  head.append(el('h3', { textContent:'New Project' }),
              el('button', { className:'ghost', textContent:'×', onclick:()=>modal.remove() }));

  const form = el('div', { className:'grid', style:'gap:8px;margin-top:8px' });
  const job   = el('input', { placeholder:'Job # (e.g., 1357)' });
  const name  = el('input', { placeholder:'Project name' });
  const client= el('input', { placeholder:'Client' });
  const pmSel = el('select');
  state.users.forEach(u=> pmSel.appendChild(el('option', { value:u.id, textContent:u.name })));
  const status= el('select'); status.innerHTML = `<option value="active" selected>active</option><option value="hold">hold</option><option value="archived">archived</option>`;
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
  const cancel = el('button', { className:'ghost', textContent:'Cancel', onclick:()=>modal.remove() });
  actions.append(cancel, save);

  panel.append(head, form, actions);
  modal.append(panel);
  document.body.appendChild(modal);

  save.onclick = ()=>{
    const job_number = job.value.trim();
    const pname = name.value.trim();
    if (!job_number || !pname){
      alert('Job # and Name are required.');
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
    store.update(s=>({ ...s, projects: [proj, ...s.projects], ui: { ...s.ui, selectedProjectId: proj.id }}));
    modal.remove();
  };
}
