# guruguru-codechan

Public repository for `guruguru-codechan`, a VS Code extension that runs `Codeちゃん` and user-imported 5x5 guruguru-style character assets in a dockable Webview view.

The extension package lives in [`extension/`](./extension/). Marketplace-facing documentation is maintained in [`extension/README.md`](./extension/README.md).

## Development

Requirements:

- Node.js 22.13 or newer
- pnpm 11.5.2
- VS Code with the `code` CLI for isolated install QA

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Build, test, and package the VS Code extension:

```bash
pnpm extension:test
pnpm extension:package
pnpm verify:extension-package
```

Run the local release gate:

```bash
pnpm verify:release
```

The release gate runs unit tests, VS Code smoke tests, VSIX packaging, VSIX content verification, and packaged install smoke tests.

## Release

GitHub Actions builds a preview VSIX on pushes and pull requests. Pushing a tag that matches `extension/package.json` as `vX.Y.Z` creates a GitHub pre-release and uploads the packaged VSIX.

Marketplace publishing is intentionally manual for the first public release. After the first upload is verified, `VSCE_PAT` can be added as a repository secret and a publish step can be wired into the release workflow.

## Support

Use the structured GitHub Issue forms for reproducible bugs and asset rights or import reports. See [`SUPPORT.md`](./SUPPORT.md) before filing preview feedback.

## Licensing

Program code is MIT licensed. Bundled `Codeちゃん` sample assets are separately licensed for non-commercial use; see [`extension/ASSET_LICENSE.md`](./extension/ASSET_LICENSE.md).

User-imported assets remain governed by the rights of the user or their licensors.
