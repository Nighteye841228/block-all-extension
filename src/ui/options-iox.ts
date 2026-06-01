import { AppState } from '@core/types';
import { serializeExport, parseImport, mergeImport, filterUsers, ExportFilter } from '@core/export';

const UNTAGGED = '__untagged__';

export function renderIox(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  const tagOptions = state.tags
    .map(t => `<label class="tag-pick"><input type="checkbox" data-tag-id="${escape(t.id)}"> <span class="tag-chip" style="--color:${escape(t.color ?? '#71717a')}">${escape(t.name)}</span></label>`)
    .join('');

  host.innerHTML = `
    <div class="field">
      <label>匯出目前的封鎖名單與標籤</label>
      <div class="tag-filter">
        <div class="tag-filter-hint">標籤過濾（不勾任何項目＝匯出全部）</div>
        <div class="tag-filter-grid">
          <label class="tag-pick"><input type="checkbox" data-tag-id="${UNTAGGED}"> <span class="tag-chip muted" style="--color:#a1a1aa">無標籤</span></label>
          ${tagOptions}
        </div>
        <div class="tag-filter-actions">
          <button class="btn" type="button" id="filter-all">全選</button>
          <button class="btn" type="button" id="filter-none">全不選</button>
          <span class="tag-filter-count" id="filter-count"></span>
        </div>
      </div>
      <button class="btn primary" id="export-btn">下載 JSON</button>
    </div>
    <div class="field">
      <label for="import-file">匯入</label>
      <input type="file" id="import-file" accept="application/json">
      <label>
        <input type="radio" name="import-mode" value="merge" checked> 合併（保留現有）
      </label>
      <label>
        <input type="radio" name="import-mode" value="replace"> 取代（清掉現有封鎖名單）
      </label>
    </div>
    <div id="import-status"></div>
  `;

  const checkboxes = () => host.querySelectorAll<HTMLInputElement>('.tag-filter input[type="checkbox"]');
  const countEl = host.querySelector<HTMLSpanElement>('#filter-count')!;

  function readFilter(): ExportFilter | undefined {
    const tagIds: string[] = [];
    let includeUntagged = false;
    for (const cb of checkboxes()) {
      if (!cb.checked) continue;
      const id = cb.dataset.tagId!;
      if (id === UNTAGGED) includeUntagged = true;
      else tagIds.push(id);
    }
    if (tagIds.length === 0 && !includeUntagged) return undefined;
    return { tagIds, includeUntagged };
  }

  function refreshCount() {
    const filter = readFilter();
    const n = filterUsers(state, filter).length;
    countEl.textContent = filter ? `共 ${n} 筆符合` : `共 ${n} 筆（全部）`;
  }

  checkboxes().forEach(cb => cb.addEventListener('change', refreshCount));
  host.querySelector('#filter-all')!.addEventListener('click', () => {
    checkboxes().forEach(cb => { cb.checked = true; });
    refreshCount();
  });
  host.querySelector('#filter-none')!.addEventListener('click', () => {
    checkboxes().forEach(cb => { cb.checked = false; });
    refreshCount();
  });
  refreshCount();

  host.querySelector('#export-btn')!.addEventListener('click', () => {
    const filter = readFilter();
    const json = serializeExport(state, '0.1.0-alpha', filter);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = filter ? '-filtered' : '';
    a.download = `block-all-${new Date().toISOString().slice(0, 10)}${suffix}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  host.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change', async e => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const status = host.querySelector<HTMLDivElement>('#import-status')!;
    try {
      const payload = parseImport(text);
      const mode = (host.querySelector<HTMLInputElement>('[name="import-mode"]:checked')!.value) as 'merge' | 'replace';
      const next = mergeImport(state, payload, { mode });
      await persist(next);
      status.textContent = `✅ 已${mode === 'merge' ? '合併' : '取代'}：共 ${Object.keys(next.blockedUsers).length} 筆`;
    } catch (err) {
      status.textContent = `❌ ${(err as Error).message}`;
    }
  });
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}
