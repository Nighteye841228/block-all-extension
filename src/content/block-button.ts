const ATTR = 'data-block-all-quick-block';

export function injectBlockButton(
  container: HTMLElement,
  username: string,
  onClick: (username: string) => void,
): void {
  if (container.querySelector(`[${ATTR}]`)) return;
  const btn = document.createElement('button');
  btn.setAttribute(ATTR, '');
  btn.title = `快速封鎖 @${username}`;
  btn.textContent = '🚫';
  btn.style.cssText =
    'position:absolute;top:8px;right:8px;z-index:10;background:transparent;border:0;cursor:pointer;font-size:16px;opacity:0.5;';
  btn.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
  btn.addEventListener('mouseleave', () => (btn.style.opacity = '0.5'));
  btn.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); onClick(username); });
  const cs = getComputedStyle(container);
  if (cs.position === 'static') container.style.position = 'relative';
  container.appendChild(btn);
}
