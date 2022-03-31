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
 * playerView
 */
var playerView = (function() {
  function playerView() {
    var pView = this;

    /**
     * Dom Operators
     */
    function showElementById( id ) {
      var element = document.getElementById( id );
      element.style.display = 'block';
    }
    function hideElementById( id ) {
      var element = document.getElementById( id );
      element.style.display = 'none';
    }
    function showElementsByClassName( classname ) {
      var elements = document.getElementsByClassName( classname );
      for( var i=0; i<elements.length; i++ ) {
        elements[i].style.display = 'block';
      }
    }
    function hideElementsByClassName( classname ) {
      var elements = document.getElementsByClassName( classname );
      for( var i=0; i<elements.length; i++ ) {
        elements[i].style.display = 'none';
      }
    }

    function addClassElementById( id, classname ) {
      var element = document.getElementById( id );
      element.classList.add( classname );
    }
    function removeClassElementById( id, classname ) {
      var element = document.getElementById( id );
      element.classList.remove( classname );
    }
    function removeClassElementsByClassNname( classname, rmv_classname ) {
      var elements = document.getElementsByClassName( classname );
      for( var i=0; i<elements.length; i++ ) {
        elements[i].classList.remove( rmv_classname );
      }
    }

    /**
     * Change view
     */
    pView.last_active_element = null;

    pView.set_pause_mode = function() {
      addClassElementById( 'pause_play', 'pause_mode' );
    };
    pView.unset_pause_mode = function() {
      removeClassElementById( 'pause_play', 'pause_mode' );
    };

    pView.log_menu_hide = function(hc_logo, log_only) {
      pView.lastActiveElement = document.activeElement;

      hideElementsByClassName( 'status' );
      hideElementById( 'TVSpec_ContentInfo' );
      hideElementById( 'buffer_info' );
      if (log_only == false) {
        hideElementById( 'ctrl_bar' );
        hideElementById( 'setting_bar' );
      }
    };

    pView.log_menu_show = function(hc_logo, log_only, opt_menu_disp) {
      showElementsByClassName( 'status' );
      showElementById( 'TVSpec_ContentInfo' );
      showElementById( 'buffer_info' );
      if (log_only == false) {
        showElementById( 'ctrl_bar' );
        if (opt_menu_disp) {
          showElementById( 'setting_bar' );
        }
      }

      if( document.activeElement == document.body ) {
        if( pView.lastActiveElement ) {
          pView.lastActiveElement.focus();
        }
      }
    };

    pView.opt_menu_disp = function( opt_menu_disp ) {
      if (opt_menu_disp) {
        showElementById( 'setting_bar' );
      } else {
          hideElementById( 'setting_bar' );
      }
    };

    pView.abr_on = function( abr_on ) {
      if( abr_on ) {
        addClassElementById( 'btn_abr_on', 'control_button_selected' );
        removeClassElementById( 'btn_abr_of', 'control_button_selected' );
      }
      else {
        addClassElementById( 'btn_abr_of', 'control_button_selected' );
        removeClassElementById( 'btn_abr_on', 'control_button_selected' );
      }
    };

    pView.VideoSize_Change = function( obj, w, h ) {
      var elementPlayer = document.getElementById( 'player' );
      elementPlayer.style.width = w + 'px';
      elementPlayer.style.height = h + 'px';
      elementPlayer.style.left = ((1920 - w) / 2) + 'px';
      elementPlayer.style.top = '0px';

      var elementVideoPlayer = document.getElementById( 'videoplayer' );
      elementVideoPlayer.style.width = w + 'px';
      elementVideoPlayer.style.height = h + 'px';

      removeClassElementsByClassNname( 'size_chg', 'control_button_selected' ) ;
      obj.classList.add( 'control_button_selected' );

      // SubtitleLayer
      var scale = w / 1920;
      var elements = document.getElementsByClassName( 'subtitle_layer' );
      for( var i=0; i<elements.length; i++ ) {
        var cssAttr = 'left: 0px; top: 0px; transform-origin: left top; transform: scale(' + scale + ');' ;
        elements[i].setAttribute("style", cssAttr);
      }
    };

    pView.showForwardBackwardTime = function( id, tvalue ) {
      var element = document.getElementById( id );
      var tooltip = document.createElement('div');
      tooltip.textContent = tvalue;
      tooltip.classList.add( id + '-tooltips' );
      element.appendChild(tooltip);
    };
    pView.hideForwardBackwardTime = function( id ) {
      var element = document.getElementById( id );
      var tooltips = element.getElementsByClassName(id + '-tooltips');
      for (var i = 0; i < tooltips.length; i++) {
        element.removeChild(tooltips[i]);
      }
    };
    pView.updateForwardBackwardTime = function( id, tvalue ) {
      var element = document.getElementById( id );
      var tooltips = element.getElementsByClassName(id + '-tooltips');
      for (var i = 0; i < tooltips.length; i++) {
        tooltips[0].textContent = tvalue;
      }
    };

    /**
     * set Event Handler
     */
    //set_button_handler
    pView.handlers = {};
    var set_button_handler = function( id, _keyCode, _handler_down, _handler_up ) {
      var element = document.getElementById( id );
      if( _handler_down ) {
        if( ! ((id +'keydown'+String(_keyCode)) in pView.handlers) ) {
          element.addEventListener('keydown', function (evt) {
            if (evt.keyCode == _keyCode) {
              pView.handlers[id + 'keydown'+String(_keyCode)](evt);
            }
          });
        }
        pView.handlers[id+'keydown'+String(_keyCode)] = _handler_down;
      }
      if( _handler_up ) {
        if( ! ((id +'keyup'+String(_keyCode)) in pView.handlers) ) {
          element.addEventListener('keyup', function (evt) {
            if (evt.keyCode == _keyCode) {
              pView.handlers[id + 'keyup'+String(_keyCode)](evt);
            }
          });
        }
        pView.handlers[id+'keyup'+String(_keyCode)] = _handler_up;
      }
    };

    //play, pause, stop, forward, backward, prev/next period
    pView.set_Play_pause = function( _handler ) {
      set_button_handler( 'pause_play', VK_ENTER, _handler, null );
    };
    pView.set_Play_stop = function( _handler ) {
      set_button_handler( 'play_stop', VK_ENTER, _handler, null );
    };
    pView.set_Forward_Backward = function( id, _handler_down, _handler_up ) {
      set_button_handler( id, VK_ENTER, _handler_down, _handler_up );
    };
    pView.set_PrevPeriod = function( _handler ) {
      set_button_handler( 'playback_period', VK_ENTER, _handler, null );
    };
    pView.set_NextPeriod = function( _handler ) {
      set_button_handler( 'playfwd_period', VK_ENTER, _handler, null );
    };

    pView.set_optMenu = function( _handler ) {
      set_button_handler( 'opt_detail', VK_ENTER, _handler, null );
    };

    pView.set_ABR_ON = function( _handler ) {
      set_button_handler( 'btn_abr_on', VK_ENTER, _handler, null );
    };
    pView.set_ABR_OFF = function( _handler ) {
      set_button_handler( 'btn_abr_of', VK_ENTER, _handler, null );
    };

    pView.set_Video_Down = function( _handler ) {
      set_button_handler( 'btn_video_down', VK_ENTER, _handler, null );
    };
    pView.set_Video_Up = function( _handler ) {
      set_button_handler( 'btn_video_up', VK_ENTER, _handler, null );
    };
    pView.set_Audio_Down = function( _handler ) {
      set_button_handler( 'btn_audio_down', VK_ENTER, _handler, null );
    };
    pView.set_Audio_Up = function( _handler ) {
      set_button_handler( 'btn_audio_up', VK_ENTER, _handler, null );
    };

    pView.set_size_960_540 = function( _handler ) {
      set_button_handler( 'size_chg_960_540', VK_ENTER, _handler, null );
    };
    pView.set_size_1440_810 = function( _handler ) {
      set_button_handler( 'size_chg_1440_810', VK_ENTER, _handler, null );
    };
    pView.set_size_1600_900 = function( _handler ) {
      set_button_handler( 'size_chg_1600_900', VK_ENTER, _handler, null );
    };
    pView.set_size_1920_1080 = function( _handler ) {
      set_button_handler( 'size_chg_1920_1080', VK_ENTER, _handler, null );
    };


    //Color: Blue, Red, Green, Yellow
    pView.set_color_buttons = function( _handler ) {
      window.addEventListener('keydown', function (evt) {
        if (evt.keyCode == VK_BLUE) {
          if( _handler[0] ) _handler[0](evt);
        }
        else if (evt.keyCode == VK_RED) {
          if( _handler[1] ) _handler[1](evt);
        }
        else if (evt.keyCode == VK_GREEN) {
          if( _handler[2] ) _handler[2](evt);
        }
        else if (evt.keyCode == VK_YELLOW) {
          if( _handler[3] ) _handler[3](evt);
        }
      });
    };


    /**
     * set_log_slider
     */
    pView.set_log_slider = function() {
      DashTVPlayer.LogHandler.log_slider = function (curtime_raw, durtime_raw) {
        curtime = cnv_hhmmss(curtime_raw);
        durtime = cnv_hhmmss(durtime_raw);

        var dur_time = document.getElementById('slider_dur_time');
        if (dur_time) {
          dur_time.innerHTML = durtime;
        }
        var bar_time = document.getElementById('slider_bar_time');
        if (bar_time) {
          bar_time.innerHTML = curtime;
        }

        var bar_inner = document.getElementById('slider_bar_inner');
        var bar_width = 0;
        if (!!curtime_raw && !!durtime_raw) {
          bar_width = (curtime_raw / durtime_raw) * 100.0 + '%';
        }
        bar_inner.style.width = bar_width;
      };
    };


    /**
     * initialize
     */
    pView.init = function() {
//      pView.video = document.getElementById( video_id );

      pView.set_log_slider();

      pView.set_size_960_540( function(evt) { pView.VideoSize_Change( evt.target, 960, 540 ); } );
      pView.set_size_1440_810( function(evt) { pView.VideoSize_Change( evt.target, 1440, 810 ); } );
      pView.set_size_1600_900( function(evt) { pView.VideoSize_Change( evt.target, 1600, 900 ); } );
      pView.set_size_1920_1080( function(evt) { pView.VideoSize_Change( evt.target, 1920, 1080 ); } );
    };
  }

  return playerView;
})();
