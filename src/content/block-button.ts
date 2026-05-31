const ATTR = 'data-block-all-quick-block';

const ICON_SVG = `
<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9"/>
  <line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>
</svg>`;

export function injectBlockButton(
  container: HTMLElement,
  username: string,
  onClick: (username: string) => void,
): void {
  if (container.querySelector(`[${ATTR}]`)) return;

  const btn = document.createElement('button');
  btn.setAttribute(ATTR, '');
  btn.setAttribute('aria-label', `封鎖 @${username}`);
  btn.title = `封鎖 @${username}`;
  btn.innerHTML = ICON_SVG;
  btn.style.cssText = [
    'background:transparent',
    'border:0',
    'cursor:pointer',
    'color:currentColor',
    'opacity:0.5',
    'padding:0',
    'margin:0 0 0 6px',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'align-self:center',
    'vertical-align:middle',
    'line-height:0',
  ].join(';');
  btn.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
  btn.addEventListener('mouseleave', () => (btn.style.opacity = '0.5'));
  btn.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); onClick(username); });

  const anchor = container.querySelector<HTMLElement>('a[href*="/post/"]');
  if (anchor) {
    // Walk up: anchor → inline span → flex container.
    // Inserting at the flex layer lets the parent's align-items center the button next to "N分鐘".
    const flexHost = findFlexAncestor(anchor, 3);
    if (flexHost) {
      flexHost.appendChild(btn);
      return;
    }
    anchor.insertAdjacentElement('afterend', btn);
    return;
  }

  // Fallback: absolute corner if we can't find the time link
  btn.style.cssText += ';position:absolute;top:8px;right:36px;z-index:10';
  const cs = getComputedStyle(container);
  if (cs.position === 'static') container.style.position = 'relative';
  container.appendChild(btn);
}

function findFlexAncestor(el: HTMLElement, maxDepth: number): HTMLElement | null {
  let cur: HTMLElement | null = el.parentElement;
  for (let i = 0; i < maxDepth && cur; i++) {
    const d = getComputedStyle(cur).display;
    if (d === 'flex' || d === 'inline-flex') return cur;
    cur = cur.parentElement;
  }
  return null;
}
