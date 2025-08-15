// src/views/insights.js
import { clear, el } from '../ui/dom.js';
import { isOverdue, isWithinNextNDays } from '../utils/date.js';

export function mountInsights(root, store){
  const projectTasks = (pid)=> store.get().tasks.filter(t=>t.project_id===pid);
  const projectNotes = (pid)=> store.get().notes.filter(n=>n.project_id===pid);

  function getVars() {
    const css = getComputedStyle(document.documentElement);
    const grab = (v, fb) => (css.getPropertyValue(v) || '').trim() || fb;
    return {
      red:   grab('--graph-red',   '#e45d57'),
      amber: grab('--graph-amber', '#f0d264'),
      green: grab('--graph-green', '#5ed09b'),
      muted: grab('--muted',       '#a7b4c6'),
      text:  '#cfe0ff'
    };
  }

  function computeBuckets(users, open) {
    // returns [{id, name, total, over, soon, ok}]
    return users.map(u => {
      const mine = open.filter(t => t.assignee_user_id === u.id);
      const over = mine.filter(t => isOverdue(t.due_date)).length;
      const soon = mine.filter(t => isWithinNextNDays(t.due_date, 3)).length;
      const total = mine.length;
      const ok = Math.max(0, total - over - soon);
      return { id: u.id, name: u.name, total, over, soon, ok };
    });
  }

  function drawWorkload(canvas, buckets, colors){
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const wCSS = canvas.clientWidth || 600;
    const hCSS = 220;
    canvas.width = Math.floor(wCSS * dpr);
    canvas.height = Math.floor(hCSS * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = wCSS, h = hCSS;
    ctx.clearRect(0,0,w,h);

    if (!buckets.length) {
      ctx.fillStyle = colors.muted;
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No team members to chart.', w/2, h/2);
      return;
    }

    const pad=28, gap=18, available = Math.max(1, w - pad*2 - gap*(buckets.length-1));
    const bw = available / buckets.length;
    const max = Math.max(1, ...buckets.map(b => b.total));

    buckets.forEach((b, i) => {
      const x = pad + i*(bw+gap);
      const scale = (n) => (n/max)*(h-50);

      let y = h-30;
      const oh = scale(b.over);
      const sh = scale(b.soon);
      const kh = scale(b.ok);

      ctx.fillStyle = colors.red;   ctx.fillRect(x, y-oh, bw, oh); y -= oh;
      ctx.fillStyle = colors.amber; ctx.fillRect(x, y-sh, bw, sh); y -= sh;
      ctx.fillStyle = colors.green; ctx.fillRect(x, y-kh, bw, kh);

      // labels
      ctx.textAlign = 'center';
      ctx.font = '12px system-ui';
      ctx.fillStyle = colors.muted;
      ctx.fillText(b.name, x + bw/2, h-12);

      ctx.font = 'bold 12px system-ui';
      ctx.fillStyle = colors.text;
      const labelY = h - 44 - Math.min(h-80, (b.total/max)*(h-50));
      ctx.fillText(String(b.total), x + bw/2, labelY);
    });
  }

  function render(){
    clear(root);
    const state = store.get();
    const pid = state.ui.selectedProjectId;
    const users = state.users || [];
    const tasks = projectTasks(pid);
    const open = tasks.filter(t=>t.status !== 'done');

    const over = open.filter(t=> isOverdue(t.due_date)).length;
    const soon = open.filter(t=> isWithinNextNDays(t.due_date, 3)).length;

    const coverage = (()=> {
      const notes = projectNotes(pid);
      const linked = notes.filter(n => tasks.some(t => t.note_id === n.id)).length;
      return notes.length ? Math.round((linked/notes.length)*100) : 0;
    })();

    // KPI tiles
    const insights = el('div', { className:'insights' });
    insights.append(
      el('div', { className:'insight' }, [
        el('div', { className:'tag', textContent:'Overdue' }),
        el('div', { className:'big', id:'iOverdue', textContent: String(over) })
      ]),
      el('div', { className:'insight' }, [
        el('div', { className:'tag', textContent:'Due ≤ 3 days' }),
        el('div', { className:'big', id:'iSoon', textContent: String(soon) })
      ]),
      el('div', { className:'insight' }, [
        el('div', { className:'tag', textContent:'Open tasks' }),
        el('div', { className:'big', id:'iOpen', textContent: String(open.length) })
      ]),
      el('div', { className:'insight' }, [
        el('div', { className:'tag', textContent:'Notes → Tasks coverage' }),
        el('div', { className:'big', id:'iCoverage', textContent: coverage + '%' })
      ])
    );

    // Workload card
    const card = el('div', { className:'card' });
    card.append(el('h3', { textContent: 'Workload' }));

    const canvas = el('canvas', { id:'workload', height:220 });
    card.append(canvas);

    if (!open.length) {
      card.append(el('div', { className:'empty', style:'margin-top:8px', textContent:'No open tasks to chart.' }));
    } else if (!users.length) {
      card.append(el('div', { className:'empty', style:'margin-top:8px', textContent:'No team members configured.' }));
    } else {
      const buckets = computeBuckets(users, open);
      const colors = getVars();
      drawWorkload(canvas, buckets, colors);
      card.append(el('div', {
        className:'muted', style:'margin-top:6px'
      }, 'Open tasks by person (colors: overdue / soon / ok).'));
    }

    root.append(insights, card);
  }

  store.subscribe((_, keys)=>{ if (keys.some(k=>['tasks','notes','users','ui'].includes(k))) render(); });
  window.addEventListener('resize', ()=>{ if (store.get().ui.activeTab==='insights') render(); });
  render();
}
