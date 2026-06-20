# Publishing

This repository builds VSIX packages with GitHub Actions. Marketplace publishing is intentionally separated from tag builds.

## Local Preflight

```bash
pnpm install --frozen-lockfile
pnpm verify:release
```

The release gate runs extension tests, VS Code host smoke tests, VSIX packaging, VSIX hygiene checks, VSIX content verification, and packaged install smoke tests.

## GitHub VSIX Releases

1. Update `package.json`, `extension/package.json`, and `extension/CHANGELOG.md`.
2. Commit the release changes.
3. Push `main`.
4. Create and push a tag that exactly matches `extension/package.json`.

```bash
git tag v0.5.9
git push origin v0.5.9
```

The `Release VSIX` workflow verifies the tag, runs `pnpm verify:release`, and uploads `extension/guruguru-codechan-<version>.vsix` to GitHub Releases.

Patch versions such as `0.5.9` are created as GitHub prereleases and are not published to the Visual Studio Marketplace.
Patch-zero versions such as `0.6.0` are created as regular GitHub Releases, but still do not publish to the Marketplace automatically.

## Marketplace Publishing

Marketplace publishing is done only through the manual `Marketplace Release` workflow after the stable release has been reviewed and explicitly approved.

Required repository secret:

- `VSCE_PAT`: Visual Studio Marketplace personal access token for publisher `hitsuki-ban`.

Manual workflow inputs:

- `tag`: stable patch-zero tag, for example `v0.6.0`.
- `confirmation`: exact text `publish <tag> to marketplace`, for example `publish v0.6.0 to marketplace`.

The workflow checks that the tag matches `extension/package.json`, the version is `major.minor.0`, the confirmation string is exact, and `VSCE_PAT` is present before running `vsce publish`.

Before triggering Marketplace publishing, confirm the Marketplace README, icon, preview image, license text, and `ASSET_LICENSE.md`.

## Version Policy

Small versions in a line, such as `0.5.x`, are GitHub prerelease VSIX builds only.
Stable line changes, such as `0.6.0`, are regular GitHub Releases and can be synced to the Marketplace after explicit approval.

Marketplace pre-release and regular releases must use different `major.minor.patch` versions.

## Asset Rights

Bundled `Codeちゃん` sample assets are non-commercial only. User-imported assets remain owned by the user or their licensors.
