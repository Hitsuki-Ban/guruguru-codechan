# Guruguru Codechan

**Codeちゃんは見ている。**

Guruguru Codechan 是一个 VS Code 扩展，会在工作区里添加一个可停靠的 Codeちゃん 伙伴视图。Codeちゃん 会看着你的编辑器，眨眼，并朝向鼠标指针或编辑器光标。你也可以把它替换成自己的 guruguru 风格角色素材。

![Guruguru Codechan preview](../../extension/media/marketplace/codechan-view.png)

[English](../../README.md) | [日本語](./README.ja.md) | 简体中文

## 可以做什么

- 在 VS Code 的可停靠视图中显示 Codeちゃん。
- 在 VS Code API 允许的范围内追随视图内鼠标和编辑器光标。
- 在设置层里调整位置、缩放和视线锁定。
- 导入自己的 150 帧 guruguru 风格角色素材。
- 导入素材只保存在 VS Code 全局扩展存储中，不写入当前工作区。

## 安装

最新预览版 VSIX 可以从 [GitHub Releases](https://github.com/Hitsuki-Ban/guruguru-codechan/releases) 下载。

安装后，从命令面板执行 `Guruguru Codechan: Open Codechan View`。

## 使用自己的角色

自定义角色使用与 [rotejin/tomari-guruguru](https://github.com/rotejin/tomari-guruguru) 相同的基本帧结构。制作 25 方向 guruguru 风格素材时，请优先参考该项目。

生成并切片后，准备一个包含以下 150 帧的文件夹：

```text
A/r0c0.webp ... A/r4c4.webp
B/r0c0.webp ... B/r4c4.webp
C/r0c0.webp ... C/r4c4.webp
D/r0c0.webp ... D/r4c4.webp
E/r0c0.webp ... E/r4c4.webp
F/r0c0.webp ... F/r4c4.webp
```

也支持 PNG，但同一个角色内不能混用 PNG 和 WebP。

导入方法：

1. 打开 Codeちゃん 视图。
2. 点击视图标题栏里的设置按钮。
3. 点击导入按钮。
4. 选择包含 `A` 到 `F` 文件夹的素材目录。
5. 输入角色名称。

扩展会检查帧命名，拒绝缺帧或混合格式的素材。长边超过 512px 的图片会在保存到扩展存储前缩小到 512px。原始素材文件夹不会被修改。

## 为 VS Code 做了哪些调整

这个扩展参考了浏览器头像的做法，但为了在 VS Code 中日常使用做了调整：

- 从浏览器页面改为 VS Code Webview view。
- 可以停靠在编辑器、终端或其他面板旁边。
- 角色切换和素材导入通过 VS Code UI 操作。
- 视线追踪使用公开 VS Code API 能提供的鼠标和编辑器选择信息。
- 运行时只显示当前帧；导入大图时会规范化到 512px，减少资源占用。

VS Code 不向扩展暴露全局鼠标坐标，也不提供所有工作区面板的精确位置。因此它不是操作系统级桌宠，而是在 VS Code 视图系统中运行的工作伙伴。

## 致谢

感谢 [rotejin](https://github.com/rotejin) 创建并公开 [tomari-guruguru](https://github.com/rotejin/tomari-guruguru)。该项目展示了 25 方向 guruguru 头像方法，以及口型和眨眼帧结构。

本项目不包含原始 Tomari 素材。随扩展提供的 Codeちゃん 样本素材是单独准备的非商用样本素材。

## 许可证和素材权利

程序代码使用 MIT 许可证。内置样本素材仅允许非商用使用，详见 [ASSET_LICENSE.md](../../extension/ASSET_LICENSE.md)。

用户导入的素材权利归用户或授权方所有。请只导入自己有权使用的素材。
