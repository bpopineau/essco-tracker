// @ts-check
// src/views/notes.js

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} project_id
 * @property {string=} body
 * @property {(string|null)=} meeting_date
 * @property {boolean=} pinned
 */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} project_id
 * @property {(string|null|undefined)=} note_id
 */

/**
 * @typedef {Object} State
 * @property {Note[]} notes
 * @property {Task[]} tasks
 * @property {any} ui
 */
import { clear, el, highlightText, toast } from '../ui/dom.js';
import { fmtDate, parseDate, todayStr } from '../utils/date.js';

export function mountNotes(root, store){
  const makeId = (prefix)=> prefix + Math.random().toString(36).slice(2,8);
  const nBool = (v)=> (v ? 1 : 0);

  const projectNotes = (pid)=> store.get().notes
    .filter(n=>n.project_id===pid)
    .sort((a,b)=>{
      // pinned first, then newest meeting_date first
      const pinCmp = nBool(b.pinned) - nBool(a.pinned);
      if (pinCmp) return pinCmp;
      const da = parseDate(a.meeting_date || '');
      const db = parseDate(b.meeting_date || '');
      return db - da;
    });

  const ensureUI = ()=>{
    const s = store.get(); const ui = s.ui || {};
    let changed = false;
    if (ui.noteSearch == null) { ui.noteSearch = ''; changed = true; }
    if (ui.editingNoteId == null) { ui.editingNoteId = null; changed = true; }
    if (changed) store.set({ ui });
    return ui;
  };

  function render(){
    clear(root);
    const state = store.get();
    const pid = state.ui.selectedProjectId;
    const ui = ensureUI();
    const searchTerm = ui.noteSearch || '';

    const wrap = el('div', { className:'split' });

    /* -------- left: notes list -------- */
    const left = el('div', { className:'card' });
    left.appendChild(el('h3', { textContent:'Meeting notes' }));

    const searchRow = el('div', { className:'row', style:'gap:8px;margin-bottom:6px' });
    const search = el('input', { placeholder:'Search notes…', value: searchTerm, style:'min-width:220px' });
    const clearBtn = el('button', { className:'ghost', textContent:'Clear' });
    searchRow.append(search, clearBtn);

    const notesList = el('div', { className:'grid', style:'gap:8px' });
    const empty = el('div', { className:'empty', style:'display:none', textContent:'No notes yet.' });
    left.append(searchRow, notesList, empty);

    /* -------- right: new note composer -------- */
    const right = el('div', { className:'card' });
    right.append(el('h3', { textContent:'New note' }));
    const row = el('div', { className:'row' });
    const dateInput = el('input', { type:'date', id:'noteDate', value: todayStr() });
    const spacer = el('div', { className:'spacer' });
    const saveBtn = el('button', { className:'primary', id:'saveNote', textContent:'Save Note' });
    row.append(dateInput, spacer, saveBtn);
    const body = el('textarea', {
      id:'noteBody', rows:10, style:'width:100%;margin-top:8px',
      placeholder:'Agenda:\n1) Safety\n2) Schedule\nDecisions:\n- ...\nNext steps:\n\nTip: reference tasks with #token (e.g., #t123) to jump to them later.'
    });
    right.append(row, body);

    wrap.append(left, right);
    root.appendChild(wrap);

    /* ---- filtered list ---- */
    const all = projectNotes(pid);
    const arr = searchTerm
      ? all.filter(n => (n.body || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (n.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (n.meeting_date || '').toLowerCase().includes(searchTerm.toLowerCase()))
      : all;

    notesList.replaceChildren();
    empty.style.display = arr.length ? 'none' : 'block';

    arr.forEach(n=>{
      const isEditing = state.ui.editingNoteId === n.id;
      const card = el('div', { className:'note' });

      // header
      const header = el('div', { style:'display:flex;justify-content:space-between;gap:8px;align-items:center' });
      const leftH = el('div');
      const dateEl = el('strong', { title: n.meeting_date ? fmtDate(n.meeting_date) : '', textContent: n.meeting_date ? fmtDate(n.meeting_date) : '—' });
      const countEl = el('span', { className:'muted', style:'margin-left:6px' }, `(${linkedCount(n)} task${linkedCount(n)===1?'':'s'})`);
      leftH.append(dateEl, countEl);

      const rightH = el('div', { className:'row', style:'gap:6px;align-items:center' });
      const idPill = el('span', { className:'pill', title:'Note id', textContent:`Note ${n.id}` });

      const pinBtn = el('button', {
        className:'btn-icon ghost',
        title: n.pinned ? 'Unpin note' : 'Pin note',
        'aria-label': n.pinned ? 'Unpin note' : 'Pin note',
        onclick: ()=> togglePin(n)
      }, n.pinned ? '⭐' : '☆');

      const editBtn = el('button', {
        className:'btn-icon ghost',
        title: isEditing ? 'Cancel edit' : 'Edit note',
        'aria-label': isEditing ? 'Cancel edit' : 'Edit note',
        onclick: ()=> isEditing ? cancelEdit(editBtn) : startEdit(n, editBtn)
      }, isEditing ? '✖' : '✏️');

      const delBtn = el('button', {
        className:'btn-icon ghost',
        title:'Delete note',
        'aria-label':'Delete note',
        onclick: ()=> deleteNote(n)
      }, '🗑');

      rightH.append(idPill, pinBtn, editBtn, delBtn);
      header.append(leftH, rightH);

      // highlight in header if search term
      if (searchTerm) {
        highlightText(dateEl, searchTerm);
        highlightText(idPill, searchTerm);
      }

      // body
      const bodyWrap = el('div', { style:'margin-top:6px' });
      if (isEditing) {
        const ta = el('textarea', { rows:10, style:'width:100%;margin-bottom:8px' });
        ta.value = n.body || '';
        const hint = el('div', { className:'muted', style:'margin-bottom:6px' }, 'Ctrl/Cmd+Enter to save, Esc to cancel');

        const actions = el('div', { className:'row', style:'gap:8px;justify-content:flex-end' });
  const saveEd = el('button', { className:'primary', textContent:'Save' });
  const cancelEd = el('button', { className:'ghost', textContent:'Cancel' });

        ta.addEventListener('keydown', (e)=>{
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); commitEdit(ta.value, n, editBtn); }
          else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(editBtn); }
        });
        saveEd.onclick = ()=> commitEdit(ta.value, n, editBtn);
        cancelEd.onclick = ()=> cancelEdit(editBtn);

        actions.append(cancelEd, saveEd);
        bodyWrap.append(hint, ta, actions);
        setTimeout(()=> ta.focus(), 0);
      } else {
        const bodyEl = el('div', { style:'white-space:pre-wrap' });
        linkifyNoteBody(bodyEl, n.body || '');
        if (searchTerm) highlightText(bodyEl, searchTerm);
        bodyWrap.append(bodyEl);
      }

      card.append(header, bodyWrap);
      notesList.appendChild(card);
    });

    /* ---- interactions ---- */
    const pushSearch = ()=>{
      const ui2 = store.get().ui || {};
      store.set({ ui: { ...ui2, noteSearch: search.value.trim() } });
    };
    search.oninput = pushSearch;
    clearBtn.onclick = ()=>{ search.value = ''; pushSearch(); };

    saveBtn.addEventListener('click', ()=>{
      const text = body.value.trim();
      const date = dateInput.value || todayStr();
      if (!text) { toast('Write something first.', { type:'error' }); return; }
      const note = { id: makeId('n'), project_id: pid, meeting_date: date, body: text, pinned: false };
      store.update(s=>({ notes: [...s.notes, note] }));
      body.value = '';
      toast('Note added', { type:'success' });
    });
  }

  /* ---------- edit helpers ---------- */
  function startEdit(note, _trigger){
    const ui = store.get().ui || {};
    store.set({ ui: { ...ui, editingNoteId: note.id } });
  }

  function cancelEdit(_trigger){
    const ui = store.get().ui || {};
    store.set({ ui: { ...ui, editingNoteId: null } });
    if (_trigger && typeof _trigger.focus === 'function') setTimeout(()=>_trigger.focus(), 0);
    toast('Edit cancelled', { type:'warn' });
  }

  function commitEdit(text, note, _trigger){
    const val = (text || '').trim();
    store.update(s=>({
      notes: s.notes.map(n => n.id === note.id ? { ...n, body: val } : n),
      ui: { ...s.ui, editingNoteId: null }
    }));
    if (_trigger && typeof _trigger.focus === 'function') setTimeout(()=>_trigger.focus(), 0);
    toast('Note updated', { type:'success' });
  }

  /* ---------- other helpers ---------- */
  function deleteNote(note){
    const _s = store.get();
    store.update(st => ({
      notes: st.notes.filter(n => n.id !== note.id),
      ui: { ...st.ui, editingNoteId: st.ui.editingNoteId === note.id ? null : st.ui.editingNoteId }
    }));
    toast(`Deleted note ${note.id}`, {
      type: 'warn',
      action: {
        label: 'Undo',
        onClick: () => {
          store.update(st => ({ notes: [...st.notes, note] }));
          toast('Note restored', { type:'success' });
        }
      }
    });
  }

  function linkedCount(n){
    const s = store.get();
    return s.tasks.filter(t=>t.project_id===n.project_id && t.note_id===n.id).length;
  }


  /**
   * @param {{id: string, pinned: boolean}} note
   */
  function togglePin(note){
    store.update((/** @type {State} */ s) => ({
      notes: s.notes.map((/** @type {Note} */ n) =>
        n.id === note.id ? { ...n, pinned: !n.pinned } : n
      )
    }));
  }

  /**
   * @param {HTMLElement} container
   * @param {string} text
   */
  /** @param {HTMLElement} container @param {string} text */
  function linkifyNoteBody(container, text){
    container.replaceChildren();
    if (!text) return container.appendChild(document.createTextNode(''));
    const re = /#([A-Za-z0-9._-]{2,})/g;
    let idx = 0, m;
    while ((m = re.exec(text))){
      const before = text.slice(idx, m.index);
      if (before) container.appendChild(document.createTextNode(before));

      const token = m[1];
      const chip = el('button', {
        className:'pill',
        title:`Search tasks for “${token}”`,
        onclick: ()=>{
          const ui = store.get().ui || {};
          const tf = (ui.taskFilters || { assignee:'all', status:'all', priority:'all', due:'all', search:'' });
          store.set({ ui: { ...ui, activeTab:'tasks', taskFilters: { ...tf, search: token } } });
          toast(`Jumped to Tasks filtered by “${token}”`, { type:'success' });
        }
      }, `#${token}`);
      container.appendChild(chip);
      idx = m.index + m[0].length;
    }
    const rest = text.slice(idx);
    if (rest) container.appendChild(document.createTextNode(rest));
  }

  store.subscribe((/** @type {State} */ _, /** @type {string[]} */ keys) => {
    if (keys.some(k => ['notes','tasks','ui'].includes(k))) render();
  });

  render();
}
