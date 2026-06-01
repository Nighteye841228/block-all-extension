import { AppState } from '@core/types';

export function renderTags(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  function rerender() {
    host.innerHTML = `
      <div class="toolbar">
        <button class="btn primary" id="add-tag">新增標籤</button>
      </div>
      <div id="list"></div>
    `;
    const list = host.querySelector<HTMLDivElement>('#list')!;
    state.tags.forEach((tag, idx) => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <div><input value="${escape(tag.name)}" data-name></div>
        <div><input type="color" value="${tag.color ?? '#71717a'}" data-color></div>
        <div><span class="tag-chip" style="--color:${tag.color ?? '#71717a'}">${escape(tag.name)}</span></div>
        <div><button class="btn danger" ${tag.builtin ? 'disabled' : ''}>刪除</button></div>
      `;
      row.querySelector<HTMLInputElement>('[data-name]')!.addEventListener('change', async e => {
        tag.name = (e.target as HTMLInputElement).value; await persist(state);
      });
      row.querySelector<HTMLInputElement>('[data-color]')!.addEventListener('change', async e => {
        tag.color = (e.target as HTMLInputElement).value; await persist(state);
      });
      const delBtn = row.querySelector<HTMLButtonElement>('.danger')!;
      if (!tag.builtin) {
        delBtn.addEventListener('click', async () => {
          if (!confirm(`刪除「${tag.name}」？被標記的封鎖紀錄會保留但失去此標籤。`)) return;
          state.tags.splice(idx, 1);
          for (const u of Object.values(state.blockedUsers)) {
            u.tagIds = u.tagIds.filter(id => id !== tag.id);
          }
          await persist(state);
          rerender();
        });
      }
      list.appendChild(row);
    });
    host.querySelector('#add-tag')!.addEventListener('click', async () => {
      const id = `user:${Math.random().toString(36).slice(2, 9)}`;
      state.tags.push({ id, name: '新標籤', color: '#71717a', defaultAction: 'fold', builtin: false });
      await persist(state);
      rerender();
    });
  }

  function escape(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
  }

  rerender();
}
