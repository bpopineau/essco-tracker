// @ts-check
/**
 * @typedef {{ id:string, name:string }} User
 * @typedef {{ id:string, project_id:string, assignee_user_id?:string|null, due_date?:string|null, status:string, note_id?:string|null }} Task
 * @typedef {{ id:string, project_id:string, body?:string, meeting_date?:string|null, pinned?:boolean }} Note
 * @typedef {{ users:User[], tasks:Task[], notes:Note[] }} State
 * @typedef {{ get:()=>State, update:(fn:(s:State)=>State)=>void, subscribe:(fn:(s:State, keys:string[])=>void)=>()=>void }} Store
 */
// src/views/insights.js
import { clear, el } from '../ui/dom.js';
import { addDays, isOverdue, isWithinNextNDays, toISODate } from '../utils/date.js';

/** @param {HTMLElement} root @param {{ get:Function, set:Function, subscribe:Function }} store */
export function mountInsights(root, store){
  
  /** @param {string} pid */ const projectTasks = (pid)=> store.get().tasks.filter((t)=> (/** @type {Task} */(t)).project_id === pid);
  /** @param {string} pid */ const projectNotes = (pid)=> store.get().notes.filter((n)=> (/** @type {{id:string,project_id:string}} */(n)).project_id === pid);

  function getVars() {
    const css = getComputedStyle(document.documentElement);
    /** @param {string} v @param {string} fb */ const grab = (v, fb) => (css.getPropertyValue(v) || '').trim() || fb;
    return {
      red:   grab('--red-500',   '#ef4444'),
      amber: grab('--amber-500', '#f59e0b'),
      green: grab('--green-500', '#22c55e'),
      muted: grab('--muted',     '#6b7280'),
      text:  grab('--text',      '#111827'),
      border:grab('--border',    '#e5e7eb'),
    };
  }
  /** @param {User[]} users @param {Task[]} open */
  function computeBuckets(users, open) {
    
    /** Build per-user workload buckets.
     * @param {User[]} users
     * @param {Task[]} open
     * @returns {Array<{user:User,total:number,overdue:number,soon:number}>}
     */
    return users.map((u) => {
      const mine = open.filter(t => t.assignee_user_id === u.id);
      const overdue = mine.filter(t => isOverdue(t.due_date)).length;
      const soon = mine.filter(t => isWithinNextNDays(t.due_date, 3)).length;
      return { user: u, total: mine.length, overdue, soon };
    });
  }
  /** @param {HTMLCanvasElement} canvas @param {{user:User,total:number,overdue:number,soon:number}[]} buckets @param {{over:string,soon:string,rest:string}} colors */
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{user:User,total:number,overdue:number,soon:number}[]} buckets
   * @param {{ red:string, amber:string, green:string, muted:string, text:string, border:string }} colors
   */
  function drawWorkload(canvas, buckets, colors){
    /** Stacked bars: overdue (red) / soon (amber) / rest (green).
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{user:User,total:number,overdue:number,soon:number}>} buckets
   * @param {{ red:string, amber:string, green:string, text:string, muted:string }} colors
   */
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    canvas.width = w; canvas.height = h;
    if (!buckets.length){
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No team members to chart.', w/2, h/2);
      return;
    }
    const gap = 12;
    const pad = 20;
    const bw = Math.floor((w - pad*2 - gap*(buckets.length-1)) / Math.max(1, buckets.length));
    const max = Math.max(1, ...buckets.map(b => b.total));
    const y0 = h - 28;
    /** @param {number} n */ const scale = (n) => (n/max)*(h-50);

    buckets.forEach((b, i) => {
      const x = pad + i*(bw+gap);
      let y = y0;
      const oh = scale(b.overdue);
      const sh = scale(b.soon);
      const restCount = Math.max(0, b.total - b.overdue - b.soon);
      const kh = scale(restCount);
      ctx.fillStyle = colors.red;   ctx.fillRect(x, y-oh, bw, oh); y -= oh;
      ctx.fillStyle = colors.amber; ctx.fillRect(x, y-sh, bw, sh); y -= sh;
      ctx.fillStyle = colors.green; ctx.fillRect(x, y-kh, bw, kh);

      ctx.textAlign = 'center';
      ctx.font = '12px system-ui';
      ctx.fillStyle = colors.muted;
      ctx.fillText(b.user.name, x + bw/2, h-12);

      const labelY = y0 + 16;
      ctx.font = 'bold 12px system-ui';
      ctx.fillStyle = colors.text;
      ctx.fillText(String(b.total), x + bw/2, labelY);
    });
  }

  /** @param {Task[]} tasks @param {number=} days */
  function buildDueSeries(tasks, days=14) {
    /** Build time series of open vs done counts by due date.
   * @param {Task[]} tasks
   * @param {number} [days=14]
   */
    const labels = [];
    const openSeries = [];
    const doneSeries = [];
    /** @type {Date} */ const base = new Date(); // today
    for (let i=0;i<days;i++){
      /** @type {Date} */ const dNext = /** @type {Date} */(addDays(base, i));
      const dStr = toISODate(dNext);
      labels.push(dStr);
      doneSeries.push(tasks.filter(t => t.status === 'done' && t.due_date === dStr).length);
      openSeries.push(tasks.filter(t => t.status !== 'done' && t.due_date === dStr).length);
    }
    return { labels, openSeries, doneSeries };
  }
  /** @param {HTMLCanvasElement} canvas @param {{done:number[], open:number[]}} series @param {{done:string, open:string}} colors */
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ labels:string[], openSeries:number[], doneSeries:number[] }} series
   * @param {{ open:string, done:string, muted:string, border:string }} colors
   */
  function drawSparkline(canvas, series, colors){
    /** @param {HTMLCanvasElement} canvas
   *  @param {{ labels:string[], openSeries:number[], doneSeries:number[] }} series
   *  @param {{ open:string, done:string, muted:string, border:string }} colors
   */
    const { labels, openSeries, doneSeries } = series;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0,0,w,h);

    const max = Math.max(1, ...openSeries, ...doneSeries);
    const padL = 28, padR = 12, padT = 12, padB = 24;
    const chartW = Math.max(1, w - padL - padR);
    const chartH = Math.max(1, h - padT - padB);
  const n = labels.length;
  const _step = n > 1 ? chartW / (n - 1) : 0; // reserved for future spacing logic

    // grid baseline
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, h - padB + 0.5);
    ctx.lineTo(w - padR, h - padB + 0.5);
    ctx.stroke();

    /** @param {number} val */ const yFor = (val) => h - padB - (val / max) * chartH;
    const count = labels.length || 1;
    /** @param {number} i */ const xFor = (i) => padL + i * (chartW / Math.max(1, count - 1));

    /**
     * @param {number[]} data
     * @param {string} stroke
     */
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
    plotLine(openSeries, colors.open);
    plotLine(doneSeries, colors.done);

    ctx.fillStyle = colors.muted;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';
    if (labels.length) ctx.fillText(labels[0].slice(5), padL, h-6); // 'MM-DD'
    ctx.textAlign = 'right';
    if (labels.length) ctx.fillText(labels[labels.length-1].slice(5), w - padR, h-6);
  }
  /** @param {string} txt @param {string} bg */
  function chip(txt, bg){
    const s = el('span', { className:'pill', style:`background:${bg};border-color:rgba(0,0,0,.25)` }, txt);
    return s;
  }

  function render(){
    clear(root);
    const state = store.get();
    const pid = state.ui.selectedProjectId;
    const users = state.users || [];
    const tasks = projectTasks(pid);
  /** @type {Task[]} */
  const open = tasks.filter((t)=> (/** @type {Task} */(t)).status !== 'done');

    const over = open.filter(t=> isOverdue(t.due_date)).length;
    const soon = open.filter(t=> isWithinNextNDays(t.due_date, 3)).length;

    const coverage = (()=> {
      const notes = projectNotes(pid);
  const linked = notes.filter((n) =>
    tasks.some((t) => (/** @type {Task} */(t)).note_id === n.id)
  ).length;
      return notes.length ? Math.round((linked/notes.length)*100) : 0;
    })();

    const colors = getVars();

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

    // Legend (overdue / soon / ok)
    const legendWork = el('div', { className:'row', style:'gap:8px;margin-bottom:6px' });
    legendWork.append(
      chip('Overdue', colors.red),
      chip('Soon', colors.amber),
      chip('OK', colors.green)
    );
    cardWork.append(legendWork);

    const canvasWork = el('canvas', {
      id:'workload',
      height:220,
      role:'img',
      'aria-label':'Workload per person: stacked bars (red overdue, amber soon, green ok)'
    });
    cardWork.append(canvasWork);

    if (!open.length) {
      cardWork.append(el('div', { className:'empty', style:'margin-top:8px', textContent:'No open tasks to chart.' }));
    } else if (!users.length) {
      cardWork.append(el('div', { className:'empty', style:'margin-top:8px', textContent:'No team members configured.' }));
    } else {
  const buckets = computeBuckets(users, open);
  /** @type {HTMLCanvasElement|null} */
  const workCanvas = canvasWork instanceof HTMLCanvasElement ? canvasWork : /** @type {HTMLCanvasElement|null} */ (null);
  if (workCanvas) drawWorkload(/** @type {HTMLCanvasElement} */(workCanvas), buckets, colors);
      cardWork.append(el('div', {
        className:'muted', style:'margin-top:6px'
      }, 'Open tasks by person.'));
    }

    // Trend card
    const cardTrend = el('div', { className:'card' });
    cardTrend.append(el('h3', { textContent:'Due trend (last 14 days)' }));

    const legendTrend = el('div', { className:'row', style:'gap:8px;margin-bottom:6px' });
    legendTrend.append(
      chip('Open (by due)', colors.amber),
      chip('Done (by due)', colors.green)
    );
    cardTrend.append(legendTrend);

    const canvasTrend = el('canvas', {
      id:'trend',
      height:140,
      role:'img',
      'aria-label':'Sparkline of tasks by due date over the last 14 days (open vs done)'
    });
    cardTrend.append(canvasTrend);
    cardTrend.append(el('div', {
      className:'muted', style:'margin-top:6px'
    }, 'Counts are grouped by each task’s due date.'));

    const series = buildDueSeries(tasks, 14);
    if (series.openSeries.every(v=>v===0) && series.doneSeries.every(v=>v===0)) {
      cardTrend.append(el('div', { className:'empty', style:'margin-top:8px', textContent:'No dated tasks in the last 14 days.' }));
    } else {
      /** @type {HTMLCanvasElement|null} */
      const trendCanvas = canvasTrend instanceof HTMLCanvasElement ? canvasTrend : /** @type {HTMLCanvasElement|null} */ (null);
      if (trendCanvas) drawSparkline(/** @type {HTMLCanvasElement} */(trendCanvas), series, {
        open: colors.amber,
        done: colors.green,
        muted: colors.muted,
        border: colors.border
      });
    }

    cards.append(cardWork, cardTrend);
    root.append(insights, cards);
  }

  store.subscribe((/** @type {*} */ _, /** @type {string[]} */ keys) => {
    if (keys.some(k => ['tasks','notes','users','ui'].includes(k))) render();
  });
  window.addEventListener('resize', ()=>{ if (store.get().ui.activeTab==='insights') render(); });
  render();
}
