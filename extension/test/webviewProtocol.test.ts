import { describe, expect, it } from 'vitest';
import { parseWebviewToHostMessage, WebviewMessageValidationError } from '../src/webviewProtocol';

describe('parseWebviewToHostMessage', () => {
  it('accepts exact command messages from the Webview', () => {
    expect(parseWebviewToHostMessage({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(parseWebviewToHostMessage({ type: 'importCharacter' })).toEqual({ type: 'importCharacter' });
    expect(parseWebviewToHostMessage({ type: 'deleteCharacter' })).toEqual({ type: 'deleteCharacter' });
  });

  it('accepts validated layout updates', () => {
    const message = parseWebviewToHostMessage({
      type: 'layoutChanged',
      layout: {
        x: 42,
        y: 58,
        scale: 0.72,
        mouthSync: true,
        trackingRange: 420,
        trackingSpeed: 0.22,
        autoBlink: false,
        gazeLock: {
          x: 12,
          y: 24,
          vectorX: -0.5,
          vectorY: 0.75,
        },
      },
    });

    expect(message).toEqual({
      type: 'layoutChanged',
      layout: {
        x: 42,
        y: 58,
        scale: 0.72,
        mouthSync: true,
        trackingRange: 420,
        trackingSpeed: 0.22,
        autoBlink: false,
        gazeLock: {
          x: 12,
          y: 24,
          vectorX: -0.5,
          vectorY: 0.75,
        },
      },
    });
  });

  it('accepts normalized pointer-exit vectors', () => {
    expect(parseWebviewToHostMessage({ type: 'viewPointerExit', x: -1, y: 0.25 })).toEqual({
      type: 'viewPointerExit',
      x: -1,
      y: 0.25,
    });
  });

  it('rejects malformed or unexpected messages before host-side effects', () => {
    const invalidMessages = [
      undefined,
      null,
      'ready',
      [],
      {},
      { type: 'setMouthLevel', mouthLevel: 2 },
      { type: 'ready', extra: true },
      { type: 'importCharacter', path: 'C:/workspace/asset' },
      { type: 'layoutChanged' },
      { type: 'layoutChanged', layout: { x: Number.NaN, y: 50, scale: 0.62 } },
      { type: 'layoutChanged', layout: { x: 50, y: 50, scale: 2 } },
      { type: 'layoutChanged', layout: { x: 50, y: 50, scale: 0.62, mouthSync: 'yes', trackingRange: 340, trackingSpeed: 0.3, autoBlink: true } },
      { type: 'layoutChanged', layout: { x: 50, y: 50, scale: 0.62, mouthSync: false, trackingRange: 119, trackingSpeed: 0.3, autoBlink: true } },
      { type: 'layoutChanged', layout: { x: 50, y: 50, scale: 0.62, mouthSync: false, trackingRange: 340, trackingSpeed: 0.51, autoBlink: true } },
      { type: 'layoutChanged', layout: { x: 50, y: 50, scale: 0.62, mouthSync: false, trackingRange: 340, trackingSpeed: 0.3, autoBlink: 'yes' } },
      { type: 'layoutChanged', layout: { x: 50, y: 50, scale: 0.62, mouthSync: false, trackingRange: 340, trackingSpeed: 0.3, autoBlink: true, extra: true } },
      { type: 'layoutChanged', layout: { x: 50, y: 50, scale: 0.62, mouthSync: false, trackingRange: 340, trackingSpeed: 0.3, autoBlink: true, gazeLock: { x: 50, y: 50, vectorX: 0, vectorY: 0, extra: true } } },
      { type: 'viewPointerExit', x: 'left', y: 0 },
      { type: 'viewPointerExit', x: Number.POSITIVE_INFINITY, y: 0 },
      { type: 'viewPointerExit', x: 1.5, y: 0 },
      { type: 'viewPointerExit', x: 0, y: -1.5 },
    ];

    for (const invalidMessage of invalidMessages) {
      expect(() => parseWebviewToHostMessage(invalidMessage)).toThrow(WebviewMessageValidationError);
    }
  });
});
