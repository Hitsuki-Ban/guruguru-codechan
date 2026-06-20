# Guruguru Codechan

**Codeちゃんは見ている。**

Guruguru Codechan は、VS Code の中に小さな相棒ビューを追加する拡張機能です。Codeちゃんはエディタを見守り、まばたきし、ポインターやエディタのカーソル方向を見ます。自分で用意したぐるぐる風キャラクター素材に差し替えることもできます。

![Guruguru Codechan preview](../../extension/media/marketplace/codechan-view.png)

[English](../../README.md) | 日本語 | [简体中文](./README.zh-CN.md)

## できること

- VS Code のドッキング可能なビューに Codeちゃんを表示します。
- ビュー内のポインター移動と、VS Code が取得できる範囲のエディタカーソル移動を追います。
- 設定レイヤーから位置、拡大率、視線固定を調整できます。
- 自分の 150 フレームのぐるぐる風キャラクター素材を読み込めます。
- 読み込んだ素材は VS Code のグローバル拡張ストレージにだけ保存されます。

## インストール

最新のプレビュー VSIX は [GitHub Releases](https://github.com/Hitsuki-Ban/guruguru-codechan/releases) から取得できます。

インストール後、コマンドパレットから `Guruguru Codechan: Open Codechan View` を実行してください。

## 自分のキャラクターを使う

カスタムキャラクターは、[rotejin/tomari-guruguru](https://github.com/rotejin/tomari-guruguru) と同じ基本的なフレーム構造を使います。25方向のぐるぐる風素材を作るときは、まずそちらの手順を参考にしてください。

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

この拡張機能は、ブラウザアバターの方法をもとにしつつ、VS Code 内で使いやすい形に調整しています。

- ブラウザページではなく VS Code Webview view として動きます。
- エディタ、ターミナル、他のパネルの横にドッキングできます。
- キャラクター切り替えや素材インポートを VS Code の UI から扱えます。
- 視線追従は、公開 VS Code API で取得できるポインター情報とエディタ選択情報を使います。
- 表示中の1フレームだけを描画し、大きい素材は読み込み時に 512px へ縮小します。

VS Code はグローバルなマウス座標や、すべてのワークベンチ領域の正確な位置を拡張機能へ公開していません。そのため、この拡張機能は OS レベルのデスクトップマスコットではなく、VS Code のビュー内で動く相棒です。

## 謝辞

25方向のぐるぐるアバター方式と、口パク・まばたき用フレーム構造を公開してくださった [rotejin](https://github.com/rotejin) さんと [tomari-guruguru](https://github.com/rotejin/tomari-guruguru) に感謝します。

このプロジェクトには、元の Tomari 素材は含まれていません。付属の Codeちゃんサンプル素材は、別途用意した非商用サンプル素材です。

## ライセンスと素材の権利

プログラムコードは MIT ライセンスです。付属サンプル素材は非商用利用のみです。詳しくは [ASSET_LICENSE.md](../../extension/ASSET_LICENSE.md) を参照してください。

ユーザーが読み込む素材の権利は、ユーザー本人またはライセンス元に帰属します。利用権を確認した素材だけを読み込んでください。
