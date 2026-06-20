import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import type { CharacterRecord, CompanionLayout, FrameExt } from './shared';
import { SHEETS, validateAssetFileNames } from './assetValidation';
import { normalizeImportedFrame } from './frameProcessor';
import { DEFAULT_LAYOUT, LayoutValidationError, validateCompanionLayout } from './layout';

const CHARACTERS_KEY = 'guruguru-codechan.characters';
const CURRENT_CHARACTER_KEY = 'guruguru-codechan.currentCharacterId';
const LAYOUT_KEY = 'guruguru-codechan.layout';

export const BUILT_IN_CHARACTER: CharacterRecord = {
  id: 'sample-codechan',
  name: 'Codeちゃん',
  kind: 'builtIn',
  ext: 'webp',
};

export class StoredStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoredStateError';
  }
}

export class CharacterRegistry {
  constructor(private readonly context: vscode.ExtensionContext) {}

  all(): CharacterRecord[] {
    const userCharacters = this.userCharacters();
    return [BUILT_IN_CHARACTER, ...userCharacters];
  }

  currentId(): string {
    const current = this.context.globalState.get<string>(CURRENT_CHARACTER_KEY);
    if (current === undefined) return BUILT_IN_CHARACTER.id;
    if (!this.all().some((character) => character.id === current)) {
      throw new StoredStateError(`Stored current character is missing from registry: ${current}`);
    }
    return current;
  }

  current(): CharacterRecord {
    const id = this.currentId();
    const record = this.all().find((character) => character.id === id);
    if (!record) throw new Error(`Current character is not registered: ${id}`);
    return record;
  }

  layout(): CompanionLayout {
    const stored = this.context.globalState.get<unknown>(LAYOUT_KEY);
    if (stored === undefined) return { ...DEFAULT_LAYOUT };
    return validateCompanionLayout(stored);
  }

  async recoverPersistedState(): Promise<void> {
    const storedLayout = this.context.globalState.get<unknown>(LAYOUT_KEY);
    if (storedLayout === undefined) return;
    try {
      validateCompanionLayout(storedLayout);
    } catch (error) {
      if (!(error instanceof LayoutValidationError)) throw error;
      await this.context.globalState.update(LAYOUT_KEY, { ...DEFAULT_LAYOUT });
    }
  }

  async setLayout(layout: CompanionLayout): Promise<void> {
    await this.context.globalState.update(LAYOUT_KEY, validateCompanionLayout(layout));
  }

  async setCurrent(id: string): Promise<CharacterRecord> {
    const record = this.all().find((character) => character.id === id);
    if (!record) throw new Error(`Character is not registered: ${id}`);
    await this.context.globalState.update(CURRENT_CHARACTER_KEY, id);
    return record;
  }

  async importCharacter(source: vscode.Uri, name: string): Promise<CharacterRecord> {
    const cleanName = name.trim();
    if (cleanName.length === 0) throw new Error('Character name is required.');
    if (this.all().some((character) => character.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
      throw new Error(`Character name already exists: ${cleanName}`);
    }

    const id = makeCharacterId(cleanName);
    if (this.all().some((character) => character.id === id)) {
      throw new Error(`Character id already exists: ${id}`);
    }

    const relativeFiles = await collectCandidateFiles(source);
    const validated = validateAssetFileNames(relativeFiles);
    const storageRelativePath = `characters/${id}`;
    const targetRoot = vscode.Uri.joinPath(this.context.globalStorageUri, storageRelativePath);
    const previousUserCharacters = this.userCharacters();
    const previousCurrentCharacter = this.context.globalState.get<string>(CURRENT_CHARACTER_KEY);
    let characterListUpdated = false;

    await vscode.workspace.fs.createDirectory(targetRoot);

    const record: CharacterRecord = {
      id,
      name: cleanName,
      kind: 'user',
      ext: validated.ext,
      storageRelativePath,
    };

    try {
      await writeNormalizedFrames(source, targetRoot, validated.framePaths, validated.ext);
      await writeManifest(targetRoot, record);
      const next = [...previousUserCharacters, record];
      await this.context.globalState.update(CHARACTERS_KEY, next);
      characterListUpdated = true;
      await this.context.globalState.update(CURRENT_CHARACTER_KEY, id);
    } catch (error) {
      await vscode.workspace.fs.delete(targetRoot, { recursive: true, useTrash: false });
      if (characterListUpdated) {
        await this.context.globalState.update(
          CHARACTERS_KEY,
          previousUserCharacters.length === 0 ? undefined : previousUserCharacters,
        );
        await this.context.globalState.update(CURRENT_CHARACTER_KEY, previousCurrentCharacter);
      }
      throw error;
    }
    return record;
  }

  async deleteCharacter(id: string): Promise<void> {
    const record = this.all().find((character) => character.id === id);
    if (!record) throw new Error(`Character is not registered: ${id}`);
    if (record.kind === 'builtIn') throw new Error('The bundled sample character cannot be deleted.');
    if (!record.storageRelativePath) throw new Error(`Imported character has no storage path: ${id}`);

    const userCharacters = this.userCharacters();
    if (userCharacters.length === 0) throw new Error('No imported characters are registered.');
    const next = userCharacters.filter((character) => character.id !== id);
    await vscode.workspace.fs.delete(vscode.Uri.joinPath(this.context.globalStorageUri, record.storageRelativePath), {
      recursive: true,
      useTrash: false,
    });
    await this.context.globalState.update(CHARACTERS_KEY, next);
    if (this.context.globalState.get<string>(CURRENT_CHARACTER_KEY) === id) {
      await this.context.globalState.update(CURRENT_CHARACTER_KEY, BUILT_IN_CHARACTER.id);
    }
  }

  characterRoot(record: CharacterRecord): vscode.Uri {
    if (record.kind === 'builtIn') {
      return vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sample-codechan');
    }
    if (!record.storageRelativePath) throw new Error(`Imported character has no storage path: ${record.id}`);
    return vscode.Uri.joinPath(this.context.globalStorageUri, record.storageRelativePath);
  }

  private userCharacters(): CharacterRecord[] {
    const stored = this.context.globalState.get<unknown>(CHARACTERS_KEY);
    if (stored === undefined) return [];
    if (!Array.isArray(stored)) throw new StoredStateError('Stored imported characters state is invalid: expected an array.');
    return stored.map((record, index) => validateStoredUserCharacter(record, index));
  }
}

function validateStoredUserCharacter(value: unknown, index: number): CharacterRecord {
  if (!isRecord(value)) {
    throw new StoredStateError(`Stored imported characters state is invalid: entry ${index} must be an object.`);
  }
  const id = nonEmptyString(value.id, `entry ${index} id`);
  const name = nonEmptyString(value.name, `entry ${index} name`);
  if (value.kind !== 'user') {
    throw new StoredStateError(`Stored imported characters state is invalid: entry ${index} kind must be user.`);
  }
  const ext = value.ext;
  if (ext !== 'webp' && ext !== 'png') {
    throw new StoredStateError(`Stored imported characters state is invalid: entry ${index} ext must be webp or png.`);
  }
  const storageRelativePath = nonEmptyString(value.storageRelativePath, `entry ${index} storageRelativePath`);
  return { id, name, kind: 'user', ext, storageRelativePath };
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new StoredStateError(`Stored imported characters state is invalid: ${field} must be a non-empty string.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function collectCandidateFiles(root: vscode.Uri): Promise<string[]> {
  const files: string[] = [];
  for (const sheet of SHEETS) {
    const sheetUri = vscode.Uri.joinPath(root, sheet);
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(sheetUri);
    } catch {
      throw new Error(`Missing sheet directory: ${sheet}`);
    }
    for (const [name, type] of entries) {
      if (type === vscode.FileType.File) files.push(`${sheet}/${name}`);
    }
  }
  return files;
}

async function writeNormalizedFrames(
  sourceRoot: vscode.Uri,
  targetRoot: vscode.Uri,
  framePaths: string[],
  ext: FrameExt,
): Promise<void> {
  const normalizedFrameCache = new Map<string, Uint8Array>();
  for (const relative of framePaths) {
    const [sheet, fileName] = relative.split('/');
    const targetSheet = vscode.Uri.joinPath(targetRoot, sheet);
    await vscode.workspace.fs.createDirectory(targetSheet);
    const source = vscode.Uri.joinPath(sourceRoot, sheet, fileName);
    const target = vscode.Uri.joinPath(targetRoot, sheet, fileName);
    const sourceBytes = await vscode.workspace.fs.readFile(source);
    const cacheKey = `${ext}:${createHash('sha256').update(sourceBytes).digest('base64url')}`;
    let normalized = normalizedFrameCache.get(cacheKey);
    if (!normalized) {
      normalized = await normalizeImportedFrame(sourceBytes, ext);
      normalizedFrameCache.set(cacheKey, normalized);
    }
    await vscode.workspace.fs.writeFile(target, normalized);
  }
}

async function writeManifest(targetRoot: vscode.Uri, record: CharacterRecord): Promise<void> {
  const data = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
  await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(targetRoot, 'manifest.json'), data);
}

function makeCharacterId(name: string): string {
  const id = name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (id.length === 0) throw new Error('Character name must contain at least one ASCII letter or digit.');
  return id;
}
