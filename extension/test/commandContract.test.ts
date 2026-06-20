import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMAND_SURFACE_CONTRACT, COMMANDS } from '../src/commands';

type ExtensionManifest = {
  activationEvents?: string[];
  contributes?: {
    commands?: Array<{ command: string; title: string; category?: string }>;
    menus?: {
      'view/title'?: Array<{ command: string; when?: string; group?: string }>;
    };
    viewsContainers?: {
      panel?: Array<{ id: string; title: string; icon: string }>;
    };
    views?: Record<string, Array<{ id: string; name: string; type?: string }>>;
  };
};

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(resolve(extensionRoot, 'package.json'), 'utf8')) as ExtensionManifest;
const extensionSource = readFileSync(resolve(extensionRoot, 'src', 'extension.ts'), 'utf8');
const readme = readFileSync(resolve(extensionRoot, 'README.md'), 'utf8');
const commandTable = readme.slice(readme.indexOf('## Commands'), readme.indexOf('## Asset Format'));

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

describe('command surface contract', () => {
  it('keeps all registered commands declared in the command policy', () => {
    const contractIds = COMMAND_SURFACE_CONTRACT.map((command) => command.id);
    expect(new Set(contractIds).size).toBe(contractIds.length);
    expect(sorted(Object.values(COMMANDS))).toEqual(sorted(contractIds));

    const registeredCommandKeys = [...extensionSource.matchAll(/registerCommand\(COMMANDS\.(\w+)/g)]
      .map((match) => match[1] as keyof typeof COMMANDS);
    expect(new Set(registeredCommandKeys).size).toBe(registeredCommandKeys.length);
    expect(sorted(registeredCommandKeys.map((key) => COMMANDS[key]))).toEqual(sorted(contractIds));
    expect(extensionSource).not.toMatch(/registerCommand\('guruguru-codechan\./);
  });

  it('keeps manifest command contributions and activation events intentional', () => {
    const contributedCommands = packageJson.contributes?.commands?.map((command) => command.command) ?? [];
    const expectedContributedCommands = COMMAND_SURFACE_CONTRACT
      .filter((command) => command.contributed)
      .map((command) => command.id);
    expect(sorted(contributedCommands)).toEqual(sorted(expectedContributedCommands));

    const commandActivations = packageJson.activationEvents
      ?.filter((event) => event.startsWith('onCommand:'))
      .map((event) => event.slice('onCommand:'.length)) ?? [];
    const expectedCommandActivations = COMMAND_SURFACE_CONTRACT
      .filter((command) => command.activationEvent)
      .map((command) => command.id);
    expect(sorted(commandActivations)).toEqual(sorted(expectedCommandActivations));
    expect(packageJson.activationEvents).toContain('onView:guruguru-codechan.codechanView');
  });

  it('keeps the view title toolbar limited to title actions', () => {
    const viewTitleCommands = packageJson.contributes?.menus?.['view/title'] ?? [];
    const expectedViewTitleCommands = COMMAND_SURFACE_CONTRACT
      .filter((command) => command.viewTitle)
      .map((command) => command.id);
    expect(sorted(viewTitleCommands.map((command) => command.command))).toEqual(sorted(expectedViewTitleCommands));
    expect(viewTitleCommands.every((command) => command.when === 'view == guruguru-codechan.codechanView')).toBe(true);
  });

  it('keeps the Webview view container valid for VS Code contribution schema', () => {
    const panelContainers = packageJson.contributes?.viewsContainers?.panel ?? [];

    expect(panelContainers).toHaveLength(1);
    expect(panelContainers[0].id).toBe('guruguru-codechan-container');
    expect(panelContainers[0].id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(packageJson.contributes?.views?.[panelContainers[0].id]).toEqual([
      {
        type: 'webview',
        id: 'guruguru-codechan.codechanView',
        name: 'Codeちゃん',
      },
    ]);
  });

  it('documents only public command-palette entries in the command table', () => {
    const documentedCommandIds = [...commandTable.matchAll(/^\| [^|]+ \| `(guruguru-codechan\.[^`]+)` \|$/gm)]
      .map((match) => match[1]);
    const expectedDocumentedCommands = COMMAND_SURFACE_CONTRACT
      .filter((command) => command.readmeCommandTable)
      .map((command) => command.id);
    expect(sorted(documentedCommandIds)).toEqual(sorted(expectedDocumentedCommands));
    expect(readme).toMatch(/Import and delete are settings-layer actions/i);
    expect(readme).toMatch(/setMouthLevel.*integration-only/i);
  });
});
