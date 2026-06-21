import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { SHEETS } from '../src/assetValidation';
import { BUILT_IN_CHARACTER, CharacterRegistry, StoredStateError } from '../src/characterRegistry';
import { DEFAULT_LAYOUT } from '../src/layout';
import type { CharacterRecord, CompanionLayout } from '../src/shared';

const vscodeMockState = vi.hoisted(() => ({
  readFailurePattern: undefined as RegExp | undefined,
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
        async readFile(uri: Uri): Promise<Uint8Array> {
          if (vscodeMockState.readFailurePattern?.test(uri.fsPath)) {
            throw new Error(`Mock frame read failure for ${uri.fsPath}`);
          }
          return nodeFs.readFile(uri.fsPath);
        },
        async copy(source: Uri, target: Uri): Promise<void> {
          if (vscodeMockState.readFailurePattern?.test(source.fsPath)) {
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
const SOLID_WEBP = Buffer.from(
  'UklGRkQAAABXRUJQVlA4IDgAAAAwAwCdASogACAAPpFEnEolo6KhqAgAsBIJZQDIEoAAQFBQAP7Xlf/VeIMzx7/3RsXW0XOLFpAAAA==',
  'base64',
);

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
    vscodeMockState.readFailurePattern = undefined;
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

  it('normalizes imported frames to 512 pixels on the longest edge before storing them', async () => {
    const env = await createEnvironment();
    const source = await createCharacterFixture(env.root, 'large-png', 'png', {
      imageSize: { width: 768, height: 640 },
    });
    const registry = new CharacterRegistry(env.context);

    const record = await registry.importCharacter(source, 'Large PNG');
    const storedFrame = await readFile(join(env.globalStorageRoot, record.storageRelativePath!, 'A', 'r0c0.png'));

    expect(readPngSize(storedFrame)).toEqual({ width: 512, height: 427 });
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

  it('rejects reserved launch setting names without creating storage', async () => {
    const env = await createEnvironment();
    const source = await createCharacterFixture(env.root, 'reserved-name', 'webp');
    const registry = new CharacterRegistry(env.context);

    await expect(registry.importCharacter(source, 'Default')).rejects.toThrow(/reserved/);
    await expect(registry.importCharacter(source, ' random ')).rejects.toThrow(/reserved/);

    expect(await pathExists(join(env.globalStorageRoot, 'characters'))).toBe(false);
    expect(env.globalState.get<CharacterRecord[]>(CHARACTERS_KEY)).toBeUndefined();
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

  it('cleans up partially written files when frame processing fails', async () => {
    const env = await createEnvironment();
    const source = await createCharacterFixture(env.root, 'copy-fails', 'webp');
    const registry = new CharacterRegistry(env.context);
    vscodeMockState.readFailurePattern = /A[\\/]r0c2\.webp$/;

    await expect(registry.importCharacter(source, 'Copy Fails')).rejects.toThrow(/Mock frame read failure/);

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
      imageSize?: { width: number; height: number };
    } = {},
  ): Promise<vscode.Uri> {
    const sourceRoot = join(root, name);
    const frameBytes = await frameFixture(ext, options.imageSize);
    for (const sheet of SHEETS) {
      await mkdir(join(sourceRoot, sheet), { recursive: true });
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          const relative = `${sheet}/r${row}c${col}.${ext}`;
          if (relative === options.skip || relative === options.replace?.from) continue;
          await writeFile(join(sourceRoot, sheet, `r${row}c${col}.${ext}`), frameBytes);
        }
      }
    }
    if (options.replace) {
      const target = join(sourceRoot, ...options.replace.to.split('/'));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await frameFixture('png', options.imageSize));
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

  async function frameFixture(ext: 'webp' | 'png', imageSize: { width: number; height: number } | undefined): Promise<Buffer> {
    const width = imageSize?.width ?? 32;
    const height = imageSize?.height ?? 32;
    if (ext === 'png') return createSolidPng(width, height);
    if (width !== 32 || height !== 32) throw new Error('The WebP test fixture is fixed at 32x32.');
    return SOLID_WEBP;
  }

  function createSolidPng(width: number, height: number): Buffer {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x += 1) {
      row[1 + x * 4] = 64;
      row[2 + x * 4] = 128;
      row[3 + x * 4] = 192;
      row[4 + x * 4] = 255;
    }
    const raw = Buffer.concat(Array.from({ length: height }, () => row));
    return Buffer.concat([
      signature,
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', deflateSync(raw)),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
  }

  function pngChunk(type: string, data: Buffer): Buffer {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  function crc32(data: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function readPngSize(data: Buffer): { width: number; height: number } {
    return {
      width: data.readUInt32BE(16),
      height: data.readUInt32BE(20),
    };
  }
});
