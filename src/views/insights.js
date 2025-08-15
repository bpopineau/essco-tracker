// src/views/insights.js
import { clear, el } from '../ui/dom.js';
import { addDays, isOverdue, isWithinNextNDays, toISODate } from '../utils/date.js';

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
      text:  '#cfe0ff',
      border: grab('--border',     '#2b3647')
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

  // --- Due trend (last 14 days, by due date) ---
  function buildDueSeries(tasks, days=14) {
    const end = new Date();              // today
    const start = addDays(end, -(days-1));
    const labels = [];
    const openSeries = [];
    const doneSeries = [];
    for (let i=0; i<days; i++) {
      const dStr = toISODate(addDays(start, i));
      labels.push(dStr);
      doneSeries.push(tasks.filter(t => t.status === 'done' && t.due_date === dStr).length);
      openSeries.push(tasks.filter(t => t.status !== 'done' && t.due_date === dStr).length);
    }
    return { labels, openSeries, doneSeries };
  }

  function drawSparkline(canvas, series, colors){
    const { labels, openSeries, doneSeries } = series;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const wCSS = canvas.clientWidth || 480;
    const hCSS = 140;
    canvas.width = Math.floor(wCSS * dpr);
    canvas.height = Math.floor(hCSS * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = wCSS, h = hCSS;
    ctx.clearRect(0,0,w,h);

    const max = Math.max(1, ...openSeries, ...doneSeries);
    const padL = 28, padR = 12, padT = 12, padB = 24;
    const chartW = Math.max(1, w - padL - padR);
    const chartH = Math.max(1, h - padT - padB);
    const n = labels.length;
    const step = n > 1 ? chartW / (n - 1) : 0;

    // grid baseline
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, h - padB + 0.5);
    ctx.lineTo(w - padR, h - padB + 0.5);
    ctx.stroke();

    function yFor(val){ return h - padB - (val/max)*chartH; }
    function xFor(i){ return padL + i*step; }

    // line drawer
    function plotLine(data, stroke){
      if (!data.length) return;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xFor(0), yFor(data[0]));
      for (let i=1;i<data.length;i++){
        ctx.lineTo(xFor(i), yFor(data[i]));
      }
      ctx.stroke();
    }

    // draw both lines (open first so done sits on top)
    plotLine(openSeries, colors.amber);
    plotLine(doneSeries, colors.green);

    // endpoints + labels
    ctx.fillStyle = colors.muted;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(labels[0].slice(5), padL, h-6); // 'MM-DD'
    ctx.textAlign = 'right';
    ctx.fillText(labels[labels.length-1].slice(5), w - padR, h-6);
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

    // Cards row: Workload + Due trend
    const cards = el('div', { className:'grid', style:'grid-template-columns:2fr 1fr' });

    // Workload card
    const cardWork = el('div', { className:'card' });
    cardWork.append(el('h3', { textContent: 'Workload' }));
    const canvasWork = el('canvas', { id:'workload', height:220 });
    cardWork.append(canvasWork);

    const colors = getVars();

    if (!open.length) {
      cardWork.append(el('div', { className:'empty', style:'margin-top:8px', textContent:'No open tasks to chart.' }));
    } else if (!users.length) {
      cardWork.append(el('div', { className:'empty', style:'margin-top:8px', textContent:'No team members configured.' }));
    } else {
      const buckets = computeBuckets(users, open);
      drawWorkload(canvasWork, buckets, colors);
      cardWork.append(el('div', {
        className:'muted', style:'margin-top:6px'
      }, 'Open tasks by person (colors: overdue / soon / ok).'));
    }

    // Trend card
    const cardTrend = el('div', { className:'card' });
    cardTrend.append(el('h3', { textContent:'Due trend (last 14 days)' }));
    const legend = el('div', { className:'row', style:'gap:8px;margin-bottom:6px' });
    legend.append(
      el('span', { className:'pill', textContent:'Open (by due)' }),
      el('span', { className:'pill', textContent:'Done (by due)' })
    );
    cardTrend.append(legend);

    const canvasTrend = el('canvas', { id:'trend', height:140 });
    cardTrend.append(canvasTrend);
    cardTrend.append(el('div', {
      className:'muted', style:'margin-top:6px'
    }, 'Counts are grouped by each task’s due date.'));

    const series = buildDueSeries(tasks, 14);
    if (series.openSeries.every(v=>v===0) && series.doneSeries.every(v=>v===0)) {
      cardTrend.append(el('div', { className:'empty', style:'margin-top:8px', textContent:'No dated tasks in the last 14 days.' }));
    } else {
      drawSparkline(canvasTrend, series, colors);
    }

    cards.append(cardWork, cardTrend);
    root.append(insights, cards);
  }

  store.subscribe((_, keys)=>{ if (keys.some(k=>['tasks','notes','users','ui'].includes(k))) render(); });
  window.addEventListener('resize', ()=>{ if (store.get().ui.activeTab==='insights') render(); });
  render();
}
