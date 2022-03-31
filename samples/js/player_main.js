/*
* The copyright in this software is being made available under the BSD License, included below.
*
* Copyright (c) 2022, NHK(Japan Broadcasting Corporation).
* All rights reserved.
*
* Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
* - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
* - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* - Neither the name of the NHK nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * basjoo.jsによるサンプルプレーヤ
 *
 * @module Sample Dash Player（basjoo.jsによるサンプルプレーヤ）
 */

/**
 * Player Parameters
 */
var setupParams = {
  DEFAULT_MIN_BUFFER_TIME: 2,
  FORCE_DEFAULT_MBT: false,
  MSE_APPEND_ENABLE_THRESHOLD: 5,
  BUFFER_PREFETCH_THRESHOLD: 15,
  LOADING_REQUEST_THRESHOLD: 2,
  DEFAULT_MANIFEST_REFRESH_DELAY: 10,
  //DEFAULT_PRESENTATION_DELAY: 6,
  //ADJUST_TIMESTAMP_OFFSET : false,
  //START_FROM_MPDTOP_FORLIVE: true,
  //SET_1STSEG_TIME_ZERO: false,
  //MIN_SEGSIZE_FORBASE: 2,
  //EXTRACT_ALL_IDR_IN_MOOF: true,
  //LISTEN_TO_CANPLAY_AFTER_SEEK: true,
  USE_FETCH: true,
  DELETE_PAST_DASHEVENT: true,
  DELETE_UNNECESSARY_BOX: true,
  //UNUSE_AUDIO: true,
  BDAT_INSERT_MODE: false,
};

/**
 * Player Main Processing
 */
var pCtrl ;
var src = {};

window.addEventListener('load', function () {
  var pView  = new playerView() ;
  pView.init();
  pCtrl = new playerController( pView, 'videoplayer', setupParams ) ;
  pCtrl.init();

//console.log( pCtrl.params );

  if (pCtrl.params['url']) {

    if (!!pCtrl.params['logOFF']) {
      pCtrl.setNXDebugMode(false);
    }
    pCtrl.player.setAutoPlay(true);

    pCtrl.ABR_ON(true);		//ABR_ON();
//    pCtrl.ABR_ON(false);	//ABR_OFF();

    src['type'] = 'url';
    src['source'] = pCtrl.params['url'];

    if (window.navigator.userAgent.toLowerCase().indexOf('chrome') > 0) {
      var video = document.getElementById('videoplayer');
      video.muted = true;
      var plistener = function (evt) {
        pCtrl.player.removeEventListener('PLAY_PROMISE', plistener);
        evt.data.element.muted = false;
      };
      pCtrl.player.addEventListener('PLAY_PROMISE', plistener);
    }

    src['params'] = setupParams;

    // リクエストカスタマイズパラメータの設定 
    var custom = {};
    custom['drm'] = {};
    if(pCtrl.params['drm']) {
      custom['drm'] = JSON.parse(pCtrl.params['drm']) ;
    }

    custom['drm']['onPrepare'] = function(data) {
      data.req; //
      data.xhr; //xhrオブジェクト
      data.qrys; //リクエストに付与したクエリ
      data.hdrs; //リクエストに付与するHTTPヘッダパラメータ

      if (data.xhr.url == 'unknown'){
        pCtrl.logHandler.log("ここでライセンスサーバーのURLを指定してください。");
        if(data.xhr.keysTypeString == 'com.microsoft.playready'){
          data.xhr.url='https://...';
        }else if (data.xhr.keysTypeString == 'com.widevine.alpha') {
          data.xhr.url='https://...';
        }else {
          data.xhr.url='https://...';
        }
      }
      if((window.location.href.indexOf("https://") == 0) && 
        (data.xhr.url.indexOf("http://")  ==  0)) {
        data.xhr.url = data.xhr.url.replace("http://","https://");
      }
    }
    src['xhrCustom'] = custom;

    //4. 再生開始時刻、終了時刻を指定する
    //・t=start,end で再生開始時刻、終了時刻を設定
    if (pCtrl.params['t']) {
      var startEnd = pCtrl.params['t'].split(','),
        s = 0,
        e = NaN;
      if (startEnd.length == 1) {
        s = parseFloat(startEnd[0]);
      } else if (startEnd.length == 2) {
        s = parseFloat(startEnd[0]);
        e = parseFloat(startEnd[1]);
      }
    }

    pCtrl.player.attachSource(src, s, e);
  }

//  set_menu_focus();
//  $('#pause_play').focus();
//  $('#size_chg_1920_1080').addClass('control_button_selected');
  document.getElementById( 'pause_play' ).focus();
  document.getElementById( 'size_chg_1920_1080' ).classList.add( 'control_button_selected' );

  var fnavi = new FocusNavi();
  fnavi.init();

//console.log("main called")
});



window.addEventListener('load', function () {

// Dash Event
//任意のEventを受信したタイミングで捕捉
  pCtrl.player.addEventListener('DASHEVENT_RECEIVED', function (evt) {
    var de = evt.data.event, //受信したEvent
        list = evt.data.eventList, //deと同じschemeIdUriのEventのリスト
        index = evt.data.index, //list内のdeのインデックス
        type = evt.data.type; //イベントの種類(inband / outband)
      // 参照: MpegDashEvent in W3C MediaTimedEvent: https://w3c.github.io/me-media-timed-events/#mpeg-dash
      de.schemeIdUri; //schemeIdUri
      de.value; //eventValue
      de.id; //id
      de.presentationTime; //発火時刻
      de.duration; //継続時間
      de.messageData; //messageData（パース方法はschemeIdUriによる）

      pCtrl.logHandler.log( 'get Event[' + type + '] schemeIdUri=' + de.schemeIdUri + ', id=' + de.id + ', presentationTime=' + de.presentationTime );
    });

//捕捉したいEventのschemeIdUriをリッスン
  pCtrl.player.addEventListener("urn:xxx:yyy:zzz",function(evt){
    var video = document.getElementById('videoplayer'),
        de = evt.data.event, //発火したEvent
        list = evt.data.eventList, //deと同じschemeIdUriのEventのリスト
        index = evt.data.index; //list内のdeのインデックス

    de.value; //value
    de.id; //id
    de.presentationTime; //発火時刻
    de.duration; //継続時間
    de.messageData; //messageData（パース方法はschemeIdUriによる）

    pCtrl.logHandler.log("発火: id:"+de.id +", diff:"+(de.presentationTime - video.currentTime));
    //deの削除（DELETE_PAST_DASHEVENTがtrueの場合、一度発火しても削除しなければlistに残り続ける）
    list.splice(list.indexOf(de),1);
  });

/*
//ライブ中の時刻更新確認 
  pCtrl.player.addEventListener("liveEdgeUpdated",function(evt){
    var video = document.getElementById('videoplayer'),
        s = evt.data.liveEdgeS, //ライブ中に遡れる一番過去の時刻
        su = evt.data.liveEdgeSUpdated, //liveEdgeSの更新確認
        e = evt.data.liveEdgeE, //最新セグメントの時刻からDEFAULT_PRESENTATION_DELAYだけ遡った値
        eu = evt.data.liveEdgeEUpdated, //liveEdgeEの更新確認
        end = evt.data.liveEdge, //最新セグメントの時刻
        target = evt.data.targetLatency,
        cur = video.currentTime,
        bf = video.buffered,
        diff = 0;

    //ネットワーク状況等の影響により遅延が大きくなったら
    //映像を少し飛ばして低遅延に戻す例。
    //
    // 再生時刻のシーク値(delta)の指定
    // setCurrentTimeDelta(value, _silent)
    // value - 再生中時刻から＋/-dalta秒指定してシーク
    // _silent - シーク後のイベント処理をスキップするか否か
    //
    if(eu) {
      //diff: 再生時刻とバッファ内の最新時刻との差分
      for(var i=0;i<bf.length;i++){
        if((bf.start(i) < cur ) && (cur< bf.end(i))){
          diff = bf.end(i) - cur; 
          break;
        }
      } 
               
      if (cur !=0){
        if(diff > 2.5){
          //遅延が大きくなったので、バッファの最後から0.5秒遡ったところに戻す。
          pCtrl.logHandler.log("diff: "+diff);
          pCtrl.player.setCurrentTimeDelta((diff-0.5),true);
        }else if (diff > 1.5){
          // pCtrl.player.setCurrentTimeDelta(0.5,true);
        }
      }
    }

    if((cur !=0) &&(cur < s)){
     //再生時刻がliveEdgeSよりも小さいのでliveEdgeEに戻す
     pCtrl.player.setCurrentTime(e);
    }
         
  });
*/        

});


