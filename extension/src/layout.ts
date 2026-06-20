import type { CompanionLayout, GazeLock } from './shared';

export const MIN_LAYOUT_SCALE = 0.24;
export const MAX_LAYOUT_SCALE = 1.6;
export const MIN_TRACKING_RANGE = 120;
export const MAX_TRACKING_RANGE = 1200;
export const MIN_TRACKING_SPEED = 0.04;
export const MAX_TRACKING_SPEED = 0.5;

export const DEFAULT_LAYOUT: CompanionLayout = {
  x: 50,
  y: 50,
  scale: 0.62,
  mouthSync: false,
  trackingRange: 340,
  trackingSpeed: 0.3,
  autoBlink: true,
};

export class LayoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutValidationError';
  }
}

export function validateCompanionLayout(value: unknown): CompanionLayout {
  if (!isRecord(value)) throw new LayoutValidationError('Invalid companion layout: expected an object.');
  const layout: CompanionLayout = {
    x: finiteNumberInRange(value.x, 'x', 0, 100),
    y: finiteNumberInRange(value.y, 'y', 0, 100),
    scale: finiteNumberInRange(value.scale, 'scale', MIN_LAYOUT_SCALE, MAX_LAYOUT_SCALE),
    mouthSync: booleanField(value.mouthSync, 'mouthSync'),
    trackingRange: finiteNumberInRange(value.trackingRange, 'trackingRange', MIN_TRACKING_RANGE, MAX_TRACKING_RANGE),
    trackingSpeed: finiteNumberInRange(value.trackingSpeed, 'trackingSpeed', MIN_TRACKING_SPEED, MAX_TRACKING_SPEED),
    autoBlink: booleanField(value.autoBlink, 'autoBlink'),
  };
  if (value.gazeLock !== undefined) layout.gazeLock = validateGazeLock(value.gazeLock);
  return layout;
}

function validateGazeLock(value: unknown): GazeLock {
  if (!isRecord(value)) throw new LayoutValidationError('Invalid companion layout: gazeLock must be an object.');
  return {
    x: finiteNumberInRange(value.x, 'gazeLock.x', 0, 100),
    y: finiteNumberInRange(value.y, 'gazeLock.y', 0, 100),
    vectorX: finiteNumberInRange(value.vectorX, 'gazeLock.vectorX', -1, 1),
    vectorY: finiteNumberInRange(value.vectorY, 'gazeLock.vectorY', -1, 1),
  };
}

function finiteNumberInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LayoutValidationError(`Invalid companion layout: ${field} must be a finite number.`);
  }
  if (value < min || value > max) {
    throw new LayoutValidationError(`Invalid companion layout: ${field} must be between ${min} and ${max}.`);
  }
  return value;
}

function booleanField(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new LayoutValidationError(`Invalid companion layout: ${field} must be a boolean.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
