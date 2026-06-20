export interface FocusVector {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PointLike {
  x: number;
  y: number;
}

export interface EditorVisibleLine {
  line: number;
  text: string;
}

export interface EditorCursorLocalPositionInput {
  positionLine: number;
  positionCharacter: number;
  visibleLines: readonly EditorVisibleLine[];
  tabSize: number;
  wrapColumn?: number;
}

const EDGE_NEAR = 0.18;
const EDGE_FAR = 0.95;
const CROSS_AXIS_LIMIT = 0.9;
const VERTICAL_CROSS_AXIS_LIMIT = 0.45;
const DIAGONAL_COMPONENT_MIN = 0.25;
const STRONG_VERTICAL_EXIT_BLEND = 0.35;
const POINTER_GAZE_Y_RATIO = 0.44;
const POINTER_RANGE_RATIO = 0.56;

export function normalizeFocusVector(x: number, y: number): FocusVector {
  const length = Math.hypot(x, y);
  if (length < 0.001) return { x: 0, y: 0 };
  const scale = Math.max(EDGE_NEAR, Math.min(EDGE_FAR, length)) / length;
  return {
    x: clamp(x * scale, -1, 1),
    y: clamp(y * scale, -1, 1),
  };
}

export function workbenchFocusVector(): FocusVector {
  return { x: 0, y: 0 };
}

export function editorCursorFocusVector(exitVector: FocusVector, localX: number, localY: number): FocusVector {
  const exit = normalizeFocusVector(exitVector.x, exitVector.y);
  if (Math.abs(exit.x) < 0.001 && Math.abs(exit.y) < 0.001) return exit;

  const x = clamp(localX, 0, 1);
  const y = clamp(localY, 0, 1);
  if (Math.abs(exit.x) >= Math.abs(exit.y) && Math.abs(exit.y) < DIAGONAL_COMPONENT_MIN) {
    return {
      x: Math.sign(exit.x),
      y: cursorAxis(y),
    };
  }
  if (Math.abs(exit.y) > Math.abs(exit.x) && Math.abs(exit.x) < DIAGONAL_COMPONENT_MIN) {
    return {
      x: cursorAxis(x),
      y: Math.sign(exit.y),
    };
  }
  if (Math.abs(exit.x) >= DIAGONAL_COMPONENT_MIN && Math.abs(exit.y) >= DIAGONAL_COMPONENT_MIN) {
    return normalizeFocusVector(signedDepth(exit.x, x), signedDepth(exit.y, y));
  }

  if (Math.abs(exit.x) >= Math.abs(exit.y)) {
    const primary = signedDepth(exit.x, x);
    return normalizeFocusVector(primary, crossAxis(y));
  }

  const primary = signedDepth(exit.y, y);
  return normalizeFocusVector(crossAxis(x, VERTICAL_CROSS_AXIS_LIMIT), preserveStrongExitDepth(exit.y, primary));
}

export function pointerFocusVector(rect: RectLike, point: PointLike, rangePx?: number): FocusVector {
  const anchorX = rect.left + rect.width * 0.5;
  const anchorY = rect.top + rect.height * POINTER_GAZE_Y_RATIO;
  const range = Math.max(1, rangePx ?? rect.width * POINTER_RANGE_RATIO);
  return normalizeFocusVector((point.x - anchorX) / range, (point.y - anchorY) / range);
}

export function editorCursorLocalPosition(input: EditorCursorLocalPositionInput): FocusVector | undefined {
  if (input.visibleLines.length === 0) return undefined;
  const tabSize = input.tabSize > 0 ? input.tabSize : 4;
  const wrapColumn = input.wrapColumn && input.wrapColumn > 0 ? Math.floor(input.wrapColumn) : undefined;
  let totalRows = 0;
  let rowsBeforeCursor = 0;
  let cursorRow = 0;
  let cursorColumn = 0;
  let cursorRowLength = 0;
  let foundCursorLine = false;

  for (const line of input.visibleLines) {
    const lineColumn = visualColumn(line.text, undefined, tabSize);
    const rowCount = visualRowCount(lineColumn, wrapColumn);
    if (line.line < input.positionLine) {
      rowsBeforeCursor += rowCount;
    } else if (line.line === input.positionLine) {
      foundCursorLine = true;
      const character = Math.min(input.positionCharacter, line.text.length);
      const visualCursorColumn = visualColumn(line.text, character, tabSize);
      if (wrapColumn) {
        cursorRow = Math.min(rowCount - 1, Math.floor(Math.max(0, visualCursorColumn - 1) / wrapColumn));
        const rowStart = cursorRow * wrapColumn;
        const rowEnd = Math.min(lineColumn, rowStart + wrapColumn);
        cursorColumn = clamp(visualCursorColumn - rowStart, 0, Math.max(0, rowEnd - rowStart));
        cursorRowLength = Math.max(0, rowEnd - rowStart);
      } else {
        cursorRow = 0;
        cursorColumn = visualCursorColumn;
        cursorRowLength = lineColumn;
      }
    }
    totalRows += rowCount;
  }

  if (!foundCursorLine) return undefined;
  return {
    x: cursorLinePosition(cursorColumn, cursorRowLength),
    y: clamp((rowsBeforeCursor + cursorRow + 0.5) / Math.max(1, totalRows), 0, 1),
  };
}

export function visualColumn(text: string, character: number | undefined, tabSize: number): number {
  const limit = character === undefined ? text.length : Math.min(character, text.length);
  let column = 0;
  for (let index = 0; index < limit; index += 1) {
    if (text[index] === '\t') {
      column += tabSize - (column % tabSize);
    } else {
      column += 1;
    }
  }
  return column;
}

function crossAxis(value: number, limit = CROSS_AXIS_LIMIT): number {
  return lerp(-limit, limit, value);
}

function cursorAxis(value: number): number {
  return lerp(-1, 1, value);
}

function cursorLinePosition(column: number, rowLength: number): number {
  if (rowLength <= 0) return 0.5;
  return clamp(column / rowLength, 0, 1);
}

function signedDepth(component: number, value: number): number {
  return component < 0
    ? -lerp(EDGE_FAR, EDGE_NEAR, value)
    : lerp(EDGE_NEAR, EDGE_FAR, value);
}

function preserveStrongExitDepth(component: number, depth: number): number {
  if (Math.sign(component) !== Math.sign(depth) || Math.abs(component) <= Math.abs(depth)) return depth;
  return lerp(component, depth, STRONG_VERTICAL_EXIT_BLEND);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function visualRowCount(columnCount: number, wrapColumn: number | undefined): number {
  if (!wrapColumn) return 1;
  return Math.max(1, Math.ceil(Math.max(1, columnCount) / wrapColumn));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
