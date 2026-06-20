import type { FrameExt, SheetName } from './shared';

export const SHEETS: SheetName[] = ['A', 'B', 'C', 'D', 'E', 'F'];
export const ROWS = 5;
export const COLS = 5;
export const FRAME_EXTS: FrameExt[] = ['webp', 'png'];

export class AssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetValidationError';
  }
}

export interface ValidatedAsset {
  ext: FrameExt;
  framePaths: string[];
}

export function frameBasePath(sheet: SheetName, row: number, col: number): string {
  return `${sheet}/r${row}c${col}`;
}

export function framePath(sheet: SheetName, row: number, col: number, ext: FrameExt): string {
  return `${frameBasePath(sheet, row, col)}.${ext}`;
}

export function validateAssetFileNames(relativeFileNames: string[]): ValidatedAsset {
  const normalizedNames = relativeFileNames.map((name) => name.replaceAll('\\', '/'));
  const normalized = new Set<string>();
  for (const name of normalizedNames) {
    if (normalized.has(name)) {
      throw new AssetValidationError(`Duplicate asset file name: ${name}`);
    }
    normalized.add(name);
  }
  const discoveredExts = new Set<FrameExt>();
  const framePaths: string[] = [];

  for (const sheet of SHEETS) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const matches = FRAME_EXTS.filter((ext) => normalized.has(framePath(sheet, row, col, ext)));
        if (matches.length === 0) {
          throw new AssetValidationError(`Missing frame: ${framePath(sheet, row, col, 'webp')} or .png`);
        }
        if (matches.length > 1) {
          throw new AssetValidationError(`Mixed duplicate frame formats: ${frameBasePath(sheet, row, col)}`);
        }
        const ext = matches[0];
        discoveredExts.add(ext);
        framePaths.push(framePath(sheet, row, col, ext));
      }
    }
  }

  if (discoveredExts.size !== 1) {
    throw new AssetValidationError('Character frames must use only one image format: webp or png.');
  }

  const ext = [...discoveredExts][0];
  const expected = new Set(framePaths);
  for (const name of normalized) {
    const sheet = name.split('/')[0];
    if (!SHEETS.includes(sheet as SheetName)) continue;
    if (name.endsWith('.webp') || name.endsWith('.png')) {
      if (!expected.has(name)) {
        throw new AssetValidationError(`Unexpected image frame file: ${name}`);
      }
    }
  }

  return { ext, framePaths };
}
