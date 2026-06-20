# Publishing

This repository publishes VSIX files through GitHub Releases and can publish the same verified package to the Visual Studio Marketplace.

## Local Preflight

```bash
pnpm install --frozen-lockfile
pnpm verify:release
```

The release gate runs extension tests, VS Code host smoke tests, VSIX packaging, VSIX hygiene checks, VSIX content verification, and packaged install smoke tests.

## GitHub Release

1. Update `extension/package.json` and `extension/CHANGELOG.md`.
2. Commit the release changes.
3. Push `main`.
4. Create and push a tag that exactly matches the extension version:

```bash
git tag v0.5.0
git push origin v0.5.0
```

The `Release VSIX And Marketplace` workflow verifies the tag against `extension/package.json`, runs `pnpm verify:release`, and uploads `extension/guruguru-codechan-<version>.vsix` to a GitHub Release.

## Marketplace Publishing

The first public upload has been completed. Future tag releases are intended to publish automatically to the Visual Studio Marketplace.

Required repository secret:

- `VSCE_PAT`: Visual Studio Marketplace personal access token for publisher `hitsuki-ban`.

The release workflow fails before publishing if `VSCE_PAT` is missing.

Before pushing a release tag, confirm the Marketplace README, icon, preview image, license text, and `ASSET_LICENSE.md`.

## Version Policy

Marketplace pre-release and regular releases must use different versions. If a version was uploaded as a pre-release, publish the next regular release with a new patch version.

## Asset Rights

Bundled `Codeちゃん` sample assets are non-commercial only. User-imported assets remain owned by the user or their licensors.
