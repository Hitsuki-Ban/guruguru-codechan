import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const panelSource = readFileSync(resolve(extensionRoot, 'src', 'panel.ts'), 'utf8');

describe('Webview security boundary', () => {
  it('parses unknown Webview messages before dispatching host-side effects', () => {
    expect(panelSource).toContain("import { parseWebviewToHostMessage, WebviewMessageValidationError } from './webviewProtocol';");
    expect(panelSource).toMatch(/onDidReceiveMessage\(\(message:\s*unknown\)/);
    expect(panelSource).toContain('parseWebviewToHostMessage(message)');
    expect(panelSource).not.toContain('onDidReceiveMessage((message: WebviewToHostMessage)');
  });

  it('keeps a restrictive Webview content security policy', () => {
    expect(panelSource).toContain('"default-src \'none\'"');
    expect(panelSource).toContain('"base-uri \'none\'"');
    expect(panelSource).toContain('"form-action \'none\'"');
    expect(panelSource).toContain('`img-src ${webview.cspSource} data:`');
    expect(panelSource).toContain('`style-src ${webview.cspSource} \'unsafe-inline\'`');
    expect(panelSource).toContain('`font-src ${webview.cspSource}`');
    expect(panelSource).toContain("`script-src 'nonce-${nonce}'`");
    expect(panelSource).not.toMatch(/https?:/);
  });
});
