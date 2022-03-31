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
 * basjoo.js によるサンプルプレーヤ
 *
 * @module Sample Dash Player（basjoo.js によるサンプルプレーヤ）
 */

/**
 * playerController
 */
var playerController = (function() {
  function playerController( _pView, video_id, _setupParams ) {
    var pCtrl = this;
    var keyRepeatInterval = 500; //msec

    pCtrl.params = {};			//url parameters
    pCtrl.video  = null; 		//Video Object
    pCtrl.player = null; 		//DashTVPlayer as Model
    pCtrl.pView = _pView; 		//as View
    pCtrl.setupParams = _setupParams; 	//setupParams

    /**
     * Log Functions
     */
    pCtrl.logOFF = false;

    /**
     * Player Menu Functions
     */
    pCtrl.play_flag = true;
    pCtrl.log_menu_disp = true;

    pCtrl.logHandler = DashTVPlayer.LogHandler;
    pCtrl.NXDebug = DashTVPlayer.Debug;

    pCtrl.opt_menu_disp = false;

    pCtrl.seekTargetTime = -1;
    pCtrl.seekTargetPeriodIdx = -1;
    pCtrl.tmpval = 0;
    pCtrl.seekCtrlVal = 0;
    pCtrl.seekCtrlTimer = null;
    pCtrl.seekDelayTimer = null;
    pCtrl.keyDownTime = 0;
    pCtrl.keyUpTime = 0;

    pCtrl.totalNextPeriod = 0;
    pCtrl.totalPrevPeriod = 0;
    pCtrl.cueingNextTimer = null;
    pCtrl.cueingPrevTimer = null;

    /**
     *  Parse Params
     */
    pCtrl.parse_params = function() {
      if (1 < window.location.search.length) {
        var query = window.location.search.substring(1);
        var parameters = query.split('&');

        for (var i = 0; i < parameters.length; i++) {
          var element = parameters[i].split('=');
          var paramName = decodeURIComponent(element[0]);
          var paramValue = decodeURIComponent(element[1]);
//console.log(paramName + ' ' + paramValue)
          this.params[paramName] = paramValue;
        }
      }
    }

    /**
     * setNXDebugMode
     */
    pCtrl.setNXDebugMode = function(logmode) {
      if (logmode == true) {
        pCtrl.player.setDebugMode({
          log: true,
          debug: true,
          info: true,
          warn: true,
          error: true,
        });
        pCtrl.logOFF = false;
        pCtrl.logHandler.log('NXDebug Mode: ON', '#ff0000');
      } else {
        pCtrl.player.setDebugMode({
          log: false,
          debug: false,
          info: false,
          warn: false,
          error: false,
        });
        pCtrl.logOFF = true;
        pCtrl.logHandler.log('NXDebug Mode: OFF', '#ff0000');
      }
    }

    /**
     * log_menu_onoff
     */
    pCtrl.log_menu_onoff = function(hc_logo, log_only) {
      if (pCtrl.log_menu_disp) {
        pCtrl.pView.log_menu_hide(hc_logo, log_only);
        pCtrl.log_menu_disp = false;
      } else {
        pCtrl.pView.log_menu_show(hc_logo, log_only, pCtrl.opt_menu_disp);
        pCtrl.log_menu_disp = true;
      }
    }

    /**
     * opt_menu_onoff
     */
    pCtrl.opt_menu_onoff = function() {
      pCtrl.opt_menu_disp = !pCtrl.opt_menu_disp;
      pCtrl.pView.opt_menu_disp( pCtrl.opt_menu_disp );
    }

    /**
     * ABR_ON( abr on/off )
     */
    pCtrl.ABR_ON = function( abr_on ) {
      pCtrl.player.setAutoSwitchQuality(abr_on);
      pCtrl.pView.abr_on( abr_on );
    }

    /**
     * VideoAudio_Down(Up)
     */
    pCtrl.VideoAudio_Down = function( type, isDown ) {
      var newQuality = pCtrl.player.getQualityFor(type);

      if( isDown ) {
        newQuality = newQuality - 1;
        if (newQuality < 0) {
          newQuality = 0;
        }
      }
      else {
        var max = pCtrl.player.getMaxQualityIndexFor(type);
        newQuality = newQuality + 1;
        if (newQuality > max) {
          newQuality = max;
        }
      }

      pCtrl.logHandler.log('VideoAudio_DownUp ' + type + ' Q=' + newQuality);
      pCtrl.player.setQualityFor(type, newQuality);
    }

    /**
     *  Play_pause
     */
    pCtrl.Play_pause = function(evt) {
      if (pCtrl.play_flag) {
        pCtrl.video.pause();
        pCtrl.play_flag = false;
        pCtrl.pView.set_pause_mode();	//<<== $('#pause_play').addClass('pause_mode');
        //    $('#pause_play img').attr( "src", "img/operation_play2.png") ;
        //    $('#pause_play img').attr( "src", "img/play_ON.png") ;
        //    logHandler.log("*** Play_Pause *** " );
      } else {
        pCtrl.video.play();
        pCtrl.play_flag = true;
        pCtrl.pView.unset_pause_mode();	//<<== $('#pause_play').removeClass('pause_mode');
        //    $('#pause_play img').attr( "src", "img/operation_pause.png") ;
        //    logHandler.log("*** Play_Play *** " );
      }
    };

    /**
     *  Play_stop
     */
    pCtrl.Play_stop = function(evt) {
      var ptag = document.getElementById('player');
      var timeoutId = setTimeout(function () {
          pCtrl.video = null;
          history.back();
      }, 3000);

      var checkVideoTag = function () {
        clearTimeout(timeoutId);
        ptag.removeChild(pCtrl.video);
        history.back();
      };

      pCtrl.video.addEventListener('emptied', function () {
        checkVideoTag();
      });

      pCtrl.player.reset();
    };


    /**
     *  needToSkipInhibition
     */
    //CMピリオドの場合はスキップを禁止する
    //assetIdに"inserted"が含まれていたらCMとみなす
    pCtrl.needToSkipInhibition = function () {
      var curPeriodIdx, assetId;

      curPeriodIdx = pCtrl.player.getCurrentPlayingPeriodIdx();
      assetId = pCtrl.player.getPeriodInfoForIdx(curPeriodIdx).assetId;
      if (!!assetId && assetId.indexOf('inserted') > -1) {
        pCtrl.logHandler.log('スキップ禁止');
        return true;
      } else {
        return false;
      }
    }


    /**
     *  periodEndedListener
     */
    pCtrl.periodEndedListener = function(evt) {
//      var video = document.getElementById('videoplayer');
      //終わったピリオドのidを返す。
      var periods = pCtrl.player.getPeriodInfo();
      var nextPeriodIdx = evt.data + 1;

      if (nextPeriodIdx < pCtrl.seekTargetPeriodIdx) {
        if ( !!periods[nextPeriodIdx].assetId && periods[nextPeriodIdx].assetId.indexOf('inserted') > -1 ) {
          //そのまま継続
        } else {
        }
      } else if (nextPeriodIdx === pCtrl.seekTargetPeriodIdx) {
        pCtrl.logHandler.log('---seekTo:' + pCtrl.seekTargetTime);
        if (!pCtrl.video.paused) {
          pCtrl.player.setPause();
        }
        pCtrl.video.currentTime = pCtrl.seekTargetTime;
//        player.removeEventListener('periodEnded', periodEndedListener);
        pCtrl.player.removeEventListener('periodEnded', pCtrl.periodEndedListener);
      }
    }

    /**
     *  downKey_forward_backward_sub
     */
    pCtrl.keyUp_forward_backward_sub = function(id, val) {
      var periods = pCtrl.player.getPeriodInfo();
      var liveEdgeS = periods[0].mpd.liveEdgeS;
      var liveEdgeE = periods[0].mpd.liveEdgeE;

      pCtrl.logHandler.log( '*** Seek-1 *** : ' + (pCtrl.video.currentTime + pCtrl.tmpval) + ' : ' + pCtrl.tmpval + ', ' + (pCtrl.keyUpTime - pCtrl.keyDownTime) );
      if (pCtrl.video.currentTime + pCtrl.tmpval > liveEdgeE) {
        pCtrl.NXDebug.info(' **** seek liveEdgeE ****' + liveEdgeE);
        pCtrl.video.currentTime = liveEdgeE;
      } else if (pCtrl.video.currentTime + pCtrl.tmpval < liveEdgeS) {
        pCtrl.NXDebug.info(' **** seek liveEdgeS ****' + liveEdgeS);
        pCtrl.video.currentTime = liveEdgeS;
      } else {
        if (pCtrl.tmpval < 0) {
          pCtrl.NXDebug.info(' **** seek ****' + (pCtrl.video.currentTime + pCtrl.tmpval));
          pCtrl.logHandler.log(' **** seek ****' + (pCtrl.video.currentTime + pCtrl.tmpval));

          if (pCtrl.player.getMediaSourceReadyState() == 'open') {
            if (pCtrl.video.currentTime + pCtrl.tmpval > 0) {
              pCtrl.video.currentTime += pCtrl.tmpval;
            } else {
              pCtrl.video.currentTime = 0.2;
            }
          } else {
            var m = pCtrl.player.getCurrentManifestData();
            pCtrl.player.attachSource(
              { type: 'data', source: m, params: pCtrl.setupParams },
              pCtrl.video.currentTime + pCtrl.tmpval
            );
            //シーク時にソースをattachしなおすパターン
          }
        } else {
//          var periods = pCtrl.player.getPeriodInfo();
          var curPeriodIdx = pCtrl.player.getCurrentPlayingPeriodIdx();
          var nextInsertedPeriodIdx = -1;
          pCtrl.seekTargetTime = pCtrl.video.currentTime + pCtrl.tmpval;
          if (pCtrl.seekTargetTime > pCtrl.video.duration - 10) {
            pCtrl.seekTargetTime = pCtrl.video.duration - 10;
          }

          pCtrl.seekTargetPeriodIdx = -1;

          for (var i = curPeriodIdx; i < periods.length; i++) {
            if ( periods[i].start <= pCtrl.seekTargetTime && periods[i].end > pCtrl.seekTargetTime ) {
              pCtrl.seekTargetPeriodIdx = i;
              break;
            }
          }
          if (pCtrl.seekTargetPeriodIdx == -1) {
            pCtrl.seekTargetTime = periods[periods.length - 1].end - 10;
            pCtrl.seekTargetPeriodIdx = periods.length - 1;
          }
          for (var i = curPeriodIdx; i < pCtrl.seekTargetPeriodIdx; i++) {
            if ( !!periods[i].assetId && periods[i].assetId.indexOf('inserted') > -1 ) {
              if (nextInsertedPeriodIdx == -1) {
                nextInsertedPeriodIdx = i;
              }
            } else {
              nextInsertedPeriodIdx = -1;
            }
          }
          if (nextInsertedPeriodIdx !== -1) {
            //CMをまたいでスキップしようとしたときはCMの頭に飛ばす
            pCtrl.logHandler.log('seekTo:' + pCtrl.seekTargetTime + ' after CM period');
            pCtrl.player.setCueingPeriodIdx(nextInsertedPeriodIdx);

            //CMを見終わった後に所望の位置に飛ばす
            pCtrl.player.addEventListener('periodEnded', pCtrl.periodEndedListener);
          } else if ( !!periods[pCtrl.seekTargetPeriodIdx].assetId && periods[pCtrl.seekTargetPeriodIdx].assetId.indexOf('inserted') > -1 ) {
            pCtrl.logHandler.log('seekTo: start CM period');
            pCtrl.player.setCueingPeriodIdx(pCtrl.seekTargetPeriodIdx);

            //CMを見終わった後に所望の位置に飛ばす
            //player.addEventListener("periodEnded", periodEndedListener);
          } else {
            if (pCtrl.video.currentTime + pCtrl.tmpval > 0) {
              //video.currentTime+=tmpval;
              pCtrl.video.currentTime = pCtrl.seekTargetTime;
            } else {
              pCtrl.video.currentTime = 0.2;
            }
          }
        }
      }
      pCtrl.seekDelayTimer = null;
    }



    /**
     *  downKey_forward_backward
     */
    pCtrl.keyDown_forward_backward = function(id, val) {
      if (pCtrl.seekCtrlTimer || pCtrl.seekDelayTimer) return;
      if (val > 0) {
        if (pCtrl.needToSkipInhibition()) return;
      }

      pCtrl.keyDownTime = new Date().getTime();
      if (!pCtrl.video.paused) {
        pCtrl.player.setPause();
      }
      if (pCtrl.seekCtrlVal === 0) {
        pCtrl.seekCtrlVal = val;
      }

//      $('#' + id).append( '<div class="' + id + '-tooltips">' + pCtrl.seekCtrlVal + '</div>' );
      pCtrl.pView.showForwardBackwardTime(id, pCtrl.seekCtrlVal);

      pCtrl.seekCtrlTimer = setInterval(function () {
        //      pCtrl.logHandler.log("*** Seek-b *** : " + seekCtrlVal);
        pCtrl.seekCtrlVal += val;
        //      pCtrl.logHandler.log("*** Seek-a *** : " + seekCtrlVal);
//        $('#' + id).find('.' + id + '-tooltips').text(pCtrl.seekCtrlVal);
        pCtrl.pView.updateForwardBackwardTime( id, pCtrl.seekCtrlVal );
      }, keyRepeatInterval);
    }


    /**
     *  keyUp_forward_backward
     */
    pCtrl.keyUp_forward_backward = function(id, val) {
      if (!pCtrl.seekCtrlTimer || pCtrl.seekDelayTimer) return;

      pCtrl.keyUpTime = new Date().getTime();
      pCtrl.tmpval = pCtrl.seekCtrlVal;
      pCtrl.seekCtrlVal = 0;
      clearInterval(pCtrl.seekCtrlTimer);
      pCtrl.seekCtrlTimer = null;

//      $('#' + id).find('.' + id + '-tooltips').remove();
      pCtrl.pView.hideForwardBackwardTime( id );

      if (pCtrl.keyUpTime - pCtrl.keyDownTime < keyRepeatInterval) {
        pCtrl.seekDelayTimer = setTimeout(function () {
          pCtrl.keyUp_forward_backward_sub(id, val);
        }, keyRepeatInterval);
      }
      else {
        pCtrl.keyUp_forward_backward_sub(id, val);
      }
    }


    /**
     *  Cueing_PrevPeriod
     */
    pCtrl.Cueing_PrevPeriod = function() {
      if (pCtrl.player.getIsDynamic() === true) {
        var periods = player.getPeriodInfo();
        var curPeriodIdx = player.getCurrentPlayingPeriodIdx();
        var liveEdgeS = periods[curPeriodIdx].mpd.liveEdgeS + 0.2;

        pCtrl.logHandler.log('SEEK TO:' + liveEdgeS);
        pCtrl.NXDebug.log('SEEK TO:' + liveEdgeS);
        if (!isNaN(liveEdgeS)) {
          if (!pCtrl.video.paused) {
            pCtrl.player.setPause();
            pCtrl.video.currentTime = liveEdgeS;
          }
        } else {
          pCtrl.logHandler.log('MPD更新中' + liveEdgeS);
        }
        return;
      }

      if (!pCtrl.video.paused) {
        pCtrl.player.setPause();
      } else {
      }

      pCtrl.totalPrevPeriod++;

      if (pCtrl.cueingPrevTimer) {
        clearTimeout(pCtrl.cueingPrevTimer);
        pCtrl.cueingPrevTimer = null;
      }

      var curPeriodIdx = 0;
      var targetPeriodIdx = 0;

      pCtrl.cueingPrevTimer = setTimeout(function () {
        curPeriodIdx = pCtrl.player.getCurrentPlayingPeriodIdx();
        targetPeriodIdx = curPeriodIdx - (pCtrl.totalPrevPeriod - 1);
        pCtrl.logHandler.log('cur:' + curPeriodIdx + ', cnt:' + pCtrl.totalPrevPeriod + ', tag:' + targetPeriodIdx );
        pCtrl.totalPrevPeriod = 0;
        pCtrl.cueingPrevTimer = null;

        if (pCtrl.player.getMediaSourceReadyState() == 'open') {
          pCtrl.player.setCueingPeriodIdx(targetPeriodIdx > 0 ? targetPeriodIdx : 0);
        } else {
          var periods = pCtrl.player.getPeriodInfo();
          var st = (targetPeriodIdx > 0 ? periods[targetPeriodIdx].start : 0) + 0.2;
          var m = pCtrl.player.getCurrentManifestData();

          pCtrl.player.attachSource({ type: 'data', source: m, params: pCtrl.setupParams }, st);
          //シーク時にソースをattachしなおすパターン
        }
      }, 500);
    }


    /**
     *  Cueing_NextPeriod
     */
    pCtrl.Cueing_NextPeriod = function() {
      var curPeriodIdx = 0;
      var targetPeriodIdx = 0;
      var periods = [];

      if (pCtrl.player.getIsDynamic() === true) {
        var periods = pCtrl.player.getPeriodInfo();
        var curPeriodIdx = player.getCurrentPlayingPeriodIdx();
        var target;

        if (curPeriodIdx == periods.length - 1) {
          target = periods[curPeriodIdx].mpd.liveEdgeE;
        } else {
          target = periods[curPeriodIdx + 1].start + 0.2;
        }
        if (!isNaN(target)) {
          if (Math.abs(target - pCtrl.video.currentTime) < 1) {
            pCtrl.NXDebug.info('liveEdge::: cur=' + pCtrl.video.currentTime + ', liveEdgeE=' + target );
          } else if (!pCtrl.video.paused) {
            //player.setPause();
            pCtrl.NXDebug.info( 'liveEdge::: cur=' + pCtrl.video.currentTime + ', liveEdgeE=' + target );
            pCtrl.video.currentTime = target;
          }
        } else {
          pCtrl.logHandler.log('MPD更新中');
        }
        return;
      }
      if (pCtrl.needToSkipInhibition()) return;

      if (!pCtrl.video.paused) {
        //player.setPause();
      } else {
      }

      pCtrl.totalNextPeriod++;

      if (pCtrl.cueingNextTimer) {
        clearTimeout(pCtrl.cueingNextTimer);
        pCtrl.cueingNextTimer = null;
      }

      pCtrl.cueingNextTimer = setTimeout(function () {
        curPeriodIdx = pCtrl.player.getCurrentPlayingPeriodIdx();
        targetPeriodIdx = curPeriodIdx + pCtrl.totalNextPeriod;
        periods = pCtrl.player.getPeriodInfo();
        pCtrl.totalNextPeriod = 0;
        pCtrl.cueingNextTimer = null;
        pCtrl.player.setCueingPeriodIdx( targetPeriodIdx < periods.length ? targetPeriodIdx : periods.length - 1 );
      }, 500);
    }

    pCtrl.getPlayer = function() {
      return pCtrl.player;
    }

    /**
     * initialize
     */
    pCtrl.init = function() {
      pCtrl.parse_params();
      pCtrl.video = document.getElementById( video_id );
      pCtrl.player = new DashTVPlayer( pCtrl.video );

      pCtrl.pView.set_Play_pause( pCtrl.Play_pause ) ;
      pCtrl.pView.set_Play_stop( pCtrl.Play_stop ) ;

      pCtrl.pView.set_Forward_Backward( 'playfwd_30',  function(){ pCtrl.keyDown_forward_backward('playfwd_30', 30); },   function(){ pCtrl.keyUp_forward_backward('playfwd_30', 30); } ) ;
      pCtrl.pView.set_Forward_Backward( 'playfwd_3',   function(){ pCtrl.keyDown_forward_backward('playfwd_3', 3); },     function(){ pCtrl.keyUp_forward_backward('playfwd_3', 3); } ) ;
      pCtrl.pView.set_Forward_Backward( 'playback_3',  function(){ pCtrl.keyDown_forward_backward('playback_3', -3); },   function(){ pCtrl.keyUp_forward_backward('playback_3', -3); } ) ;
      pCtrl.pView.set_Forward_Backward( 'playback_30', function(){ pCtrl.keyDown_forward_backward('playback_30', -30); }, function(){ pCtrl.keyUp_forward_backward('playback_30', -30); } ) ;

      pCtrl.pView.set_PrevPeriod( pCtrl.Cueing_PrevPeriod ) ;
      pCtrl.pView.set_NextPeriod( pCtrl.Cueing_NextPeriod ) ;

      pCtrl.pView.set_optMenu( pCtrl.opt_menu_onoff ) ;

      pCtrl.pView.set_ABR_ON( function() { pCtrl.ABR_ON(true); } );
      pCtrl.pView.set_ABR_OFF( function() { pCtrl.ABR_ON(false); } );

      pCtrl.pView.set_Video_Down( function() { pCtrl.VideoAudio_Down('video', true); } );
      pCtrl.pView.set_Video_Up( function() { pCtrl.VideoAudio_Down('video', false); } );
      pCtrl.pView.set_Audio_Down( function() { pCtrl.VideoAudio_Down('audio', true); } );
      pCtrl.pView.set_Audio_Up( function() { pCtrl.VideoAudio_Down('audio', false); } );

      pCtrl.pView.set_color_buttons([
        function() { pCtrl.log_menu_onoff(true, false); },
        function() { pCtrl.log_menu_onoff(false, true); },
        null,
        function() { pCtrl.setNXDebugMode(pCtrl.logOFF); }
      ]) ;
    };
  }

  return playerController;
})();

