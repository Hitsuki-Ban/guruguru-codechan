import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  MAX_TRACKING_RANGE,
  MAX_TRACKING_SPEED,
  MIN_TRACKING_RANGE,
  MIN_TRACKING_SPEED,
  validateCompanionLayout,
} from '../src/layout';

describe('DEFAULT_LAYOUT', () => {
  it('centers the companion by default', () => {
    expect(DEFAULT_LAYOUT.x).toBe(50);
    expect(DEFAULT_LAYOUT.y).toBe(50);
  });

  it('keeps keyboard mouth sync disabled by default', () => {
    expect(DEFAULT_LAYOUT.mouthSync).toBe(false);
  });

  it('keeps original guruguru tracking defaults and automatic blink enabled', () => {
    expect(DEFAULT_LAYOUT.trackingRange).toBe(340);
    expect(DEFAULT_LAYOUT.trackingSpeed).toBe(0.3);
    expect(DEFAULT_LAYOUT.autoBlink).toBe(true);
  });

  it('accepts explicit tweak settings in persisted layout', () => {
    expect(validateCompanionLayout({
      x: 50,
      y: 50,
      scale: 0.62,
      mouthSync: true,
      trackingRange: MIN_TRACKING_RANGE,
      trackingSpeed: MIN_TRACKING_SPEED,
      autoBlink: true,
    })).toMatchObject({
      mouthSync: true,
      trackingRange: MIN_TRACKING_RANGE,
      trackingSpeed: MIN_TRACKING_SPEED,
      autoBlink: true,
    });
    expect(validateCompanionLayout({
      x: 50,
      y: 50,
      scale: 0.62,
      mouthSync: false,
      trackingRange: MAX_TRACKING_RANGE,
      trackingSpeed: MAX_TRACKING_SPEED,
      autoBlink: false,
    })).toMatchObject({
      mouthSync: false,
      trackingRange: MAX_TRACKING_RANGE,
      trackingSpeed: MAX_TRACKING_SPEED,
      autoBlink: false,
    });
  });

  it('rejects malformed tweak layout settings', () => {
    const base = {
      x: 50,
      y: 50,
      scale: 0.62,
      mouthSync: false,
      trackingRange: 340,
      trackingSpeed: 0.3,
      autoBlink: true,
    };

    expect(() => validateCompanionLayout({ ...base, mouthSync: 'yes' })).toThrow(/mouthSync/);
    expect(() => validateCompanionLayout({ ...base, trackingRange: MIN_TRACKING_RANGE - 1 })).toThrow(/trackingRange/);
    expect(() => validateCompanionLayout({ ...base, trackingSpeed: MAX_TRACKING_SPEED + 0.01 })).toThrow(/trackingSpeed/);
    expect(() => validateCompanionLayout({ ...base, autoBlink: 'yes' })).toThrow(/autoBlink/);
  });
});
