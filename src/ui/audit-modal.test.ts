import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openAuditModal, AuditRow } from './audit-modal';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('audit-modal', () => {
  it('renders one row per username, all preselected', () => {
    const state = emptyState();
    const usernames = ['alice', 'bob', 'charlie'];
    openAuditModal({ state, usernames, mountTo: document.body, useShadow: false, onSave: vi.fn(), onCancel: vi.fn() });
    const rows = document.querySelectorAll('.row');
    expect(rows.length).toBe(3);
    rows.forEach(r => expect(r.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true));
  });

  it('marks already-blocked users with a warning indicator', () => {
    const state = emptyState();
    state.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: 'prev', addedAt: 1 };
    openAuditModal({ state, usernames: ['alice', 'bob'], mountTo: document.body, useShadow: false, onSave: vi.fn(), onCancel: vi.fn() });
    const aliceRow = Array.from(document.querySelectorAll('.row')).find(r => r.textContent?.includes('alice'))!;
    expect(aliceRow.querySelector('.warn')).toBeTruthy();
  });

  it('save invokes onSave with selected rows and chosen tag ids', () => {
    const state = emptyState();
    const onSave = vi.fn();
    openAuditModal({ state, usernames: ['alice', 'bob'], mountTo: document.body, useShadow: false, onSave, onCancel: vi.fn() });
    const bobBox = Array.from(document.querySelectorAll<HTMLInputElement>('.row input[type="checkbox"]'))[1]!;
    bobBox.checked = false;
    bobBox.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.primary')!.click();
    expect(onSave).toHaveBeenCalledTimes(1);
    const rows: AuditRow[] = onSave.mock.calls[0]![0];
    expect(rows.map(r => r.username)).toEqual(['alice']);
  });

  it('cancel triggers onCancel and removes the modal', () => {
    const onCancel = vi.fn();
    openAuditModal({ state: emptyState(), usernames: ['alice'], mountTo: document.body, useShadow: false, onSave: vi.fn(), onCancel });
    document.querySelector<HTMLButtonElement>('.secondary')!.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });
});
