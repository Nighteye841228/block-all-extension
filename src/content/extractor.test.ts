import { describe, it, expect, beforeEach } from 'vitest';
import { extractAuthorUsername, extractLikersFromDialog } from './extractor';
import { mountFixture } from '../test-utils/fixtures';

beforeEach(() => { document.body.innerHTML = ''; });

describe('extractAuthorUsername', () => {
  it('returns the author from a feed post container', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    expect(container).toBeTruthy();
    const username = extractAuthorUsername(container);
    expect(username).toMatch(/^[a-z0-9_.]+$/);
  });

  it('returns the author from a profile post container', () => {
    const host = mountFixture('profile-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    const username = extractAuthorUsername(container);
    expect(username).toBe('moonowkk');
  });

  it('returns null when no /post/ link present', () => {
    const div = document.createElement('div');
    expect(extractAuthorUsername(div)).toBeNull();
  });
});

describe('extractLikersFromDialog', () => {
  it('extracts deduplicated, normalized liker usernames', () => {
    const host = mountFixture('likes-modal.html');
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const likers = extractLikersFromDialog(dialog);
    expect(likers.length).toBeGreaterThan(0);
    expect(new Set(likers).size).toBe(likers.length);
    expect(likers.every(u => /^[a-z0-9_.]+$/.test(u))).toBe(true);
  });
});
