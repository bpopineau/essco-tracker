// src/ui/dom.d.ts

export type Child = Node | string | Array<Node | string>;


export function el(
  tag: string,
  props?: Record<string, any>,
  ...children: Child[]
): HTMLElement;


// Delegated listener; keep handler 'any' so .key, .delegateTarget, etc. are allowed
export function on(
  root: Element | Document,
  type: string,
  selector: string,
  handler: (ev: any) => void
): () => void;

// Other helpers you import elsewhere
export function clear(el: Element): void;
export function highlightText(text: string, term?: string): Node;
export function toast(msg: string, type?: 'info' | 'error' | 'success'): void;
