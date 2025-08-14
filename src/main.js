// ================== DOM helpers ==================
export const $ = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
export function el(tag, props={}, children=[]){
  const node = Object.assign(document.createElement(tag), props);
  for (const ch of (Array.isArray(children)?children:[children])){
    if (ch==null) continue;
    node.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
  }
  return node;
}
export const clear = (node)=> node.innerHTML='';

export const fmtDate = (d)=> new Date(d).toLocaleDateString();
export const todayStr = ()=> new Date().toISOString().slice(0,10);
export function daysUntil(dateStr){
  if (!dateStr) return NaN;
  const d = new Date(dateStr);
  const t = new Date();
  return Math.floor((d - new Date(t.getFullYear(), t.getMonth(), t.getDate()))/86400000);
}

// ================== Store ==================
export function createStore(initial){
  let state = structuredClone(initial);
  const subs = [];
  function get(){ return state; }
  function set(patch){
    const changed = [];
    for (const [k,v] of Object.entries(patch)){
      const before = state[k];
      if (typeof v === 'object' && v && !Array.isArray(v)){
        state[k] = { ...before, ...v };
      } else {
        state[k] = v;
      }
      changed.push(k);
    }
    emit(changed);
  }
  function update(fn){
    const next = fn(structuredClone(state));
    set(next);
  }
  function subscribe(fn){
    subs.push(fn);
    return ()=>{ const i = subs.indexOf(fn); if (i>=0) subs.splice(i,1); };
  }
  function emit(changedKeys = Object.keys(state)){ subs.forEach(fn=>fn(state, changedKeys)); }
  return { get, set, update, subscribe, emit };
}

// ================== Storage ==================
const STORAGE_KEY = 'essco_tracker_db_v1';
let saveTimer = null;
export const storage = {
  async load(schema){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw){
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
        return structuredClone(schema);
      }
      const parsed = JSON.parse(raw);
      if (parsed.version !== schema.version){
        const merged = { ...schema, ...parsed };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }catch{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
      return structuredClone(schema);
    }
  },
  save(state){
    if (saveTimer) clearTimeout(saveTimer);
    const ss = document.getElementById('saveStatus');
    if (ss){ ss.textContent = 'Saving…'; }
    saveTimer = setTimeout(()=>{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const el = document.getElementById('saveStatus');
      if (el){ el.textContent = 'All changes saved'; }
    }, 250);
  },
  exportJSON(state){
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `essco-tracker-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  },
  async importJSON(file){
    const text = await file.text();
    const incoming = JSON.parse(text);
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const merged = { ...current, ...incoming, version: incoming.version || current.version || 1 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }
};

// ================== Schema (v1) ==================
export const schemaV1 = {
  version: 1,
  users: [
    {id:'u1', name:'Ava', email:'ava@essco.local'},
    {id:'u2', name:'Ben', email:'ben@essco.local'},
    {id:'u3', name:'Cam', email:'cam@essco.local'},
    {id:'u4', name:'Dee', email:'dee@essco.local'},
  ],
  projects: [
    {id:'p1', job_number:'1334', name:'AVC The Commons', client:'AVC', status:'active', pm_user_id:'u2', start_date:'2025-01-10'},
    {id:'p2', job_number:'1338', name:'Pierce College ILB', client:'LACCD', status:'active', pm_user_id:'u3', start_date:'2025-03-01'},
    {id:'p3', job_number:'1340', name:'Banning Childcare', client:'LAUSD', status:'hold', pm_user_id:'u1', start_date:'2025-02-12'},
    {id:'p4', job_number:'1350', name:'ETI and Master File', client:'ETI', status:'active', pm_user_id:'u4', start_date:'2025-05-20'},
  ],
  notes: [
    {id:'n1', project_id:'p1', meeting_date:'2025-08-01', body:'Agenda: Safety, Schedule.\nDecisions:\n- Proceed with feeder reroute.\nNext steps:\n- Submit RFI #12.'},
    {id:'n2', project_id:'p1', meeting_date:'2025-08-12', body:'Submittals lagging. Weekly check-ins.\nDecision: split panel order.'},
    {id:'n3', project_id:'p2', meeting_date:'2025-07-30', body:'Hold pending DSA comment response.'},
  ],
  tasks: [
    {id:'t1', project_id:'p1', note_id:'n1', title:'Draft RFI #12', assignee_user_id:'u1', status:'in_progress', priority:'med', due_date:'2025-08-10'},
    {id:'t2', project_id:'p1', note_id:'n1', title:'Feeder reroute layout', assignee_user_id:'u2', status:'backlog', priority:'high', due_date:'2025-08-16'},
    {id:'t3', project_id:'p1', note_id:'n2', title:'Panel split procurement', assignee_user_id:'u4', status:'blocked', priority:'high', due_date:'2025-08-08'},
    {id:'t4', project_id:'p2', note_id:'n3', title:'Reply to DSA comments', assignee_user_id:'u3', status:'backlog', priority:'med', due_date:'2025-08-22'},
    {id:'t5', project_id:'p4', note_id:null, title:'Create master spec index', assignee_user_id:'u2', status:'in_progress', priority:'low', due_date:'2025-08-25'},
  ],
  ui: { selectedProjectId:'p1', activeTab:'notes', viewMode:'kanban', sortDueAsc:true, searchTerm:'' }
};

// ================== File handles (IDB) ==================
export const fileDB = (()=> {
  const DB = 'essco_fs', STORE = 'handles';
  function open(){ return new Promise((res,rej)=>{
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath:'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej(req.error);
  });}
  async function putHandle(handle){
    const db = await open(); const id = crypto.randomUUID();
    await new Promise((res,rej)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put({ id, handle });
      tx.oncomplete=res; tx.onerror=()=>rej(tx.error);
    });
    return id;
  }
  async function getHandle(id){
    const db = await open();
    return new Promise((res,rej)=>{
      const tx=db.transaction(STORE,'readonly');
      const rq=tx.objectStore(STORE).get(id);
      rq.onsuccess=()=>res(rq.result?.handle||null);
      rq.onerror=()=>rej(rq.error);
    });
  }
  async function delHandle(id){
    const db = await open();
    return new Promise((res,rej)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete=res; tx.onerror=()=>rej(tx.error);
    });
  }
  return { putHandle, getHandle, delHandle };
})();

// ================== Views ==================
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

function mountNotes(root, store){
  const projectNotes = (pid)=> store.get().notes.filter(n=>n.project_id===pid).sort((a,b)=>b.meeting_date.localeCompare(a.meeting_date));
  const makeId = (prefix)=> prefix + Math.random().toString(36).slice(2,8);
  function render(){
    clear(root);
    const state = store.get();
    const pid = state.ui.selectedProjectId;

    const wrap = el('div', { className:'split' });
    const left = el('div', { className:'card' });
    left.appendChild(el('h3', { textContent:'Meeting notes' }));
    const notesList = el('div', { className:'grid', style:'gap:8px' });
    const empty = el('div', { className:'empty', style:'display:none', textContent:'No notes yet.' });
    left.append(notesList, empty);

    const right = el('div', { className:'card' });
    right.append(el('h3', { textContent:'New note' }));
    const row = el('div', { className:'row' });
    const dateInput = el('input', { type:'date', id:'noteDate', value: todayStr() });
    const spacer = el('div', { className:'spacer' });
    const saveBtn = el('button', { className:'primary', id:'saveNote', textContent:'Save Note' });
    row.append(dateInput, spacer, saveBtn);
    const body = el('textarea', { id:'noteBody', rows:10, style:'width:100%;margin-top:8px', placeholder:'Agenda:\n1) Safety\n2) Schedule\nDecisions:\n- ...\nNext steps:' });
    right.append(row, body);

    wrap.append(left, right);
    root.appendChild(wrap);

    const arr = projectNotes(pid);
    notesList.innerHTML=''; empty.style.display = arr.length ? 'none' : 'block';
    arr.forEach(n=>{
      const card = el('div', { className:'note' });
      const header = el('div', { style:'display:flex;justify-content:space-between;gap:8px;align-items:center' });
      const linked = store.get().tasks.filter(t=>t.project_id===n.project_id && t.note_id===n.id).length;
      header.innerHTML = `<div><strong>${fmtDate(n.meeting_date)}</strong> <span class="muted">(${linked} task${linked===1?'':'s'})</span></div><span class="pill">Note ${n.id}</span>`;
      const bodyEl = el('div', { style:'margin-top:6px;white-space:pre-wrap' }); bodyEl.textContent = n.body;
      card.append(header, bodyEl);
      notesList.appendChild(card);
    });

    saveBtn.addEventListener('click', ()=>{
      const text = body.value.trim();
      const date = dateInput.value || todayStr();
      if (!text) { alert('Write something first.'); return; }
      const note = { id: makeId('n'), project_id: pid, meeting_date: date, body: text };
      store.update(s=>({ ...s, notes: [...s.notes, note] }));
    });
  }
  store.subscribe((_, keys)=>{ if (keys.some(k=>['notes','tasks','ui'].includes(k))) render(); });
  render();
}

function mountTasks(root, store){
  const getUser = (id)=> store.get().users.find(u=>u.id===id);
  const projectTasks = (pid)=> store.get().tasks.filter(t=>t.project_id===pid);
  const projectNotes = (pid)=> store.get().notes.filter(n=>n.project_id===pid).sort((a,b)=>b.meeting_date.localeCompare(a.meeting_date));
  const makeId = (prefix)=> prefix + Math.random().toString(36).slice(2,8);
  const STATUS = ['backlog','in_progress','blocked','done'];

  const badge = (text, cls)=>{ const s = el('span', { className:`pill ${cls||''}` }); s.textContent = text; return s; };
  const attCount = (t)=> (t.attachments?.length||0);

  function taskCard(t){
    const u = getUser(t.assignee_user_id);
    const du = t.due_date ? daysUntil(t.due_date) : NaN;
    let chip='chip-ok', tip='OK';
    if (!Number.isNaN(du) && du<0){ chip='chip-bad'; tip='Overdue'; }
    else if (!Number.isNaN(du) && du<=3){ chip='chip-warn'; tip='Due soon'; }
    const card = el('div', { className:'task', draggable:true, id:t.id });
    card.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
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
    head.append(el('h3', { textContent: 'Attachments' }),
                el('button', { className:'ghost', textContent:'×', onclick:()=>modal.remove() }));
    const list = el('div', { className:'att-list' });

    function renderList(){
      list.innerHTML='';
      (t.attachments||[]).forEach(att=>{
        const row = el('div', { className:'att-item' });
        row.append(
          el('div', { className:'name', textContent: att.name }),
          el('div', {}, [
            el('button', { className:'ghost', textContent:'Open', onclick:()=>openAttachment(att) }),
            el('button', { className:'ghost', textContent:'Remove', onclick:()=>{ removeAttachment(taskId, att); row.remove(); } })
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
      el('button', { className:'primary', textContent:'Add files', onclick:()=>pickAndAttach(taskId).then(()=>{ renderList(); refreshAttBadge(taskId); }) }),
      el('button', { className:'ghost', textContent:'Close', onclick:()=>modal.remove() })
    );

    panel.append(head, list, actions);
    modal.append(panel);
    document.body.appendChild(modal);
    renderList();
  }

  function refreshAttBadge(taskId){
    const s = store.get();
    const t = s.tasks.find(x=>x.id===taskId);
    const btn = document.getElementById(taskId)?.querySelector('[data-att-btn]');
    if (btn) btn.textContent = `📎 ${attCount(t||{})}`;
  }

  function render(){
    clear(root);
    const state = store.get();
    const pid = state.ui.selectedProjectId;

    const topRow = el('div', { className:'row' });
    topRow.append(el('div', { className:'pill', textContent:'View:' }));
    const switchRow = el('div', { className:'row' });
    const btnKanban = el('button', { id:'viewKanban', className:'tab' + (state.ui.viewMode==='kanban'?' active':''), textContent:'Kanban' });
    const btnTable = el('button', { id:'viewTable', className:'tab' + (state.ui.viewMode==='table'?' active':''), textContent:'Table' });
    switchRow.append(btnKanban, btnTable);
    const spacer = el('div', { className:'spacer' });
    const summary = el('div', { id:'summaryBadges', className:'row' });
    topRow.append(switchRow, spacer, summary);

    const kanban = el('div', { id:'kanban', className:'kanban', style: state.ui.viewMode==='kanban'?'grid':'display:none' });
    ['backlog','in_progress','blocked','done'].forEach(st=>{
      const col = el('div', { className:'col' });
      col.append(el('h4', { textContent: st.replace('_',' ').replace(/^./,c=>c.toUpperCase()) }));
      const drop = el('div', { className:'drop' }); drop.dataset.status = st;
      col.append(drop); kanban.append(col);
    });

    const tableWrap = el('div', { id:'tableWrap', className:'card', style: state.ui.viewMode==='table'?'':'display:none' });
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
          </tr>
        </thead>
        <tbody id="taskTable"></tbody>
      </table>`;

    const quick = el('div', { className:'card' });
    quick.innerHTML = `<h3>Quick add</h3>`;
    const qrow = el('div', { className:'row' });
    const qaTitle = el('input', { id:'qaTitle', placeholder:'Task title', style:'min-width:260px' });
    const qaAssignee = el('select', { id:'qaAssignee' });
    store.get().users.forEach(u=> qaAssignee.appendChild(el('option', { value:u.id, textContent:u.name })));
    const qaPriority = el('select', { id:'qaPriority' }); qaPriority.innerHTML = `<option value="low">Low</option><option value="med" selected>Med</option><option value="high">High</option>`;
    const qaDue = el('input', { id:'qaDue', type:'date' });
    const qaNoteLink = el('select', { id:'qaNoteLink' });
    qaNoteLink.appendChild(el('option', { value:'', textContent:'(no note link)' }));
    projectNotes(pid).forEach(n=> qaNoteLink.appendChild(el('option', { value:n.id, textContent:`${fmtDate(n.meeting_date)} — ${n.id}` })));
    const qaAdd = el('button', { id:'qaAdd', className:'primary', textContent:'Add' });
    qrow.append(qaTitle, qaAssignee, qaPriority, qaDue, qaNoteLink, qaAdd);
    quick.appendChild(qrow);

    root.append(topRow, kanban, tableWrap, quick);

    // Summary badges
    const open = projectTasks(pid).filter(t=>t.status!=='done');
    const overdue = open.filter(t=>daysUntil(t.due_date)<0).length;
    const soon = open.filter(t=>{ const du=daysUntil(t.due_date); return du>=0 && du<=3; }).length;
    summary.append(badge(`Overdue: ${overdue}`, 'chip-bad'), badge(`Due ≤3d: ${soon}`, 'chip-warn'), badge(`Open: ${open.length}`, ''));

    // Kanban
    if (state.ui.viewMode==='kanban'){
      ['backlog','in_progress','blocked','done'].forEach(st=>{
        const container = root.querySelector(`.drop[data-status="${st}"]`) || Array.from(root.querySelectorAll('.drop')).find(d=>d.dataset.status===st);
        container.innerHTML='';
        projectTasks(pid).filter(t=>t.status===st).forEach(t=> container.appendChild(taskCard(t)));
      });
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
    if (state.ui.viewMode==='table'){
      const body = tableWrap.querySelector('#taskTable');
      let arr = projectTasks(pid).slice();
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
        tr.innerHTML = `
          <td>${t.title} ${attCount(t)?`<span class="pill" title="Attachments">📎 ${attCount(t)}</span>`:''}</td>
          <td>${u?u.name:'—'}</td>
          <td>${t.due_date?fmtDate(t.due_date):'—'}</td>
          <td>${t.priority}</td>
          <td>${t.status.replace('_',' ')}</td>
          <td>${t.note_id||'—'}</td>`;
        tr.addEventListener('click', ()=> openAttachmentModal(t.id));
        body.appendChild(tr);
      });
      const dueHeader = tableWrap.querySelector('#sortDue');
      dueHeader.onclick = ()=>{ const ui = store.get().ui; store.set({ ui: { ...ui, sortDueAsc: !ui.sortDueAsc } }); };
    }

    // View toggles
    const ui = store.get().ui;
    root.querySelector('#viewKanban').onclick = ()=> store.set({ ui: { ...ui, viewMode: 'kanban' } });
    root.querySelector('#viewTable').onclick = ()=> store.set({ ui: { ...ui, viewMode: 'table' } });

    // Quick add
    root.querySelector('#qaAdd').onclick = ()=>{
      const title = qaTitle.value.trim(); if(!title) { alert('Title?'); return; }
      const ass = qaAssignee.value || null;
      const pr = qaPriority.value;
      const due = qaDue.value || null;
      const note = qaNoteLink.value || null;
      const t = { id: makeId('t'), project_id: pid, note_id: note || null, title, assignee_user_id: ass, status:'backlog', priority: pr, due_date: due, attachments: [] };
      store.update(s=>({ ...s, tasks: [...s.tasks, t] }));
      qaTitle.value=''; qaDue.value='';
    };
    qaTitle.addEventListener('keydown', e=>{ if(e.key==='Enter') root.querySelector('#qaAdd').click(); });
  }

  store.subscribe((_, keys)=>{ if (keys.some(k=>['tasks','notes','users','ui'].includes(k))) render(); });
  render();
}

function mountInsights(root, store){
  const projectTasks = (pid)=> store.get().tasks.filter(t=>t.project_id===pid);
  const projectNotes = (pid)=> store.get().notes.filter(n=>n.project_id===pid);
  function drawWorkload(canvas, users, open, du){
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const wCSS = canvas.clientWidth;
    const hCSS = 220;
    canvas.width = Math.floor(wCSS * dpr);
    canvas.height = Math.floor(hCSS * dpr);
    ctx.scale(dpr, dpr);

    const w = wCSS, h = hCSS;
    ctx.clearRect(0,0,w,h);

    const pad=28, gap=18, bw=(w - pad*2 - gap*(users.length-1))/users.length;
    const count = u => open.filter(t=>t.assignee_user_id===u).length;
    const counts = users.map(u=>count(u.id));
    const max = Math.max(1, ...counts);

    const overdueBy = u=>open.filter(t=>t.assignee_user_id===u && !Number.isNaN(du(t.due_date)) && du(t.due_date)<0).length;
    const soonBy    = u=>open.filter(t=>t.assignee_user_id===u && !Number.isNaN(du(t.due_date)) && du(t.due_date)>=0 && du(t.due_date)<=3).length;

    users.forEach((u,i)=>{
      const x = pad + i*(bw+gap); const total = counts[i];
      const oh = (overdueBy(u.id)/max)*(h-50);
      const sh = (soonBy(u.id)/max)*(h-50);
      const kh = ((total - overdueBy(u.id) - soonBy(u.id))/max)*(h-50);
      let y = h-30;
      ctx.fillStyle = '#e45d57'; ctx.fillRect(x, y-oh, bw, oh); y -= oh;
      ctx.fillStyle = '#f0d264'; ctx.fillRect(x, y-sh, bw, sh); y -= sh;
      ctx.fillStyle = '#5ed09b'; ctx.fillRect(x, y-kh, bw, kh);
      ctx.fillStyle = '#a8b0bd'; ctx.textAlign='center'; ctx.font='12px system-ui';
      ctx.fillText(u.name, x+bw/2, h-12);
      ctx.font='bold 12px system-ui'; ctx.fillStyle='#cfe0ff';
      ctx.fillText(String(total), x+bw/2, h-44 - Math.min(h-80, (total/max)*(h-50)));
    });
  }

  function render(){
    clear(root);
    const state = store.get();
    const pid = state.ui.selectedProjectId;
    const tasks = projectTasks(pid);
    const open = tasks.filter(t=>t.status!== 'done');
    const du = d=>{ if(!d) return NaN; const a=new Date(d), n=new Date(); return Math.floor((a - new Date(n.getFullYear(),n.getMonth(),n.getDate()))/86400000); };
    const over = open.filter(t=>!Number.isNaN(du(t.due_date)) && du(t.due_date) < 0).length;
    const soon = open.filter(t=>{ const x=du(t.due_date); return !Number.isNaN(x) && x>=0 && x<=3; }).length;
    const coverage = (()=>{
      const notes = projectNotes(pid);
      const linked = notes.filter(n=>tasks.some(t=>t.note_id===n.id)).length;
      return notes.length ? Math.round((linked/notes.length)*100) : 0;
    })();

    const insights = el('div', { className:'insights' });
    insights.append(
      el('div', { className:'insight' }, [ el('div', { className:'tag', textContent:'Overdue' }), el('div', { className:'big', id:'iOverdue', textContent: String(over) }) ]),
      el('div', { className:'insight' }, [ el('div', { className:'tag', textContent:'Due ≤ 3 days' }), el('div', { className:'big', id:'iSoon', textContent: String(soon) }) ]),
      el('div', { className:'insight' }, [ el('div', { className:'tag', textContent:'Open tasks' }), el('div', { className:'big', id:'iOpen', textContent: String(open.length) }) ]),
      el('div', { className:'insight' }, [ el('div', { className:'tag', textContent:'Notes → Tasks coverage' }), el('div', { className:'big', id:'iCoverage', textContent: coverage + '%' }) ]),
    );

    const card = el('div', { className:'card' });
    card.append(el('h3', { textContent: 'Workload' }));
    const canvas = el('canvas', { id:'workload', height:220 });
    card.append(canvas);
    card.append(el('div', { className:'muted', style:'margin-top:6px', textContent:'Open tasks by person (color hints: overdue / soon / ok).' }));

    root.append(insights, card);
    drawWorkload(canvas, state.users, open, du);
  }

  store.subscribe((_, keys)=>{ if (keys.some(k=>['tasks','notes','users','ui'].includes(k))) render(); });
  window.addEventListener('resize', ()=>{ if (store.get().ui.activeTab==='insights') render(); });
  render();
}

// ================== Boot ==================
(async function main(){
  const initial = await storage.load(schemaV1);
  const store = createStore(initial);

  // save on changes
  store.subscribe((state)=> storage.save(state));

  // Sidebar
  mountSidebar(document.getElementById('projList'), document.getElementById('search'), store);

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

  // Tabs
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

  // Kick
  store.emit();

  // Service worker (auto-refresh on update)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }
})();
