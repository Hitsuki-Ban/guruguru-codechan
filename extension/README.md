# Guruguru Codechan

**Codeちゃんは見ている。**

Guruguru Codechan adds a small dockable companion view to VS Code. Codeちゃん watches your editor, blinks, turns toward the pointer or editor cursor, and can be replaced with your own guruguru-style character assets.

![Guruguru Codechan preview](https://raw.githubusercontent.com/Hitsuki-Ban/guruguru-codechan/main/extension/media/marketplace/codechan-view.png)

English | [日本語](https://github.com/Hitsuki-Ban/guruguru-codechan/blob/main/docs/i18n/README.ja.md) | [简体中文](https://github.com/Hitsuki-Ban/guruguru-codechan/blob/main/docs/i18n/README.zh-CN.md)

## What You Get

- A dockable VS Code view for Codeちゃん.
- Pointer and editor-cursor gaze tracking inside the limits of the VS Code API.
- A settings layer for position, scale, gaze lock, character import, and character deletion.
- A bundled non-commercial sample character.
- Local custom character import. Imported files are stored only in VS Code global extension storage, not in your workspace.

## Quick Start

1. Install the extension.
2. Run `Guruguru Codechan: Open Codechan View` from the Command Palette.
3. Use the view title buttons to switch characters or open settings.
4. In settings mode, move Codeちゃん with the arrow controls, scale with the slider or mouse wheel, or click the empty canvas to lock the gaze direction.

## Make Your Own Character

Custom characters use the same basic frame idea as [rotejin/tomari-guruguru](https://github.com/rotejin/tomari-guruguru). Please refer to that project when creating your own 25-direction guruguru-style assets.

After you have generated and sliced your assets, prepare one folder with exactly 150 frames:

```text
A/r0c0.webp ... A/r4c4.webp
B/r0c0.webp ... B/r4c4.webp
C/r0c0.webp ... C/r4c4.webp
D/r0c0.webp ... D/r4c4.webp
E/r0c0.webp ... E/r4c4.webp
F/r0c0.webp ... F/r4c4.webp
```

PNG is also accepted, but one character must use only one format.

To import the folder:

1. Open the Codeちゃん view.
2. Open settings from the view title.
3. Click the import button.
4. Select the folder that contains `A` through `F`.
5. Enter a character name.

The extension validates the frame names, rejects missing or mixed-format assets, resizes frames larger than 512px on their longest edge, and stores the imported copy in VS Code global extension storage. Your original folder is not changed.

## What Changed For VS Code

This extension is inspired by the original browser avatar method, but it is adapted for everyday use inside VS Code:

- The avatar runs in a VS Code Webview view instead of a browser page.
- The view can be docked beside the editor, terminal, or other panels.
- Character switching and import are handled by VS Code commands and in-view settings.
- Gaze tracking uses pointer movement inside the view and editor selection information available through the public VS Code API.
- Rendering is kept lightweight by showing only the active frame and by normalizing imported large assets to 512px.

VS Code does not provide global mouse coordinates or exact positions for every workbench panel, so this extension does not behave like an operating-system-level desktop pet. It stays inside the VS Code view system.

## Credits

Thank you to [rotejin](https://github.com/rotejin) for creating and publishing [tomari-guruguru](https://github.com/rotejin/tomari-guruguru), the original implementation that demonstrated the 25-direction guruguru avatar method and the mouth/blink frame structure.

This project does not bundle the original Tomari assets. The bundled Codeちゃん sample is a separate non-commercial sample asset set.

## License And Asset Rights

Program code is MIT licensed. Bundled sample assets are non-commercial only; see [ASSET_LICENSE.md](./ASSET_LICENSE.md).

User-imported assets remain owned by the user or their licensors. Please import only assets that you have the right to use.

## Support

Use GitHub Issues for reproducible bugs, import problems, and asset-rights questions:

https://github.com/Hitsuki-Ban/guruguru-codechan/issues
