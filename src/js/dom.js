// P10: write-on-change DOM helpers. Per-frame HUD code goes through these so the DOM is only touched when a value
// changes. Every writer of a given element property must use the same helper (the cache is per element + property).
const C = new WeakMap(), cache = (el) => { let c = C.get(el); if (!c) C.set(el, c = {}); return c; };
export function setText(el, v) { const c = cache(el); if (c.text !== v) { c.text = v; el.textContent = v; } }
export function setHTML(el, v) { const c = cache(el); if (c.html !== v) { c.html = v; el.innerHTML = v; } }
export function setStyle(el, p, v) { const c = cache(el); if (c['s:' + p] !== v) { c['s:' + p] = v; el.style[p] = v; } }
export function setClass(el, k, on) { on = !!on; const c = cache(el); if (c['c:' + k] !== on) { c['c:' + k] = on; el.classList.toggle(k, on); } }
export function setData(el, k, v) { const c = cache(el); if (c['d:' + k] !== v) { c['d:' + k] = v; el.dataset[k] = v; } }
