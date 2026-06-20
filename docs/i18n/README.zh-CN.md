# Guruguru Codechan

**Codeちゃんは見ている。**

Guruguru Codechan 是一个 VS Code 扩展，会在工作区里添加一个可停靠的 Codeちゃん 伙伴窗口。
Codeちゃん 会眨眼，静静看着你工作，并在鼠标接近她时用视线追随你。

在工作累了的时候陪 Codeちゃん 玩一玩治愈一下吧。

你也可以把它替换成自己的 guruguru 风格角色素材。

![Guruguru Codechan preview](../../extension/media/marketplace/codechan-view.png)

[English](../../README.md) | [日本語](./README.ja.md) | 简体中文

## 预览

### 鼠标互动

![Codeちゃん 追随鼠标指针](../../extension/media/marketplace/demo-pointer.gif)

### 文本光标追踪

![Codeちゃん 追随编辑器光标](../../extension/media/marketplace/demo-editor-cursor.gif)

## 可以做什么

- 在 VS Code 的可停靠视图中显示 Codeちゃん。
- Codeちゃん会追随视图内鼠标和编辑器光标。
- 在设置层里调整位置、缩放和视线锁定。
- 导入自己的 150 帧 guruguru 风格角色素材。

## 安装

最新预览版 VSIX 可以从 [GitHub Releases](https://github.com/Hitsuki-Ban/guruguru-codechan/releases) 下载。

安装后，从命令面板执行 `Guruguru Codechan: Open Codechan View`。

## 使用自己的角色

自定义角色使用与 [rotejin/tomari-guruguru](https://github.com/rotejin/tomari-guruguru) 相同的基本帧结构。
关于如何制作你自己的 25 方向 guruguru 风格素材，请仔细阅读并参考上述项目。

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

扩展会检查帧命名，拒绝缺帧或混合格式的素材。
长边超过 512px 的图片会在保存到扩展存储前缩小到 512px。原始素材文件夹不会被修改。

## 为 VS Code 做了哪些调整

这个扩展参考了浏览器头像的做法，但为了在 VS Code 中日常使用做了调整：

- 性能优化：运行时只显示当前帧；导入大图时会规范化到 512px，减少资源占用。
- 输入调整：视线追踪使用公开 VS Code API 能提供的鼠标和编辑器选择信息。
- 口型同步：角色口型动画目前和键盘输入联动，未来可能会加入tts支持。

VS Code 不向扩展暴露全局鼠标坐标，也不提供所有工作区面板的精确位置。
因此 Codeちゃん 无法做到准确的全局鼠标追踪。

### 简易问题指南

#### > Codeちゃん 在编辑器视图中没有追随正确的方向
- 尝试用鼠标诱导一次她的视线后再回到编辑器中，Codeちゃん 是通过你的鼠标上一次退出的方向来推测编辑器的位置的。

#### > 我想让 Codeちゃん 只看固定方向
- 点击设置按钮，然后在扩展窗口的空白画布的中点击左键，点击出现的[Lock Gaze]按钮就可以锁定 Codeちゃん 的视线。

#### > 我在使用中遇到了其他问题
- 欢迎使用 [GitHub Issues](https://github.com/Hitsuki-Ban/guruguru-codechan/issues) 报告问题。

## 致谢和许可证

感谢 [rotejin](https://github.com/rotejin) 创建并公开 [tomari-guruguru](https://github.com/rotejin/tomari-guruguru)。
该项目展示了 25 方向 guruguru 头像方法，以及口型和眨眼帧结构。

本项目不包含 Tomari 的相关素材。

程序代码使用 MIT 许可证。
随扩展提供的样本素材 Codeちゃん 是 Hitsuki 设计的同人角色。
Codeちゃん 仅允许非商业用途使用，详见 [ASSET_LICENSE.md](../../extension/ASSET_LICENSE.md)。

用户导入的素材权利归用户或授权方所有，且仅保存在本地。
请只导入自己有权使用的素材。
