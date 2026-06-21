import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMAND_SURFACE_CONTRACT, COMMANDS } from '../src/commands';

type ExtensionManifest = {
  displayName?: string;
  description?: string;
  activationEvents?: string[];
  contributes?: {
    commands?: Array<{ command: string; title: string; category?: string }>;
    configuration?: {
      title?: string;
      properties?: Record<string, { type?: string; default?: unknown; description?: string }>;
    };
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
const packageNls = JSON.parse(readFileSync(resolve(extensionRoot, 'package.nls.json'), 'utf8')) as Record<string, string>;
const packageNlsJa = JSON.parse(readFileSync(resolve(extensionRoot, 'package.nls.ja.json'), 'utf8')) as Record<string, string>;
const packageNlsZhCn = JSON.parse(readFileSync(resolve(extensionRoot, 'package.nls.zh-cn.json'), 'utf8')) as Record<string, string>;
const extensionSource = readFileSync(resolve(extensionRoot, 'src', 'extension.ts'), 'utf8');
const readme = readFileSync(resolve(extensionRoot, 'README.md'), 'utf8');

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
    expect(packageJson.activationEvents).toContain('onStartupFinished');
  });

  it('keeps optional startup opening exposed as an explicit user setting', () => {
    const settings = packageJson.contributes?.configuration?.properties ?? {};
    const setting = settings['guruguru-codechan.openOnStartup'];

    expect(packageJson.contributes?.configuration?.title).toBe('%configuration.title%');
    expect(setting).toMatchObject({
      type: 'boolean',
      default: false,
      description: '%configuration.openOnStartup.description%',
    });
    expect(settings['guruguru-codechan.defaultCharacter']).toMatchObject({
      type: 'string',
      default: 'Default',
      description: '%configuration.defaultCharacter.description%',
    });
    expect(settings['guruguru-codechan.randomCharacterBlacklist']).toMatchObject({
      type: 'array',
      default: ['Codeちゃん'],
      description: '%configuration.randomCharacterBlacklist.description%',
    });
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
    expect(panelContainers[0].title).toBe('%views.container.title%');
    expect(packageJson.contributes?.views?.[panelContainers[0].id]).toEqual([
      {
        type: 'webview',
        id: 'guruguru-codechan.codechanView',
        name: '%views.codechan.name%',
      },
    ]);
    expect(packageNls['views.container.title']).toBe('Guruguru Codechan');
    expect(packageNls['views.codechan.name']).toBe('Codeちゃん');
  });

  it('keeps static manifest localization keys complete', () => {
    const manifestText = JSON.stringify(packageJson);
    const manifestKeys = [...manifestText.matchAll(/%([^%]+)%/g)].map((match) => match[1]);
    const uniqueManifestKeys = new Set(manifestKeys);
    for (const key of uniqueManifestKeys) {
      expect(packageNls[key], key).toEqual(expect.any(String));
      expect(packageNlsJa[key], key).toEqual(expect.any(String));
      expect(packageNlsZhCn[key], key).toEqual(expect.any(String));
    }
    expect(sorted(Object.keys(packageNlsJa))).toEqual(sorted(Object.keys(packageNls)));
    expect(sorted(Object.keys(packageNlsZhCn))).toEqual(sorted(Object.keys(packageNls)));
    expect(packageJson.displayName).toBe('%extension.displayName%');
    expect(packageJson.description).toBe('%extension.description%');
  });

  it('keeps the README focused on reader-facing setup and import flow', () => {
    expect(readme).not.toMatch(/^## Commands$/m);
    expect(readme).toMatch(/Codeちゃんは見ている。/);
    expect(readme).toMatch(/Guruguru Codechan: Open Codechan View/);
    expect(readme).toMatch(/Open settings from the view title/);
    expect(readme).toMatch(/Click the import button/);
    expect(readme).toMatch(/rotejin\/tomari-guruguru/);
    expect(readme).not.toMatch(/guruguru-codechan\.importCharacter/);
    expect(readme).not.toMatch(/guruguru-codechan\.deleteCharacter/);
    expect(readme).not.toMatch(/guruguru-codechan\.setMouthLevel/);
  });
});
