import { describe, it, expect } from 'vitest';

describe('vitest sanity', () => {
  it('runs in jsdom and document exists', () => {
    expect(typeof document).toBe('object');
    expect(document.createElement('div')).toBeInstanceOf(HTMLElement);
  });
});
