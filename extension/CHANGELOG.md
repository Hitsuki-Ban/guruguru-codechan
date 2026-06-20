# Changelog

## 0.5.8

- Improves editor-cursor gaze stability after the pointer leaves the companion view.
- Keeps straight left/right exits on the outer animation columns and straight top/bottom exits on the outer rows.
- Improves wrapped-line cursor position estimates for long editor lines.

## 0.5.7

- Adds a Tweaks panel with tracking range, tracking speed, keyboard mouth sync, and auto blink controls.
- Improves Webview styling for VS Code light, dark, and high-contrast themes.

## 0.5.6

- Adds a settings toggle for keyboard-driven mouth sync.
- Adds an optional setting to open the Codeちゃん view automatically after VS Code startup.
- Updates release automation so patch builds stay as GitHub prerelease VSIX artifacts.

## 0.5.5

- Adds a dockable Codeちゃん companion view for VS Code.
- Supports pointer and editor-cursor gaze tracking where VS Code exposes enough information.
- Provides settings for position, scale, gaze lock, character switching, import, and deletion.
- Supports local import of 150-frame guruguru-style custom character assets.
- Bundles the non-commercial Codeちゃん sample asset set.
