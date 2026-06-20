import { LayoutValidationError, validateCompanionLayout } from './layout';
import type { CompanionLayout, WebviewToHostMessage } from './shared';

export class WebviewMessageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebviewMessageValidationError';
  }
}

export function parseWebviewToHostMessage(value: unknown): WebviewToHostMessage {
  if (!isRecord(value)) throw new WebviewMessageValidationError('Invalid Webview message: expected an object.');
  if (typeof value.type !== 'string') {
    throw new WebviewMessageValidationError('Invalid Webview message: type must be a string.');
  }

  switch (value.type) {
    case 'ready':
      assertExactKeys(value, ['type'], value.type);
      return { type: 'ready' };
    case 'importCharacter':
      assertExactKeys(value, ['type'], value.type);
      return { type: 'importCharacter' };
    case 'deleteCharacter':
      assertExactKeys(value, ['type'], value.type);
      return { type: 'deleteCharacter' };
    case 'layoutChanged':
      assertExactKeys(value, ['type', 'layout'], value.type);
      return { type: 'layoutChanged', layout: validateWebviewLayout(value.layout) };
    case 'viewPointerExit':
      assertExactKeys(value, ['type', 'x', 'y'], value.type);
      return {
        type: 'viewPointerExit',
        x: finiteNumberInRange(value.x, 'x', -1, 1),
        y: finiteNumberInRange(value.y, 'y', -1, 1),
      };
    default:
      throw new WebviewMessageValidationError(`Invalid Webview message: unsupported type "${value.type}".`);
  }
}

function validateWebviewLayout(value: unknown): CompanionLayout {
  if (!isRecord(value)) throw new WebviewMessageValidationError('Invalid Webview message layout: expected an object.');
  assertExactKeys(value, value.gazeLock === undefined ? ['x', 'y', 'scale'] : ['x', 'y', 'scale', 'gazeLock'], 'layout');
  if (value.gazeLock !== undefined) {
    if (!isRecord(value.gazeLock)) {
      throw new WebviewMessageValidationError('Invalid Webview message layout: gazeLock must be an object.');
    }
    assertExactKeys(value.gazeLock, ['x', 'y', 'vectorX', 'vectorY'], 'layout.gazeLock');
  }

  try {
    return validateCompanionLayout(value);
  } catch (error) {
    if (error instanceof LayoutValidationError) {
      throw new WebviewMessageValidationError(error.message);
    }
    throw error;
  }
}

function finiteNumberInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WebviewMessageValidationError(`Invalid Webview message: ${field} must be a finite number.`);
  }
  if (value < min || value > max) {
    throw new WebviewMessageValidationError(`Invalid Webview message: ${field} must be between ${min} and ${max}.`);
  }
  return value;
}

function assertExactKeys(value: Record<string, unknown>, allowedKeys: readonly string[], context: string): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new WebviewMessageValidationError(`Invalid Webview message ${context}: unexpected field "${key}".`);
    }
  }
  for (const key of allowedKeys) {
    if (!(key in value)) {
      throw new WebviewMessageValidationError(`Invalid Webview message ${context}: missing field "${key}".`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
