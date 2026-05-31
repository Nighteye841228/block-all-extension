import { AppState, BlockedUser } from '@core/types';
import { openAuditModal } from '@ui/audit-modal';

export function renderBlocklist(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  let query = '';
  let undoState: { users: BlockedUser[]; timer: number } | null = null;
  const selected = new Set<string>();

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
      <div class="bulk-bar" id="bulk-bar">
        <label><input type="checkbox" id="select-all"> 全選本頁</label>
        <span class="bulk-count" id="bulk-count"></span>
        <button class="btn danger" id="bulk-delete" disabled>刪除選取</button>
      </div>
      <div id="list"></div>
      <div id="undo-bar"></div>
    `;
    const search = host.querySelector<HTMLInputElement>('.toolbar input')!;
    search.addEventListener('input', () => { query = search.value; renderList(); refreshBulkBar(); });
    host.querySelector('#batch-add')!.addEventListener('click', () => promptBatchAdd());
    host.querySelector<HTMLInputElement>('#select-all')!.addEventListener('change', e => {
      const checked = (e.target as HTMLInputElement).checked;
      const visible = rows();
      if (checked) for (const u of visible) selected.add(u.username);
      else for (const u of visible) selected.delete(u.username);
      renderList();
      refreshBulkBar();
    });
    host.querySelector('#bulk-delete')!.addEventListener('click', bulkDelete);
    renderList();
    refreshBulkBar();
    renderUndo();
  }

  function renderList() {
    const list = host.querySelector<HTMLDivElement>('#list')!;
    list.innerHTML = '';
    for (const u of rows()) {
      const row = document.createElement('div');
      row.className = 'list-row';
      const chipsHtml = u.tagIds.length
        ? u.tagIds.map(id => tagChip(id)).filter(Boolean).join(' ')
        : `<span class="tag-chip muted" style="--color:#a1a1aa">無標籤</span>`;
      row.innerHTML = `
        <div class="row-select">
          <input type="checkbox" data-pick ${selected.has(u.username) ? 'checked' : ''}>
          <span>@${escape(u.username)}</span>
        </div>
        <div class="chips">${chipsHtml}</div>
        <div><input value="${escape(u.note)}" data-note></div>
        <div>
          <button class="btn" data-edit>編輯</button>
          <button class="btn danger" data-delete>刪除</button>
        </div>
      `;
      row.querySelector<HTMLInputElement>('[data-pick]')!.addEventListener('change', e => {
        const checked = (e.target as HTMLInputElement).checked;
        if (checked) selected.add(u.username); else selected.delete(u.username);
        refreshBulkBar();
      });
      row.querySelector<HTMLInputElement>('[data-note]')!.addEventListener('change', async e => {
        u.note = (e.target as HTMLInputElement).value;
        await persist(state);
      });
      row.querySelector('[data-edit]')!.addEventListener('click', () => openEditor([u.username]));
      row.querySelector('[data-delete]')!.addEventListener('click', () => deleteWithUndo([u.username]));
      list.appendChild(row);
    }
  }

  function refreshBulkBar() {
    const visible = rows();
    const visibleSelected = visible.filter(u => selected.has(u.username)).length;
    const countEl = host.querySelector<HTMLSpanElement>('#bulk-count');
    const delBtn = host.querySelector<HTMLButtonElement>('#bulk-delete');
    const all = host.querySelector<HTMLInputElement>('#select-all');
    if (countEl) countEl.textContent = visibleSelected > 0 ? `已選 ${visibleSelected} 筆` : '';
    if (delBtn) delBtn.disabled = visibleSelected === 0;
    if (all) all.checked = visible.length > 0 && visibleSelected === visible.length;
  }

  function bulkDelete() {
    const visible = rows();
    const targets = visible.filter(u => selected.has(u.username));
    if (targets.length === 0) return;
    if (!window.confirm(`要刪除這 ${targets.length} 筆？（可在底部復原一次）`)) return;
    deleteWithUndo(targets.map(u => u.username));
  }

  function deleteWithUndo(usernames: string[]) {
    const removed: BlockedUser[] = [];
    for (const name of usernames) {
      const u = state.blockedUsers[name];
      if (!u) continue;
      removed.push(u);
      delete state.blockedUsers[name];
      selected.delete(name);
    }
    if (removed.length === 0) return;
    if (undoState) clearTimeout(undoState.timer);
    const timer = window.setTimeout(async () => {
      undoState = null;
      await persist(state);
      renderUndo();
    }, 5000);
    undoState = { users: removed, timer };
    renderList();
    refreshBulkBar();
    renderUndo();
  }

  function renderUndo() {
    const bar = host.querySelector<HTMLDivElement>('#undo-bar')!;
    if (!undoState) { bar.innerHTML = ''; bar.className = ''; return; }
    bar.className = 'undo-bar';
    const label = undoState.users.length === 1
      ? `已刪除 @${escape(undoState.users[0]!.username)}`
      : `已刪除 ${undoState.users.length} 筆`;
    bar.innerHTML = `${label} <button class="btn">復原</button>`;
    bar.querySelector('button')!.addEventListener('click', async () => {
      if (!undoState) return;
      clearTimeout(undoState.timer);
      for (const u of undoState.users) state.blockedUsers[u.username] = u;
      undoState = null;
      await persist(state);
      renderList();
      refreshBulkBar();
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
    if (usernames.length === 0) return;
    openEditor(usernames);
  }

  function openEditor(usernames: string[]) {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    openAuditModal({
      state, usernames, mountTo: mount, useShadow: false,
      onSave: async picked => {
        for (const r of picked) {
          const prev = state.blockedUsers[r.username];
          state.blockedUsers[r.username] = {
            username: r.username, tagIds: r.tagIds, note: r.note,
            addedAt: prev?.addedAt ?? Date.now(),
            ...(prev?.sourceUrl ? { sourceUrl: prev.sourceUrl } : {}),
          };
        }
        await persist(state);
        mount.remove();
        rerender();
      },
      onCancel: () => { mount.remove(); },
    });
  }

  function escape(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
  }

  rerender();
}
