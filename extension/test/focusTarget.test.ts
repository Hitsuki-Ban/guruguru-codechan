import { describe, expect, it } from 'vitest';
import {
  editorCursorFocusVector,
  editorCursorLocalPosition,
  normalizeFocusVector,
  pointerFocusVector,
} from '../src/focusTarget';

function cellFor(vector: { x: number; y: number }): { row: number; col: number } {
  return {
    row: Math.min(4, Math.max(0, Math.round(((vector.y + 1) / 2) * 4))),
    col: Math.min(4, Math.max(0, Math.round(((vector.x + 1) / 2) * 4))),
  };
}

describe('normalizeFocusVector', () => {
  it('keeps diagonal exit directions distinct', () => {
    expect(cellFor(normalizeFocusVector(-0.7, 0.7))).toEqual({ row: 3, col: 1 });
    expect(cellFor(normalizeFocusVector(0.7, 0.7))).toEqual({ row: 3, col: 3 });
    expect(cellFor(normalizeFocusVector(-0.7, -0.7))).toEqual({ row: 1, col: 1 });
    expect(cellFor(normalizeFocusVector(0.7, -0.7))).toEqual({ row: 1, col: 3 });
  });

  it('normalizes long vectors without losing their direction', () => {
    expect(cellFor(normalizeFocusVector(-4, 3))).toEqual({ row: 3, col: 0 });
    expect(cellFor(normalizeFocusVector(4, -3))).toEqual({ row: 1, col: 4 });
  });

  it('returns a centered gaze for a zero vector', () => {
    expect(normalizeFocusVector(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('pointerFocusVector', () => {
  it('returns the same vector for the same relative pointer position at different companion scales', () => {
    const small = pointerFocusVector(
      { left: 100, top: 80, width: 120, height: 120 },
      { x: 100 + 120 * 0.78, y: 80 + 120 * 0.44 },
    );
    const large = pointerFocusVector(
      { left: 300, top: 160, width: 280, height: 280 },
      { x: 300 + 280 * 0.78, y: 160 + 280 * 0.44 },
    );

    expect(cellFor(small)).toEqual(cellFor(large));
    expect(cellFor(small).col).toBeGreaterThanOrEqual(3);
  });

  it('uses the companion rect position when tracking pointer direction', () => {
    const leftCompanion = pointerFocusVector(
      { left: 60, top: 100, width: 180, height: 180 },
      { x: 60 + 180 * 0.22, y: 100 + 180 * 0.44 },
    );
    const rightCompanion = pointerFocusVector(
      { left: 420, top: 100, width: 180, height: 180 },
      { x: 420 + 180 * 0.22, y: 100 + 180 * 0.44 },
    );

    expect(cellFor(leftCompanion)).toEqual(cellFor(rightCompanion));
    expect(cellFor(leftCompanion).col).toBeLessThanOrEqual(1);
  });

  it('tracks panel exits relative to the companion center, not the panel edge alone', () => {
    const rect = { left: 1200, top: 180, width: 260, height: 260 };
    const southWestExit = pointerFocusVector(rect, { x: 1120, y: 560 });

    expect(cellFor(southWestExit).row).toBeGreaterThanOrEqual(3);
    expect(cellFor(southWestExit).col).toBeLessThanOrEqual(1);
  });
});

describe('editorCursorFocusVector', () => {
  it('locks cardinal left and right editor tracking to the outer columns', () => {
    const farTop = cellFor(editorCursorFocusVector({ x: -0.9, y: 0 }, 0.05, 0.1));
    const nearBottom = cellFor(editorCursorFocusVector({ x: -0.9, y: 0 }, 0.95, 0.9));
    const rightTop = cellFor(editorCursorFocusVector({ x: 0.9, y: 0 }, 0.05, 0.1));
    const rightBottom = cellFor(editorCursorFocusVector({ x: 0.9, y: 0 }, 0.95, 0.9));

    expect(farTop.col).toBe(0);
    expect(nearBottom.col).toBe(0);
    expect(farTop.row).toBeLessThan(nearBottom.row);
    expect(rightTop.col).toBe(4);
    expect(rightBottom.col).toBe(4);
    expect(rightTop.row).toBeLessThan(rightBottom.row);
  });

  it('locks cardinal above and below editor tracking to the outer rows', () => {
    const farLeft = cellFor(editorCursorFocusVector({ x: 0, y: -0.9 }, 0.1, 0.05));
    const nearRight = cellFor(editorCursorFocusVector({ x: 0, y: -0.9 }, 0.9, 0.95));
    const belowLeft = cellFor(editorCursorFocusVector({ x: 0, y: 0.9 }, 0.1, 0.05));
    const belowRight = cellFor(editorCursorFocusVector({ x: 0, y: 0.9 }, 0.9, 0.95));

    expect(farLeft.row).toBe(0);
    expect(nearRight.row).toBe(0);
    expect(farLeft.col).toBeLessThan(nearRight.col);
    expect(belowLeft.row).toBe(4);
    expect(belowRight.row).toBe(4);
    expect(belowLeft.col).toBeLessThan(belowRight.col);
  });

  it('treats near-cardinal exits as cardinal for stable editor tracking', () => {
    const left = cellFor(editorCursorFocusVector({ x: -0.9, y: 0.18 }, 0.95, 0.5));
    const above = cellFor(editorCursorFocusVector({ x: 0.18, y: -0.9 }, 0.5, 0.95));

    expect(left.col).toBe(0);
    expect(above.row).toBe(0);
  });

  it('keeps diagonal exit vectors as the editor cursor baseline', () => {
    const northEast = editorCursorFocusVector({ x: 0.7, y: -0.7 }, 0.5, 0.5);
    const northWest = editorCursorFocusVector({ x: -0.7, y: -0.7 }, 0.5, 0.5);

    expect(northEast.x).toBeGreaterThan(0.25);
    expect(northEast.y).toBeLessThan(-0.25);
    expect(northWest.x).toBeLessThan(-0.25);
    expect(northWest.y).toBeLessThan(-0.25);
  });

  it('preserves cursor depth independently on both axes for diagonal editor targets', () => {
    const nearNorthEast = editorCursorFocusVector({ x: 0.7, y: -0.7 }, 0.1, 0.9);
    const farNorthEast = editorCursorFocusVector({ x: 0.7, y: -0.7 }, 0.9, 0.1);

    expect(nearNorthEast.x).toBeGreaterThan(0);
    expect(nearNorthEast.y).toBeLessThan(0);
    expect(farNorthEast.x).toBeGreaterThan(nearNorthEast.x);
    expect(farNorthEast.y).toBeLessThan(nearNorthEast.y);
  });

  it('keeps the latest exit vector when no editor cursor side is known yet', () => {
    expect(editorCursorFocusVector({ x: 0, y: 0 }, 0.9, 0.9)).toEqual({ x: 0, y: 0 });
  });
});

describe('editorCursorLocalPosition', () => {
  it('maps wrapped continuation columns back into the visible wrap row', () => {
    const position = editorCursorLocalPosition({
      positionLine: 12,
      positionCharacter: 105,
      visibleLines: [{ line: 12, text: 'x'.repeat(200) }],
      tabSize: 4,
      wrapColumn: 80,
    });

    expect(position).toBeDefined();
    expect(position!.x).toBeGreaterThan(0.25);
    expect(position!.x).toBeLessThan(0.35);
    expect(position!.y).toBeGreaterThan(0.45);
    expect(position!.y).toBeLessThan(0.55);
  });

  it('uses the current wrapped visual row length for horizontal cursor position', () => {
    const position = editorCursorLocalPosition({
      positionLine: 4,
      positionCharacter: 170,
      visibleLines: [{ line: 4, text: 'x'.repeat(200) }],
      tabSize: 4,
      wrapColumn: 80,
    });

    expect(position).toBeDefined();
    expect(position!.x).toBeGreaterThan(0.2);
    expect(position!.x).toBeLessThan(0.3);
  });

  it('places later wrapped visual rows lower than earlier rows', () => {
    const visibleLines = [{ line: 4, text: 'x'.repeat(200) }];
    const firstRow = editorCursorLocalPosition({
      positionLine: 4,
      positionCharacter: 30,
      visibleLines,
      tabSize: 4,
      wrapColumn: 80,
    });
    const thirdRow = editorCursorLocalPosition({
      positionLine: 4,
      positionCharacter: 170,
      visibleLines,
      tabSize: 4,
      wrapColumn: 80,
    });

    expect(firstRow).toBeDefined();
    expect(thirdRow).toBeDefined();
    expect(thirdRow!.y).toBeGreaterThan(firstRow!.y);
    expect(thirdRow!.x).toBeGreaterThan(0.2);
  });
});
