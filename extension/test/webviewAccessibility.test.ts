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
      'Open tweaks',
      'Lock gaze',
      'Unlock gaze',
      'Zoom companion',
      'Tracking range',
      'Tracking speed',
      'Sync mouth with typing',
      'Auto blink',
    ]) {
      expect(webviewSource).toContain(`aria-label="${label}"`);
    }
  });

  it('keeps high-contrast theme styling explicit', () => {
    expect(webviewStyles).toMatch(/body\.vscode-high-contrast/);
    expect(webviewStyles).toMatch(/--vscode-contrastBorder/);
    expect(webviewStyles).toMatch(/--vscode-contrastActiveBorder/);
    expect(webviewStyles).toMatch(/--vscode-editor-background/);
  });

  it('keeps keyboard focus and reduced-motion styles explicit', () => {
    expect(webviewStyles).toMatch(/:focus-visible/);
    expect(webviewStyles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(webviewStyles).toMatch(/transition:\s*none/);
  });

  it('uses inline SVG action icons with compact labels for settings actions', () => {
    expect(webviewSource).toContain('function ActionIcon');
    for (const icon of ['import', 'delete', 'tweaks']) {
      expect(webviewSource).toContain(`name="${icon}"`);
    }
    expect(webviewSource).toContain('className="assetIcon"');
    expect(webviewSource).toContain('className="assetText"');
    expect(webviewSource).not.toContain('codicon-');
    expect(webviewSource).not.toContain('@vscode/codicons');
    expect(webviewStyles).not.toMatch(/@font-face/);
    expect(webviewStyles).toMatch(/\.assetText\s*{/);
    expect(webviewStyles).toMatch(/@media\s*\(max-width:\s*360px\)[\s\S]*\.assetText\s*{[\s\S]*display:\s*none/);
  });
});
