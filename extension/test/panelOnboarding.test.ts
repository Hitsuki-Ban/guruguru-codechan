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

  it('shows and clears character loading state through the Webview protocol', async () => {
    const postMessage = vi.fn(async () => true);
    const panel = new CompanionPanel({} as never, {} as never);
    (panel as unknown as { view: { webview: { postMessage: typeof postMessage } } }).view = {
      webview: { postMessage },
    };

    await panel.postCharacterLoading(true, 'Importing Mint Pilot...');
    await panel.postCharacterLoading(false);

    expect(postMessage).toHaveBeenNthCalledWith(1, {
      type: 'characterLoading',
      active: true,
      message: 'Importing Mint Pilot...',
    });
    expect(postMessage).toHaveBeenNthCalledWith(2, {
      type: 'characterLoading',
      active: false,
    });
  });

  it('updates the Webview view title to the current character name', async () => {
    const postMessage = vi.fn(async () => true);
    const view = {
      title: 'Codeちゃん',
      webview: { postMessage },
    };
    const panel = new CompanionPanel({} as never, {} as never);
    (panel as unknown as {
      view: typeof view;
      snapshot(): unknown;
    }).view = view;
    (panel as unknown as { snapshot(): unknown }).snapshot = () => ({
      characters: [],
      currentCharacterId: 'mint-pilot',
      currentCharacterName: 'Mint Pilot',
      frames: { ext: 'webp', sheets: {} },
      layout: { x: 50, y: 50, scale: 0.62, mouthSync: false, trackingRange: 150, trackingSpeed: 0.18, autoBlink: true },
      mouthLevel: 0,
    });

    await panel.postCharacterChanged();

    expect(view.title).toBe('Mint Pilot');
    expect(postMessage).toHaveBeenCalledWith({
      type: 'characterChanged',
      state: expect.objectContaining({ currentCharacterName: 'Mint Pilot' }),
    });
  });
});
