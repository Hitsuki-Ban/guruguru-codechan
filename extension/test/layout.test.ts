import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT } from '../src/layout';

describe('DEFAULT_LAYOUT', () => {
  it('centers the companion by default', () => {
    expect(DEFAULT_LAYOUT.x).toBe(50);
    expect(DEFAULT_LAYOUT.y).toBe(50);
  });
});
