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
    return <div className="loading">Loading Guruguru Codechan...</div>;
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
            <span className="assetLabel">Import</span>
          </button>
          <button className="assetButton deleteButton" type="button" title="Delete character" aria-label="Delete character" onClick={onDelete}>
            <span className="assetLabel">Delete</span>
          </button>
        </div>
        <button
          className={`assetButton tweaksButton ${tweaksOpen ? 'active' : ''}`}
          type="button"
          title="Open tweaks"
          aria-label="Open tweaks"
          aria-expanded={tweaksOpen}
          onClick={() => setTweaksOpen((open) => !open)}
        >
          <span className="assetLabel">Tweaks</span>
        </button>

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

createRoot(document.getElementById('root')!).render(<App />);
