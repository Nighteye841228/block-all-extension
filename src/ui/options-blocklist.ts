import { AppState, BlockedUser } from '@core/types';

export function renderBlocklist(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  let query = '';
  let undoState: { user: BlockedUser; timer: number } | null = null;

  function rows(): BlockedUser[] {
    const users = Object.values(state.blockedUsers);
    const q = query.trim().toLowerCase();
    return users
      .filter(u => !q || u.username.includes(q) || u.note.toLowerCase().includes(q))
      .sort((a, b) => b.addedAt - a.addedAt);
  }

  function rerender() {
    host.innerHTML = `
      <div class="toolbar">
        <input placeholder="搜尋使用者或備註" value="${escape(query)}">
        <button class="btn primary" id="batch-add">批次新增 (貼上多個)</button>
      </div>
      <div id="list"></div>
      <div id="undo-bar"></div>
    `;
    const search = host.querySelector<HTMLInputElement>('.toolbar input')!;
    search.addEventListener('input', () => { query = search.value; renderList(); });
    host.querySelector('#batch-add')!.addEventListener('click', () => promptBatchAdd());
    renderList();
    renderUndo();
  }

  function renderList() {
    const list = host.querySelector<HTMLDivElement>('#list')!;
    list.innerHTML = '';
    for (const u of rows()) {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <div>@${escape(u.username)}</div>
        <div>${u.tagIds.map(id => tagChip(id)).join(' ')}</div>
        <div><input value="${escape(u.note)}" data-note></div>
        <div><button class="btn danger" data-delete>刪除</button></div>
      `;
      row.querySelector<HTMLInputElement>('[data-note]')!.addEventListener('change', async e => {
        u.note = (e.target as HTMLInputElement).value;
        await persist(state);
      });
      row.querySelector('[data-delete]')!.addEventListener('click', () => {
        const removed = state.blockedUsers[u.username];
        if (!removed) return;
        delete state.blockedUsers[u.username];
        if (undoState) clearTimeout(undoState.timer);
        const timer = window.setTimeout(async () => {
          undoState = null;
          await persist(state);
          renderUndo();
        }, 5000);
        undoState = { user: removed, timer };
        renderList();
        renderUndo();
      });
      list.appendChild(row);
    }
  }

  function renderUndo() {
    const bar = host.querySelector<HTMLDivElement>('#undo-bar')!;
    if (!undoState) { bar.innerHTML = ''; bar.className = ''; return; }
    bar.className = 'undo-bar';
    bar.innerHTML = `已刪除 @${escape(undoState.user.username)} <button class="btn">復原</button>`;
    bar.querySelector('button')!.addEventListener('click', async () => {
      if (!undoState) return;
      clearTimeout(undoState.timer);
      state.blockedUsers[undoState.user.username] = undoState.user;
      undoState = null;
      await persist(state);
      renderList();
      renderUndo();
    });
  }

  function tagChip(id: string): string {
    const tag = state.tags.find(t => t.id === id);
    if (!tag) return '';
    return `<span class="tag-chip" style="--color:${tag.color ?? '#71717a'}">${escape(tag.name)}</span>`;
  }

  function promptBatchAdd() {
    const raw = window.prompt('一行一個 username 或 @username：');
    if (!raw) return;
    const usernames = raw.split(/\n/).map(s => s.trim()).filter(Boolean);
    for (const u of usernames) {
      const name = u.replace(/^@/, '').toLowerCase();
      if (state.blockedUsers[name]) continue;
      state.blockedUsers[name] = { username: name, tagIds: [], note: '', addedAt: Date.now() };
    }
    persist(state).then(rerender);
  }

  function escape(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
  }

  rerender();
}
