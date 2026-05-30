import { AppState } from '@core/types';
import { serializeExport, parseImport, mergeImport } from '@core/export';

export function renderIox(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  host.innerHTML = `
    <div class="field">
      <label>匯出目前的封鎖名單與標籤</label>
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

  host.querySelector('#export-btn')!.addEventListener('click', () => {
    const json = serializeExport(state, '0.1.0');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `block-all-${new Date().toISOString().slice(0, 10)}.json`;
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
