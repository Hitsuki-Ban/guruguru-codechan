import React from 'react';
import { createRoot } from 'react-dom/client';
import { pointerFocusVector } from '../focusTarget';
import {
  MAX_LAYOUT_SCALE,
  MAX_TRACKING_RANGE,
  MAX_TRACKING_SPEED,
  MIN_LAYOUT_SCALE,
  MIN_TRACKING_RANGE,
  MIN_TRACKING_SPEED,
} from '../layout';
import type {
  CompanionLayout,
  CompanionStateSnapshot,
  GazeLock,
  HostToWebviewMessage,
  SheetName,
  WebviewToHostMessage,
} from '../shared';
import '../webview/styles.css';

declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage(message: WebviewToHostMessage): void;
      setState(state: unknown): void;
      getState(): unknown;
    };
  }
}

const vscode = window.acquireVsCodeApi();
const SHEETS: SheetName[] = ['A', 'B', 'C', 'D', 'E', 'F'];
const ROWS = 5;
const COLS = 5;
const WHEEL_SCALE_STEP = 0.04;

interface Cell {
  row: number;
  col: number;
}

interface LockPromptState extends GazeLock {}

interface SavedWebviewState {
  currentCharacterId: string;
  layout: CompanionLayout;
  mouthLevel: 0 | 1 | 2;
}

type ActionIconName = 'import' | 'delete' | 'tweaks';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function withoutGazeLock(layout: CompanionLayout): CompanionLayout {
  const { gazeLock: _gazeLock, ...next } = layout;
  return next;
}

function sheetFor(blink: boolean, mouthLevel: 0 | 1 | 2): SheetName {
  return SHEETS[(blink ? 3 : 0) + mouthLevel];
}

function frameSrc(state: CompanionStateSnapshot, sheet: SheetName, cell: Cell): string {
  return state.frames.sheets[sheet][cell.row][cell.col];
}

function App() {
  const [state, setState] = React.useState<CompanionStateSnapshot | undefined>();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [lockPrompt, setLockPrompt] = React.useState<LockPromptState | undefined>();
  const [loadingMessage, setLoadingMessage] = React.useState<string | undefined>();
  const [cell, setCell] = React.useState<Cell>({ row: 2, col: 2 });
  const [blink, setBlink] = React.useState(false);
  const [mouthLevel, setMouthLevel] = React.useState<0 | 1 | 2>(0);
  const [frameSlots, setFrameSlots] = React.useState<[string | undefined, string | undefined]>([undefined, undefined]);
  const [visibleSlot, setVisibleSlot] = React.useState<0 | 1>(0);
  const stateRef = React.useRef<CompanionStateSnapshot | undefined>();
  const cellRef = React.useRef<Cell>({ row: 2, col: 2 });
  const mouthLevelRef = React.useRef<0 | 1 | 2>(0);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const petRef = React.useRef<HTMLDivElement | null>(null);
  const target = React.useRef({ x: 0, y: 0 });
  const current = React.useRef({ x: 0, y: 0 });
  const hostTarget = React.useRef<{ x: number; y: number } | undefined>();
  const pointerInside = React.useRef(false);
  const decodedFrames = React.useRef<Set<string>>(new Set());
  const frameDecodes = React.useRef<Map<string, Promise<void>>>(new Map());
  const pendingFrame = React.useRef<{ src: string; slot: 0 | 1 } | undefined>();
  const loadedFrameSlots = React.useRef<[string | undefined, string | undefined]>([undefined, undefined]);
  const animationFrame = React.useRef(0);
  stateRef.current = state;
  mouthLevelRef.current = mouthLevel;

  const persistWebviewState = React.useCallback((snapshot: CompanionStateSnapshot, layout = snapshot.layout) => {
    const saved: SavedWebviewState = {
      currentCharacterId: snapshot.currentCharacterId,
      layout,
      mouthLevel: mouthLevelRef.current,
    };
    vscode.setState(saved);
  }, []);

  const decodeFrame = React.useCallback((src: string) => {
    if (decodedFrames.current.has(src)) return Promise.resolve();
    const existing = frameDecodes.current.get(src);
    if (existing) return existing;

    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    const ready = (typeof image.decode === 'function'
      ? image.decode()
      : new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      }))
      .catch(() => undefined)
      .then(() => {
        decodedFrames.current.add(src);
        frameDecodes.current.delete(src);
      });
    frameDecodes.current.set(src, ready);
    return ready;
  }, []);

  const commitCellFromCurrent = React.useCallback(() => {
    const col = clamp(Math.round(((current.current.x + 1) / 2) * (COLS - 1)), 0, COLS - 1);
    const row = clamp(Math.round(((current.current.y + 1) / 2) * (ROWS - 1)), 0, ROWS - 1);
    const next = { row, col };
    if (next.row !== cellRef.current.row || next.col !== cellRef.current.col) {
      cellRef.current = next;
      setCell(next);
    }
  }, []);

  const startTracking = React.useCallback(() => {
    if (animationFrame.current !== 0) return;
    const tick = () => {
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;
      if (Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002) {
        current.current = { ...target.current };
        commitCellFromCurrent();
        animationFrame.current = 0;
        return;
      }
      const speed = stateRef.current?.layout.trackingSpeed ?? 0.3;
      current.current.x += dx * speed;
      current.current.y += dy * speed;
      commitCellFromCurrent();
      animationFrame.current = requestAnimationFrame(tick);
    };
    animationFrame.current = requestAnimationFrame(tick);
  }, [commitCellFromCurrent]);

  const targetFocusVector = React.useCallback((x: number, y: number) => {
    target.current = {
      x: clamp(x, -1, 1),
      y: clamp(y, -1, 1),
    };
    startTracking();
  }, [startTracking]);

  const applyLayout = React.useCallback((layout: CompanionLayout, notify: boolean) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, layout };
      stateRef.current = next;
      persistWebviewState(next, layout);
      return next;
    });
    if (notify) vscode.postMessage({ type: 'layoutChanged', layout });
  }, [persistWebviewState]);

  const applyGazeLock = React.useCallback((gazeLock: GazeLock | undefined) => {
    const snapshot = stateRef.current;
    if (!snapshot) return;
    const layout = gazeLock ? { ...snapshot.layout, gazeLock } : withoutGazeLock(snapshot.layout);
    applyLayout(layout, true);
    setLockPrompt(undefined);
    if (gazeLock) targetFocusVector(gazeLock.vectorX, gazeLock.vectorY);
    else if (hostTarget.current) targetFocusVector(hostTarget.current.x, hostTarget.current.y);
  }, [applyLayout, targetFocusVector]);

  React.useEffect(() => () => {
    if (animationFrame.current !== 0) cancelAnimationFrame(animationFrame.current);
  }, []);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebviewMessage>) => {
      const message = event.data;
      if (message.type === 'init' || message.type === 'characterChanged') {
        decodedFrames.current.clear();
        frameDecodes.current.clear();
        pendingFrame.current = undefined;
        loadedFrameSlots.current = [undefined, undefined];
        setFrameSlots([undefined, undefined]);
        setVisibleSlot(0);
        setState(message.state);
        stateRef.current = message.state;
        setLoadingMessage(undefined);
        mouthLevelRef.current = message.state.mouthLevel;
        setMouthLevel(message.state.mouthLevel);
        setLockPrompt(undefined);
        persistWebviewState(message.state);
        if (message.state.layout.gazeLock) {
          targetFocusVector(message.state.layout.gazeLock.vectorX, message.state.layout.gazeLock.vectorY);
        }
      } else if (message.type === 'layoutChanged') {
        setState((prev) => {
          if (!prev) return prev;
          const next = { ...prev, layout: message.layout };
          stateRef.current = next;
          persistWebviewState(next, message.layout);
          if (message.layout.gazeLock) {
            targetFocusVector(message.layout.gazeLock.vectorX, message.layout.gazeLock.vectorY);
          }
          return next;
        });
      } else if (message.type === 'characterLoading') {
        setLoadingMessage(message.active ? message.message : undefined);
      } else if (message.type === 'focusTarget') {
        hostTarget.current = { x: message.x, y: message.y };
        if (!stateRef.current?.layout.gazeLock && !pointerInside.current) targetFocusVector(message.x, message.y);
      } else if (message.type === 'settingsMode') {
        setSettingsOpen(message.open);
        if (!message.open) setLockPrompt(undefined);
      } else if (message.type === 'mouthLevel') {
        mouthLevelRef.current = message.mouthLevel;
        setMouthLevel(message.mouthLevel);
      }
    };
    window.addEventListener('message', onMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, [persistWebviewState, targetFocusVector]);

  const autoBlink = state?.layout.autoBlink ?? true;

  React.useEffect(() => {
    if (!autoBlink) {
      setBlink(false);
      return;
    }
    let alive = true;
    let timer = 0;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const schedule = () => {
      if (!alive) return;
      const u = Math.random();
      const wait = u < 0.12 ? rand(700, 1500) : u < 0.82 ? rand(1800, 4500) : rand(4500, 9000);
      timer = window.setTimeout(doBlink, wait);
    };
    const blinkOnce = (duration: number, after: () => void) => {
      setBlink(true);
      timer = window.setTimeout(() => {
        if (!alive) return;
        setBlink(false);
        timer = window.setTimeout(after, rand(120, 220));
      }, duration);
    };
    const doBlink = () => {
      if (!alive) return;
      const roll = Math.random();
      if (roll < 0.22) {
        blinkOnce(rand(80, 120), () => blinkOnce(rand(70, 110), schedule));
      } else if (roll < 0.28) {
        blinkOnce(rand(260, 420), schedule);
      } else {
        blinkOnce(rand(90, 150), schedule);
      }
    };
    schedule();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [autoBlink]);

  const activeSheet = sheetFor(blink, mouthLevel);
  const requestedFrameSrc = state ? frameSrc(state, activeSheet, cell) : undefined;

  React.useEffect(() => {
    if (!requestedFrameSrc) return;
    if (frameSlots[visibleSlot] === requestedFrameSrc) return;

    const slot = visibleSlot === 0 ? 1 : 0;
    pendingFrame.current = { src: requestedFrameSrc, slot };
    if (
      frameSlots[slot] === requestedFrameSrc
      && loadedFrameSlots.current[slot] === requestedFrameSrc
      && decodedFrames.current.has(requestedFrameSrc)
    ) {
      requestAnimationFrame(() => {
        const pending = pendingFrame.current;
        if (!pending || pending.slot !== slot || pending.src !== requestedFrameSrc) return;
        setVisibleSlot(slot);
        pendingFrame.current = undefined;
      });
      return;
    }
    if (frameSlots[slot] !== requestedFrameSrc) loadedFrameSlots.current[slot] = undefined;
    setFrameSlots((prev) => {
      if (prev[slot] === requestedFrameSrc) return prev;
      const next: [string | undefined, string | undefined] = [...prev];
      next[slot] = requestedFrameSrc;
      return next;
    });
  }, [frameSlots, requestedFrameSrc, visibleSlot]);

  const onFrameLoad = React.useCallback((slot: 0 | 1, src: string | undefined, image: HTMLImageElement) => {
    if (!src) return;
    void image.decode().then(() => {
      decodedFrames.current.add(src);
      loadedFrameSlots.current[slot] = src;
      const pending = pendingFrame.current;
      if (!pending || pending.slot !== slot || pending.src !== src) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const latest = pendingFrame.current;
          if (!latest || latest.slot !== slot || latest.src !== src) return;
          setVisibleSlot(slot);
          pendingFrame.current = undefined;
        });
      });
    }).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!state) return;
    const stableCell = { ...cell };
    const timer = window.setTimeout(() => {
      if (stableCell.row !== cellRef.current.row || stableCell.col !== cellRef.current.col) return;
      const sources = new Set<string>();
      for (const sheet of SHEETS) {
        sources.add(frameSrc(state, sheet, stableCell));
      }
      for (const src of sources) void decodeFrame(src);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [cell, decodeFrame, state]);

  const gazeLockAtPoint = React.useCallback((clientX: number, clientY: number): GazeLock | undefined => {
    const stage = stageRef.current;
    const pet = petRef.current;
    const snapshot = stateRef.current;
    if (!stage || !pet || !snapshot) return undefined;
    const stageRect = stage.getBoundingClientRect();
    const petRect = pet.getBoundingClientRect();
    const vector = pointerFocusVector(petRect, { x: clientX, y: clientY }, snapshot.layout.trackingRange);
    return {
      x: clamp(((clientX - stageRect.left) / Math.max(1, stageRect.width)) * 100, 0, 100),
      y: clamp(((clientY - stageRect.top) / Math.max(1, stageRect.height)) * 100, 0, 100),
      vectorX: vector.x,
      vectorY: vector.y,
    };
  }, []);

  const onPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const snapshot = stateRef.current;
    const pet = petRef.current;
    if (!snapshot || !pet) return;
    pointerInside.current = true;
    if (snapshot.layout.gazeLock) return;
    target.current = pointerFocusVector(
      pet.getBoundingClientRect(),
      { x: event.clientX, y: event.clientY },
      snapshot.layout.trackingRange,
    );
    startTracking();
  }, [startTracking]);

  const onPointerEnter = React.useCallback(() => {
    pointerInside.current = true;
  }, []);

  const onStagePointerLeave = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const snapshot = stateRef.current;
    const pet = petRef.current;
    pointerInside.current = false;
    if (snapshot?.layout.gazeLock) {
      targetFocusVector(snapshot.layout.gazeLock.vectorX, snapshot.layout.gazeLock.vectorY);
      return;
    }
    if (pet) {
      const vector = pointerFocusVector(
        pet.getBoundingClientRect(),
        { x: event.clientX, y: event.clientY },
        snapshot?.layout.trackingRange,
      );
      vscode.postMessage({ type: 'viewPointerExit', x: vector.x, y: vector.y });
      targetFocusVector(vector.x, vector.y);
    }
  }, [targetFocusVector]);

  const onStageClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!settingsOpen) return;
    const targetElement = event.target;
    if (!(targetElement instanceof HTMLElement)) return;
    if (targetElement.closest('.settingsUi, .gazeLockMarker, .lockPrompt')) return;
    const lock = gazeLockAtPoint(event.clientX, event.clientY);
    if (!lock) return;
    if (stateRef.current?.layout.gazeLock) {
      applyGazeLock(lock);
    } else {
      setLockPrompt(lock);
    }
  }, [applyGazeLock, gazeLockAtPoint, settingsOpen]);

  const onStageWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!settingsOpen) return;
    event.preventDefault();
    const snapshot = stateRef.current;
    if (!snapshot) return;
    const steps = Math.max(1, Math.min(4, Math.ceil(Math.abs(event.deltaY) / 120)));
    const direction = event.deltaY < 0 ? 1 : -1;
    const scale = clamp(snapshot.layout.scale + direction * WHEEL_SCALE_STEP * steps, MIN_LAYOUT_SCALE, MAX_LAYOUT_SCALE);
    if (scale === snapshot.layout.scale) return;
    applyLayout({ ...snapshot.layout, scale }, true);
  }, [applyLayout, settingsOpen]);

  if (!state) {
    return <LoadingScreen message={loadingMessage ?? 'Loading Guruguru Codechan...'} />;
  }

  const layout = state.layout;
  const petSize = `${Math.round(340 * layout.scale)}px`;

  return (
    <div
      ref={stageRef}
      className={`stage ${settingsOpen ? 'settings-open' : 'settings-closed'}`}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onStagePointerLeave}
      onClick={onStageClick}
      onWheel={onStageWheel}
    >
      <div
        ref={petRef}
        className="pet"
        style={{
          left: `${layout.x}%`,
          top: `${layout.y}%`,
          width: petSize,
          height: petSize,
        }}
      >
        {frameSlots.map((src, slot) => src && (
          <img
            key={slot}
            className={slot === visibleSlot ? 'frame active' : 'frame'}
            src={src}
            loading="eager"
            decoding="async"
            draggable={false}
            alt=""
            onLoad={(event) => onFrameLoad(slot as 0 | 1, src, event.currentTarget)}
          />
        ))}
      </div>

      {settingsOpen && (
        <SettingsOverlay
          currentCharacterName={state.currentCharacterName}
          layout={layout}
          onNudge={(dx, dy) => {
            applyLayout({
              ...layout,
              x: clamp(layout.x + dx, 0, 100),
              y: clamp(layout.y + dy, 0, 100),
            }, true);
          }}
          onScale={(scale) => {
            applyLayout({ ...layout, scale }, true);
          }}
          onMouthSync={(mouthSync) => {
            applyLayout({ ...layout, mouthSync }, true);
          }}
          onTrackingRange={(trackingRange) => {
            applyLayout({ ...layout, trackingRange }, true);
          }}
          onTrackingSpeed={(trackingSpeed) => {
            applyLayout({ ...layout, trackingSpeed }, true);
          }}
          onAutoBlink={(autoBlink) => {
            applyLayout({ ...layout, autoBlink }, true);
          }}
          onImport={() => vscode.postMessage({ type: 'importCharacter' })}
          onDelete={() => vscode.postMessage({ type: 'deleteCharacter' })}
        />
      )}

      {settingsOpen && layout.gazeLock && (
        <button
          className="gazeLockMarker"
          type="button"
          title="Unlock gaze"
          aria-label="Unlock gaze"
          style={{ left: `${layout.gazeLock.x}%`, top: `${layout.gazeLock.y}%` }}
          onClick={(event) => {
            event.stopPropagation();
            applyGazeLock(undefined);
          }}
        >
          Unlock
        </button>
      )}

      {settingsOpen && lockPrompt && (
        <div
          className="lockPrompt"
          style={{ left: `${lockPrompt.x}%`, top: `${lockPrompt.y}%` }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="settingsButton compact"
            type="button"
            aria-label="Lock gaze"
            onClick={() => applyGazeLock(lockPrompt)}
          >
            Lock gaze
          </button>
        </div>
      )}

      {loadingMessage && <LoadingScreen message={loadingMessage} overlay />}
    </div>
  );
}

function LoadingScreen({ message, overlay = false }: { message: string; overlay?: boolean }) {
  return (
    <div className={overlay ? 'loading loadingOverlay' : 'loading'} role="status" aria-live="polite">
      <span className="loadingSpinner" aria-hidden="true" />
      <span className="loadingText">{message}</span>
    </div>
  );
}

function SettingsOverlay({
  currentCharacterName,
  layout,
  onNudge,
  onScale,
  onMouthSync,
  onTrackingRange,
  onTrackingSpeed,
  onAutoBlink,
  onImport,
  onDelete,
}: {
  currentCharacterName: string;
  layout: CompanionLayout;
  onNudge(dx: number, dy: number): void;
  onScale(scale: number): void;
  onMouthSync(enabled: boolean): void;
  onTrackingRange(range: number): void;
  onTrackingSpeed(speed: number): void;
  onAutoBlink(enabled: boolean): void;
  onImport(): void;
  onDelete(): void;
}) {
  const [tweaksOpen, setTweaksOpen] = React.useState(false);

  return (
    <div className="settingsUi" aria-label="Companion settings">
      <button className="triangleButton moveButton moveUp" type="button" title="Move up" aria-label="Move up" onClick={() => onNudge(0, -2)}>↑</button>
      <button className="triangleButton moveButton moveLeft" type="button" title="Move left" aria-label="Move left" onClick={() => onNudge(-2, 0)}>←</button>
      <button className="triangleButton moveButton moveRight" type="button" title="Move right" aria-label="Move right" onClick={() => onNudge(2, 0)}>→</button>
      <button className="triangleButton moveButton moveDown" type="button" title="Move down" aria-label="Move down" onClick={() => onNudge(0, 2)}>↓</button>

      <label className="zoomRail" title="Zoom">
        <input
          className="zoomSlider"
          type="range"
          min={MIN_LAYOUT_SCALE}
          max={MAX_LAYOUT_SCALE}
          step="0.02"
          value={layout.scale}
          aria-label="Zoom companion"
          onChange={(event) => onScale(Number(event.currentTarget.value))}
        />
        <span className="zoomValue">{Math.round(layout.scale * 100)}%</span>
      </label>

      <div className="assetTools">
        <div className="assetButtonRow">
          <button className="assetButton importButton" type="button" title="Import character" aria-label="Import character" onClick={onImport}>
            <ActionIcon name="import" />
            <span className="assetText">Import</span>
          </button>
          <button className="assetButton deleteButton" type="button" title="Delete character" aria-label="Delete character" onClick={onDelete}>
            <ActionIcon name="delete" />
            <span className="assetText">Delete</span>
          </button>
          <button
            className={`assetButton tweaksButton ${tweaksOpen ? 'active' : ''}`}
            type="button"
            title="Open tweaks"
            aria-label="Open tweaks"
            aria-expanded={tweaksOpen}
            onClick={() => setTweaksOpen((open) => !open)}
          >
            <ActionIcon name="tweaks" />
            <span className="assetText">Tweaks</span>
          </button>
        </div>

        {tweaksOpen && (
          <div className="tweaksPanel" aria-label="Tweaks">
            <label className="tweakField">
              <span className="tweakHeader">
                <span>Tracking range</span>
                <span>{layout.trackingRange}px</span>
              </span>
              <input
                className="tweakSlider"
                type="range"
                min={MIN_TRACKING_RANGE}
                max={MAX_TRACKING_RANGE}
                step="10"
                value={layout.trackingRange}
                aria-label="Tracking range"
                onChange={(event) => onTrackingRange(Number(event.currentTarget.value))}
              />
            </label>

            <label className="tweakField">
              <span className="tweakHeader">
                <span>Tracking speed</span>
                <span>{layout.trackingSpeed.toFixed(2)}</span>
              </span>
              <input
                className="tweakSlider"
                type="range"
                min={MIN_TRACKING_SPEED}
                max={MAX_TRACKING_SPEED}
                step="0.01"
                value={layout.trackingSpeed}
                aria-label="Tracking speed"
                onChange={(event) => onTrackingSpeed(Number(event.currentTarget.value))}
              />
            </label>

            <label className="tweakToggle">
              <input
                className="tweakCheckbox"
                type="checkbox"
                checked={layout.mouthSync}
                aria-label="Sync mouth with typing"
                onChange={(event) => onMouthSync(event.currentTarget.checked)}
              />
              <span>Typing mouth sync</span>
            </label>

            <label className="tweakToggle">
              <input
                className="tweakCheckbox"
                type="checkbox"
                checked={layout.autoBlink}
                aria-label="Auto blink"
                onChange={(event) => onAutoBlink(event.currentTarget.checked)}
              />
              <span>Auto blink</span>
            </label>
          </div>
        )}
      </div>
      <span className="characterName" title={currentCharacterName}>{currentCharacterName}</span>
    </div>
  );
}

function ActionIcon({ name }: { name: ActionIconName }) {
  if (name === 'import') {
    return (
      <svg className="assetIcon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M2 4.5V9.10022L2.92389 7.5C3.45979 6.5718 4.45017 6 5.52196 6L11.9146 6C11.7087 5.4174 11.1531 5 10.5 5H7C6.86739 5 6.74021 4.94732 6.64645 4.85355L4.93934 3.14645C4.84557 3.05268 4.71839 3 4.58579 3H3.5C2.67157 3 2 3.67157 2 4.5ZM7.06895 13.9953C7.04641 13.9984 7.02339 14 7 14H3.5C2.11929 14 1 12.8807 1 11.5V4.5C1 3.11929 2.11929 2 3.5 2H4.58579C4.98361 2 5.36514 2.15804 5.64645 2.43934L7.20711 4H10.5C11.724 4 12.7426 4.87965 12.958 6.04127C14.605 6.34148 15.5443 8.22106 14.6616 9.75L13.0766 12.4953C12.5407 13.4235 11.5503 13.9953 10.4785 13.9953H7.06895ZM5.52196 7C4.80743 7 4.14718 7.3812 3.78991 8L2.20492 10.7453C1.62757 11.7453 2.34926 12.9953 3.50396 12.9953L10.4785 12.9953C11.193 12.9953 11.8533 12.6141 12.2105 11.9953L13.7955 9.25C14.3729 8.25 13.6512 7 12.4965 7L5.52196 7Z" />
      </svg>
    );
  }
  if (name === 'delete') {
    return (
      <svg className="assetIcon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M14 2H10C10 0.897 9.103 0 8 0C6.897 0 6 0.897 6 2H2C1.724 2 1.5 2.224 1.5 2.5C1.5 2.776 1.724 3 2 3H2.54L3.349 12.708C3.456 13.994 4.55 15 5.84 15H10.159C11.449 15 12.543 13.993 12.65 12.708L13.459 3H13.999C14.275 3 14.499 2.776 14.499 2.5C14.499 2.224 14.275 2 13.999 2H14ZM8 1C8.551 1 9 1.449 9 2H7C7 1.449 7.449 1 8 1ZM11.655 12.625C11.591 13.396 10.934 14 10.16 14H5.841C5.067 14 4.41 13.396 4.346 12.625L3.544 3H12.458L11.656 12.625H11.655ZM7 5.5V11.5C7 11.776 6.776 12 6.5 12C6.224 12 6 11.776 6 11.5V5.5C6 5.224 6.224 5 6.5 5C6.776 5 7 5.224 7 5.5ZM10 5.5V11.5C10 11.776 9.776 12 9.5 12C9.224 12 9 11.776 9 11.5V5.5C9 5.224 9.224 5 9.5 5C9.776 5 10 5.224 10 5.5Z" />
      </svg>
    );
  }
  return (
    <svg className="assetIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 9C10.3425 9 9.00002 10.3425 9.00002 12C9.00002 13.6575 10.3425 15 12 15C13.6575 15 15 13.6575 15 12C15 10.3425 13.6575 9 12 9ZM12 13.5C11.172 13.5 10.5 12.828 10.5 12C10.5 11.172 11.172 10.5 12 10.5C12.828 10.5 13.5 11.172 13.5 12C13.5 12.828 12.828 13.5 12 13.5ZM21.8475 14.5725L19.9185 12.942C19.8675 12.8985 19.8195 12.8505 19.776 12.7995C19.332 12.279 19.3965 11.5005 19.9185 11.058L21.8475 9.4275C22.0395 9.2655 22.113 9.0045 22.0365 8.766C21.579 7.3545 20.823 6.06 19.8285 4.962C19.7085 4.83 19.5405 4.758 19.368 4.758C19.2975 4.758 19.227 4.77 19.1595 4.794L16.779 5.6415C16.716 5.664 16.65 5.682 16.584 5.694C16.509 5.7075 16.434 5.715 16.3605 5.715C15.7725 5.715 15.2505 5.298 15.141 4.701L14.6865 2.223C14.6415 1.977 14.451 1.782 14.205 1.7295C13.485 1.5765 12.7485 1.5 12.0015 1.5C11.2545 1.5 10.5165 1.578 9.79652 1.7295C9.55052 1.782 9.36002 1.977 9.31502 2.223L8.86202 4.701C8.85002 4.767 8.83202 4.8315 8.80952 4.8945C8.62802 5.4 8.15102 5.715 7.64102 5.715C7.50302 5.715 7.36202 5.691 7.22402 5.643L4.84352 4.7955C4.77602 4.7715 4.70402 4.7595 4.63502 4.7595C4.46252 4.7595 4.29452 4.8315 4.17452 4.9635C3.17852 6.0615 2.42402 7.356 1.96502 8.7675C1.88702 9.006 1.96202 9.267 2.15402 9.429L4.08302 11.0595C4.13402 11.103 4.18202 11.151 4.22552 11.202C4.66952 11.7225 4.60502 12.501 4.08302 12.9435L2.15402 14.574C1.96202 14.736 1.88852 14.997 1.96502 15.2355C2.42252 16.647 3.17852 17.9415 4.17452 19.0395C4.29452 19.1715 4.46252 19.2435 4.63502 19.2435C4.70552 19.2435 4.77602 19.2315 4.84352 19.2075L7.22402 18.36C7.28702 18.3375 7.35302 18.3195 7.41902 18.3075C7.49402 18.294 7.56902 18.288 7.64252 18.288C8.23052 18.288 8.75252 18.705 8.86202 19.302L9.31502 21.78C9.36002 22.026 9.55052 22.221 9.79652 22.2735C10.5165 22.4265 11.2545 22.503 12.0015 22.503C12.7485 22.503 13.4865 22.425 14.205 22.2735C14.451 22.221 14.6415 22.026 14.6865 21.78L15.141 19.302C15.153 19.236 15.171 19.1715 15.1935 19.1085C15.375 18.603 15.852 18.288 16.362 18.288C16.5 18.288 16.641 18.312 16.779 18.36L19.158 19.2075C19.227 19.2315 19.2975 19.2435 19.3665 19.2435C19.539 19.2435 19.707 19.1715 19.827 19.0395C20.823 17.9415 21.5775 16.647 22.035 15.2355C22.113 14.997 22.038 14.736 21.846 14.574L21.8475 14.5725ZM19.092 17.589L17.2815 16.944C16.9845 16.839 16.6755 16.785 16.362 16.785C15.2085 16.785 14.1705 17.514 13.782 18.5985C13.731 18.738 13.6935 18.882 13.6665 19.029L13.3215 20.9055C12.8865 20.9685 12.444 21 12.0015 21C11.559 21 11.1165 20.9685 10.68 20.904L10.3365 19.0275C10.098 17.727 8.96552 16.7835 7.64252 16.7835C7.48052 16.7835 7.31552 16.7985 7.14902 16.8285C7.00352 16.8555 6.86102 16.893 6.72002 16.9425L4.90952 17.5875C4.35752 16.896 3.91652 16.1385 3.59102 15.321L5.05202 14.0865C5.61152 13.614 5.95202 12.951 6.01202 12.222C6.07202 11.493 5.84252 10.785 5.36702 10.227C5.27102 10.1145 5.16452 10.008 5.05202 9.912L3.59102 8.6775C3.91652 7.86 4.35752 7.101 4.90952 6.411L6.72002 7.056C7.01702 7.161 7.32602 7.215 7.64102 7.215C8.79452 7.215 9.83252 6.486 10.221 5.4015C10.272 5.2605 10.3095 5.1165 10.3365 4.971L10.68 3.0945C11.1165 3.0315 11.559 2.9985 12.0015 2.9985C12.444 2.9985 12.8865 3.03 13.3215 3.093L13.665 4.9695C13.9035 6.27 15.036 7.2135 16.359 7.2135C16.521 7.2135 16.686 7.1985 16.851 7.1685C16.9965 7.1415 17.1405 7.104 17.2815 7.0545L19.092 6.4095C19.644 7.0995 20.085 7.8585 20.4105 8.676L18.951 9.9105C18.3915 10.383 18.0495 11.046 17.991 11.775C17.931 12.504 18.1605 13.2135 18.636 13.77C18.7335 13.884 18.8385 13.989 18.9525 14.085L20.4135 15.3195C20.088 16.137 19.647 16.896 19.095 17.586L19.092 17.589Z" />
    </svg>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
