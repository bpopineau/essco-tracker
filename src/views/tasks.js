// src/views/tasks.js
import { clear, el } from '../ui/dom.js';
import { daysUntil, fmtDate } from '../utils/date.js';

// Matches other parts of the app
const STATUS = ['backlog','in_progress','blocked','done'];
const PRIORITIES = ['low','med','high'];

// Fallback-safe helpers
const makeId = (prefix)=> prefix + Math.random().toString(36).slice(2,8);

export function mountTasks(root, store){
  // --- helpers that reference state each time ---
  const getUser   = (id)=> store.get().users.find(u=>u.id===id);
  const usersList = ()=> store.get().users;
  const projectTasks = (pid)=> store.get().tasks.filter(t=>t.project_id===pid);
  const projectNotes = (pid)=> store.get().notes
    .filter(n=>n.project_id===pid)
    .sort((a,b)=> b.meeting_date.localeCompare(a.meeting_date));

  // --- ensure filters exist in UI state (non-destructive) ---
  const ensureFilters = ()=>{
    const s = store.get();
    const ui = s.ui || {};
    const tf = ui.taskFilters || {
      assignee: 'all',
      status: 'all',
      priority: 'all',
      due: 'all',          // all | overdue | soon | nodue
      search: ''
    };
    if (!ui.taskFilters){
      store.set({ ui: { ...ui, taskFilters: tf } });
    }
    return tf;
  };

  // --- Attachments: local file linking (re-uses fileDB global created in index.html) ---
  const attCount = (t)=> (t.attachments?.length || 0);

  async function ensurePermission(handle){
    if (!handle) return false;
    const q = await handle.queryPermission?.({ mode:'read' });
    if (q === 'granted') return true;
    const r = await handle.requestPermission?.({ mode:'read' });
    return r === 'granted';
  }

  async function pickAndAttach(taskId){
    if (!window.showOpenFilePicker){
      alert('Your browser does not support local file linking. Use Chrome/Edge on desktop.');
      return;
    }
    const picks = await showOpenFilePicker({ multiple:true });
    const newMetas = [];
    for (const h of picks){
      const id = await fileDB.putHandle(h);
      newMetas.push({ id, name: h.name, kind: h.kind || 'file' });
    }
    store.update(s=>({
      ...s,
      tasks: s.tasks.map(t => t.id===taskId ? { ...t, attachments: [...(t.attachments||[]), ...newMetas] } : t)
    }));
  }

  async function openAttachment(att){
    const handle = await fileDB.getHandle(att.id);
    if (!handle){ alert('Missing handle. Re-link this attachment.'); return; }
    const ok = await ensurePermission(handle);
    if (!ok){ alert('Permission denied. Re-link or grant access.'); return; }
    const file = await handle.getFile();
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
    setTimeout(()=> URL.revokeObjectURL(url), 10_000);
  }

  async function removeAttachment(taskId, att){
    await fileDB.delHandle(att.id).catch(()=>{});
    store.update(s=>({
      ...s,
      tasks: s.tasks.map(t => t.id===taskId ? { ...t, attachments: (t.attachments||[]).filter(a=>a.id!==att.id) } : t)
    }));
  }

  function openAttachmentModal(taskId){
    const t = store.get().tasks.find(x=>x.id===taskId);
    const modal = el('div', { className:'modal' });
    const panel = el('div', { className:'panel' });
    const head = el('div', { className:'row' });
    head.append(
      el('h3', { textContent: 'Attachments' }),
      el('button', { className:'ghost', textContent:'×', onclick:()=>modal.remove() })
    );
    const list = el('div', { className:'att-list' });

    function renderList(){
      list.innerHTML='';
      (t.attachments||[]).forEach(att=>{
        const row = el('div', { className:'att-item' });
        row.append(
          el('div', { className:'name', textContent: att.name }),
          el('div', {}, [
            el('button', { className:'ghost', textContent:'Open', onclick:()=>openAttachment(att) }),
            el('button', { className:'ghost', textContent:'Remove', onclick:()=>{ removeAttachment(t.id, att); row.remove(); } })
          ])
        );
        list.appendChild(row);
      });
      if (!(t.attachments||[]).length){
        list.append(el('div', { className:'empty', textContent:'No attachments yet.' }));
      }
    }

    const actions = el('div', { className:'row', style:'margin-top:10px' });
    actions.append(
      el('button', { className:'primary', textContent:'Add files', onclick:()=>pickAndAttach(taskId).then(renderList) }),
      el('button', { className:'ghost', textContent:'Close', onclick:()=>modal.remove() })
    );

    panel.append(head, list, actions);
    modal.append(panel);
    document.body.appendChild(modal);
    renderList();
  }

  // --- UI bits shared by Kanban & Table ---
  function badge(text, cls){ const s = el('span', { className:`pill ${cls||''}` }); s.textContent = text; return s; }

  function taskCard(t){
    const u = getUser(t.assignee_user_id);
    const du = t.due_date ? daysUntil(t.due_date) : NaN;
    let chip='chip-ok', tip='OK';
    if (!Number.isNaN(du) && du < 0){ chip='chip-bad'; tip='Overdue'; }
    else if (!Number.isNaN(du) && du <= 3){ chip='chip-warn'; tip='Due soon'; }
    const card = el('div', { className:'task', draggable:true, id:t.id });
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div>${t.title}</div>
        <button class="ghost" title="Attachments" style="padding:4px 8px" data-att-btn>📎 ${attCount(t)}</button>
      </div>
      <div class="meta">
        <span class="pill assignee">${u?u.name:'Unassigned'}</span>
        <span class="pill prio">P: ${t.priority}</span>
        <span class="pill due ${chip}" title="${tip}">${t.due_date?fmtDate(t.due_date):'No due'}</span>
        ${t.note_id?`<span class="pill">Note ${t.note_id}</span>`:''}
      </div>`;
    card.addEventListener('dragstart', ev=>{ ev.dataTransfer.setData('text/plain', t.id); });
    card.querySelector('[data-att-btn]').addEventListener('click', ()=> openAttachmentModal(t.id));
    return card;
  }

  // --- render main view ---
  function render(){
    clear(root);
    const state = store.get();
    const pid = state.ui.selectedProjectId;
    const viewMode = state.ui.viewMode || 'kanban';
    const filters = ensureFilters();

    // Top controls row
    const topRow = el('div', { className:'row' });
    topRow.append(el('div', { className:'pill', textContent:'View:' }));
    const switchRow = el('div', { className:'row' });
    const btnKanban = el('button', { id:'viewKanban', className: 'tab' + (viewMode==='kanban'?' active':''), textContent:'Kanban' });
    const btnTable = el('button', { id:'viewTable', className: 'tab' + (viewMode==='table'?' active':''), textContent:'Table' });
    switchRow.append(btnKanban, btnTable);
    const spacer = el('div', { className:'spacer' });
    const summary = el('div', { id:'summaryBadges', className:'row' });
    topRow.append(switchRow, spacer, summary);
    root.append(topRow);

    // Summary badges
    const openAll = projectTasks(pid).filter(t=>t.status!=='done');
    const overdue = openAll.filter(t=>daysUntil(t.due_date)<0).length;
    const soon = openAll.filter(t=>{ const du=daysUntil(t.due_date); return du>=0 && du<=3; }).length;
    summary.append(badge(`Overdue: ${overdue}`, 'chip-bad'), badge(`Due ≤3d: ${soon}`, 'chip-warn'), badge(`Open: ${openAll.length}`, ''));

    // Filters row (table-focused but present for both)
    const filterBar = el('div', { className:'row', style:'gap:8px;margin-top:-6px' });
    const fAssignee = el('select', { title:'Assignee' });
    fAssignee.appendChild(el('option', { value:'all', textContent:'All assignees' }));
    usersList().forEach(u=> fAssignee.appendChild(el('option', { value:u.id, textContent:u.name })));
    fAssignee.value = filters.assignee;

    const fStatus = el('select', { title:'Status' });
    [['all','All status'], ...STATUS.map(s=>[s, s.replace('_',' ')])].forEach(([v,txt])=> fStatus.appendChild(el('option', { value:v, textContent:txt })));
    fStatus.value = filters.status;

    const fPriority = el('select', { title:'Priority' });
    [['all','All priorities'], ...PRIORITIES.map(p=>[p, p.toUpperCase()])].forEach(([v,txt])=> fPriority.appendChild(el('option', { value:v, textContent:txt })));
    fPriority.value = filters.priority;

    const fDue = el('select', { title:'Due' });
    [['all','All due dates'], ['overdue','Overdue'], ['soon','Due ≤3d'], ['nodue','No due date']].forEach(([v,txt])=> fDue.appendChild(el('option', { value:v, textContent:txt })));
    fDue.value = filters.due;

    const fSearch = el('input', { placeholder:'Search tasks…', value: filters.search, style:'min-width:220px' });

    const fClear = el('button', { className:'ghost', textContent:'Clear filters' });

    filterBar.append(fAssignee, fStatus, fPriority, fDue, fSearch, fClear);
    root.append(filterBar);

    // Apply filters function
    const matchesFilters = (t)=>{
      if (filters.assignee !== 'all' && t.assignee_user_id !== filters.assignee) return false;
      if (filters.status   !== 'all' && t.status !== filters.status) return false;
      if (filters.priority !== 'all' && t.priority !== filters.priority) return false;

      if (filters.due !== 'all'){
        const du = t.due_date ? daysUntil(t.due_date) : NaN;
        if (filters.due === 'overdue' && !( !Number.isNaN(du) && du < 0 )) return false;
        if (filters.due === 'soon'    && !( !Number.isNaN(du) && du >=0 && du <=3 )) return false;
        if (filters.due === 'nodue'   && t.due_date) return false;
      }

      if (filters.search){
        const hay = `${t.title} ${getUser(t.assignee_user_id)?.name||''} ${t.priority} ${t.status}`.toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    };

    // Kanban
    const kanban = el('div', { id:'kanban', className:'kanban', style: viewMode==='kanban'?'grid':'display:none' });
    STATUS.forEach(st=>{
      const col = el('div', { className:'col' });
      col.append(el('h4', { textContent: st.replace('_',' ').replace(/^./,c=>c.toUpperCase()) }));
      const drop = el('div', { className:'drop' }); drop.dataset.status = st;
      const list = projectTasks(pid).filter(t=>t.status===st).filter(matchesFilters);
      list.forEach(t=> drop.appendChild(taskCard(t)));
      col.append(drop); kanban.append(col);
    });
    root.append(kanban);

    // Kanban DnD delegation
    if (viewMode==='kanban'){
      const board = kanban;
      board.addEventListener('dragenter', (ev)=>{ const drop = ev.target.closest('.drop'); if (drop) drop.classList.add('is-over'); });
      board.addEventListener('dragleave', (ev)=>{ const drop = ev.target.closest('.drop'); if (drop) drop.classList.remove('is-over'); });
      board.addEventListener('dragover', (ev)=>{ if (ev.target.closest('.drop')) ev.preventDefault(); });
      board.addEventListener('drop', (ev)=>{ const drop = ev.target.closest('.drop'); if (!drop) return;
        ev.preventDefault();
        const id = ev.dataTransfer.getData('text/plain');
        const s = store.get();
        const t = s.tasks.find(x=>x.id===id); if (!t) return;
        const moved = { ...t, status: drop.dataset.status };
        const nextTasks = s.tasks.map(x=>x.id===id? moved : x);
        store.update(()=>({ ...s, tasks: nextTasks }));
        drop.classList.remove('is-over');
      }, { once:true });
    }

    // Table
    const tableWrap = el('div', { id:'tableWrap', className:'card', style: viewMode==='table'?'':'display:none' });
    tableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Assignee</th>
            <th id="sortDue" style="cursor:pointer">Due ${state.ui.sortDueAsc?'▾':'▴'}</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Note</th>
            <th style="width:1%">Files</th>
          </tr>
        </thead>
        <tbody id="taskTable"></tbody>
      </table>`;
    root.append(tableWrap);

    if (viewMode==='table'){
      const body = tableWrap.querySelector('#taskTable');
      let arr = projectTasks(pid).filter(matchesFilters);

      // sort by due
      arr.sort((a,b)=>{
        if(!a.due_date && !b.due_date) return 0;
        if(!a.due_date) return 1;
        if(!b.due_date) return -1;
        return state.ui.sortDueAsc ? a.due_date.localeCompare(b.due_date) : b.due_date.localeCompare(a.due_date);
      });

      body.innerHTML='';
      arr.forEach(t=>{
        const u = getUser(t.assignee_user_id);
        const tr = el('tr');

        const titleTd = el('td');
        titleTd.textContent = t.title;
        tr.appendChild(titleTd);

        const assTd = el('td');
        assTd.textContent = u?u.name:'—';
        tr.appendChild(assTd);

        const dueTd = el('td');
        dueTd.textContent = t.due_date ? fmtDate(t.due_date) : '—';
        tr.appendChild(dueTd);

        const priTd = el('td');
        priTd.textContent = t.priority;
        tr.appendChild(priTd);

        // Inline status editor
        const stTd = el('td');
        const stSel = el('select', { title:'Status' });
        STATUS.forEach(sv=> stSel.appendChild(el('option', { value:sv, textContent: sv.replace('_',' ') })));
        stSel.value = t.status;
        stSel.onchange = ()=> {
          const nv = stSel.value;
          store.update(s=>({
            ...s,
            tasks: s.tasks.map(x=> x.id===t.id ? { ...x, status:nv } : x)
          }));
        };
        stTd.appendChild(stSel);
        tr.appendChild(stTd);

        const noteTd = el('td');
        noteTd.textContent = t.note_id || '—';
        tr.appendChild(noteTd);

        // Attachments action (button only)
        const filesTd = el('td');
        const attBtn = el('button', { className:'ghost', title:'Attachments', style:'padding:4px 8px' });
        attBtn.textContent = `📎 ${attCount(t)}`;
        attBtn.onclick = ()=> openAttachmentModal(t.id);
        filesTd.appendChild(attBtn);
        tr.appendChild(filesTd);

        body.appendChild(tr);
      });

      const dueHeader = tableWrap.querySelector('#sortDue');
      dueHeader.onclick = ()=>{
        const ui = store.get().ui;
        store.set({ ui: { ...ui, sortDueAsc: !ui.sortDueAsc } });
      };
    }

    // View toggles
    const ui = store.get().ui;
    root.querySelector('#viewKanban').onclick = ()=> store.set({ ui: { ...ui, viewMode: 'kanban' } });
    root.querySelector('#viewTable').onclick = ()=> store.set({ ui: { ...ui, viewMode: 'table' } });

    // Filter interactions
    const pushFilters = ()=>{
      const ui2 = store.get().ui;
      store.set({ ui: { ...ui2, taskFilters: {
        assignee: fAssignee.value,
        status: fStatus.value,
        priority: fPriority.value,
        due: fDue.value,
        search: fSearch.value.trim()
      }}});
    };

    fAssignee.onchange = pushFilters;
    fStatus.onchange   = pushFilters;
    fPriority.onchange = pushFilters;
    fDue.onchange      = pushFilters;
    fSearch.oninput    = ()=> { // mild debounce not necessary here; render is cheap
      pushFilters();
    };
    fClear.onclick     = ()=>{
      fAssignee.value='all';
      fStatus.value='all';
      fPriority.value='all';
      fDue.value='all';
      fSearch.value='';
      pushFilters();
    };
  }

  // subscribe to relevant changes
  store.subscribe((_, keys)=>{
    if (keys.some(k=>['tasks','notes','users','ui'].includes(k))) render();
  });

  // initial paint
  render();
}
