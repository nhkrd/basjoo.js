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
 * Overwrite LogHandler Functions
 */

/**
 * 日付
 */
function cnv_hhmmss(t) {
  var t_str = '--:--';

  if (t == Infinity) return 'N/A';
  if (t) {
    t_ss = parseInt(t);
    t_sub = parseInt((t - t_ss) * 100.0);

    t_hh = parseInt(t_ss / (60 * 60));
    t_mm = parseInt((t_ss - t_hh * 60 * 60) / 60);
    t_ss = t_ss - t_hh * 60 * 60 - t_mm * 60;

    t_str = '';
    t_str = 0 < t_hh ? t_hh + ':' : '';
    t_str = t_str + (t_mm < 10 ? '0' : '') + t_mm + ':';
    t_str = t_str + (t_ss < 10 ? '0' : '') + t_ss;
    //    t_str = t_str + "." + t_sub + ((t_sub<10)? "0":"") ;
    //    t_str = t_hh + ":" + t_mm + ":" + t_ss + "." + t_sub ;
  }

  return t_str;
}


/**
 * Functions
 */
(function () {
  var d_log = document.getElementById('log');
  var alog_box = document.getElementById('alog');
  var vlog_box = document.getElementById('vlog');
  var dlog_box = document.getElementById('dlog');
  var appendVlog_box = document.getElementById('appendVlog');
  var appendAlog_box = document.getElementById('appendAlog');
  var appendVlogQ_box = document.getElementById('appendVlogQ');
  var appendAlogQ_box = document.getElementById('appendAlogQ');

  if (dlog_box.innerText == undefined) {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      get: function () {
        return this.textContent;
      },
      set: function (v) {
        return (this.textContent = v);
      },
    });
  }

  DashTVPlayer.LogHandler.log = function (str, color) {
    var d_logAll = d_log.querySelectorAll('.logstr');
    while( 30 <= d_logAll.length ) {
      d_log.removeChild(d_logAll[d_logAll.length-1]);
      d_logAll = d_log.querySelectorAll('.logstr');
    }
    var logstr = document.createElement('p');
    logstr.classList.add( 'logstr' );
    if (!!color) {
      var cssAttr = 'color: ' + color + ';' ;
      logstr.setAttribute("style", cssAttr);
    }
    logstr.textContent = str;
    d_log.insertBefore(logstr, d_log.firstChild);
  };


  DashTVPlayer.LogHandler.log_A = function () {
    var vals = [];
    for (var i = 0; i < arguments.length; i++) {
      var v = '' + arguments[i];
      if (v.slice(0, 4) == '[obj') continue;
      vals.push(v);
    }
    var msg = vals.join(', ');
    if (alog_box) alog_box.innerText = msg;
  };

  DashTVPlayer.LogHandler.log_V = function () {
    var vals = [];
    for (var i = 0; i < arguments.length; i++) {
      var v = '' + arguments[i];
      if (v.slice(0, 4) == '[obj') continue;
      vals.push(v);
    }
    var msg = vals.join(', ');
    if (vlog_box) vlog_box.innerText = msg;
  };

  DashTVPlayer.LogHandler.log_V2 = function () {
    var vals = [];
    for (var i = 0; i < arguments.length; i++) {
      var v = '' + arguments[i];
      if (v.slice(0, 4) == '[obj') continue;
      vals.push(v);
    }
    var msg = vals.join(', ');
    if (0 <= msg.indexOf('init')) {
      msg = '<span style="color:#f5a8be">' + msg + '</span>';
    }

    boxv = appendVlog_box.innerHTML;
    boxv_lines = boxv.split('<br>');
    if (!!boxv_lines && 5 <= boxv_lines.length) {
      boxv = boxv.substr(0, boxv.lastIndexOf('<br>', boxv.length - 2));
    }
    if (appendVlog_box) appendVlog_box.innerHTML = msg + '<br>' + boxv;
  };

  DashTVPlayer.LogHandler.log_A2 = function () {
    var vals = [];
    for (var i = 0; i < arguments.length; i++) {
      var v = '' + arguments[i];
      if (v.slice(0, 4) == '[obj') continue;
      vals.push(v);
    }
    var msg = vals.join(', ');
    if (0 <= msg.indexOf('init')) {
      msg = '<span style="color:#f5a8be">' + msg + '</span>';
    }

    boxv = appendAlog_box.innerHTML;
    boxv_lines = boxv.split('<br>');
    if (!!boxv_lines && 5 <= boxv_lines.length) {
      boxv = boxv.substr(0, boxv.lastIndexOf('<br>', boxv.length - 2));
    }
    if (appendAlog_box) appendAlog_box.innerHTML = msg + '<br>' + boxv;
  };

  DashTVPlayer.LogHandler.log_d = function () {
    var vals = [];
    for (var i = 0; i < arguments.length; i++) {
      var v = '' + arguments[i];
      if (v.slice(0, 4) == '[obj') continue;
      vals.push(v);
    }
    var msg = vals.join(', ');

    boxv = dlog_box.innerText;
    boxv_lines = boxv.split('\n');
    if (!!boxv_lines && 6 <= boxv_lines.length) {
      boxv = boxv.substr(0, boxv.lastIndexOf('\n', boxv.length - 2));
    }
    if (dlog_box) dlog_box.innerText = msg + '\n' + boxv;
  };

  DashTVPlayer.LogHandler.log_V2Q = function () {
    var vals = [];
    for (var i = 0; i < arguments.length; i++) {
      var v = '' + arguments[i];
      if (v.slice(0, 4) == '[obj') continue;
      vals.push(v);
    }
    var msg = vals.join(', ');
    if (0 <= msg.indexOf('init')) {
      msg = '<span style="color:#f5a8be">' + msg + '</span>';
    }

    boxv = appendVlogQ_box.innerHTML;
    boxv_lines = boxv.split('<br>');
    if (!!boxv_lines && 5 <= boxv_lines.length) {
      boxv = boxv.substr(0, boxv.lastIndexOf('<br>', boxv.length - 2));
    }
    if (appendVlogQ_box) appendVlogQ_box.innerHTML = msg + '<br>' + boxv;
  };

  DashTVPlayer.LogHandler.log_A2Q = function () {
    var vals = [];
    for (var i = 0; i < arguments.length; i++) {
      var v = '' + arguments[i];
      if (v.slice(0, 4) == '[obj') continue;
      vals.push(v);
    }
    var msg = vals.join(', ');
    if (0 <= msg.indexOf('init')) {
      msg = '<span style="color:#f5a8be">' + msg + '</span>';
    }

    boxv = appendAlogQ_box.innerHTML;
    boxv_lines = boxv.split('<br>');
    if (!!boxv_lines && 5 <= boxv_lines.length) {
      boxv = boxv.substr(0, boxv.lastIndexOf('<br>', boxv.length - 2));
    }
    if (appendAlogQ_box) appendAlogQ_box.innerHTML = msg + '<br>' + boxv;
  };

  DashTVPlayer.LogHandler.log_DRM = function (str, seq, color) {
    var d_logAll = d_log.querySelectorAll('.logstr');
    while( 30 <= d_logAll.length ) {
      d_log.removeChild(d_logAll[d_logAll.length-1]);
      d_logAll = d_log.querySelectorAll('.logstr');
    }

    var logstr = document.createElement('p');
    logstr.classList.add( 'logstr', 'logdrm' );

    if (seq == 0) {
      logstr.innerHTML = 'DRM |Brs-->App| ' + str;
      logstr.setAttribute("style", 'color:' + '#0000ff;');
    } else if (seq == 1) {
      logstr.innerHTML = 'DRM |Brs<--App| ' + str;
      logstr.setAttribute('style', 'color:' + '#008000;');
    } else if (seq == 2) {
      logstr.innerHTML = 'DRM |App-->Srv| ' + str;
      logstr.setAttribute('style', 'color:' + '#ff8000;');
    } else if (seq == 3) {
      logstr.innerHTML = 'DRM |App<--Srv| ' + str;
      logstr.setAttribute('style', 'color:' + '#d800d8;');
    } else if (seq == 99) {
      logstr.innerHTML = '&nbsp;&nbsp;DRM Info: ' + str;
      logstr.setAttribute('style', 'color:' + '#000000;');
    } else if (seq == -1) {
      logstr.innerHTML = 'DRM Error: ' + str;
      logstr.setAttribute('style', 'color:' + '#ff0000;');
    } else if (seq == -2) {
      logstr.innerHTML = 'DRM Warning: ' + str;
      logstr.setAttribute('style', 'color:' + '#ff0000;');
    }

    if (!!color) {
      var cssAttr = 'color: ' + color + ';' ;
      logstr.setAttribute("style", cssAttr);
    }
    d_log.insertBefore(logstr, d_log.firstChild);
  };


  DashTVPlayer.LogHandler.clearLogs = function () {
    var box;
    box = document.getElementById('vlog');
    if (box) box.value = '';

    box = document.getElementById('alog');
    if (box) box.value = '';

    box = document.getElementById('appendVlog');
    if (box) box.value = '';

    box = document.getElementById('appendAlog');
    if (box) box.value = '';

    box = document.getElementById('appendVlogQ');
    if (box) box.value = '';

    box = document.getElementById('appendAlogQ');
    if (box) box.value = '';

    d_log.innerHTML = "";
  };

  if (typeof VK_YELLOW === 'undefined') {
    var VK_YELLOW = 89;
  }



  /**
   *
   */
  DashTVPlayer.LogHandler.log_item = function (tag, value) {
    var element = document.getElementById(tag);
    if (element) element.innerHTML = value;
  };


})();
