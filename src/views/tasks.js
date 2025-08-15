// src/views/tasks.js
import { fileDB as fileDBMod } from '../storage/fileDB.js';
import { clear, el, highlightText, toast } from '../ui/dom.js';
import { daysUntil, fmtDate, formatRelative } from '../utils/date.js';

// Matches other parts of the app
const STATUS = ['backlog','in_progress','blocked','done'];
const PRIORITIES = ['low','med','high'];

// unify fileDB source (module import first, then optional global)
const fileDB = (typeof window !== 'undefined' && window.fileDB) ? window.fileDB : fileDBMod;
const supportsPicker = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

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

  // --- file/attachments shims so this works even without new fileDB helpers ---
  const hasFileDB = () => !!fileDB;

  async function ensurePermission(handle){
    if (!handle) return false;
    const q = await handle.queryPermission?.({ mode:'read' });
    if (q === 'granted') return true;
    const r = await handle.requestPermission?.({ mode:'read' });
    return r === 'granted';
  }

  async function fdGetHandle(id){
    if (!hasFileDB() || !fileDB.getHandle) return null;
    try { return await fileDB.getHandle(id); } catch { return null; }
  }

  async function fdGetFile(id){
    if (!hasFileDB()) return null;
    if (typeof fileDB.getFile === 'function') {
      try { return await fileDB.getFile(id); } catch { return null; }
    }
    const h = await fdGetHandle(id);
    if (!h) return null;
    const ok = await ensurePermission(h);
    if (!ok) return null;
    try { return await h.getFile(); } catch { return null; }
  }

  async function fdGetMeta(id){
    if (!hasFileDB()) return { stale:true };
    if (typeof fileDB.getMeta === 'function') {
      try { return await fileDB.getMeta(id); } catch { /* fall through */ }
    }
    // derive from handle/file
    const h = await fdGetHandle(id);
    if (!h) return { stale:true };
    try {
      const ok = await ensurePermission(h);
      if (!ok) return { name:h.name, kind:h.kind, stale:true };
      const f = await h.getFile();
      return { name:h.name, kind:h.kind, type:f.type, size:f.size, lastModified:f.lastModified };
    } catch {
      return { name:h.name, kind:h.kind, stale:true };
    }
  }

  async function fdPutHandle(handle){
    if (!hasFileDB() || !fileDB.putHandle) throw new Error('fileDB not available');
    return await fileDB.putHandle(handle);
  }

  async function relinkAttachment(taskId, att){
    if (!supportsPicker) { toast('Relink not supported in this browser.', { type:'warn' }); return null; }
    const picks = await showOpenFilePicker({ multiple:false });
    const h = picks[0]; if (!h) return null;
    // If fileDB exposes relink, prefer it
    if (hasFileDB() && typeof fileDB.relink === 'function') {
      try { return await fileDB.relink(att.id, h); } catch { /* fall through */ }
    }
    // Fallback: create a new record and replace the attachment id in state
    const newId = await fdPutHandle(h);
    store.update(s=>({
      tasks: s.tasks.map(t => t.id===taskId
        ? { ...t, attachments: (t.attachments||[]).map(a => a.id===att.id ? { ...a, id:newId, name:h.name, kind:h.kind||'file' } : a) }
        : t)
    }));
    return { id:newId, name:h.name, kind:h.kind||'file' };
  }

  // --- Attachments UI helpers ---
  const attCount = (t)=> (t.attachments?.length || 0);

  async function pickAndAttach(taskId){
    if (!supportsPicker || !hasFileDB()){
      toast('Local file linking not supported here. Try Chrome/Edge on desktop.', { type:'warn' });
      return;
    }
    try{
      const picks = await showOpenFilePicker({ multiple:true });
      const newMetas = [];
      for (const h of picks){
        const id = await fdPutHandle(h);
        newMetas.push({ id, name: h.name, kind: h.kind || 'file' });
      }
      store.update(s=>({
        tasks: s.tasks.map(t => t.id===taskId ? { ...t, attachments: [...(t.attachments||[]), ...newMetas] } : t)
      }));
      toast(`${newMetas.length} file${newMetas.length>1?'s':''} attached`, { type:'success' });
    }catch{ /* cancel or error */ }
  }

  async function openAttachment(att, taskId){
    if (!hasFileDB()){
      toast('Attachments unavailable in this browser.', { type:'warn' });
      return;
    }
    const file = await fdGetFile(att.id);
    if (!file){
      const meta = await fdGetMeta(att.id);
      if (meta?.stale) {
        toast('This file needs to be relinked.', {
          type:'warn',
          action:{ label:'Relink', onClick: async () => {
            const res = await relinkAttachment(taskId, att);
            toast(res ? 'Relinked' : 'Relink cancelled', { type: res ? 'success' : 'warn' });
          }}
        });
      } else {
        toast('Missing or denied permission to open file.', { type:'error' });
      }
      return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
    setTimeout(()=> URL.revokeObjectURL(url), 10_000);
  }

  async function removeAttachment(taskId, att){
    // Update state first; IDB deletion best-effort
    store.update(s=>({
      tasks: s.tasks.map(t => t.id===taskId ? { ...t, attachments: (t.attachments||[]).filter(a=>a.id!==att.id) } : t)
    }));
    if (hasFileDB() && typeof fileDB.delHandle === 'function'){
      try{ await fileDB.delHandle(att.id); }catch{}
    }
    toast('Attachment removed', { type:'success' });
  }

  function openAttachmentModal(taskId){
    const t = store.get().tasks.find(x=>x.id===taskId);
    const modal = el('div', { className:'modal' });
    const panel = el('div', { className:'panel', role:'dialog', 'aria-modal':'true' });
    const headingId = makeId('att_');
    const head = el('div', { className:'row' });
    head.append(
      el('h3', { id: headingId, textContent: 'Attachments' }),
      el('button', { className:'btn-icon', title:'Close', 'aria-label':'Close', onclick:()=>closeModal() }, '×')
    );
    panel.setAttribute('aria-labelledby', headingId);

    const list = el('div', { className:'att-list' });

    async function renderList(){
      list.replaceChildren();
      const items = (t.attachments||[]);
      if (!items.length){
        list.append(el('div', { className:'empty', textContent:'No attachments yet.' }));
        return;
      }
      for (const att of items){
        const meta = await fdGetMeta(att.id);
        const row = el('div', { className:'att-item' });
        const left = el('div', { className:'name' });

        left.append(el('span', { textContent: meta?.name || att.name }));
        const chips = el('div', { className:'row' });
        if (meta?.type) chips.append(el('span', { className:'pill', textContent: meta.type }));
        if (Number.isFinite(meta?.size)) chips.append(el('span', { className:'pill', textContent: humanFileSize(meta.size) }));
        if (meta?.lastModified) chips.append(el('span', { className:'pill', textContent: new Date(meta.lastModified).toLocaleDateString() }));
        if (chips.childNodes.length) left.append(chips);

        const right = el('div', { className:'row' });
        right.append(
          el('button', { className:'ghost', title:'Open', onclick:()=>openAttachment(att, t.id) }, 'Open'),
          ...(meta?.stale ? [el('button', { className:'ghost', title:'Relink', onclick:async ()=>{
            const rel = await relinkAttachment(t.id, att);
            if (rel) { await renderList(); toast('Relinked', { type:'success' }); }
            else toast('Relink cancelled', { type:'warn' });
          } }, 'Relink')] : []),
          el('button', { className:'ghost', title:'Remove', onclick:()=>{ removeAttachment(t.id, att); renderList(); } }, 'Remove')
        );

        row.append(left, right);
        list.appendChild(row);
      }
    }

    const actions = el('div', { className:'row', style:'margin-top:10px' });
    actions.append(
      el('button', { className:'primary', title:'Add files', onclick:()=>pickAndAttach(taskId).then(renderList) }, 'Add files'),
      el('button', { className:'ghost', title:'Close', onclick:()=>closeModal() }, 'Close')
    );

    panel.append(head, list, actions);
    modal.append(panel);
    document.body.appendChild(modal);

    // Focus management (trap + restore)
    const prevFocus = document.activeElement;
    const focusables = () => Array.from(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.hasAttribute('disabled'));
    (focusables()[0] || panel).focus();

    function onKey(e){
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      if (e.key === 'Tab'){
        const els = focusables();
        if (!els.length) return;
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

    renderList();
  }

  // --- UI bits shared by Kanban & Table ---
  function badge(text, cls){
    const s = el('span', { className:`pill ${cls||''}` });
    s.textContent = text; return s;
  }

  function taskCard(t, searchTerm){
    const u = getUser(t.assignee_user_id);
    const du = t.due_date ? daysUntil(t.due_date) : NaN;
    let chip='chip-ok', tip='OK';
    if (!Number.isNaN(du) && du < 0){ chip='chip-bad'; tip='Overdue'; }
    else if (!Number.isNaN(du) && du <= 3){ chip='chip-warn'; tip='Due soon'; }

    const card = el('div', { className:'task', draggable:true, id:t.id });
    const top = el('div', { style:'display:flex;justify-content:space-between;gap:8px;align-items:center' });

    const title = el('div', {});
    title.textContent = t.title;
    if (searchTerm) highlightText(title, searchTerm);

    const attBtn = el('button', {
      className:'btn-icon ghost',
      title:`Attachments (${attCount(t)})`,
      'aria-label':'Attachments',
      onclick: ()=> openAttachmentModal(t.id)
    }, '📎');

    top.append(title, attBtn);

    const meta = el('div', { className:'meta' });
    meta.append(
      el('span', { className:'pill assignee', textContent: u?u.name:'Unassigned' }),
      el('span', { className:'pill prio', textContent: `P: ${t.priority}` }),
      el('span', {
        className:`pill due ${chip}`,
        title: t.due_date ? fmtDate(t.due_date) : 'No due',
        'aria-label': `Due: ${t.due_date ? fmtDate(t.due_date) : 'No due'} (${tip})`
      }, t.due_date ? formatRelative(t.due_date) : 'No due'),
      ...(t.note_id ? [el('span', { className:'pill', textContent:`Note ${t.note_id}` })] : [])
    );

    card.append(top, meta);
    card.addEventListener('dragstart', ev=>{ ev.dataTransfer.setData('text/plain', t.id); });
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

    // Filters row
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
    const kanban = el('div', { id:'kanban', className:'kanban', style: viewMode==='kanban' ? '' : 'display:none' });
    STATUS.forEach(st=>{
      const col = el('div', { className:'col' });
      col.append(el('h4', { textContent: st.replace('_',' ').replace(/^./,c=>c.toUpperCase()) }));
      const drop = el('div', { className:'drop' }); drop.dataset.status = st;
      const list = projectTasks(pid).filter(t=>t.status===st).filter(matchesFilters);
      list.forEach(t=> drop.appendChild(taskCard(t, filters.search)));
      col.append(drop); kanban.append(col);
    });
    root.append(kanban);

    // Kanban DnD delegation
    if (viewMode==='kanban'){
      const board = kanban;
      board.addEventListener('dragenter', (ev)=>{ const d = ev.target.closest('.drop'); if (d) d.classList.add('is-over'); });
      board.addEventListener('dragleave', (ev)=>{ const d = ev.target.closest('.drop'); if (d) d.classList.remove('is-over'); });
      board.addEventListener('dragover', (ev)=>{ if (ev.target.closest('.drop')) ev.preventDefault(); });
      board.addEventListener('drop', (ev)=>{ const drop = ev.target.closest('.drop'); if (!drop) return;
        ev.preventDefault();
        const id = ev.dataTransfer.getData('text/plain');
        const s = store.get();
        const t = s.tasks.find(x=>x.id===id); if (!t) return;
        if (t.status === drop.dataset.status) return;
        store.update((_s)=>({ tasks: s.tasks.map(x=>x.id===id? { ...x, status: drop.dataset.status } : x) }));
        drop.classList.remove('is-over');
      });
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

        const titleTd = el('td', { title: t.title });
        titleTd.textContent = t.title;
        if (filters.search) highlightText(titleTd, filters.search);
        tr.appendChild(titleTd);

        const assTd = el('td');
        assTd.textContent = u?u.name:'—';
        tr.appendChild(assTd);

        const dueTd = el('td', { title: t.due_date ? fmtDate(t.due_date) : '' });
        dueTd.textContent = t.due_date ? formatRelative(t.due_date) : '—';
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
          store.update(s=>({ tasks: s.tasks.map(x=> x.id===t.id ? { ...x, status:nv } : x) }));
        };
        stTd.appendChild(stSel);
        tr.appendChild(stTd);

        const noteTd = el('td');
        noteTd.textContent = t.note_id || '—';
        tr.appendChild(noteTd);

        // Attachments action (button only)
        const filesTd = el('td');
        const attBtn = el('button', { className:'btn-icon ghost', title:`Attachments (${attCount(t)})`, 'aria-label':'Attachments' }, '📎');
        attBtn.onclick = ()=> openAttachmentModal(t.id);
        filesTd.appendChild(attBtn);
        tr.appendChild(filesTd);

        body.appendChild(tr);
      });

      const dueHeader = tableWrap.querySelector('#sortDue');
      dueHeader.onclick = ()=>{
        const ui = store.get().ui || {};
        store.set({ ui: { ...ui, sortDueAsc: !ui.sortDueAsc } });
      };
    }

    // View toggles
    const ui = store.get().ui || {};
    root.querySelector('#viewKanban').onclick = ()=> store.set({ ui: { ...ui, viewMode: 'kanban' } });
    root.querySelector('#viewTable').onclick = ()=> store.set({ ui: { ...ui, viewMode: 'table' } });

    // Filter interactions
    const pushFilters = ()=>{
      const ui2 = store.get().ui || {};
      store.set({ ui: { ...ui2, taskFilters: {
        assignee: fAssignee.value,
        status: fStatus.value,
        priority: fPriority.value,
        due: fDue.value,
        search: fSearch.value.trim()
      } }});
    };

    fAssignee.onchange = pushFilters;
    fStatus.onchange   = pushFilters;
    fPriority.onchange = pushFilters;
    fDue.onchange      = pushFilters;
    fSearch.oninput    = ()=> { pushFilters(); };
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

/* ---------- small utils ---------- */
function humanFileSize(bytes){
  if (!Number.isFinite(bytes)) return '';
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) return bytes + ' B';
  const units = ['KB','MB','GB','TB'];
  let u = -1;
  do { bytes /= thresh; ++u; } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(1) + ' ' + units[u];
}
