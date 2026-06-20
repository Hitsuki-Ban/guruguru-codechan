import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { SHEETS } from '../src/assetValidation';
import { BUILT_IN_CHARACTER, CharacterRegistry, StoredStateError } from '../src/characterRegistry';
import { DEFAULT_LAYOUT } from '../src/layout';
import type { CharacterRecord, CompanionLayout } from '../src/shared';

const vscodeMockState = vi.hoisted(() => ({
  copyFailurePattern: undefined as RegExp | undefined,
  writeTargets: [] as string[],
}));

vi.mock('vscode', async () => {
  const nodePath = await import('node:path');
  const nodeFs = await import('node:fs/promises');

  class Uri {
    readonly fsPath: string;

    private constructor(fsPath: string) {
      this.fsPath = nodePath.resolve(fsPath);
    }

    static file(fsPath: string): Uri {
      return new Uri(fsPath);
    }

    static joinPath(base: Uri, ...segments: string[]): Uri {
      return new Uri(nodePath.join(base.fsPath, ...segments));
    }

    toString(): string {
      return this.fsPath;
    }
  }

  const FileType = {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64,
  } as const;

  return {
    Uri,
    FileType,
    workspace: {
      fs: {
        async createDirectory(uri: Uri): Promise<void> {
          vscodeMockState.writeTargets.push(uri.fsPath);
          await nodeFs.mkdir(uri.fsPath, { recursive: true });
        },
        async readDirectory(uri: Uri): Promise<Array<[string, number]>> {
          const entries = await nodeFs.readdir(uri.fsPath, { withFileTypes: true });
          return entries.map((entry) => [
            entry.name,
            entry.isDirectory() ? FileType.Directory : FileType.File,
          ]);
        },
        async copy(source: Uri, target: Uri): Promise<void> {
          if (vscodeMockState.copyFailurePattern?.test(source.fsPath)) {
            throw new Error(`Mock copy failure for ${source.fsPath}`);
          }
          vscodeMockState.writeTargets.push(target.fsPath);
          await nodeFs.mkdir(nodePath.dirname(target.fsPath), { recursive: true });
          await nodeFs.copyFile(source.fsPath, target.fsPath);
        },
        async writeFile(uri: Uri, data: Uint8Array): Promise<void> {
          vscodeMockState.writeTargets.push(uri.fsPath);
          await nodeFs.mkdir(nodePath.dirname(uri.fsPath), { recursive: true });
          await nodeFs.writeFile(uri.fsPath, data);
        },
        async delete(uri: Uri): Promise<void> {
          vscodeMockState.writeTargets.push(uri.fsPath);
          await nodeFs.rm(uri.fsPath, { recursive: true, force: true });
        },
      },
    },
  };
});

const CHARACTERS_KEY = 'guruguru-codechan.characters';
const CURRENT_CHARACTER_KEY = 'guruguru-codechan.currentCharacterId';
const LAYOUT_KEY = 'guruguru-codechan.layout';

type MockGlobalState = {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Promise<void>;
  failNextUpdate(key: string): void;
  seed(key: string, value: unknown): void;
};

type TestEnvironment = {
  root: string;
  globalStorageRoot: string;
  context: vscode.ExtensionContext;
  globalState: MockGlobalState;
};

describe('CharacterRegistry storage transactions', () => {
  let roots: string[] = [];

  beforeEach(() => {
    roots = [];
    vscodeMockState.copyFailurePattern = undefined;
    vscodeMockState.writeTargets = [];
  });

  afterEach(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  });

  it('imports a complete character into global storage and restores it on reload', async () => {
    const env = await createEnvironment();
    const source = await createCharacterFixture(env.root, 'source-webp', 'webp');
    const registry = new CharacterRegistry(env.context);

    const record = await registry.importCharacter(source, 'Mint Pilot');

    expect(record).toMatchObject({
      id: 'mint-pilot',
      name: 'Mint Pilot',
      kind: 'user',
      ext: 'webp',
      storageRelativePath: 'characters/mint-pilot',
    });
    expect(registry.current().id).toBe('mint-pilot');
    expect(await pathExists(join(env.globalStorageRoot, 'characters', 'mint-pilot', 'A', 'r0c0.webp'))).toBe(true);
    expect(await manifest(env.globalStorageRoot, record)).toMatchObject({ id: 'mint-pilot', name: 'Mint Pilot' });
    expect(vscodeMockState.writeTargets.length).toBeGreaterThan(0);
    expect(vscodeMockState.writeTargets.every((target) => isInside(env.globalStorageRoot, target))).toBe(true);

    const reloaded = new CharacterRegistry(env.context);
    expect(reloaded.current()).toEqual(record);
    expect(reloaded.all().map((character) => character.id)).toEqual([BUILT_IN_CHARACTER.id, 'mint-pilot']);
  });

  it('rejects invalid assets before writing imported character storage', async () => {
    const env = await createEnvironment();
    const missingFrameSource = await createCharacterFixture(env.root, 'missing-frame', 'webp', {
      skip: 'F/r4c4.webp',
    });
    const mixedFormatSource = await createCharacterFixture(env.root, 'mixed-format', 'webp', {
      replace: { from: 'A/r0c0.webp', to: 'A/r0c0.png' },
    });
    const registry = new CharacterRegistry(env.context);

    await expect(registry.importCharacter(missingFrameSource, 'Missing Frame')).rejects.toThrow(/Missing frame/);
    await expect(registry.importCharacter(mixedFormatSource, 'Mixed Format')).rejects.toThrow(/one image format/);

    expect(await pathExists(join(env.globalStorageRoot, 'characters', 'missing-frame'))).toBe(false);
    expect(await pathExists(join(env.globalStorageRoot, 'characters', 'mixed-format'))).toBe(false);
    expect(env.globalState.get<CharacterRecord[]>(CHARACTERS_KEY)).toBeUndefined();
  });

  it('rejects duplicate names without creating another storage record', async () => {
    const env = await createEnvironment();
    const firstSource = await createCharacterFixture(env.root, 'first', 'webp');
    const secondSource = await createCharacterFixture(env.root, 'second', 'webp');
    const registry = new CharacterRegistry(env.context);

    await registry.importCharacter(firstSource, 'Mint Pilot');
    await expect(registry.importCharacter(secondSource, '  mint pilot  ')).rejects.toThrow(/already exists/);

    expect(env.globalState.get<CharacterRecord[]>(CHARACTERS_KEY)).toHaveLength(1);
    expect(await readdir(join(env.globalStorageRoot, 'characters'))).toEqual(['mint-pilot']);
  });

  it('cleans up imported files and restores metadata when import state update fails', async () => {
    const env = await createEnvironment();
    const source = await createCharacterFixture(env.root, 'state-fails', 'webp');
    const registry = new CharacterRegistry(env.context);
    env.globalState.failNextUpdate(CURRENT_CHARACTER_KEY);

    await expect(registry.importCharacter(source, 'State Fails')).rejects.toThrow(/Mock globalState update failure/);

    expect(await pathExists(join(env.globalStorageRoot, 'characters', 'state-fails'))).toBe(false);
    expect(env.globalState.get<CharacterRecord[]>(CHARACTERS_KEY)).toBeUndefined();
    expect(registry.current().id).toBe(BUILT_IN_CHARACTER.id);
  });

  it('cleans up partially copied files when frame copy fails', async () => {
    const env = await createEnvironment();
    const source = await createCharacterFixture(env.root, 'copy-fails', 'webp');
    const registry = new CharacterRegistry(env.context);
    vscodeMockState.copyFailurePattern = /A[\\/]r0c2\.webp$/;

    await expect(registry.importCharacter(source, 'Copy Fails')).rejects.toThrow(/Mock copy failure/);

    expect(await pathExists(join(env.globalStorageRoot, 'characters', 'copy-fails'))).toBe(false);
    expect(env.globalState.get<CharacterRecord[]>(CHARACTERS_KEY)).toBeUndefined();
  });

  it('deletes the current imported character and resets to the bundled sample', async () => {
    const env = await createEnvironment();
    const source = await createCharacterFixture(env.root, 'delete-me', 'png');
    const registry = new CharacterRegistry(env.context);
    const record = await registry.importCharacter(source, 'Delete Me');

    await registry.deleteCharacter(record.id);

    expect(await pathExists(join(env.globalStorageRoot, 'characters', 'delete-me'))).toBe(false);
    expect(registry.current().id).toBe(BUILT_IN_CHARACTER.id);
    expect(registry.all()).toEqual([BUILT_IN_CHARACTER]);
  });

  it('recovers invalid stored layout to the default layout before rendering', async () => {
    const env = await createEnvironment();
    env.globalState.seed(LAYOUT_KEY, { x: 160, y: 50, scale: 0.62 });
    const registry = new CharacterRegistry(env.context);

    await registry.recoverPersistedState();

    expect(registry.layout()).toEqual(DEFAULT_LAYOUT);
    expect(env.globalState.get<CompanionLayout>(LAYOUT_KEY)).toEqual(DEFAULT_LAYOUT);
  });

  it('rejects invalid layout updates instead of persisting off-canvas values', async () => {
    const env = await createEnvironment();
    const registry = new CharacterRegistry(env.context);

    await expect(registry.setLayout({ x: Number.NaN, y: 50, scale: 0.62 })).rejects.toThrow(/Invalid companion layout/);

    expect(env.globalState.get<CompanionLayout>(LAYOUT_KEY)).toBeUndefined();
  });

  it('fails clearly for malformed imported character state', async () => {
    const env = await createEnvironment();
    env.globalState.seed(CHARACTERS_KEY, { id: 'not-an-array' });
    const registry = new CharacterRegistry(env.context);

    expect(() => registry.all()).toThrow(/Stored imported characters state is invalid/);
  });

  it('fails with a persisted-state error when the stored current character is missing', async () => {
    const env = await createEnvironment();
    env.globalState.seed(CURRENT_CHARACTER_KEY, 'missing-character');
    const registry = new CharacterRegistry(env.context);

    expect(() => registry.current()).toThrow(StoredStateError);
    expect(() => registry.current()).toThrow(/Stored current character is missing from registry: missing-character/);
  });

  async function createEnvironment(): Promise<TestEnvironment> {
    const root = await mkdtemp(join(tmpdir(), 'ggc-registry-'));
    roots.push(root);
    const globalStorageRoot = join(root, 'global-storage');
    const globalState = createGlobalState();
    return {
      root,
      globalStorageRoot,
      globalState,
      context: {
        extensionUri: vscode.Uri.file(join(root, 'extension')),
        globalStorageUri: vscode.Uri.file(globalStorageRoot),
        globalState,
      } as vscode.ExtensionContext,
    };
  }

  async function createCharacterFixture(
    root: string,
    name: string,
    ext: 'webp' | 'png',
    options: {
      skip?: string;
      replace?: { from: string; to: string };
    } = {},
  ): Promise<vscode.Uri> {
    const sourceRoot = join(root, name);
    for (const sheet of SHEETS) {
      await mkdir(join(sourceRoot, sheet), { recursive: true });
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          const relative = `${sheet}/r${row}c${col}.${ext}`;
          if (relative === options.skip || relative === options.replace?.from) continue;
          await writeFile(join(sourceRoot, sheet, `r${row}c${col}.${ext}`), Buffer.from(relative, 'utf8'));
        }
      }
    }
    if (options.replace) {
      const target = join(sourceRoot, ...options.replace.to.split('/'));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(options.replace.to, 'utf8'));
    }
    return vscode.Uri.file(sourceRoot);
  }

  function createGlobalState(): MockGlobalState {
    const values = new Map<string, unknown>();
    const failingKeys = new Set<string>();
    return {
      get<T>(key: string): T | undefined {
        return values.get(key) as T | undefined;
      },
      async update(key: string, value: unknown): Promise<void> {
        if (failingKeys.has(key)) {
          failingKeys.delete(key);
          throw new Error(`Mock globalState update failure for ${key}`);
        }
        if (value === undefined) {
          values.delete(key);
        } else {
          values.set(key, value);
        }
      },
      failNextUpdate(key: string): void {
        failingKeys.add(key);
      },
      seed(key: string, value: unknown): void {
        values.set(key, value);
      },
    };
  }

  async function manifest(globalStorageRoot: string, record: CharacterRecord): Promise<CharacterRecord> {
    if (!record.storageRelativePath) throw new Error('Expected imported character storage path.');
    return JSON.parse(await readFile(join(globalStorageRoot, record.storageRelativePath, 'manifest.json'), 'utf8')) as CharacterRecord;
  }

  async function pathExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  function isInside(parent: string, child: string): boolean {
    const normalizedParent = resolve(parent);
    const normalizedChild = resolve(child);
    const relativePath = relative(normalizedParent, normalizedChild);
    return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
  }
});
