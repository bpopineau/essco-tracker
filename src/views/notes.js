// src/views/notes.js
import { clear, el } from '../ui/dom.js';
import { fmtDate, todayStr } from '../utils/date.js';

export function mountNotes(root, store){
  const projectNotes = (pid)=> store.get().notes
    .filter(n=>n.project_id===pid)
    .sort((a,b)=>b.meeting_date.localeCompare(a.meeting_date));

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
    const body = el('textarea', {
      id:'noteBody', rows:10, style:'width:100%;margin-top:8px',
      placeholder:'Agenda:\n1) Safety\n2) Schedule\nDecisions:\n- ...\nNext steps:'
    });
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
      const bodyEl = el('div', { style:'margin-top:6px;white-space:pre-wrap' });
      bodyEl.textContent = n.body;
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

  store.subscribe((_, keys)=>{
    if (keys.some(k=>['notes','tasks','ui'].includes(k))) render();
  });
  render();
}
