import { describe, expect, it } from 'vitest';
import { AssetValidationError, SHEETS, validateAssetFileNames } from '../src/assetValidation';

function fullSet(ext: 'webp' | 'png'): string[] {
  const files: string[] = [];
  for (const sheet of SHEETS) {
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        files.push(`${sheet}/r${row}c${col}.${ext}`);
      }
    }
  }
  return files;
}

describe('validateAssetFileNames', () => {
  it('accepts a complete webp character set', () => {
    const result = validateAssetFileNames(fullSet('webp'));
    expect(result.ext).toBe('webp');
    expect(result.framePaths).toHaveLength(150);
  });

  it('rejects missing frames', () => {
    const files = fullSet('webp').filter((name) => name !== 'F/r4c4.webp');
    expect(() => validateAssetFileNames(files)).toThrow(AssetValidationError);
  });

  it('rejects mixed frame formats', () => {
    const files = fullSet('webp').filter((name) => name !== 'A/r0c0.webp');
    files.push('A/r0c0.png');
    expect(() => validateAssetFileNames(files)).toThrow(AssetValidationError);
  });

  it('rejects duplicate asset file names', () => {
    const files = fullSet('webp');
    files.push('A/r0c0.webp');
    expect(() => validateAssetFileNames(files)).toThrow(AssetValidationError);
  });

  it('rejects unexpected png or webp files inside sheet folders', () => {
    const files = fullSet('png');
    files.push('A/extra.png');
    expect(() => validateAssetFileNames(files)).toThrow(AssetValidationError);
  });
});
