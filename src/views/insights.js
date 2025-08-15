
// src/views/insights.js
import { clear, el } from '../ui/dom.js';

export function mountInsights(root, store){
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

  store.subscribe((_, keys)=>{
    if (keys.some(k=>['tasks','notes','users','ui'].includes(k))) render();
  });
  window.addEventListener('resize', ()=>{ if (store.get().ui.activeTab==='insights') render(); });
  render();
}
