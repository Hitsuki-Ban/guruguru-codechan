import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function cleanGeneratedVsixArtifacts(root = resolve('.')) {
  const { extensionDir, manifest } = readExtensionManifest(root);
  const generatedPattern = generatedVsixPattern(manifest.name);
  const deleted = [];

  for (const entry of readdirSync(extensionDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!generatedPattern.test(entry.name)) continue;

    rmSync(join(extensionDir, entry.name));
    deleted.push(entry.name);
  }

  return deleted.sort();
}

export function collectVsixArtifactHygieneViolations(root = resolve('.')) {
  const { extensionDir, manifest } = readExtensionManifest(root);
  const expectedArtifact = `${manifest.name}-${manifest.version}.vsix`;
  const vsixArtifacts = readdirSync(extensionDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.vsix'))
    .map((entry) => entry.name)
    .sort();
  const violations = [];

  if (!vsixArtifacts.includes(expectedArtifact)) {
    violations.push(`missing current VSIX artifact: ${expectedArtifact}`);
  }

  const unexpectedArtifacts = vsixArtifacts.filter((artifact) => artifact !== expectedArtifact);
  if (unexpectedArtifacts.length > 0) {
    violations.push(`unexpected VSIX artifacts in extension root: ${unexpectedArtifacts.join(', ')}`);
  }

  return violations;
}

function readExtensionManifest(root) {
  const extensionDir = join(root, 'extension');
  const manifestPath = join(extensionDir, 'package.json');

  if (!existsSync(manifestPath)) {
    throw new Error(`Missing extension manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.name !== 'guruguru-codechan') {
    throw new Error(`Unexpected extension name: ${manifest.name}`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(manifest.version)) {
    throw new Error(`Unexpected extension version: ${manifest.version}`);
  }

  return { extensionDir, manifest };
}

function generatedVsixPattern(extensionName) {
  return new RegExp(`^${escapeRegExp(extensionName)}-\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?\\.vsix$`, 'u');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
