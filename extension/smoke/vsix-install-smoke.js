const assert = require('node:assert/strict');
const path = require('node:path');
const vscode = require('vscode');

const COMMANDS = [
  'guruguru-codechan.openCanvas',
  'guruguru-codechan.switchCharacter',
  'guruguru-codechan.toggleSettings',
  'guruguru-codechan.importCharacter',
  'guruguru-codechan.deleteCharacter',
  'guruguru-codechan.setMouthLevel',
];

async function run() {
  const expectedExtensionId = requireEnv('GGC_EXPECTED_EXTENSION_ID');
  const expectedVersion = requireEnv('GGC_EXPECTED_VERSION');
  const expectedExtensionsDir = path.resolve(requireEnv('GGC_EXPECTED_EXTENSIONS_DIR'));
  const sourceExtensionPath = path.resolve(requireEnv('GGC_SOURCE_EXTENSION_PATH'));

  const extension = vscode.extensions.getExtension(expectedExtensionId);
  assert.ok(extension, `Expected installed extension to be loaded: ${expectedExtensionId}.`);
  assert.equal(extension.packageJSON.version, expectedVersion);

  const installedPath = path.resolve(extension.extensionPath);
  assert.ok(
    isInside(expectedExtensionsDir, installedPath),
    `Expected installed extension path to be under ${expectedExtensionsDir}, found ${installedPath}.`,
  );
  assert.notEqual(installedPath.toLowerCase(), sourceExtensionPath.toLowerCase());

  await extension.activate();
  assert.equal(extension.isActive, true, `${expectedExtensionId} should activate cleanly from the installed VSIX.`);

  const registeredCommands = await vscode.commands.getCommands(true);
  for (const command of COMMANDS) {
    assert.ok(registeredCommands.includes(command), `Expected command to be registered: ${command}`);
  }

  await vscode.commands.executeCommand('guruguru-codechan.openCanvas');
  await waitForViewActivation();

  await vscode.commands.executeCommand('guruguru-codechan.toggleSettings');
  await vscode.commands.executeCommand('guruguru-codechan.setMouthLevel', 1);
  await vscode.commands.executeCommand('guruguru-codechan.setMouthLevel', 2);
  await vscode.commands.executeCommand('guruguru-codechan.setMouthLevel', 0);
  await vscode.commands.executeCommand('guruguru-codechan.toggleSettings');

  await vscode.commands.executeCommand('guruguru-codechan.deleteCharacter');
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required VSIX smoke environment variable: ${name}`);
  return value;
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function waitForViewActivation() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

module.exports = { run };
