import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import {
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath,
  runTests,
} from '@vscode/test-electron';

const root = resolve('.');
const extensionRoot = resolve(root, 'extension');
const manifestPath = resolve(extensionRoot, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const expectedExtension = `hitsuki-ban.guruguru-codechan@${manifest.version}`;
const sourceExtensionPath = extensionRoot;
const vsixPath = resolve(extensionRoot, `${manifest.name}-${manifest.version}.vsix`);

if (manifest.name !== 'guruguru-codechan') {
  console.error(`Refusing to smoke install unexpected extension: ${manifest.name}`);
  process.exit(1);
}

if (!existsSync(vsixPath)) {
  console.error(`Packaged VSIX is required before install smoke: ${vsixPath}`);
  process.exit(1);
}

const tempRoot = mkdtempSync(join(tmpdir(), 'ggc-vsix-install-'));
const workspacePath = join(tempRoot, 'workspace');
const userDataDir = join(tempRoot, 'user-data');
const extensionsDir = join(tempRoot, 'extensions');

try {
  mkdirSync(workspacePath, { recursive: true });
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(extensionsDir, { recursive: true });

  const vscodeExecutablePath = await downloadAndUnzipVSCode({ version: 'stable' });
  const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);

  runCodeCli(cliPath, [
    '--user-data-dir',
    userDataDir,
    '--extensions-dir',
    extensionsDir,
    '--install-extension',
    vsixPath,
    '--force',
  ]);

  const installedExtensions = runCodeCli(cliPath, [
    '--user-data-dir',
    userDataDir,
    '--extensions-dir',
    extensionsDir,
    '--list-extensions',
    '--show-versions',
  ]);
  assertInstalledExtension(installedExtensions);

  await runTests({
    vscodeExecutablePath,
    extensionDevelopmentPath: resolve(root, 'extension', 'smoke', 'vsix-harness'),
    extensionTestsPath: resolve(root, 'extension', 'smoke', 'vsix-install-smoke.js'),
    extensionTestsEnv: {
      GGC_EXPECTED_EXTENSION_ID: 'hitsuki-ban.guruguru-codechan',
      GGC_EXPECTED_VERSION: manifest.version,
      GGC_EXPECTED_EXTENSIONS_DIR: extensionsDir,
      GGC_SOURCE_EXTENSION_PATH: sourceExtensionPath,
    },
    launchArgs: [
      workspacePath,
      '--disable-workspace-trust',
      '--user-data-dir',
      userDataDir,
      '--extensions-dir',
      extensionsDir,
    ],
  });
} catch (error) {
  console.error('Packaged VSIX install smoke failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function runCodeCli(cliPath, args) {
  try {
    if (process.platform === 'win32') {
      return execFileSync('cmd.exe', ['/d', '/c', basename(cliPath), ...args], {
        cwd: dirname(cliPath),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    return execFileSync(cliPath, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : '';
    const stderr = error?.stderr ? String(error.stderr) : '';
    throw new Error(`VS Code CLI failed.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
}

function assertInstalledExtension(output) {
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const installedMatches = lines.filter((line) => line.startsWith('hitsuki-ban.guruguru-codechan@'));

  if (installedMatches.length !== 1) {
    throw new Error(`Expected one installed companion entry, found ${installedMatches.length}:\n${output}`);
  }

  if (installedMatches[0] !== expectedExtension) {
    throw new Error(`Expected installed extension ${expectedExtension}, found ${installedMatches[0]}.`);
  }
}
