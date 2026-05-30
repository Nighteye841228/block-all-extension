import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderBlocklist } from './options-blocklist';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('options-blocklist', () => {
  it('renders one row per blocked user', () => {
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    s.blockedUsers['bob']   = { username: 'bob',   tagIds: [], note: '', addedAt: 2 };
    renderBlocklist(document.body, s, vi.fn());
    expect(document.querySelectorAll('.list-row').length).toBe(2);
  });

  it('filters by search query', () => {
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    s.blockedUsers['bob']   = { username: 'bob',   tagIds: [], note: '', addedAt: 2 };
    renderBlocklist(document.body, s, vi.fn());
    const search = document.querySelector<HTMLInputElement>('input[placeholder*="搜尋"]')!;
    search.value = 'ali';
    search.dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('.list-row').length).toBe(1);
  });

  it('delete then undo restores entry', async () => {
    vi.useFakeTimers();
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    const persist = vi.fn().mockResolvedValue(undefined);
    renderBlocklist(document.body, s, persist);
    const delBtn = document.querySelector<HTMLButtonElement>('.list-row .danger')!;
    delBtn.click();
    expect(document.querySelector('.undo-bar')).toBeTruthy();
    document.querySelector<HTMLButtonElement>('.undo-bar .btn')!.click();
    expect(s.blockedUsers['alice']).toBeTruthy();
    vi.useRealTimers();
  });
});
