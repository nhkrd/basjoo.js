# サンプルプレーヤーの説明

## サンプルプレーヤーの種類

| ファイル | 概要 |
| --- | --- |
| player.html | 標準的なプレーヤー |
| player_ttml.html | player.htmlにARIB-TTML形式の字幕表示機能を追加したプレーヤー |
| simple.html | 再生するだけのシンプルなプレーヤー |
| start_widhout_videoelement.html | 放送を視聴した状態で指定動画のバッファリングを開始し、再生可能になった段階で動画に切り替えるプレーヤー（ハイブリッドキャストビデオ対応受信機用） |

---

## 使用例
basjoo.jsのサンプルプレーヤー（例:player.html）にクエリでMPEG-DASH動画のMPDのURLを渡して起動する。

```
https://aaa.bbb.ccc/basjoo.js/samples/player.html?url=https://xxx.yyy.zzz/manifest.mpd
```

## player.htmlの中身（抜粋）

```
<html lang="ja">
  <body>
    <div id="player"> <!-- videoタグ -->
      <video  id="videoplayer"  width="1920"  height="1080"  ></video>
    </div>
    <div id="ctrl_bar"> <!-- 再生コントローラ -->
      <button type="button"  id="playback_period"></button>
      <button type="button"  id="playback_30"></button>
      <button type="button"  id="playback_3"></button>
      <button type="button"  id="pause_play"></button>
      <button type="button"  id="play_stop"></button>
      <button type="button"  id="playfwd_3"></button>
      <button type="button"  id="playfwd_30"></button>
      <button type="button"  id="playfwd_period"></button>
    </div>
    <script src=“../dist/basjoo.min.js"></script>  <!-- playerライブラリ -->
    <script src="js/hcinit.js"></script>
    <script src="lib/focusnavi.js"></script>
    <script src="js/player_loghandler.js"></script>
    <script src="js/player_playerview.js"></script>
    <script src="js/player_player.js"></script>
    <script src="js/player_main.js"></script>   <!-- 実装サンプル（用途に応じてカスタマイズ） -->
  </body>
</html>
```

---

## player_main.jsのカスタマイス方法


``` javascript
//player_main.jsの抜粋

var pView  = new playerView() ;
pView.init();
pCtrl = new playerController( pView, 'videoplayer', setupParams ) ;
pCtrl.init();

var src= {
           type  :  //1.再生ソースの指定（必須）
           source:  //

           params:  //2.起動パラメータの設定（オプション）

           xhrCustom:{        //3.HTTPリクエストのカスタマイズ設定（オプション）
                       seg:   //  seg: セグメントリクエストのカスタマイズ
                       drm:   //  drm: DRMライセンスリクエストのカスタマイズ
                       mpd:   //  mpd: MPDリクエストカスタマイズ
                      }
           }
};

//再生開始・終了時刻の設定（オプション）
var   start=xxx,  //再生開始時刻
      end=yyy;    // 再生終了時刻

pCtrl.player.attachSource(src, start, end); //再生開始

```

### 1. 再生ソースの指定（必須）

  以下の1.1～1.3のいずれかの方法で指定する。

#### 1.1. urlを指定

``` javascript
 var url= 'https://xxx.yyy.zzz/manifest.mpd';
 var src= {type:'url',  source: url};
```

#### 1.2. mpdデータ（xml形式）を直接指定

``` javascript
 var mpd= data;  //xml形式のMPDファイル
 var url= 'https://xxx.yyy.zzz/manifest.mpd';  //元のMPDのurl。ただし、mpd内部に'http(s)'から始まる<BaseURL>タグがある場合は指定しなくてもよい。
 var src= {type:  'xml', source: mpd, baseUrl: url};
```

#### 1.3. プレーヤーの内部データ（JSON形式）を直接指定

``` javascript
 //途中まで視聴したコンテンツを再度視聴する場合などに利用可能
 var mdata= player.getCurrentManifestData(); //プレーヤーからパース済みのMPDデータを取得
 var src= {type:  'data',  source: mdata};
```

### 2. 起動パラメータの設定（オプション）
  リクエストやバッファリングに関するパラメータを指定する。


| パラメータ名 | 説明 | デフォルト値 |
| --- | --- | --- |
| DEFAULT_MIN_BUFFER_TIME | minBufferTimeの設定値。MPD内の値と本設定値の大きい方が反映されます。| 1 |
| FORCE_DEFAULT_MBT | MPD内のminBufferTimeよりもDEFAULT_MIN_BUFFER_TIMEで指定した値を優先します。| false |
| MSE_APPEND_ENABLE_THRESHOLD | MSEバッファへのデータの追加の閾値（秒数で指定） | 5 |
| MSE_APPEND_ENABLE_THRESHOLD_V | ビデオのMSEバッファへのデータの追加の閾値（秒数で指定）。設定するとMSE_APPEND_ENABLE_THRESHOLDよりも優先します。 | |
| MSE_APPEND_ENABLE_THRESHOLD_A | オーディオのMSEバッファへのデータの追加の閾値（秒数で指定）。設定するとMSE_APPEND_ENABLE_THRESHOLDよりも優先します。 | |
| BUFFER_PREFETCH_THRESHOLD | セグメントの先読み閾値（秒数で指定）。(BUFFER_PREFETCH_THRESHOLD - MSE_APPEND_ENABLE_THRESHOLD)のセグメントはJS内のキューに格納されます。 | 15 |
| BUFFER_PREFETCH_THRESHOLD_V | ビデオセグメントの先読み閾値（秒数で指定）。設定するとBUFFER_PREFETCH_THRESHOLDよりも優先します。 | |
| BUFFER_PREFETCH_THRESHOLD_A | オーディオセグメントの先読み閾値（秒数で指定）。設定するとBUFFER_PREFETCH_THRESHOLDよりも優先します。 | |
| LOADING_REQUEST_THRESHOLD | セグメントの最大同時リクエスト数 | 2 |
| DEFAULT_MANIFEST_REFRESH_DELAY | デフォルトのマニフェストの再読み込み周期。ライブ(type=='dynamic')の時のみ有効です。 取得すべきデータがMPD内に存在しない場合は、本設定値よりも短い周期でマニフェストを取得にいく場合があります。 | 10 |
| DEFAULT_PRESENTATION_DELAY | 最新のセグメントより何秒遡ったところから再生するかを設定。ライブ(type=='dynamic')の時のみ有効です。設定するとMPD内のsuggestedPresentationDelayよりも優先します。設定しない場合はMPD内のsuggestedPresentationDelayを参照しますが、存在しない場合は20秒となります。 | |
| START_FROM_MPDTOP_FORLIVE | ライブ(type=='dynamic')の場合に、最初に取得したMPDの先頭（もっとも古い）のセグメントから再生を開始するか否かを設定する。falseの場合は、MPD内のsuggestedPresentationDelay、もしくはDEFAULT_PRESENTATION_DELAYに従って再生位置を決定します。 | false|
| SET_1STSEG_TIME_ZERO | ライブ(type=='dynamic')かつTimeline形式の場合に、最初に受信したMPDの先頭セグメントのタイムスタンプを基準とした相対時刻を再生時刻とします。 | true |
| ADJUST_TIMESTAMP_OFFSET | セグメントのタイムスタンプとMPDの値から算出される時刻との間に大きなズレがあったら、タイムスタンプのオフセットを設定してズレを補正します。（エンコーダによっては不具合が生じる場合があるかもしれません。） | true |
| MIN_SEGSIZE_FORBASE | SegmentBase形式の場合に、リクエストするセグメントサイズ（秒数）の最小値を設定します。もともとのセグメントサイズが小さすぎる場合に、この設定値よりも大きくなるように複数セグメントをまとめてリクエストします。SegmentBase形式の場合のみ有効。| |
| EXTRACT_ALL_IDR_IN_MOOF | すべてのIDRフレームをランダムアクセスポイントとして認識できるようにmoofを修正します。GOPサイズよりもmoofサイズの方が大きい場合にシークの精度が向上する場合があります。（エンコーダによっては正しく動作しない可能性があります。） | false |
| SKIP_GAP_AT_HOB | 0秒から再生を開始する際に、バッファの先頭に小さな隙間があったらスキップする。再生が始まらない場合にtrueにしてみてください。 | false |
| LISTEN_TO_CANPLAY_AFTER_SEEK |  シーク後に'canplay'イベントが上がるまでPLAYを保留します。シークから復帰しない現象が頻繁に発生する場合に試してみてください。（ブラウザによっては'canplay'が上がらないものもあるかもしれません。） | false |
| DEFAULT_ROLE_FOR_VIDEO | ビデオのAdaptationSetが複数ある場合に、デフォルトで再生するRoleを指定します。 | 'main' |
| DEFAULT_ROLE_FOR_AUDIO | オーディオのAdaptationSetが複数ある場合に、デフォルトで再生するRoleを指定します。 | 'main' |
| SUPPORTED_COLOUR_PRIMARIES |  サポートする色域のColourPrimaries値をリスト形式で指定します(1: BT.709, 9: BT.2020)。 | [1,9] |
| SUPPORTED_TRANSFER_CHARACTERISTICS | サポートするダイナミックレンジのTransferCharacteristics値をリスト形式で指定します(1: BT.709/SDR, 16: BT.2100PQ, 18: BT.2100HLG)。 | [1,16,18] |
| USE_FETCH | データ取得にfetch apiを利用します。trueにしてもfetchに対応していない場合は、従来通りxhrを利用します。 | false |
| DELETE_PAST_DASHEVENT |  発火時刻を過ぎたDashEvent(emsgボックス)をリストから削除するか否かを指定します。trueにすると、一度発火したDashEventは、後方シークしても発火されなくなります。falseとした場合は、明示的に削除してください。 | false |
| DELETE_UNNECESSARY_BOX | セグメントに予期せぬboxがあるとデコードエラーなどの再生の不具合が起こる場合があるため、セグメントから不要と思われるboxを削除します（副作用があるかもしれません。） | false |
| UNUSE_AUDIO | 音声の再生が不要な場合にtrueにします。trueにするとMPD内のオーディオのAdaptationSetを無視します。 | false |
| ULL_MODE | 少しだけ低遅延寄りに動作します。 | false |




  指定例：

``` javascript
  var params = {
                  DEFAULT_MIN_BUFFER_TIME: 2,
                  FORCE_DEFAULT_MBT: true,
                  MSE_APPEND_ENABLE_THRESHOLD: 5,
                  BUFFER_PREFETCH_THRESHOLD: 15,
                  LOADING_REQUEST_THRESHOLD: 1,
                  DEFAULT_MANIFEST_REFRESH_DELAY: 10,
                  USE_FETCH: true,
                  DELETE_PAST_DASHEVENT: true,
                  DELETE_UNNECESSARY_BOX: true,
                };
```

### 3. HTTPリクエストのカスタマイズ設定（オプション）

リクエストにクエリやオリジナルHTTPヘッダを付与してカスタマイズ

``` javascript
  var xhrCustom = {};
  xhrCustom['seg'] = {}; //セグメントリクエストのカスタマイズ
  xhrCustom['drm'] = {}; //DRMライセンスリクエストのカスタマイズ
  xhrCustom['mpd'] = {}; //MPDリクエストのカスタマイズ
```

#### 3.1. クエリのカスタマイズ

リクエストにユーザー固有の識別子を付与したい時などに使用可能。

``` javascript
  //（例）https://aaa.bbb.ccc  ⇒  https://aaa.bbb.ccc?id=aaa&test=bbb
  xhrCustom['seg']['query'] = [{ name:"id", value:"aaa"}, {name: "test", value: "bbb"}];
```

### 3.2. HTTPリクエストヘッダパラメータのカスタマイズ

    サービス固有のトークンを必要とする場合などに使用可能。

``` javascript
  //（例）HTTPリクエストヘッダに、 token: xxx を付与
  xhrCustom['seg']['header'] = [{ name:"token", value:"xxx"}];
```

### 3.3. リクエスト開始直前にカスタマイズ処理を追加

動的な設定値の変更などに使用可能。

``` javascript
  xhrCustom['seg']['onPrepare']  =  function(data){
    data.req;  //リクエストパラメーター（セグメントのURLなど）
    data.qrys; //現時点で設定されているクエリ
    data.hdrs; //現時点で設定されているHTTPヘッダパラメーター

    //クエリの追加
    data.qrys.push({name:"time", value: (new Date()).getTime()});
  }
```  

``` javascript
  //psshボックス内にDRMライセンスサーバーのURLが指定されてなかった場合に、外部から指定する例
  xhrCustom['drm']['onPrepare'] = function(data){
    data.req; //
    data.xhr; //xhrオブジェクト
    data.qrys; //リクエストに付与したクエリ
    data.hdrs; //リクエストに付与するHTTPヘッダパラメータ

    if (data.xhr.url == 'unknown'){ //ライセンスサーバーのURLの情報が得られなかった
        if(data.xhr.keysTypeString == 'com.microsoft.playready'){
            data.xhr.url='https://aaa.bbb.ccc'; //playreadyライセンスサーバーのURLを指定
        }else if (data.xhr.keysTypeString == 'com.widevine.alpha') {
            data.xhr.url='https://ddd.eee.fff'; //widevineライセンスサーバーのURLを指定
        }else {
            data.xhr.url='https://xxx.yyy.zzz';
        }
     }
  }
```

### ライセンス

サンプルプレイヤーでは以下の理由により他のOSSパッケージを含んでいます。

- RobotoCondensed-Regular.ttf (https://fonts.google.com/specimen/Roboto+Condensed, Apache License, Version 2.0)

    種々の受信機上で同じレイアウトに見えるようにするためにこのフォントを利用しています。ライセンスについては[LICENSE.txt](./fonts/LICENSE.txt)を参照ください。
