# Guruguru Codechan

**Codeちゃんは見ている。**

Guruguru Codechan は、VS Code の中にドッキング可能な Codeちゃん相棒ビューを追加する拡張機能です。
Codeちゃんはまばたきし、静かに作業を見守り、マウスが近づくと視線で追います。

作業に疲れたら、少しだけ Codeちゃんと遊んで癒やされてください。

自分で用意したぐるぐる風キャラクター素材に差し替えることもできます。

![Guruguru Codechan preview](../../extension/media/marketplace/codechan-view.png)

[English](../../README.md) | 日本語 | [简体中文](./README.zh-CN.md)

## プレビュー

### マウスとのインタラクション

![Codeちゃんがマウスポインターを追う様子](../../extension/media/marketplace/demo-pointer.gif)

### テキストカーソル追従

![Codeちゃんがエディタカーソルを追う様子](../../extension/media/marketplace/demo-editor-cursor.gif)

## できること

- VS Code のドッキング可能なビューに Codeちゃんを表示します。
- Codeちゃんがビュー内のマウスとエディタカーソルを追います。
- 設定レイヤーから位置、拡大率、視線固定を調整できます。
- 自分の 150 フレームのぐるぐる風キャラクター素材を読み込めます。

## インストール

最新のプレビュー VSIX は [GitHub Releases](https://github.com/Hitsuki-Ban/guruguru-codechan/releases) から取得できます。

インストール後、コマンドパレットから `Guruguru Codechan: Open Codechan View` を実行してください。

## 自分のキャラクターを使う

カスタムキャラクターは、[rotejin/tomari-guruguru](https://github.com/rotejin/tomari-guruguru) と同じ基本的なフレーム構造を使います。
自分の 25方向ぐるぐる風素材を作るときは、そちらの手順をよく読んで参考にしてください。

生成・スライスした素材は、次の 150 フレーム構成にします。

```text
A/r0c0.webp ... A/r4c4.webp
B/r0c0.webp ... B/r4c4.webp
C/r0c0.webp ... C/r4c4.webp
D/r0c0.webp ... D/r4c4.webp
E/r0c0.webp ... E/r4c4.webp
F/r0c0.webp ... F/r4c4.webp
```

PNG も使えますが、1つのキャラクター内では WebP と PNG を混在させないでください。

読み込み手順:

1. Codeちゃんビューを開きます。
2. ビュータイトルの設定ボタンを押します。
3. インポートボタンを押します。
4. `A` から `F` までのフォルダを含む素材フォルダを選びます。
5. キャラクター名を入力します。

拡張機能はフレーム名を検証し、欠けたフレームや形式の混在を拒否します。512px より大きいフレームは、保存時に長辺 512px に縮小されます。元の素材フォルダは変更されません。

## VS Code 向けに調整したこと

この拡張機能はブラウザアバターの方法を参考にしつつ、VS Code 内で日常的に使いやすい形へ調整しています。

- パフォーマンス最適化: 実行時は現在の1フレームだけを表示し、大きい素材は読み込み時に 512px へ縮小します。
- 入力調整: 視線追従は、公開 VS Code API で取得できるマウス情報とエディタ選択情報を使います。
- 口パク同期: 現在は入力に反応して口パクします。将来的には TTS との連携にも使える `mouthLevel` チャンネルを残しています。

VS Code はグローバルなマウス座標や、すべてのワークベンチ領域の正確な位置を拡張機能へ公開していません。
そのため、Codeちゃんは完全に正確なグローバルマウス追従はできません。

### 簡単なトラブルシューティング

#### Codeちゃんがエディタ内で正しい方向を見ない

一度マウスで Codeちゃんの視線を誘導してから、エディタに戻ってみてください。正確なワークベンチ配置が取れない場合、Codeちゃんは最後にマウスがビューから出た方向を使ってエディタの位置を推測します。

#### Codeちゃんに固定方向だけを見てほしい

設定ボタンを押し、拡張ビュー内の空白部分をクリックして、表示された `Lock Gaze` を選んでください。

#### ほかの問題を見つけた

[GitHub Issues](https://github.com/Hitsuki-Ban/guruguru-codechan/issues) から報告してください。

## 謝辞とライセンス

[rotejin](https://github.com/rotejin) さんが [tomari-guruguru](https://github.com/rotejin/tomari-guruguru) を作成・公開してくださったことに感謝します。
そのプロジェクトは、25方向のぐるぐるアバター方式と、口パク・まばたき用フレーム構造を示しています。

このプロジェクトには、Tomari 関連の素材は含まれていません。

プログラムコードは MIT ライセンスです。
付属サンプル素材の Codeちゃん は Hitsuki がデザインしたファンキャラクターです。
Codeちゃん は非商用利用のみです。詳しくは [ASSET_LICENSE.md](../../extension/ASSET_LICENSE.md) を参照してください。

ユーザーが読み込む素材の権利は、ユーザー本人またはライセンス元に帰属し、ローカルに保存されます。
利用権を確認した素材だけを読み込んでください。
