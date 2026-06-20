# Guruguru Codechan

Guruguru Codechan runs importable 5x5 guruguru-style character assets in a dockable VS Code webview view.

This is a public preview extension. The preview keeps the full 150-frame asset contract while rendering only the active frame at runtime.

![Guruguru Codechan Codechan view preview](https://raw.githubusercontent.com/Hitsuki-Ban/guruguru-codechan/main/extension/media/marketplace/codechan-view.png)

## Getting Started

1. Run `Guruguru Codechan: Open Codechan View` from the Command Palette to show the dockable Codechan view.
2. Use `Guruguru Codechan: Toggle Codechan Settings` from the view title or Command Palette to reveal position, zoom, gaze-lock, import, and delete controls.
3. Confirm the bundled sample and user-imported asset terms in [ASSET_LICENSE.md](./ASSET_LICENSE.md) before importing custom character assets.

## Features

- Open a dockable Codechan view from the command palette.
- Switch between imported characters and the bundled sample character from the view title.
- Toggle a compact in-view settings layer from the view title.
- Use settings mode to nudge the companion with low-noise triangle buttons, adjust scale with a left-side zoom slider, or scale with the mouse wheel.
- Import or delete local character assets from settings mode.
- Click empty canvas space in settings mode to create or move a gaze lock, then click the lock marker to release it.
- Follow the pointer inside the Codechan view, then preserve the pointer exit direction vector when the pointer leaves the view.
- Track active editor cursor position on top of the latest companion-view exit vector without requiring manual side calibration.
- Keep a `mouthLevel: 0 | 1 | 2` message channel for future TTS integration.
- Store imported character assets only in VS Code global extension storage, never in the current workspace.

## Commands

| Command Palette title | Command ID |
|---|---|
| Guruguru Codechan: Open Codechan View | `guruguru-codechan.openCanvas` |
| Guruguru Codechan: Switch Character | `guruguru-codechan.switchCharacter` |
| Guruguru Codechan: Toggle Codechan Settings | `guruguru-codechan.toggleSettings` |

Import and delete are settings-layer actions rather than Command Palette commands. The experimental `guruguru-codechan.setMouthLevel` command is integration-only for future TTS/lip-sync callers and intentionally does not appear in the Command Palette.

## Asset Format

Imported character folders must contain exactly 150 image frames:

```text
A/r0c0.webp ... A/r4c4.webp
B/r0c0.webp ... B/r4c4.webp
C/r0c0.webp ... C/r4c4.webp
D/r0c0.webp ... D/r4c4.webp
E/r0c0.webp ... E/r4c4.webp
F/r0c0.webp ... F/r4c4.webp
```

PNG is also accepted, but a character must use a single format only. Missing frames, mixed formats, duplicate character names, duplicate asset file names, or extra PNG/WebP frame files are rejected.

During import, frames larger than 512 pixels on their longest edge are normalized to 512 pixels before they are stored in VS Code global extension storage. The original user-selected asset folder is not modified.

## Preview Notes

- The companion runs inside a VS Code Webview view, not as an operating-system-level floating window.
- Runtime rendering keeps a single active frame in the DOM and decodes requested frames on demand.
- VS Code does not expose global mouse coordinates or docked view bounds to extensions through the public API. Pointer follow tracks movement inside the Codechan view, then stores the normalized vector from the companion center to the pointer exit point.
- Active editor focus uses the latest exit vector for the editor side and the active selection plus visible editor range for near/far and row/column gaze detail.
- Terminal and workbench focus reuse the latest exit vector while the pointer is outside the Codechan view. This avoids manual left/right/top/bottom calibration, but it cannot read an integrated terminal cursor position from VS Code.
- Experimental integration command: `guruguru-codechan.setMouthLevel` accepts `0`, `1`, or `2` and is reserved for future TTS-driven lip sync.

## License And Asset Rights

Program code is MIT licensed. Bundled sample assets are non-commercial only; see [ASSET_LICENSE.md](./ASSET_LICENSE.md).

User-imported assets remain owned by the user or their licensors. Users are responsible for confirming that they have the rights to import and use their own character assets.

## Support

Use GitHub Issues for preview feedback and reproducible bugs:

https://github.com/Hitsuki-Ban/guruguru-codechan/issues

The public repository keeps the support policy and structured issue forms in [SUPPORT.md](../SUPPORT.md).
