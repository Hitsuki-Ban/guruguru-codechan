import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const releaseWorkflow = readFileSync(resolve(repoRoot, '.github', 'workflows', 'release.yml'), 'utf8');
const marketplaceWorkflowPath = resolve(repoRoot, '.github', 'workflows', 'marketplace-release.yml');

describe('release automation policy', () => {
  it('keeps tag releases limited to GitHub VSIX artifacts', () => {
    expect(releaseWorkflow).toContain("tags:");
    expect(releaseWorkflow).toContain("'v*'");
    expect(releaseWorkflow).not.toContain('vsce publish');
    expect(releaseWorkflow).not.toContain('VSCE_PAT');
    expect(releaseWorkflow).toContain('--prerelease');
  });

  it('keeps Marketplace publishing behind an explicit stable-version manual gate', () => {
    expect(existsSync(marketplaceWorkflowPath)).toBe(true);
    const marketplaceWorkflow = readFileSync(marketplaceWorkflowPath, 'utf8');

    expect(marketplaceWorkflow).toContain('workflow_dispatch');
    expect(marketplaceWorkflow).toContain('confirmation');
    expect(marketplaceWorkflow).toContain('publish ${TAG} to marketplace');
    expect(marketplaceWorkflow).toContain('PATCH');
    expect(marketplaceWorkflow).toContain('VSCE_PAT');
    expect(marketplaceWorkflow).toContain('vsce publish');
  });
});
