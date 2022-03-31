# basjoo.js

MPEG-DASH IPTVFJ プロファイル対応 JavaScript ライブラリ  
[Japanese Document](./README.md)

## 概要

"basjoo.js"は、国際標準の動画配信技術である MPEG-DASH 方式のネット動画を、放送・通信連携サービスである「ハイブリッドキャスト」に対応したテレビ受信機で安定に再生するためのソフトウェアです。（一社）IPTV フォーラムが定めるハイブリッドキャストの運用規定 2.0 における VOD（Video on Demand）技術方式に対応するとともに、以下の特長を備えています。

- 回線速度の変動を吸収する動画再生の管理
- 省メモリーで動作するプログラム構造
- 番組途中に動画を途切れなく挿入する機能
- Web ブラウザを搭載した端末で再生可能

これにより、メモリー容量が小さいテレビ受信機でも 4K などの高品質ネット動画を安定に再生するとともに、個人のしこうに合わせたスポットの差し替えなど、放送局のサービス要件に合わせた視聴動作のカスタマイズを容易にします。また、テレビに限らず PC やスマートフォンなど、Web ブラウザを搭載した端末で共通に利用でき、さまざまな機器に向けて、動画を配信できます。

### Reference

- [IPTVFJ STD-0013 "ハイブリッドキャスト運用規定"](https://www.iptvforum.jp/download/input.html)

## 実行環境

- [nodejs](https://nodejs.org/en/) (version 14 以降)
- [統合エディタ VSCode](https://azure.microsoft.com/ja-jp/products/visual-studio-code/)

  詳細は [fileOrganization.md](./fileOrganization.md) を参照下さい。

## Quick Start for Developers

1. Install Core Dependencies

   - [install nodejs](http://nodejs.org/)

2. Git リポジトリの取得

   ```shell
   git clone https://github.com/nhkrd/basjoo.js.git
   ```

3. 依存環境のインストール

   ```shell
   npm install
   ```

4. ビルドの実行（basjoo.all.js または basjoo.min.js を生成する）

   - ソースコードの整形(ビルド前に実行)

   ```shell
   npm run fmt
   ```

   - basjoo.all.js を生成

   ```shell
   npm run dev
   ```

   - basjoo.min.js を生成

   ```shell
   npm run build
   ```

5. サンプルプレイヤーを使った動画再生

   ```HTML browser
   http://[IP Address]/basjoo.js/samples/player.html?url=[mpd_URL]
   ```

   詳細は [sampledoc.md](./samples/sampledoc.md) を参照下さい。

## Usage

### 統合エディタの設定（利用する場合のみ）

1. [VSCode](https://azure.microsoft.com/ja-jp/products/visual-studio-code/) をインストール
2. VSCode を起動して、メニューから [ワークスペースを開く] を選択
3. basjoo.code-workspace を選択
4. ワークスペースが推奨する拡張機能（Extension）をすべてインストール

### typedoc (Typescript 版 JSDoc) を生成する

```shell
npm run doc
```

### デベロップビルドを実行

- basjoo.all.js を生成する（生成後のファイルに手を加えない）

```shell
npm run dev
```

- basjoo.all.js を生成し、basjoo.all.js 内のコメント(/\*\*\*\*\*\*/)を削除する

```shell
npm run dev:rm
```

### 変更後に自動でデベロップビルドを実行

- basjoo.all.js を生成し、コード修正時に自動でビルドを実行し basjoo.all.js を更新する

```shell
npm run watch
```

### プロダクションビルドを実行する(basjoo.min.js を生成する)

```shell
npm run build
```

### サンプルプレイヤーを起動する

```shell
Usage: npm run sample -- [options]

Options:
  -u, --url <URL>               Add MPD URL.
  -m, --mode <default | ttml >  Select sample player mode.
  -p, --port <number>           Change the port number.
  -h, --help                    display help for command

```

## ライセンス

本ソフトウェアのライセンスについては[LICENSE.md](./LICENSE.md)および[NOTICE.txt](./NOTICE.txt)を参照ください。

---

なお、サンプルプレイヤーでは以下の理由により他の OSS パッケージを含みます。

- RobotoCondensed-Regular.ttf (https://fonts.google.com/specimen/Roboto+Condensed, Apache License, Version 2.0)

  種々の受信機上で同じレイアウトに見えるようにするためにこのフォントを利用している。ライセンスについては[LICENSE.txt](./samples/fonts/LICENSE.txt)を参照。
