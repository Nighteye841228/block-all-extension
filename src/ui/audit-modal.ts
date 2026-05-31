import { html, render } from 'lit-html';
import { AppState, Tag } from '@core/types';
import { normalizeUsername } from '@core/normalize';
import modalCss from './styles/modal.css?raw';

export interface AuditRow {
  username: string;
  tagIds: string[];
  note: string;
  alreadyBlocked: boolean;
}

export interface AuditModalOptions {
  state: AppState;
  usernames: string[];
  mountTo: HTMLElement;
  useShadow: boolean;
  onSave: (rows: AuditRow[]) => void;
  onCancel: () => void;
}

export function openAuditModal(opts: AuditModalOptions): { close(): void } {
  const seen = new Set<string>();
  const rows: AuditRow[] = [];
  for (const u of opts.usernames) {
    const n = normalizeUsername(u);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    const existing = opts.state.blockedUsers[n];
    rows.push({
      username: n,
      tagIds: existing ? [...existing.tagIds] : [],
      note: existing ? existing.note : '',
      alreadyBlocked: Boolean(existing),
    });
  }
  const selected = new Set<string>(rows.map(r => r.username));
  const bulkTagIds = new Set<string>();
  let bulkNote = '';

  const host = document.createElement('div');
  let root: ShadowRoot | HTMLElement = host;
  if (opts.useShadow) {
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = modalCss; shadow.appendChild(style);
    root = shadow;
  } else {
    const style = document.createElement('style'); style.textContent = modalCss; host.appendChild(style);
  }
  opts.mountTo.appendChild(host);

  function close() { host.remove(); }

  function template() {
    const saveCount = selected.size;
    return html`
      <div class="modal-backdrop" @click=${(e: MouseEvent) => { if (e.target === e.currentTarget) cancel(); }}>
        <div class="modal" @click=${(e: MouseEvent) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>審核 — 擷取到 ${rows.length} 個 ID</h3>
            <button class="close" @click=${cancel}>×</button>
          </div>
          <div class="modal-body">
            <div class="bulk-controls">
              <label><input type="checkbox" .checked=${selected.size === rows.length} @change=${toggleAll}> 全選</label>
              <span>套用到勾選:</span>
              ${opts.state.tags.map(t => html`
                <button
                  ?data-selected=${bulkTagIds.has(t.id)}
                  style="--color:${t.color ?? '#71717a'}"
                  @click=${() => { bulkTagIds.has(t.id) ? bulkTagIds.delete(t.id) : bulkTagIds.add(t.id); applyBulk(); rerender(); }}
                >${t.name}</button>
              `)}
              <input type="text" placeholder="套用備註" @input=${(e: Event) => { bulkNote = (e.target as HTMLInputElement).value; applyBulk(); rerender(); }}>
            </div>
            ${rows.map(r => rowTemplate(r))}
          </div>
          <div class="modal-footer">
            <button class="secondary" @click=${cancel}>取消</button>
            <button class="primary" @click=${save}>儲存 ${saveCount} 筆</button>
          </div>
        </div>
      </div>
    `;
  }

  function rowTemplate(r: AuditRow) {
    return html`
      <div class="row">
        <input type="checkbox" .checked=${selected.has(r.username)} @change=${(e: Event) => {
          (e.target as HTMLInputElement).checked ? selected.add(r.username) : selected.delete(r.username);
          rerender();
        }}>
        <span class="username">@${r.username}</span>
        ${r.alreadyBlocked ? html`<span class="warn">⚠ 已在黑名單</span>` : ''}
        <span class="tags">
          ${opts.state.tags.map((t: Tag) => html`
            <button
              ?data-selected=${r.tagIds.includes(t.id)}
              style="--color:${t.color ?? '#71717a'}"
              @click=${() => {
                const i = r.tagIds.indexOf(t.id);
                if (i >= 0) r.tagIds.splice(i, 1); else r.tagIds.push(t.id);
                rerender();
              }}
            >${t.name}</button>
          `)}
        </span>
        <input type="text" placeholder="備註" .value=${r.note} @input=${(e: Event) => { r.note = (e.target as HTMLInputElement).value; }}>
      </div>
    `;
  }

  function toggleAll(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) for (const r of rows) selected.add(r.username);
    else selected.clear();
    rerender();
  }

  function applyBulk() {
    for (const r of rows) {
      if (!selected.has(r.username)) continue;
      for (const id of bulkTagIds) if (!r.tagIds.includes(id)) r.tagIds.push(id);
      if (bulkNote) r.note = bulkNote;
    }
  }

  function save() {
    const picked = rows.filter(r => selected.has(r.username));
    opts.onSave(picked);
    closeAndCleanup();
  }

  function cancel() { opts.onCancel(); closeAndCleanup(); }

  function rerender() { render(template(), root as unknown as HTMLElement); }
  rerender();

  const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
  document.addEventListener('keydown', escHandler);

  function closeAndCleanup() {
    document.removeEventListener('keydown', escHandler);
    close();
  }

  return { close: closeAndCleanup };
}
