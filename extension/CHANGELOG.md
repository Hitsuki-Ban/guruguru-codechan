# Changelog

## 0.5.2

- Rewrites the Marketplace and repository README pages around a simpler reader-first product introduction.
- Adds English, Japanese, and Simplified Chinese static manifest localization through `package.nls` files.
- Updates the Marketplace preview copy to use the product catch phrase `Codeちゃんは見ている。`.

## 0.5.1

- Replaces the bundled `Codeちゃん` sample with the current 512px non-commercial sample asset set.
- Normalizes imported PNG/WebP character frames larger than 512px on the longest edge before storing them in VS Code global extension storage.
- Keeps dynamic ESM loading for the image processing runtime used by import-time normalization.

## 0.5.0

- Rebrands the extension as `guruguru-codechan` with publisher `hitsuki-ban`.
- Ships the dockable `Codeちゃん` Webview view with character switching, settings mode, position nudging, zoom, gaze lock, pointer/editor gaze tracking, and the `mouthLevel` integration channel.
- Adds strict 150-frame local character asset import while storing user assets only in VS Code global extension storage.
- Bundles a `Codeちゃん` non-commercial sample asset set and separates program code licensing from bundled asset licensing.
