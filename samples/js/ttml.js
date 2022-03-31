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

//
// TTML
//
window.addEventListener('load', function () {
  // TTML字幕取得処理
  // 字幕を使用する場合に、DashTVPlayerを渡す
  DashTVPlayer.ttml_renderer.setDashTVPlayer(pCtrl.player);

  // 字幕制御ボタン(ON/OFF, 言語切り替え)初期化
  document.getElementById('cc_control_button').style.display = 'none';
  document.getElementById('cc_lang_button').style.display = 'none';

  // 字幕パース後に字幕制御ボタン(ON/OFF, 言語切り替え)に反映
  DashTVPlayer.ttml_renderer.addParsedEvent(function () {
    console.log('#parsed');

    // コントローラーボタン制御
    var subtitleCount = DashTVPlayer.ttml_renderer.getSubtitleElementCount();
    if (subtitleCount > 0) {
      document.getElementById('cc_control_button').style.display = 'block';
      subtitle_lang_idx = 0;
      document.getElementById('cc_lang_button').style.display = 'block';
      document.getElementById('cc_lang_button').innerHTML = DashTVPlayer.ttml_renderer.getSubtitleElement(subtitle_lang_idx).getSrclang();
    } else {
      subtitle_lang_idx = -1;
    }
  });
  // TTML字幕取得処理
});

// 表示字幕のindex（-1:字幕なし,0:字幕1, 1:字幕2...)
var subtitle_lang_idx = -1;

/**
 * 字幕ボタン制御
 * @param {string} type onoff:表示非表示のトグル、lang:複数字幕（言語）切替
 */
function controlCC(type) {
  if (typeof DashTVPlayer.ttml_renderer === 'undefined') return;

  // 字幕がなければ処理しない
  var subtitleCount = DashTVPlayer.ttml_renderer.getSubtitleElementCount();
  if (subtitleCount == 0) return;

  var subtitle;
  switch (type) {
    // 表示/非表示トグル
    case 'onoff':
      var visible = DashTVPlayer.ttml_renderer.getSubtitleVisible();
      DashTVPlayer.ttml_renderer.setSubtitleVisible(!visible);
      break;
    // 言語切り替え
    case 'lang':
      subtitle_lang_idx = (subtitle_lang_idx + 1) % subtitleCount;
      document.getElementById('cc_lang_button').innerHTML = DashTVPlayer.ttml_renderer.getSubtitleElement(subtitle_lang_idx).getSrclang();

      DashTVPlayer.ttml_renderer.selectSubtitle(subtitle_lang_idx);
      break;
  }
}
