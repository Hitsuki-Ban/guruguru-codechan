export const COMMANDS = {
  openCanvas: 'guruguru-codechan.openCanvas',
  importCharacter: 'guruguru-codechan.importCharacter',
  switchCharacter: 'guruguru-codechan.switchCharacter',
  deleteCharacter: 'guruguru-codechan.deleteCharacter',
  toggleSettings: 'guruguru-codechan.toggleSettings',
  setMouthLevel: 'guruguru-codechan.setMouthLevel',
} as const;

export type CommandId = typeof COMMANDS[keyof typeof COMMANDS];

export type CommandSurfaceContract = {
  readonly id: CommandId;
  readonly activationEvent: boolean;
  readonly contributed: boolean;
  readonly viewTitle: boolean;
  readonly readmeCommandTable: boolean;
};

export const COMMAND_SURFACE_CONTRACT: readonly CommandSurfaceContract[] = [
  {
    id: COMMANDS.openCanvas,
    activationEvent: true,
    contributed: true,
    viewTitle: false,
    readmeCommandTable: true,
  },
  {
    id: COMMANDS.importCharacter,
    activationEvent: false,
    contributed: false,
    viewTitle: false,
    readmeCommandTable: false,
  },
  {
    id: COMMANDS.switchCharacter,
    activationEvent: true,
    contributed: true,
    viewTitle: true,
    readmeCommandTable: true,
  },
  {
    id: COMMANDS.deleteCharacter,
    activationEvent: false,
    contributed: false,
    viewTitle: false,
    readmeCommandTable: false,
  },
  {
    id: COMMANDS.toggleSettings,
    activationEvent: true,
    contributed: true,
    viewTitle: true,
    readmeCommandTable: true,
  },
  {
    id: COMMANDS.setMouthLevel,
    activationEvent: true,
    contributed: false,
    viewTitle: false,
    readmeCommandTable: false,
  },
] as const;
