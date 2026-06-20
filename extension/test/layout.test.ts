import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, validateCompanionLayout } from '../src/layout';

describe('DEFAULT_LAYOUT', () => {
  it('centers the companion by default', () => {
    expect(DEFAULT_LAYOUT.x).toBe(50);
    expect(DEFAULT_LAYOUT.y).toBe(50);
  });

  it('keeps keyboard mouth sync disabled by default', () => {
    expect(DEFAULT_LAYOUT.mouthSync).toBe(false);
  });

  it('accepts explicit mouth sync settings in persisted layout', () => {
    expect(validateCompanionLayout({ x: 50, y: 50, scale: 0.62, mouthSync: true })).toMatchObject({
      mouthSync: true,
    });
    expect(validateCompanionLayout({ x: 50, y: 50, scale: 0.62, mouthSync: false })).toMatchObject({
      mouthSync: false,
    });
  });

  it('rejects malformed mouth sync layout settings', () => {
    expect(() => validateCompanionLayout({ x: 50, y: 50, scale: 0.62, mouthSync: 'yes' })).toThrow(/mouthSync/);
  });
});
