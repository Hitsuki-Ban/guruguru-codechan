# Guruguru Codechan

**Codeちゃんは見ている。**

Guruguru Codechan adds a dockable Codeちゃん companion view to VS Code.
Codeちゃん blinks, quietly watches your work, and follows the mouse with her gaze when it comes close.

When you get tired, take a short break and play with Codeちゃん.

Of course, you can also replace her with your own guruguru-style character assets.

![Guruguru Codechan preview](https://raw.githubusercontent.com/Hitsuki-Ban/guruguru-codechan/main/extension/media/marketplace/codechan-view-v0.5.5.png)

English | [日本語](https://github.com/Hitsuki-Ban/guruguru-codechan/blob/main/docs/i18n/README.ja.md) | [简体中文](https://github.com/Hitsuki-Ban/guruguru-codechan/blob/main/docs/i18n/README.zh-CN.md)

## Preview

### Mouse interaction

![Codeちゃん follows the mouse pointer](https://raw.githubusercontent.com/Hitsuki-Ban/guruguru-codechan/main/extension/media/marketplace/demo-pointer.gif)

### Editor cursor tracking

![Codeちゃん follows the editor cursor](https://raw.githubusercontent.com/Hitsuki-Ban/guruguru-codechan/main/extension/media/marketplace/demo-editor-cursor.gif)

## What You Get

- A dockable VS Code view for Codeちゃん.
- Pointer and editor-cursor gaze tracking where VS Code exposes enough information.
- A settings layer for position, scale, gaze lock, tracking tweaks, character import, and character deletion.
- A bundled non-commercial sample character.
- Local custom character import.

## Quick Start

1. Install the extension.
2. Run `Guruguru Codechan: Open Codechan View` from the Command Palette.
3. Use the view title buttons to switch characters or open settings.
4. In settings mode, move Codeちゃん with the arrow controls, scale with the slider or mouse wheel, open Tweaks for tracking and animation options, or click the empty canvas to lock the gaze direction.

To open the view automatically after VS Code starts, enable `Guruguru Codechan: Open On Startup` in Settings.

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

The extension validates the frame names and rejects missing frames or mixed formats.
Frames larger than 512px are resized to 512px on their longest edge before they are saved.

Your original asset folder is not changed.

## What Changed For VS Code

This extension follows the browser avatar idea, then adjusts it for everyday use inside VS Code:

- Performance: the runtime shows only the active frame, and imported large images are normalized to 512px to reduce resource use.
- Input: gaze tracking uses pointer and editor-selection information available through the public VS Code API.
- Mouth animation: when enabled in settings, mouth frames react to keyboard input. The `mouthLevel` channel can be connected to TTS later.

VS Code does not expose global mouse coordinates or exact positions for every workbench panel.
Because of that, Codeちゃん cannot perform perfectly accurate global mouse tracking.

### Troubleshooting

#### Codeちゃん is not looking the right way in the editor

Move the pointer through the Codeちゃん view once, then return to the editor.
Codeちゃん estimates the editor direction from the last direction where the mouse left the view.

#### I want Codeちゃん to look in one fixed direction

Click the settings button, click an empty spot in the companion canvas, then choose `Lock Gaze`.

#### I found another issue

Please report reproducible problems through [GitHub Issues](https://github.com/Hitsuki-Ban/guruguru-codechan/issues).

## Credits And License

Thank you to [rotejin](https://github.com/rotejin) for creating and publishing [tomari-guruguru](https://github.com/rotejin/tomari-guruguru).
That project demonstrated the 25-direction guruguru avatar method and the mouth/blink frame structure.

This project does not include Tomari-related assets.

Program code is MIT licensed.
The bundled sample asset, Codeちゃん, is a fan character designed by Hitsuki.
Codeちゃん is non-commercial only; see [ASSET_LICENSE.md](./ASSET_LICENSE.md).

User-imported assets remain owned by the user or their licensors, and are stored locally.
Please import only assets that you have the right to use.
