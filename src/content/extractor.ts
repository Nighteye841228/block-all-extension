import { normalizeUsername } from '@core/normalize';
import { SELECTORS } from './selectors';

export function extractAuthorUsername(container: HTMLElement): string | null {
  const link = container.querySelector<HTMLAnchorElement>(SELECTORS.authorPostLink);
  if (!link) return null;
  const href = link.getAttribute('href') ?? '';
  const match = href.match(/^\/@([^/]+)\/post\//);
  return match && match[1] ? normalizeUsername(match[1]) : null;
}

export function extractLikersFromDialog(dialog: HTMLElement): string[] {
  const anchors = dialog.querySelectorAll<HTMLAnchorElement>(SELECTORS.anyUserLink);
  const out = new Set<string>();
  for (const a of anchors) {
    const href = a.getAttribute('href') ?? '';
    if (href.includes('/post/')) continue;
    const match = href.match(/^\/@([^/?#]+)/);
    if (!match || !match[1]) continue;
    out.add(normalizeUsername(match[1]));
  }
  return Array.from(out);
}
