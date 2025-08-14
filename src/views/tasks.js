// src/views/tasks.js
import { fileDB } from '../storage/fileDB.js';
import { clear, el } from '../ui/dom.js';
import { daysUntil, fmtDate } from '../utils/date.js';

export function mountTasks(root, store){
  const getUser = (id)=> store.get().users.find(u=>u.id===id);
  const projectTasks = (pid)=> store.get().tasks.filter(t=>t.project_id===pid);
  const projectNotes = (pid)=> store.get().notes
    .filter(n=>n.project_id===pid)
    .sort((a,b)=>b.meeting_date.localeCompare(a.meeting_date));
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
    STATUS.forEach(st=>{
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
      STATUS.forEach(st=>{
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
