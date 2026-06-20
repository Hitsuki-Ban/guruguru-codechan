const assert = require('node:assert/strict');
const vscode = require('vscode');

const EXTENSION_ID = 'hitsuki-ban.guruguru-codechan';
const COMMANDS = [
  'guruguru-codechan.openCanvas',
  'guruguru-codechan.switchCharacter',
  'guruguru-codechan.toggleSettings',
  'guruguru-codechan.importCharacter',
  'guruguru-codechan.deleteCharacter',
  'guruguru-codechan.setMouthLevel',
];

async function run() {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `Expected ${EXTENSION_ID} to be loaded in the Extension Development Host.`);

  await extension.activate();
  assert.equal(extension.isActive, true, `${EXTENSION_ID} should activate cleanly.`);

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

async function waitForViewActivation() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

module.exports = { run };
