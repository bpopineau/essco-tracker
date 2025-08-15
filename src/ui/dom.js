// src/ui/dom.js

/** Query helpers */
/**
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {Element|null}
 */
export const $  = (sel, root = document) => root.querySelector(sel);
/**
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {Element[]}
 */
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// @ts-check

// ---------- Shared typing helpers ----------
/** @typedef {HTMLElement | Text | DocumentFragment | SVGElement} NodeLike */
/** @typedef {string | NodeLike | Array<string|NodeLike>} Child */
/** @typedef {{ [k:string]: any, className?: string, class?: string, textContent?: string, onclick?: (e:Event)=>void }} Props */
/** @typedef {{ label?: string, onClick?: (e:MouseEvent)=>void }} ToastAction */
/** @typedef {{ type?: ''|'info'|'success'|'error'|'warn', action?: ToastAction|null, timeout?: number }} ToastOpts */

// el(...) is already here. Tighten the return type with a few overloads so TS
// understands .value/.focus on the common elements we create.

/**
 * Create an HTML or SVG element with props and children.
 * @param {string} tag
 * @param {Props} [props]
 * @param {Child} [child]
 * @returns {HTMLElement | SVGElement}
 */
export function el(
  /** @type {string} */ tag,
  /** @type {Props} */ props = {},
  /** @type {Child} */ child
) {
  const isSvg = tag === 'svg';
  const node = isSvg
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  applyProps(node, props, isSvg);
  if (child != null) appendChild(node, child, isSvg);
  return /** @type {any} */ (node);
}

/**
 * SVG element helper
 * @param {string} tag
 * @param {Props} [props]
 * @param {Child[]|Child} [children]
 * @returns {SVGElement}
 */
export function svg(tag, props = {}, children = []) {
  if (arguments.length > 3) children = Array.prototype.slice.call(arguments, 2);
  else if (!Array.isArray(children)) children = [children];

  const NS = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(NS, tag);
  if (props && typeof props === 'object') applyProps(node, props, true);

  for (const ch of children) appendChild(node, ch, true);
  return node;
}

/** Create a fragment from children
 * @param {...Child} children
 * @returns {DocumentFragment}
 */
export function frag(...children) {
  const f = document.createDocumentFragment();
/**
 * @param {string} tag
 * @param {Props} [props]
 * @param {Child[]} [children]
 */
  children.forEach((ch) => appendChild(f, ch));
  return f;
}

/** Text node helper */
export const text = (str = '') => document.createTextNode(String(str));

/** Remove all children from a node
 * @param {Element | DocumentFragment} node
 */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Replace a node’s children
 * @param {Element | DocumentFragment} node
 * @param {...Child} children
 */
export function render(node, ...children) {
  clear(node);
  children.forEach((ch)=> appendChild(node, ch));
  return node;
}

/** Add (optionally delegated) listener.
 * @param {Element|Document|Window} target
 * @param {keyof HTMLElementEventMap | string} type
 * @param {string|((ev:Event)=>any)} selectorOrHandler
 * @param {(ev:Event)=>any} [maybeHandler]
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {() => void}
 */
/**
 * Add event listener with optional delegation
 * @param {Element|Document|Window} target
 * @param {string} type
 * @param {string|((ev:Event)=>any)} selectorOrHandler
 * @param {(ev:Event)=>any} [maybeHandler]
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {() => void}
 */
export function on(target, type, selectorOrHandler, maybeHandler, options) {
  const delegated = typeof selectorOrHandler === 'string';
  const selector = delegated ? /** @type {string} */ (selectorOrHandler) : null;
  const handler  = delegated ? maybeHandler : /** @type {(ev:Event)=>any} */ (selectorOrHandler);
  /** @param {Event} ev */
  const listener = (ev) => {
    if (!delegated) return handler?.(ev);
  // Only call closest if selector is not null
  if (!delegated) return handler?.(ev);
  if (!selector) return;
  const tgt = /** @type {Element|null} */ (/** @type {any} */(ev.target))?.closest(selector);
  if (!tgt) return;
  /** @type {any} */ (ev).delegateTarget = tgt;
  handler?.(ev);
  };
  target.addEventListener(/** @type {any} */(type), listener, options || false);
  return () => target.removeEventListener(/** @type {any} */(type), listener, options || false);
}

/** One-shot listener as a promise.
 * @param {Element|Document|Window} target
 * @param {keyof HTMLElementEventMap | string} type
 * @param {(ev:Event)=>any} [handler]
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {Promise<Event>}
 */
/**
 * One-shot listener as a promise.
 * @param {Element|Document|Window} target
 * @param {keyof HTMLElementEventMap | string} type
 * @param {(ev:Event)=>any} [handler]
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {Promise<Event>}
 */
export const once = (target, type, handler, options) =>
  new Promise((resolve) => on(target, type, (ev)=>{ handler?.(ev); resolve(ev); }, undefined, options));

/**
 * Show a toast message
 * @param {string} message
 * @param {ToastOpts} [opts]
 * @returns {() => void}
 */
export function toast(message, opts = /** @type {ToastOpts} */({})) {
  const type = opts && typeof opts.type === 'string' ? opts.type : '';
  const action = opts && typeof opts.action === 'object' ? opts.action : null;
  const timeout = opts && typeof opts.timeout === 'number' ? opts.timeout : 3500;
  /** @type {HTMLElement} */
  const wrap = /** @type {HTMLElement} */ (document.getElementById('toasts') || el('div', { id:'toasts', className:'toasts' }));
  if (!wrap.parentNode) document.body.appendChild(wrap);
  /** @type {HTMLElement} */
  let t;
  const dismiss = () => { if (t) t.remove(); };
  const msgEl = el('div', { className:'toast-msg', textContent: message });
  const close = el('button', { className:'btn-icon', 'aria-label':'Close', onclick: dismiss }, '×');
  let btn;
  if (action) {
    btn = el('button', {
      className: 'ghost',
      type: 'button',
      onclick: (e) => { action.onClick?.(/** @type {any} */(e)); dismiss(); }
    }, action.label ?? 'OK');
  }
  const childrenArr = btn ? [msgEl, btn, close] : [msgEl, close];
  t = /** @type {HTMLElement} */ (el('div', { className: `toast${type ? ' ' + type : ''}` }, frag(...childrenArr)));
  wrap.appendChild(t);
  if (timeout > 0) setTimeout(dismiss, timeout);
  return dismiss;
}

// Highlight a substring inside an element’s text nodes ------------------------
/**
 * @param {HTMLElement} root
 * @param {string} term
 */
export function highlightText(root, term) {
  if (!term) return;
  const reG = new RegExp(`(${escapeRegExp(term)})`, 'ig');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  /** @type {Text[]} */ const texts = [];
  let n; while ((n = /** @type {Text} */ (walker.nextNode()))) texts.push(n);
  texts.forEach((textNode) => {
    const str = textNode.nodeValue;
    if (!str) return;
    const parts = str.split(reG);
  // Removed duplicate/erroneous code referencing undefined variables
    const fragNode = document.createDocumentFragment();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      // Even indices are non-matches; odd indices are the captured term
      if (i % 2 === 1) fragNode.appendChild(el('mark', {}, p));
      else if (p) fragNode.appendChild(document.createTextNode(p));
    }
    if (textNode.parentNode) textNode.parentNode.replaceChild(fragNode, textNode);
  });
}

/* ----------------------- internal helpers ----------------------- */

/** @param {Element|DocumentFragment|SVGElement} parent @param {Child} ch @param {boolean} [_isSvg=false] */
function appendChild(parent, ch, _isSvg = false) {
  if (Array.isArray(ch)) { ch.forEach((c)=> appendChild(parent, c, _isSvg)); return; }
  if (ch == null) return;
  if (typeof ch === 'string') { parent.appendChild(document.createTextNode(ch)); return; }
  parent.appendChild(/** @type {Node} */(ch));
}

/** @param {HTMLElement|SVGElement} node @param {Props} props @param {boolean} [isSvg=false] */
function applyProps(node, props, isSvg = false) {
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'style' && v && typeof v === 'object') {
      Object.assign(/** @type {any} */(node).style, v);
    } else if (k in node || k === 'textContent') {
      /** @type {any} */ (node)[k] = v;
    } else if (isAttr(k, isSvg)) {
      /** @type {any} */ (node).setAttribute(attrName(k), String(v));
    }
  }
}

/** @param {string} key @param {boolean} isSvg */
function isAttr(key, isSvg) {
  return isSvg || key.startsWith('data-') || key.startsWith('aria-');
}

/** @param {string} key */
function attrName(key) {
  return key === 'className' ? 'class' : key;
}

// Keep this at the bottom of dom.js with the other small helpers.
/** @param {string} s */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
