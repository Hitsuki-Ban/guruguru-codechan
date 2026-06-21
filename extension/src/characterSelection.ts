import type { CharacterRecord } from './shared';

export const DEFAULT_CHARACTER_TOKEN = 'Default';
export const RANDOM_CHARACTER_TOKEN = 'Random';
export const RESERVED_CHARACTER_NAMES = [DEFAULT_CHARACTER_TOKEN, RANDOM_CHARACTER_TOKEN] as const;

export interface CharacterLaunchSettings {
  defaultCharacter: string;
  randomCharacterBlacklist: string[];
}

export class CharacterSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharacterSelectionError';
  }
}

export function parseCharacterLaunchSettings(
  defaultCharacter: unknown,
  randomCharacterBlacklist: unknown,
): CharacterLaunchSettings {
  if (typeof defaultCharacter !== 'string' || defaultCharacter.trim().length === 0) {
    throw new CharacterSelectionError('Default character setting must be a non-empty string.');
  }
  if (!Array.isArray(randomCharacterBlacklist)) {
    throw new CharacterSelectionError('Random character blacklist setting must be an array of strings.');
  }
  return {
    defaultCharacter: defaultCharacter.trim(),
    randomCharacterBlacklist: randomCharacterBlacklist.map((value, index) => {
      if (typeof value !== 'string') {
        throw new CharacterSelectionError(`Random character blacklist entry ${index} must be a string.`);
      }
      return value.trim();
    }).filter((value) => value.length > 0),
  };
}

export function isReservedCharacterName(name: string): boolean {
  const normalized = normalizeName(name);
  return RESERVED_CHARACTER_NAMES.some((reserved) => normalizeName(reserved) === normalized);
}

export function resolveConfiguredCharacterId(
  characters: readonly CharacterRecord[],
  currentId: string,
  settings: CharacterLaunchSettings,
  random: () => number = Math.random,
): string {
  if (characters.length === 0) throw new CharacterSelectionError('No characters are registered.');

  if (normalizeName(settings.defaultCharacter) === normalizeName(DEFAULT_CHARACTER_TOKEN)) return currentId;

  if (normalizeName(settings.defaultCharacter) === normalizeName(RANDOM_CHARACTER_TOKEN)) {
    return chooseRandomCharacter(characters, settings.randomCharacterBlacklist, random).id;
  }

  const configured = characters.find((character) => normalizeName(character.name) === normalizeName(settings.defaultCharacter));
  if (!configured) {
    throw new CharacterSelectionError(`Default character is not registered: ${settings.defaultCharacter}`);
  }
  return configured.id;
}

function chooseRandomCharacter(
  characters: readonly CharacterRecord[],
  blacklist: readonly string[],
  random: () => number,
): CharacterRecord {
  const blocked = new Set(blacklist.map(normalizeName));
  const eligible = characters.filter((character) => !blocked.has(normalizeName(character.name)));
  const candidates = eligible.length > 0 ? eligible : characters;
  const raw = random();
  if (!Number.isFinite(raw) || raw < 0 || raw >= 1) {
    throw new CharacterSelectionError('Random character selector must return a number from 0 inclusive to 1 exclusive.');
  }
  return candidates[Math.min(candidates.length - 1, Math.floor(raw * candidates.length))];
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}
