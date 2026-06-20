import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webviewSource = readFileSync(resolve(extensionRoot, 'src', 'webview', 'main.tsx'), 'utf8');
const webviewStyles = readFileSync(resolve(extensionRoot, 'src', 'webview', 'styles.css'), 'utf8');

describe('webview settings accessibility', () => {
  it('keeps settings controls named for screen readers', () => {
    for (const label of [
      'Move up',
      'Move left',
      'Move right',
      'Move down',
      'Import character',
      'Delete character',
      'Lock gaze',
      'Unlock gaze',
      'Zoom companion',
      'Sync mouth with typing',
    ]) {
      expect(webviewSource).toContain(`aria-label="${label}"`);
    }
  });

  it('keeps keyboard focus and reduced-motion styles explicit', () => {
    expect(webviewStyles).toMatch(/:focus-visible/);
    expect(webviewStyles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(webviewStyles).toMatch(/transition:\s*none/);
  });
});
