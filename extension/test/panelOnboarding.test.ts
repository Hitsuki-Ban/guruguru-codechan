import { describe, expect, it, vi } from 'vitest';
import { CompanionPanel } from '../src/panel';

const vscodeMockState = vi.hoisted(() => ({
  executeCommand: vi.fn(async () => undefined),
}));

vi.mock('vscode', () => ({
  commands: {
    executeCommand: vscodeMockState.executeCommand,
  },
  window: {},
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
  Uri: {
    joinPath: vi.fn(),
  },
}));

describe('CompanionPanel onboarding behavior', () => {
  it('opens the Codechan view before toggling settings from a cold command', async () => {
    const panel = new CompanionPanel({} as never, {} as never);

    await panel.toggleSettings();

    expect(vscodeMockState.executeCommand).toHaveBeenCalledWith('guruguru-codechan.codechanView.focus');
  });

  it('does not pulse mouth from keyboard input while mouth sync is disabled', async () => {
    const postMessage = vi.fn(async () => true);
    const panel = new CompanionPanel({} as never, {
      layout: () => ({ x: 50, y: 50, scale: 0.62, mouthSync: false }),
    } as never);
    (panel as unknown as { view: { webview: { postMessage: typeof postMessage } } }).view = {
      webview: { postMessage },
    };

    await panel.pulseMouth();

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('pulses mouth from keyboard input while mouth sync is enabled', async () => {
    const postMessage = vi.fn(async () => true);
    const panel = new CompanionPanel({} as never, {
      layout: () => ({ x: 50, y: 50, scale: 0.62, mouthSync: true }),
    } as never);
    (panel as unknown as { view: { webview: { postMessage: typeof postMessage } } }).view = {
      webview: { postMessage },
    };

    await panel.pulseMouth();

    expect(postMessage).toHaveBeenCalledWith({ type: 'mouthLevel', mouthLevel: 2 });
  });
});
