import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { cleanGeneratedVsixArtifacts } from './vsix-artifact-hygiene.mjs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
if (manifest.name !== 'guruguru-codechan') {
  console.error(`Refusing to package unexpected extension: ${manifest.name}`);
  process.exit(1);
}

const output = `${manifest.name}-${manifest.version}.vsix`;
if (basename(process.cwd()) !== 'extension') {
  console.error(`Refusing to package outside the extension directory: ${process.cwd()}`);
  process.exit(1);
}

cleanGeneratedVsixArtifacts(resolve('..'));

execFileSync('pnpm', ['exec', 'vsce', 'package', '--no-dependencies', '--out', output], {
  stdio: 'inherit',
});
