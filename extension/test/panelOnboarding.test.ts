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
});
