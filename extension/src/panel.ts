import * as vscode from 'vscode';
import { COLS, ROWS, SHEETS } from './assetValidation';
import { CharacterRegistry } from './characterRegistry';
import { COMMANDS } from './commands';
import {
  editorCursorFocusVector,
  editorCursorLocalPosition,
  normalizeFocusVector,
  workbenchFocusVector,
  type FocusVector,
} from './focusTarget';
import { parseWebviewToHostMessage, WebviewMessageValidationError } from './webviewProtocol';
import type {
  CharacterFrames,
  CharacterRecord,
  CompanionStateSnapshot,
  FocusTargetSource,
  HostToWebviewMessage,
  WebviewToHostMessage,
} from './shared';

export class CompanionPanel implements vscode.WebviewViewProvider {
  static readonly viewType = 'guruguru-codechan.codechanView';

  private view: vscode.WebviewView | undefined;
  private mouthTimer: NodeJS.Timeout | undefined;
  private focusTimer: NodeJS.Timeout | undefined;
  private settingsOpen = false;
  private focusSource: FocusTargetSource = 'workbench';
  private externalFocusVector: FocusVector = workbenchFocusVector();
  private mouthLevel: 0 | 1 | 2 = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly registry: CharacterRegistry,
  ) {}

  async open(options?: { preserveFocus?: boolean }): Promise<void> {
    if (options?.preserveFocus) {
      await vscode.commands.executeCommand(`${CompanionPanel.viewType}.focus`, { preserveFocus: true });
    } else {
      await vscode.commands.executeCommand(`${CompanionPanel.viewType}.focus`);
    }
    await this.postInit();
    await this.postFocusTarget();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        this.context.globalStorageUri,
      ],
    };
    webviewView.webview.html = this.html(webviewView.webview);

    const messageSubscription = webviewView.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleRawMessage(message);
    });
    webviewView.onDidDispose(() => {
      messageSubscription.dispose();
      if (this.view === webviewView) this.view = undefined;
      this.clearTimers();
    });
  }

  async postInit(): Promise<void> {
    if (!this.webview()) return;
    await this.post({ type: 'init', state: this.snapshot() });
    await this.postSettingsMode();
  }

  async postCharacterChanged(): Promise<void> {
    if (!this.webview()) return;
    await this.post({ type: 'characterChanged', state: this.snapshot() });
    await this.postSettingsMode();
  }

  async postLayoutChanged(): Promise<void> {
    if (!this.webview()) return;
    await this.post({ type: 'layoutChanged', layout: this.registry.layout() });
  }

  async postFocusTarget(): Promise<void> {
    if (!this.webview()) return;
    await this.post({ type: 'focusTarget', ...this.resolveFocusTarget() });
  }

  async toggleSettings(): Promise<void> {
    await this.open();
    this.settingsOpen = !this.settingsOpen;
    await this.postSettingsMode();
  }

  private async postSettingsMode(): Promise<void> {
    if (!this.webview()) return;
    await this.post({ type: 'settingsMode', open: this.settingsOpen });
  }

  scheduleFocusTarget(source?: FocusTargetSource): void {
    if (source) this.focusSource = source;
    if (this.focusTimer) return;
    this.focusTimer = setTimeout(() => {
      this.focusTimer = undefined;
      void this.postFocusTarget();
    }, 50);
  }

  private resolveFocusTarget(): { x: number; y: number; source: FocusTargetSource } {
    if (this.focusSource === 'editor') {
      const editor = vscode.window.activeTextEditor;
      if (editor) return this.editorFocusTarget(editor);
    }

    if (this.focusSource === 'terminal' && vscode.window.activeTerminal) {
      return this.externalFocusTarget('terminal');
    }

    const editor = vscode.window.activeTextEditor;
    if (editor) return this.editorFocusTarget(editor);

    if (vscode.window.activeTerminal) {
      return this.externalFocusTarget('terminal');
    }

    return this.externalFocusTarget('workbench');
  }

  private externalFocusTarget(source: FocusTargetSource): { x: number; y: number; source: FocusTargetSource } {
    return { ...this.externalFocusVector, source };
  }

  private editorFocusTarget(editor: vscode.TextEditor): { x: number; y: number; source: 'editor' } {
    const cursor = this.editorCursorPosition(editor);
    if (!cursor) {
      const target = this.externalFocusTarget('editor');
      return { x: target.x, y: target.y, source: 'editor' };
    }
    return { ...editorCursorFocusVector(this.externalFocusVector, cursor.x, cursor.y), source: 'editor' };
  }

  private editorCursorPosition(editor: vscode.TextEditor): { x: number; y: number } | undefined {
    const position = editor.selection.active;
    const visible = editor.visibleRanges.find((range) => range.contains(position)) ?? editor.visibleRanges[0];
    if (!visible) return undefined;

    const startLine = clamp(visible.start.line, 0, Math.max(0, editor.document.lineCount - 1));
    const endLine = clamp(visible.end.line, startLine, Math.max(0, editor.document.lineCount - 1));
    const tabSize = resolvedTabSize(editor);
    const visibleLines = [];
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      visibleLines.push({ line: lineNumber, text: editor.document.lineAt(lineNumber).text });
    }
    return editorCursorLocalPosition({
      positionLine: position.line,
      positionCharacter: position.character,
      visibleLines,
      tabSize,
      wrapColumn: resolvedWrapColumn(editor),
    });
  }

  async pulseMouth(): Promise<void> {
    if (!this.webview()) return;
    if (!this.registry.layout().mouthSync) return;
    if (this.mouthLevel !== 2) {
      this.mouthLevel = 2;
      await this.post({ type: 'mouthLevel', mouthLevel: 2 });
    }
    if (this.mouthTimer) clearTimeout(this.mouthTimer);
    this.mouthTimer = setTimeout(() => {
      this.mouthLevel = 0;
      void this.post({ type: 'mouthLevel', mouthLevel: 0 });
    }, 120);
  }

  async setMouthLevel(mouthLevel: 0 | 1 | 2): Promise<void> {
    if (this.mouthLevel === mouthLevel) return;
    this.mouthLevel = mouthLevel;
    await this.post({ type: 'mouthLevel', mouthLevel });
  }

  private async handleRawMessage(message: unknown): Promise<void> {
    let parsed: WebviewToHostMessage;
    try {
      parsed = parseWebviewToHostMessage(message);
    } catch (error) {
      if (error instanceof WebviewMessageValidationError) {
        console.warn(`Guruguru Codechan rejected an invalid Webview message: ${error.message}`);
        return;
      }
      throw error;
    }
    await this.handleMessage(parsed);
  }

  private async handleMessage(message: WebviewToHostMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.postInit();
        await this.postFocusTarget();
        break;
      case 'layoutChanged':
        await this.registry.setLayout(message.layout);
        if (!message.layout.mouthSync) await this.resetMouthPulse();
        break;
      case 'viewPointerExit':
        await this.setExternalFocusVector(message.x, message.y);
        break;
      case 'importCharacter':
        await vscode.commands.executeCommand(COMMANDS.importCharacter);
        break;
      case 'deleteCharacter':
        await vscode.commands.executeCommand(COMMANDS.deleteCharacter);
        break;
    }
  }

  private async setExternalFocusVector(x: number, y: number): Promise<void> {
    this.externalFocusVector = normalizeFocusVector(x, y);
    await this.postFocusTarget();
  }

  private snapshot(): CompanionStateSnapshot {
    const current = this.registry.current();
    return {
      characters: this.registry.all(),
      currentCharacterId: current.id,
      currentCharacterName: current.name,
      frames: this.framesFor(current),
      layout: this.registry.layout(),
      mouthLevel: 0,
    };
  }

  private framesFor(record: CharacterRecord): CharacterFrames {
    const root = this.registry.characterRoot(record);
    const sheets = {} as CharacterFrames['sheets'];
    for (const sheet of SHEETS) {
      sheets[sheet] = [];
      for (let row = 0; row < ROWS; row += 1) {
        const rowFrames: string[] = [];
        for (let col = 0; col < COLS; col += 1) {
          rowFrames.push(
            this.panelUri(vscode.Uri.joinPath(root, sheet, `r${row}c${col}.${record.ext}`)).toString(),
          );
        }
        sheets[sheet].push(rowFrames);
      }
    }
    return { ext: record.ext, sheets };
  }

  private panelUri(uri: vscode.Uri): vscode.Uri {
    const webview = this.webview();
    if (!webview) throw new Error('Companion view is not open.');
    return webview.asWebviewUri(uri);
  }

  private async post(message: HostToWebviewMessage): Promise<void> {
    const webview = this.webview();
    if (!webview) return;
    await webview.postMessage(message);
  }

  private webview(): vscode.Webview | undefined {
    return this.view?.webview;
  }

  private clearTimers(): void {
    if (this.mouthTimer) clearTimeout(this.mouthTimer);
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.mouthTimer = undefined;
    this.focusTimer = undefined;
    this.mouthLevel = 0;
  }

  private async resetMouthPulse(): Promise<void> {
    if (this.mouthTimer) clearTimeout(this.mouthTimer);
    this.mouthTimer = undefined;
    await this.setMouthLevel(0);
  }

  private html(webview: vscode.Webview): string {
    const nonce = createNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'webview.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'webview.css'));
    const csp = [
      "default-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Guruguru Codechan</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i += 1) {
    text += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return text;
}

function resolvedTabSize(editor: vscode.TextEditor): number {
  const raw = editor.options.tabSize;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 4;
}

function resolvedWrapColumn(editor: vscode.TextEditor): number | undefined {
  const config = vscode.workspace.getConfiguration('editor', editor.document.uri);
  const wordWrap = config.get<string>('wordWrap');
  if (wordWrap === undefined || wordWrap === 'off') return undefined;
  const raw = config.get<number>('wordWrapColumn');
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
    ? clamp(Math.floor(raw), 40, 240)
    : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
