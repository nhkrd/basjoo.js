本ファイルでは Typescript 変換した basjoo.js のファイル構成や各ファイルの説明を行う。ビルド/テスト/開発 などを行う上で使用しているツールについては [ツール一覧](#ツール一覧) を参照。

# ツール一覧

## ビルドツール

- [asdf](https://github.com/asdf-vm/asdf) .. Node.js などの各種プログラミング言語や、多種多様なツールのバージョン管理ツール
- [npm](https://www.npmjs.com/) .. Node.js のパッケージ管理ツール
- [webpack](https://webpack.js.org/) .. モジュールバンドラーツール。JS やライブラリとして読み込んでいる JS を一つの JS ファイルにまとめて出力するツール。

## 開発ツール

- [ESLint](https://eslint.org/) .. JavaScript コードチェッカー
- [Prettier](https://prettier.io/) .. コード整形ツール

## 統合エディタ

[VSCode](https://azure.microsoft.com/ja-jp/products/visual-studio-code/) はデバッグ、シンタックスハイライト、コード補完など様々なサポートが含まれたソースコードエディタ。
下記設定ファイルをコピーすれば、簡単に環境設定を共有することができる。

- setting.json .. 基本的な設定。
- extension.json .. 拡張機能の設定ファイル。
- launch.json .. デバッガーの設定ファイル。

# basjoo.js ファイル構成

.  
├── .eslintignore  
├── .eslintrc.js  
├── .prettierrc.js  
├── .tool-versions  
├── .vscode  
│ 　　　 ├── extensions.json  
│ 　　　 ├── launch.json  
│ 　　　 └── settings.json  
├── README.md  
├── dist
├── env  
│ 　　　 ├── dev.env  
│ 　　　 └── prod.env  
├── jest.config.js  
├── package-lock.json  
├── package.json  
├── src  
│ 　　　 ├── index.ts  
│ 　　　 └── ts  
│ 　　 　   　　 └── dash  
│ 　　 　   　　 　 　　 └── types  
│ 　　 　   　　 　 　　 　 　　 ├── Metrics.d.ts  
│ 　　 　   　　 　 　　 　 　　 └── index.d.ts  
├── tsconfig.json  
├── typedoc.json  
├── remove_comment.js  
├── webpack.config.js  
├── webpack.dev.js  
└── webpack.prod.js

## 各ファイル説明

### .eslintignore

- ESLint のチェック対象外のファイル/ディレクトリを指定するファイル。

### .eslintrc.js

- ESLint の設定ファイル。設定パラメータについての公式リファレンス。https://eslint.org/docs/user-guide/command-line-interface#options

### .prettierrc.js

- Prettier の設定ファイル。設定パラメータについての公式リファレンス。https://prettier.io/docs/en/options.html

### .tool-versions

- asdf で使用するバージョン管理のためのファイル。プロジェクトで内で .tool-version を作成し、適宜バージョンを記述しておくと `asdf install` を実行することで足りないバージョンをインストールすることが可能。

### .vscode

- Visual Studio Code ワークスペースの設定を行うためのファイルを格納したディレクトリ。VSCode 及び .vscode 内の各ファイル説明については [統合エディタ](#統合エディタ) を参照。

### README.md

- basjoo.js の環境構築,ビルド方法について。ビルドオプションについても記載している。

### dist フォルダ

- basjoo.min.js, basjoo.all.js を格納したフォルダ。

### dev.env

- webpack.dev.js で読み込む環境変数を保管する env ファイル。現状 env ファイルの中身は空となっているが、実際の使い方に関しては [env ファイル](#envファイル) を参照。

### prod.env

- webpack.prod.js で読み込む環境変数を保管する env ファイル。

### package-lock.json

- package.json を補完する役割の JSON ファイル。パッケージの依存関係上、 package.json だけでは完璧に全パッケージの依存関係とそのバージョンを記録することができないことがあるため。

### package.json

- npm を使う上で必要となる依存関係を記した JSON ファイル。npm install を実行すれば設定したパッケージと、それに依存するパッケージを全てインストールしてくれる。

### src > index.ts

- Typescript ファイルのエントリーポイント。エントリーポイントを起点として、そのファイルで import しているモジュールを順に読み込んでいく。

### basjoo フォルダ

- Typescript 対応のソースファイル、型定義ファイル一式を格納。

### Metrics.d.ts

- MetricsModel.ts 内で定義された型の宣言ファイル。MetricsModel.ts だけで定義された型の数が多かったため、index.d.ts とは別ファイル化。

### index.d.ts

- 全 Typescript ファイルの型定義を集約した宣言ファイル。string / number など一般的な型ではなく独自に型を生成した場合に宣言ファイルに記載する。

### tsconfig.json

- Typescript ファイルの場所や Typescript コンパイラの設定ファイル。設定パラメータについての公式リファレンス。https://www.typescriptlang.org/docs/handbook/compiler-options.html

### typedoc.json

- [typedoc](https://typedoc.org/) (Typescript 版 JSDoc) を生成する際の設定ファイル。

### remove_comment.js

- replace-in-file 設定ファイル。dev 環境向けに作成した basjoo.all.js から不要なコメントを削除。

### webpack.config.js

- webpack 設定ファイル。dev / prod 環境に共通した設定。

### webpack.dev.js

- dev 環境向け webpack 設定ファイル。npm run watch / dev (デベロップビルド) を実行した際にはこの設定が使われる。

### webpack.prod.js

- prod 環境向け webpack 設定ファイル。npm run build (プロダクションビルド)を実行した際にはこの設定が使われる。

# env ファイル

.env ファイルで定義した変数は下記のようにして JS ファイルなどから呼び出すことができます。

.env ファイルの中身。HOME のような環境変数も利用可能

```env
USER=hoge
PASS=sample
CONFIG=${HOME}/${USER}/config
```

sample.js

```js
const { USER } = process.env;

console.log(USER);
// hoge
```

basjoo.js の webpack では [dotenv-webpack](https://www.npmjs.com/package/dotenv-webpack) という plugin を使用しているため、ファイル内で直接下記のように使用できます。

```js
console.log(process.env.USER);
// hoge
```
