import bannerCss from '@ui/styles/banner.css?raw';
import { STATE_ATTR, HANDLED_ATTR, BANNER_ATTR, ORIGINAL_ATTR } from './selectors';

export interface FoldPayload {
  username: string;
  tags: { name: string; color?: string }[];
  note: string;
}

export function foldContainer(container: HTMLElement, payload: FoldPayload): void {
  if (container.getAttribute(STATE_ATTR) === 'folded') return;

  const original = document.createElement('div');
  original.setAttribute(ORIGINAL_ATTR, '');
  original.hidden = true;
  while (container.firstChild) original.appendChild(container.firstChild);

  const bannerHost = document.createElement('div');
  bannerHost.setAttribute(BANNER_ATTR, '');
  const shadow = bannerHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = renderBanner(payload);
  applyStyles(shadow, bannerCss);

  const expandBtn = shadow.querySelector<HTMLButtonElement>('.expand');
  expandBtn?.addEventListener('click', () => unfoldContainer(container));

  container.appendChild(bannerHost);
  container.appendChild(original);
  container.setAttribute(STATE_ATTR, 'folded');
  container.setAttribute(HANDLED_ATTR, 'folded');
}

export function unfoldContainer(container: HTMLElement): void {
  const original = container.querySelector<HTMLElement>(`[${ORIGINAL_ATTR}]`);
  if (original) original.hidden = false;
  container.setAttribute(STATE_ATTR, 'expanded');
}

export function hideContainer(container: HTMLElement): void {
  container.style.display = 'none';
  container.setAttribute(HANDLED_ATTR, 'hidden');
}

function renderBanner(p: FoldPayload): string {
  const tagsHtml = p.tags
    .map(t => `<span class="tag" style="--color:${escapeAttr(t.color ?? '#71717a')}">${escapeHtml(t.name)}</span>`)
    .join('');
  const noteHtml = p.note ? `<div class="note">${escapeHtml(p.note)}</div>` : '';
  return `
    <div class="banner">
      <span class="icon">🚫</span>
      <div class="info">
        <div class="title">已封鎖 @${escapeHtml(p.username)}</div>
        <div class="tags">${tagsHtml}</div>
        ${noteHtml}
      </div>
      <button class="expand">展開觀看 ▼</button>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}
function escapeAttr(s: string): string { return escapeHtml(s); }

function applyStyles(shadow: ShadowRoot, css: string): void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = css;
    shadow.prepend(style);
  }
}
