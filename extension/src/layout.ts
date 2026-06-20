import type { CompanionLayout, GazeLock } from './shared';

export const MIN_LAYOUT_SCALE = 0.24;
export const MAX_LAYOUT_SCALE = 1.6;

export const DEFAULT_LAYOUT: CompanionLayout = {
  x: 50,
  y: 50,
  scale: 0.62,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
