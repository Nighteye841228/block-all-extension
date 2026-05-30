import { describe, it, expect } from 'vitest';
import { normalizeUsername } from './normalize';

describe('normalizeUsername', () => {
  it('lowercases mixed case', () => {
    expect(normalizeUsername('MoonOwkk')).toBe('moonowkk');
  });

  it('strips a single leading @', () => {
    expect(normalizeUsername('@vic_404_kou')).toBe('vic_404_kou');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUsername('   spaced  ')).toBe('spaced');
  });

  it('removes internal whitespace', () => {
    expect(normalizeUsername('weird name')).toBe('weirdname');
  });

  it('handles leading @, mixed case, and whitespace together', () => {
    expect(normalizeUsername('  @Foo Bar ')).toBe('foobar');
  });

  it('returns an empty string for an empty/whitespace input', () => {
    expect(normalizeUsername('   ')).toBe('');
  });
});
