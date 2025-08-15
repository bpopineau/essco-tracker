// src/ui/dom.js

/** Query helpers */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create a DOM element with props + children (backwards compatible signature) */
export function el(tag, props = {}, children = []) {
  // Support both el(tag, props, children[]) and el(tag, props, ...children)
  if (arguments.length > 3) {
    children = Array.prototype.slice.call(arguments, 2);
  } else if (!Array.isArray(children)) {
    children = [children];
  }

  const node = document.createElement(tag);
  if (props && typeof props === 'object') applyProps(node, props);

  for (const ch of children) appendChild(node, ch);
  return node;
}

/** SVG element helper */
export function svg(tag, props = {}, children = []) {
  if (arguments.length > 3) children = Array.prototype.slice.call(arguments, 2);
  else if (!Array.isArray(children)) children = [children];

  const NS = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(NS, tag);
  if (props && typeof props === 'object') applyProps(node, props, true);

  for (const ch of children) appendChild(node, ch, true);
  return node;
}

/** DocumentFragment builder */
export function frag(...children) {
  const f = document.createDocumentFragment();
  for (const ch of children) appendChild(f, ch);
  return f;
}

/** Text node helper */
export const text = (str = '') => document.createTextNode(String(str));

/** Clear a node’s children and return it (for chaining) */
export function clear(node) {
  node.replaceChildren();
  return node;
}

/** Replace a node’s children with new content */
export function render(node, ...children) {
  node.replaceChildren();
  for (const ch of children) appendChild(node, ch);
  return node;
}

/**
 * Event listener helper.
 * - Direct:  on(target, 'click', handler, options?)
 * - Delegate: on(target, 'click', 'button.selector', handler, options?)
 * Returns an off() cleanup fn.
 */
export function on(target, type, selectorOrHandler, maybeHandler, options) {
  const delegated = typeof selectorOrHandler === 'string';
  const selector = delegated ? selectorOrHandler : null;
  const handler  = delegated ? maybeHandler : selectorOrHandler;

  if (!handler) throw new Error('on(): handler is required');

  // Allow options in the 4th position for direct listeners
  const opts = delegated ? options : (typeof maybeHandler === 'object' ? maybeHandler : options);

  const listener = (ev) => {
    if (!delegated) return handler(ev);
    const match = ev.target && ev.target.closest(selector);
    const within = match && (typeof target.contains === 'function' ? target.contains(match) : true);
    if (within) {
      Object.defineProperty(ev, 'delegateTarget', { value: match, configurable: true });
      return handler(ev);
    }
  };

  target.addEventListener(type, listener, opts);
  return () => target.removeEventListener(type, listener, opts);
}

/** One-time listener sugar */
export const once = (target, type, handler, options) =>
  on(target, type, handler, undefined, { ...(options||{}), once: true });

/** Lightweight toast/snackbar (uses .snackbar/.toast styles from styles.css) */
export function toast(message, opts = {}) {

  const { type = '', action = null, timeout = 3500 } = opts;
  // Prefer #toast-root, else #snackbar-root, else create .snackbar on demand
  let root = document.getElementById('toast-root')
    || document.getElementById('snackbar-root');
  if (!root) {
    root = el('div', { className: 'snackbar', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(root);
  }

  const msgEl = el('span', {}, String(message));
  const btn   = action
    ? el('button', { className: 'ghost', type: 'button', onclick: (e) => { action.onClick?.(e); dismiss(); } }, action.label ?? 'OK')
    : null;

  const close = el('button', { className: 'btn-icon', type: 'button', 'aria-label': 'Close',
    onclick: () => dismiss() }, '×');

  const t = el('div', { className: `toast${type ? ' ' + type : ''}` }, [msgEl, frag(btn, close)]);
  root.appendChild(t);

  const tid = timeout ? setTimeout(() => dismiss(), timeout) : null;

  function dismiss() {
    if (tid) clearTimeout(tid);
    if (t.parentNode) t.parentNode.removeChild(t);
  }
  return dismiss;
}

/**
 * Highlight matching text under a root element by wrapping matches in <mark>.
 * Traverses text nodes safely (no innerHTML injection).
 */
export function highlightText(root, term) {
  // Remove previous highlights created by this helper
  $$('.__hi', root).forEach(mark => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    parent.normalize(); // merge adjacent text nodes
  });

  if (!term || !String(term).trim()) return;

  const pattern = escapeRegExp(String(term));
  const reI = new RegExp(pattern, 'i');   // for testing presence (stateless)
  const reG = new RegExp(pattern, 'gi');  // for splitting/matching

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && reI.test(n.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });

  const toProcess = [];
  while (walker.nextNode()) toProcess.push(walker.currentNode);

  for (const textNode of toProcess) {
    const str = textNode.nodeValue;
    const parts = str.split(reG);
    const matches = str.match(reG);
    const fragNode = document.createDocumentFragment();

    parts.forEach((part, i) => {
      if (part) fragNode.appendChild(document.createTextNode(part));
      if (matches && matches[i]) {
        const m = el('mark', { className: '__hi' }, matches[i]);
        fragNode.appendChild(m);
      }
    });

    textNode.parentNode.replaceChild(fragNode, textNode);
  }
}

/* ----------------------- internal helpers ----------------------- */

function appendChild(parent, ch, _isSvg = false) {
  if (ch == null || ch === false || ch === true) return;
  if (typeof ch === 'string' || typeof ch === 'number') {
    parent.appendChild(document.createTextNode(String(ch)));
  } else if (Array.isArray(ch)) {
    ch.forEach((c) => appendChild(parent, c, _isSvg));
  } else {
    parent.appendChild(ch);
  }
}

function applyProps(node, props, isSvg = false) {
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;

    // Events
    if (key === 'on' && value && typeof value === 'object') {
      for (const [evt, h] of Object.entries(value)) {
        if (Array.isArray(h)) node.addEventListener(evt, h[0], h[1]);
        else node.addEventListener(evt, h);
      }
      continue;
    }
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
      continue;
    }

    // Class
    if (key === 'class' || key === 'className') {
      node.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
      continue;
    }

    // Style
    if (key === 'style' && value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) node.style[k] = v;
      continue;
    }

    // Dataset
    if (key === 'dataset' && value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
      continue;
    }

    // ARIA / data-* / SVG attrs
    if (isAttr(key, isSvg)) {
      node.setAttribute(attrName(key), value === true ? '' : String(value));
      continue;
    }

    // Fallback to property assignment
    try {
      node[key] = value;
    } catch {
      node.setAttribute(attrName(key), String(value));
    }
  }
}

function isAttr(key, isSvg) {
  return key.startsWith('aria-') || key.startsWith('data-') || isSvg;
}

function attrName(key) {
  if (key === 'htmlFor') return 'for';
  if (key === 'className') return 'class';
  return key;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
