import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runTests } from '@vscode/test-electron';

const root = resolve('.');
const tempRoot = mkdtempSync(join(tmpdir(), 'ggc-vscode-theme-'));
const workspacePath = join(tempRoot, 'workspace');
const userDataDir = join(tempRoot, 'user-data');
const extensionsDir = join(tempRoot, 'extensions');
const remoteDebuggingPort = 9328;

try {
  mkdirSync(workspacePath, { recursive: true });
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(extensionsDir, { recursive: true });

  await runTests({
    extensionDevelopmentPath: resolve(root, 'extension'),
    extensionTestsPath: resolve(root, 'extension', 'smoke', 'theme-cdp.js'),
    extensionTestsEnv: {
      GGC_CDP_PORT: String(remoteDebuggingPort),
    },
    launchArgs: [
      workspacePath,
      '--disable-workspace-trust',
      '--disable-extensions',
      '--skip-welcome',
      '--skip-release-notes',
      '--user-data-dir',
      userDataDir,
      '--extensions-dir',
      extensionsDir,
      `--remote-debugging-port=${remoteDebuggingPort}`,
    ],
  });
} catch (error) {
  console.error('VS Code theme QA failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
