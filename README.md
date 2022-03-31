# basjoo.js

JavaScript Library for MPEG-DASH supporting IPTV Forum Japan regulation profile  
[Japanese Document](./README_JP.md)

## Overview

"basjoo.js" is a player library for the playback of MPEG-DASH Internet video.
This uses MSE (Media Source Extension) API for playback and supports DRM using EME (Encrypted Media Extensions) API, both of which are supported by HTML.

It supports the VOD (Video on Demand) technical method in the "Hybridcast Operational Guideline version 2.0" defined by the IPTV Forum, and has the following features.

- Management of video playback that absorbs bandwidth fluctuations
- Program structure operating in memory saving memory
- The function to insert video without interruption during program

"basjoo.js" can stably play high quality Internet videos such as 4K videos even in TV receivers with a small memory capacity. It is also easy to customize the viewing behavior according to the service requirements of the broadcaster, such as insert videos that match individual. In addition to television, it enables video delivery to various devices that support web browsers such as PC and smartphone.

### Reference

- [IPTVFJ STD-0013 "Hybridcast Operational Guideline"](https://www.iptvforum.jp/download/input.html)

## Environment

- [nodejs](https://nodejs.org/en/) (version 14 or later)
- [IDE VSCode](https://azure.microsoft.com/ja-jp/products/visual-studio-code/)

  See [fileOrganization.md](./fileOrganization.md).

## Quick Start for Developers

1. Install Core Dependencies

   - [install nodejs](http://nodejs.org/)

2. Checkout project repository

   ```shell
   git clone https://github.com/nhkrd/basjoo.js.git
   ```

3. Install dependencies

   ```shell
   npm install
   ```

4. Builddistribution files (all or minification)

   - Build basjoo.all.js

   ```shell
   npm run dev
   ```

   - Build basjoo.min.js

   ```shell
   npm run build
   ```

5. Using sample player

   ```HTML browser
   http://[IP Address]/basjoo.js/samples/player.html?url=[mpd_URL]
   ```

   See [sampledoc.md](./samples/sampledoc.md).

## Usage

### IDE setting

1. Install [VSCode](https://azure.microsoft.com/ja-jp/products/visual-studio-code/)
2. Start VSCode, and select "Open Workspace" from the menu
3. Select "basjoo.code-workspace"
4. Install all Extensions recommended by the workspace

### Generate API typescript doc

```shell
npm run doc
```

### Build distribution files

- Build basjoo.all.js

```shell
npm run dev
```

- Build basjoo.all.js, and delete comments(/\*\*\*\*\*\*/)

```shell
npm run dev:rm
```

### Build and watch distribution files

```shell
npm run watch
```

### Build distribution files (minification included)

```shell
npm run build
```

### Launch the sample player

```shell
Usage: npm run sample -- [options]

Options:
  -u, --url <URL>               Add MPD URL.
  -m, --mode <default | ttml >  Select sample player mode.
  -p, --port <number>           Change the port number.
  -h, --help                    display help for command

```

## License

See [LICENSE.md](./LICENSE.md) and [NOTICE.txt](./NOTICE.txt)

---

Sample player includes other oss packages due to some reasons.

- RobotoCondensed-Regular.ttf (https://fonts.google.com/specimen/Roboto+Condensed, Apache License, Version 2.0)

  Sample Player uses RobotoCondensed-Regular.ttf to make it look the same layout on the display of various TV devices. See License in [LICENSE.txt](./samples/fonts/LICENSE.txt).
