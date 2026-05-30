import { SELECTORS } from './selectors';
import { extractAuthorUsername, extractLikersFromDialog } from './extractor';

const COMMENT_BTN_ID = 'block-all-extract-comments';
const LIKES_BTN_ID = 'block-all-extract-likers';

export function maybeInjectCommentButton(onClick: (usernames: string[]) => void): void {
  const match = location.pathname.match(/^\/@([^/]+)\/post\/([^/]+)/);
  if (!match || !match[1]) {
    document.getElementById(COMMENT_BTN_ID)?.remove();
    return;
  }
  if (document.getElementById(COMMENT_BTN_ID)) return;

  const pageAuthor = match[1].toLowerCase();
  const btn = document.createElement('button');
  btn.id = COMMENT_BTN_ID;
  btn.textContent = '📋 擷取本頁留言者';
  btn.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:2147483646;padding:10px 14px;border-radius:999px;border:0;background:#18181b;color:white;cursor:pointer;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
  btn.addEventListener('click', () => {
    const usernames: string[] = [];
    document.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(c => {
      const u = extractAuthorUsername(c);
      if (u && u !== pageAuthor) usernames.push(u);
    });
    onClick(Array.from(new Set(usernames)));
  });
  document.body.appendChild(btn);
}

export function attachLikesDialogTrigger(onClick: (usernames: string[]) => void): void {
  const observer = new MutationObserver(() => {
    document.querySelectorAll<HTMLElement>(SELECTORS.likesDialog).forEach(dialog => {
      if (dialog.querySelector(`#${LIKES_BTN_ID}`)) return;
      const heading = Array.from(dialog.querySelectorAll<HTMLElement>('h1,h2,div')).find(e =>
        /讚|Likes/.test(e.textContent ?? ''),
      );
      if (!heading) return;
      const btn = document.createElement('button');
      btn.id = LIKES_BTN_ID;
      btn.textContent = '📋 擷取按讚者';
      btn.style.cssText = 'margin-left:8px;padding:4px 8px;border-radius:8px;border:1px solid #d4d4d8;background:white;cursor:pointer;font-size:12px;';
      btn.addEventListener('click', () => onClick(extractLikersFromDialog(dialog)));
      heading.appendChild(btn);
    });
  });
  observer.observe(document.body, { subtree: true, childList: true });
}
