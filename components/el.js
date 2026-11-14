// el: a small helper to make page elements. el('button', { class: 'k', onclick: fn }, 'Label')
// Text children are always added as plain text, never as HTML.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style') for (const [k, v] of Object.entries(value)) node.style.setProperty(k, v);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false || child === '') continue;
    node.append(child.nodeType ? child : String(child));
  }
  return node;
}

// Set text only when it changed, so screen readers and the browser aren't disturbed for nothing.
export function setText(node, text) {
  const t = String(text);
  if (node.textContent !== t) node.textContent = t;
}

// Turn a "pressed" key on or off: its class and its aria-pressed together.
export function setPressed(node, on, cls = 'on') {
  node.classList.toggle(cls, Boolean(on));
  if (node.hasAttribute('aria-pressed')) node.setAttribute('aria-pressed', on ? 'true' : 'false');
}
