import { describe, expect, it } from 'vitest';
import {
  CharacterSelectionError,
  DEFAULT_CHARACTER_TOKEN,
  RANDOM_CHARACTER_TOKEN,
  isReservedCharacterName,
  parseCharacterLaunchSettings,
  resolveConfiguredCharacterId,
} from '../src/characterSelection';
import type { CharacterRecord } from '../src/shared';

const characters: CharacterRecord[] = [
  { id: 'sample-codechan', name: 'Codeちゃん', kind: 'builtIn', ext: 'webp' },
  { id: 'mint-pilot', name: 'Mint Pilot', kind: 'user', ext: 'webp', storageRelativePath: 'characters/mint-pilot' },
  { id: 'tea-apprentice', name: 'Tea Apprentice', kind: 'user', ext: 'webp', storageRelativePath: 'characters/tea-apprentice' },
];

describe('character launch settings', () => {
  it('parses the explicit Default and Random launch settings', () => {
    expect(parseCharacterLaunchSettings('Default', ['Codeちゃん'])).toEqual({
      defaultCharacter: DEFAULT_CHARACTER_TOKEN,
      randomCharacterBlacklist: ['Codeちゃん'],
    });
    expect(parseCharacterLaunchSettings(' Random ', [' Codeちゃん ', 'Mint Pilot'])).toEqual({
      defaultCharacter: RANDOM_CHARACTER_TOKEN,
      randomCharacterBlacklist: ['Codeちゃん', 'Mint Pilot'],
    });
  });

  it('rejects malformed launch settings instead of guessing a character', () => {
    expect(() => parseCharacterLaunchSettings(undefined, ['Codeちゃん'])).toThrow(CharacterSelectionError);
    expect(() => parseCharacterLaunchSettings('', ['Codeちゃん'])).toThrow(CharacterSelectionError);
    expect(() => parseCharacterLaunchSettings('Default', undefined)).toThrow(CharacterSelectionError);
    expect(() => parseCharacterLaunchSettings('Default', ['Codeちゃん', 42])).toThrow(CharacterSelectionError);
  });

  it('reserves system launch tokens as character names', () => {
    expect(isReservedCharacterName('Default')).toBe(true);
    expect(isReservedCharacterName(' default ')).toBe(true);
    expect(isReservedCharacterName('Random')).toBe(true);
    expect(isReservedCharacterName('random')).toBe(true);
    expect(isReservedCharacterName('Mint Pilot')).toBe(false);
  });

  it('keeps the current character when the launch setting is Default', () => {
    const selected = resolveConfiguredCharacterId(
      characters,
      'mint-pilot',
      { defaultCharacter: DEFAULT_CHARACTER_TOKEN, randomCharacterBlacklist: ['Codeちゃん'] },
      () => 0,
    );

    expect(selected).toBe('mint-pilot');
  });

  it('selects a configured character by name', () => {
    const selected = resolveConfiguredCharacterId(
      characters,
      'sample-codechan',
      { defaultCharacter: 'Tea Apprentice', randomCharacterBlacklist: ['Codeちゃん'] },
      () => 0,
    );

    expect(selected).toBe('tea-apprentice');
  });

  it('selects a random character while honoring the blacklist when another character exists', () => {
    const selected = resolveConfiguredCharacterId(
      characters,
      'sample-codechan',
      { defaultCharacter: RANDOM_CHARACTER_TOKEN, randomCharacterBlacklist: ['Codeちゃん'] },
      () => 0,
    );

    expect(selected).toBe('mint-pilot');
  });

  it('still selects the bundled character when every registered character is blacklisted', () => {
    const selected = resolveConfiguredCharacterId(
      [characters[0]],
      'sample-codechan',
      { defaultCharacter: RANDOM_CHARACTER_TOKEN, randomCharacterBlacklist: ['Codeちゃん'] },
      () => 0,
    );

    expect(selected).toBe('sample-codechan');
  });

  it('rejects unknown configured character names', () => {
    expect(() => resolveConfiguredCharacterId(
      characters,
      'sample-codechan',
      { defaultCharacter: 'Missing Character', randomCharacterBlacklist: ['Codeちゃん'] },
      () => 0,
    )).toThrow(/Default character is not registered/);
  });
});
