export type FrameExt = 'webp' | 'png';
export type SheetName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type FocusTargetSource = 'editor' | 'terminal' | 'workbench';
export type CharacterKind = 'builtIn' | 'user';

export interface CharacterRecord {
  id: string;
  name: string;
  kind: CharacterKind;
  ext: FrameExt;
  storageRelativePath?: string;
}

export interface CharacterFrames {
  ext: FrameExt;
  sheets: Record<SheetName, string[][]>;
}

export interface GazeLock {
  x: number;
  y: number;
  vectorX: number;
  vectorY: number;
}

export interface CompanionLayout {
  x: number;
  y: number;
  scale: number;
  mouthSync: boolean;
  trackingRange: number;
  trackingSpeed: number;
  autoBlink: boolean;
  gazeLock?: GazeLock;
}

export interface CompanionStateSnapshot {
  characters: CharacterRecord[];
  currentCharacterId: string;
  currentCharacterName: string;
  frames: CharacterFrames;
  layout: CompanionLayout;
  mouthLevel: 0 | 1 | 2;
}

export type HostToWebviewMessage =
  | { type: 'init'; state: CompanionStateSnapshot }
  | { type: 'characterChanged'; state: CompanionStateSnapshot }
  | { type: 'layoutChanged'; layout: CompanionLayout }
  | { type: 'focusTarget'; x: number; y: number; source: FocusTargetSource }
  | { type: 'settingsMode'; open: boolean }
  | { type: 'mouthLevel'; mouthLevel: 0 | 1 | 2 };

export type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'layoutChanged'; layout: CompanionLayout }
  | { type: 'viewPointerExit'; x: number; y: number }
  | { type: 'importCharacter' }
  | { type: 'deleteCharacter' };
