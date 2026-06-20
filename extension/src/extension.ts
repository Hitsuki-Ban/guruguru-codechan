import * as vscode from 'vscode';
import { AssetValidationError } from './assetValidation';
import { CharacterRegistry } from './characterRegistry';
import { COMMANDS } from './commands';
import { CompanionPanel } from './panel';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const registry = new CharacterRegistry(context);
  await registry.recoverPersistedState();
  const panel = new CompanionPanel(context, registry);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CompanionPanel.viewType, panel),
    vscode.commands.registerCommand(COMMANDS.openCanvas, async () => {
      await runUserCommand(async () => {
        await panel.open();
      });
    }),
    vscode.commands.registerCommand(COMMANDS.importCharacter, async () => {
      await runUserCommand(async () => {
        const folders = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Import Guruguru Character',
          title: 'Select a folder containing A-F frame directories',
        });
        if (!folders || folders.length === 0) return;
        const name = await vscode.window.showInputBox({
          title: 'Name this character',
          prompt: 'Character names must be unique.',
          ignoreFocusOut: true,
          validateInput(value) {
            return value.trim().length === 0 ? 'Character name is required.' : undefined;
          },
        });
        if (name === undefined) return;
        const record = await registry.importCharacter(folders[0], name);
        await panel.open();
        await panel.postCharacterChanged();
        vscode.window.showInformationMessage(`Imported character: ${record.name}`);
      });
    }),
    vscode.commands.registerCommand(COMMANDS.switchCharacter, async () => {
      await runUserCommand(async () => {
        const characters = registry.all();
        const pick = await vscode.window.showQuickPick(
          characters.map((character) => ({
            label: character.name,
            description: character.kind === 'builtIn' ? 'Bundled sample' : 'Imported',
            id: character.id,
          })),
          { title: 'Switch Guruguru Character' },
        );
        if (!pick) return;
        const record = await registry.setCurrent(pick.id);
        await panel.open();
        await panel.postCharacterChanged();
        vscode.window.showInformationMessage(`Switched character: ${record.name}`);
      });
    }),
    vscode.commands.registerCommand(COMMANDS.deleteCharacter, async () => {
      await runUserCommand(async () => {
        const imported = registry.all().filter((character) => character.kind === 'user');
        if (imported.length === 0) {
          vscode.window.showInformationMessage('No imported characters to delete.');
          return;
        }
        const pick = await vscode.window.showQuickPick(
          imported.map((character) => ({ label: character.name, id: character.id })),
          { title: 'Delete Imported Guruguru Character' },
        );
        if (!pick) return;
        const confirmed = await vscode.window.showWarningMessage(
          `Delete imported character "${pick.label}" from local extension storage?`,
          { modal: true },
          'Delete',
        );
        if (confirmed !== 'Delete') return;
        await registry.deleteCharacter(pick.id);
        await panel.postCharacterChanged();
        vscode.window.showInformationMessage(`Deleted character: ${pick.label}`);
      });
    }),
    vscode.commands.registerCommand(COMMANDS.toggleSettings, async () => {
      await runUserCommand(async () => {
        await panel.toggleSettings();
      });
    }),
    vscode.commands.registerCommand(COMMANDS.setMouthLevel, async (level: unknown) => {
      await runUserCommand(async () => {
        if (level !== 0 && level !== 1 && level !== 2) throw new Error('Mouth level must be 0, 1, or 2.');
        await panel.setMouthLevel(level);
      });
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (vscode.window.activeTextEditor === event.textEditor) panel.scheduleFocusTarget('editor');
    }),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (vscode.window.activeTextEditor === event.textEditor) panel.scheduleFocusTarget('editor');
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      panel.scheduleFocusTarget(editor ? 'editor' : 'workbench');
    }),
    vscode.window.onDidChangeActiveTerminal((terminal) => {
      panel.scheduleFocusTarget(terminal ? 'terminal' : 'workbench');
    }),
    vscode.window.onDidChangeTerminalState((terminal) => {
      if (vscode.window.activeTerminal === terminal) panel.scheduleFocusTarget('terminal');
    }),
    vscode.window.onDidChangeWindowState(() => {
      panel.scheduleFocusTarget();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        void panel.pulseMouth();
      }
    }),
  );

  if (vscode.workspace.getConfiguration('guruguru-codechan').get<boolean>('openOnStartup') === true) {
    await panel.open({ preserveFocus: true });
  }
}

export function deactivate(): void {}

async function runUserCommand(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    const message = error instanceof AssetValidationError || error instanceof Error
      ? error.message
      : String(error);
    vscode.window.showErrorMessage(`Guruguru Codechan: ${message}`);
  }
}
