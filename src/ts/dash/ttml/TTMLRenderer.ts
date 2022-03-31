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

import Debug from '../core/Debug';
import LogHandler from '../core/LogHandler';
import { hasProperty } from '../core/Utils';
import { Period } from '../manifest/Period';
import { TTMLParser } from './TTMLParser';
import { DashTVPlayer } from '../DashTVPlayer';

/**
 * <br/>
 * TTML字幕提示モジュール<br/>
 *
 * @module javascript TTMLRenderer（字幕提示モジュール）
 */

// parse
const BUFFERING_TIME: number = 20000; // 20s（先20秒分の字幕までパースする）

// parser実行間隔
const PARSE_INTERVAL: number = BUFFERING_TIME - 3000;

/**
 * undefined or null 判定をする
 * @param {{}} val undefined判定をする値
 * @returns {boolean}
 */
function isUndefined(val: any): boolean {
  return typeof val === 'undefined' || val == null;
}

/**
 *
 * @param ttml
 * @constructor
 */
export class TTMLCue {
  ttml: string | Document;
  // パースした最終時間
  parsed_end_time: number;

  constructor(ttml: string | Document) {
    this.ttml = ttml;
    this.parsed_end_time = 0;
  }
}

/**
 * TTML字幕クラス
 * @param {{}} caption id,begin_time,end_time,caption(HTML)
 * @constructor
 */
export class TTMLCaptionImpl implements TTMLCaption {
  // 字幕のID
  id: Nullable<string>;
  // 字幕の提示開始時間
  begin_time: number;
  // 字幕の提示終了時間
  end_time: number;
  // 字幕（HTML）
  caption: Element;

  constructor(caption: TTMLCaption) {
    this.id = caption.id;
    this.begin_time = caption.begin_time;
    this.end_time = caption.end_time;
    this.caption = caption.caption;
  }
}

/**
 * TTML字幕リストクラス
 * @constructor
 */
export class TTMLCaptionList {
  arr_caption: Array<TTMLCaption>;

  constructor() {
    this.arr_caption = [];
  }

  /**
   * 字幕データを追加する
   * @param {TTMLCaption} ttmlCaption TTMLCaptionオブジェクト
   */
  add = (ttmlCaption: TTMLCaption): void => {
    this.arr_caption.push(ttmlCaption); //new TTMLCaption(ttmlCaption));
  };

  /**
   * 字幕データの蓄積数
   * @returns {Number}
   */
  getLength = (): number => this.arr_caption.length;

  /**
   * 蓄積された字幕から指定したindexの字幕を取得
   * @param {number} idx 取得する字幕のindex
   * @returns {TTMLCaption}
   */
  get = (idx: number): TTMLCaption => this.arr_caption[idx];

  /**
   * 指定した字幕Object(TTMLCaption)のindexを取得する<br>
   * TTMLCaptionパラメーター値のマッチングではなく、Objectのマッチングなので注意
   * @param {TTMLCaption} obj 検索対象のobject
   * @returns {number}
   */
  search = (obj: TTMLCaption): number => {
    for (let i = 0; i < this.arr_caption.length; i++) {
      if (this.arr_caption[i] == obj) return i;
    }
    return -1;
  };

  /**
   * 指定したObject(TTMLCaption)を削除する<br>
   * TTMLCaptionパラメーター値のマッチングではなく、Objectのマッチングなので注意
   * @param {TTMLCaption} obj 削除対象のオブジェクト
   * @returns {number}
   */
  remove = (obj: TTMLCaption): number => {
    for (let i = 0; i < this.arr_caption.length; i++) {
      if (this.arr_caption[i] == obj) {
        this.arr_caption.splice(i, 1);
        return i;
      }
    }
    return -1;
  };

  /**
   * 指定した時間を対象とする提示対象の字幕リストを取得する
   * @param {number} time 提示時間
   * @returns {Array}
   */
  getActiveTTMLCaptionList = (time: number): TTMLCaptionList => {
    const activeList: TTMLCaptionList = new TTMLCaptionList();

    for (const cap of this.arr_caption) {
      // begin,endがないものは対象外
      if (isUndefined(cap.begin_time) && isUndefined(cap.end_time)) continue;

      if (cap.begin_time <= time && time < cap.end_time) {
        activeList.add(cap);
      }
    }

    return activeList;
  };
}

/**
 * TTML字幕エレメントクラス（日本語、英語などの単位）
 * @param _eVideo VideoElement
 * @param _id 字幕Elementのid
 * @param _subtitle_attr 字幕の属性（src:ファイルURL, srclang:字幕の言語）
 * @constructor
 */
export class TTMLSubtitleElement {
  parentClass: TTMLRenderer;
  id: string;
  // 属性
  src: Nullable<string>;
  srclang: Nullable<string>;

  // 未パースのTTML(テキスト)
  arr_ttml_cue: Array<TTMLCue>;

  // パース済みのTTMLL
  ttml_caption_list: TTMLCaptionList;

  currentActiveList: Nullable<TTMLCaptionList>;

  kfCreateFlg: boolean;
  // TTML提示Element
  _overlay: HTMLDivElement;

  constructor(
    parentClass: TTMLRenderer,
    _eVideo: HTMLVideoElement,
    _id: string,
    _subtitle_attr: {
      src: Nullable<string>;
      srclang: Nullable<string>;
    }
  ) {
    this.parentClass = parentClass;
    this.id = _id;
    this.src = isUndefined(_subtitle_attr['src'])
      ? null
      : _subtitle_attr['src'];
    this.srclang = isUndefined(_subtitle_attr['srclang'])
      ? null
      : _subtitle_attr['srclang'];
    this.arr_ttml_cue = [];
    this.ttml_caption_list = new TTMLCaptionList();
    this.currentActiveList = null;
    this.kfCreateFlg = false;
    this._overlay = document.createElement('div');
    this._overlay.id = _id;
    this._overlay.setAttribute('class', 'subtitle_element');
    this._overlay.style.position = 'absolute';
    this._overlay.style.left = '0px';
    this._overlay.style.top = '0px';
    this._overlay.style.width = _eVideo.width + 'px';
    this._overlay.style.height = _eVideo.height + 'px';
    this._overlay.style.padding = '0px';
    this._overlay.style.overflow = 'hidden';
    _eVideo.parentNode!.insertBefore(this._overlay, _eVideo.nextSibling);
  }

  /**
   * 字幕エレメントのidを取得する
   * @returns {string}
   */
  getID = (): string => this.id;

  /**
   * パース待ちTTMLをCueに追加
   *
   * @param ttml
   */
  addTTMLCue = (ttml: string | Document): void => {
    //	arr_ttml_cue.push(new TTMLCue(ttml));
    this.arr_ttml_cue.shift();
    this.arr_ttml_cue.push(new TTMLCue(ttml));
  };

  /**
   * endTimeまでをパース
   * @param {number} startTime(ms)
   */
  parseCue = (startTime: number): void => {
    let parse_count: number = 0;
    const endTime: number = startTime + BUFFERING_TIME;
    const parse_range: TTMLRange = {
      begin_time: startTime,
      end_time: endTime,
    };
    let cue: TTMLCue;
    for (let i = 0; i < this.arr_ttml_cue.length; i++) {
      cue = this.arr_ttml_cue[i];

      // 解析開始～終了（Seekも考慮するため前回パース最終時刻は使用しない）
      parse_range.begin_time = startTime; //cue.parsed_end_time;
      parse_range.end_time = endTime;

      // parse
      const result = this.parentClass.ttmlParser.parse(
        cue.ttml,
        this.getBaseUrl(),
        parse_range
      );
      const ttmlList: TTMLCaptionList = new TTMLCaptionList();

      for (const caption of result.captions) {
        const ttmlCaption = new TTMLCaptionImpl(caption);
        ttmlList.add(ttmlCaption);
      }

      parse_count = result.captions.length;

      this.addTTMLCaptionList(ttmlList);

      // KeyFrameとFontFaceは初回だけ
      if (!this.kfCreateFlg) {
        if (result.captions.length > 0) {
          const caption_id: Nullable<string> = result.captions[0].id;
          this.kfCreateFlg = true;
          this.parentClass.createKeyFrame(
            result.keyframes,
            this.getID(),
            caption_id
          );
          this.parentClass.createFontFace(
            result.fontfaces,
            this.getID(),
            caption_id
          );
        }
      }
    }

    if (parse_count > 0) {
      // 今回のパース結果
      cue!.parsed_end_time = endTime;
    }
  };

  /**
   * 字幕エレメントのsrc(TTML取得先URL)を取得する
   * @returns {string}
   */
  getSrc = (): Nullable<string> => this.src;

  /**
   * 字幕エレメントのbaseURL（TTML取得先BaseURL）を取得する
   */
  getBaseUrl = (): string => {
    const arr_src: Array<string> = this.src!.split('/');
    if (arr_src && arr_src.length > 1) {
      let result: string = '';
      for (let i = 0; i < arr_src.length - 1; i++) {
        result += arr_src[i] + '/';
      }
      return result;
    }
    return '/';
  };

  /**
   * 字幕エレメントの言語を取得する
   * @returns {string}
   */
  getSrclang = (): Nullable<string> => this.srclang;

  /**
   * セットしたcaptionのリストをインスタンス内のcaptionListに追加する
   * @param {Array} ttmlCaptionList 字幕リストに追加する字幕の配列
   */
  addTTMLCaptionList = (ttmlCaptionList: TTMLCaptionList): void => {
    for (let i = 0; i < ttmlCaptionList.getLength(); i++) {
      const tcap: TTMLCaption = ttmlCaptionList.get(i);
      let newCaption: boolean = true;
      for (let ii = 0; ii < this.ttml_caption_list.getLength(); ii++) {
        const cap: TTMLCaption = this.ttml_caption_list.get(ii);

        if (cap.id == tcap.id) {
          newCaption = false;
          break;
        }
      }
      if (newCaption) {
        this.ttml_caption_list.add(tcap);
      }
    }
  };

  /**
   * パース済み字幕リストから指定時間の字幕を提示
   * @param {number} time 提示時間
   */
  presentationTTML = (time: number): number => {
    const activeList: TTMLCaptionList =
      this.ttml_caption_list.getActiveTTMLCaptionList(time);

    const presentList: TTMLCaptionList = new TTMLCaptionList();
    const removeList: TTMLCaptionList = new TTMLCaptionList();
    let search_idx: number;
    let i: number;

    for (i = 0; i < activeList.getLength(); i++) {
      search_idx = -1;
      // すでに提示中の場合は提示対象とはしない
      if (this.currentActiveList) {
        search_idx = this.currentActiveList.search(activeList.get(i));
      }
      if (search_idx == -1) presentList.add(activeList.get(i));
    }

    // 削除対象
    if (this.currentActiveList) {
      for (i = 0; i < this.currentActiveList.getLength(); i++) {
        if (activeList.search(this.currentActiveList.get(i)) == -1) {
          removeList.add(this.currentActiveList.get(i));
        }
      }
    }

    // 提示時に子要素を削除
    for (i = 0; i < removeList.getLength(); i++) {
      const remove_id: string = removeList.get(i).id!;
      const remove_node: Nullable<HTMLElement> =
        document.getElementById(remove_id);
      if (remove_node) {
        this._overlay.removeChild(remove_node);
      }
    }

    if (presentList.getLength() > 0) {
      let ttmlCaption: TTMLCaption;
      let htmlCaption: Element;
      for (i = 0; i < presentList.getLength(); i++) {
        ttmlCaption = presentList.get(i);
        htmlCaption = ttmlCaption.caption.cloneNode(true) as Element;
        if (document.getElementById(ttmlCaption.id!) != null) continue;
        if (htmlCaption.localName == 'div') {
          if (htmlCaption.hasAttribute('style')) {
            const htmlStyleCaption = htmlCaption as HTMLStyleElement;
            if (hasProperty(htmlStyleCaption.style, 'width')) {
              htmlStyleCaption.style.width = this._overlay.style.width;
            }
            if (hasProperty(htmlStyleCaption.style, 'height')) {
              htmlStyleCaption.style.height = this._overlay.style.height;
            }
          }
        }
        this._overlay.appendChild(htmlCaption);
      }
    }

    // audioタグがあれば再生する。
    const audio_list: HTMLCollectionOf<HTMLAudioElement> =
      this._overlay.getElementsByTagName('audio');
    for (i = 0; i < audio_list.length; i++) {
      if (audio_list[i].getAttribute('autoplay') != 'autoplay') {
        audio_list[i].setAttribute('autoplay', 'autoplay');
      }
    }

    this.currentActiveList = activeList;
    return presentList.getLength();
  };

  /**
   * 蓄積字幕数
   * @returns {number} パース済みの字幕数を返す
   */
  // getCaptionCount = (): number => this.ttml_caption_list.getLength();

  /**
   * 提示中字幕リスト取得
   * @returns {Array} 現在提示中の字幕リスト
   */
  // getCurrentActiveList = (): Nullable<TTMLCaptionList> => {
  //   return this.currentActiveList;
  // };
}

/**
 * TTML提示管理クラス
 * @constructor
 */
export class TTMLRenderer {
  NXDebug: Debug;
  _head: Nullable<HTMLHeadElement>;

  // rendererの設定
  setting: {
    presentation_timing: number;
    presentation_interval: number;
  };

  // 描画用timer
  presentationTimer: Nullable<ReturnType<typeof setTimeout>>;

  // parse用timer
  parseTimer: Nullable<ReturnType<typeof setTimeout>>;

  // 字幕リスト（日本語、英語など）
  arr_subtitle_element: Array<TTMLSubtitleElement>;

  // Parse後イベント
  parsedEvent: Array<{ (): void }>;

  // TTMLパーサー
  ttmlParser: TTMLParser;

  // 対象となるvideoのElement
  videoElement: Nullable<HTMLVideoElement>;

  // seekedイベントのリスナ
  seekedListener: Nullable<{ (): void }>;

  // 選択中字幕エレメントのindex
  select_subtitle_index: number;

  constructor() {
    this.NXDebug = new Debug();
    this._head = null;
    this.setting = {
      presentation_timing: 1,
      presentation_interval: 500,
    };
    this.presentationTimer = null;
    this.parseTimer = null;
    this.arr_subtitle_element = [];
    this.parsedEvent = [];
    this.ttmlParser = new TTMLParser();
    this.videoElement = null;
    this.seekedListener = null;
    this.select_subtitle_index = -1;
  }

  /**
   * 字幕表示/非表示切り替え
   * @param {boolean} value
   */
  setSubtitleVisible = (value: boolean): void => {
    for (let i = 0; i < this.getSubtitleElementCount(); i++) {
      if (i != this.select_subtitle_index) continue;
      const subtitle: TTMLSubtitleElement = this.getSubtitleElement(i);
      const _subtitle: Nullable<HTMLElement> = document.getElementById(
        subtitle.getID()
      );
      if (value) {
        _subtitle!.style.display = 'block';
      } else {
        _subtitle!.style.display = 'none';
      }
    }
  };

  /**
   * 字幕の表示状態を取得
   * @returns {boolean}
   */
  getSubtitleVisible = (): boolean => {
    for (let i = 0; i < this.getSubtitleElementCount(); i++) {
      const subtitle: TTMLSubtitleElement = this.getSubtitleElement(i);
      const _subtitle: Nullable<HTMLElement> = document.getElementById(
        subtitle.getID()
      );
      if (_subtitle!.style.display != 'none') {
        return true;
      }
    }
    return false;
  };

  /**
   * 字幕切り替え index=0～SubtitleElementCount()-1
   * @param index
   */
  selectSubtitle = (index: number): void => {
    this.setSubtitleVisible(false);
    for (let i = 0; i < this.getSubtitleElementCount(); i++) {
      if (index == i) {
        this.select_subtitle_index = index;
        const subtitle: TTMLSubtitleElement = this.getSubtitleElement(i);
        const _subtitle: Nullable<HTMLElement> = document.getElementById(
          subtitle.getID()
        );
        _subtitle!.style.display = 'block';
        break;
      }
    }
  };

  /**
   * パース後イベント
   * @param {Function} event
   */
  addParsedEvent = (event: { (): void }): void => {
    this.parsedEvent.push(event);
  };

  /**
   * idから字幕レイヤーを取得
   * @param {string} id 字幕Elementのid
   * @returns {TTMLSubtitleElement} TTML字幕レイヤーオブジェクト
   * @private
   */
  //  private getSubtitleElementById = (
  private getSubtitleElementById = (
    id: string
  ): Nullable<TTMLSubtitleElement> => {
    for (let i = 0; i < this.arr_subtitle_element.length; i++) {
      if (this.arr_subtitle_element[i].getID() == id) {
        return this.arr_subtitle_element[i];
      }
    }
    return null;
  };

  /**
   * 静的なttml読み込み
   * @param {string} id TrackElementのid
   * @param {string} ttml_url 静的TTMLのURL
   */
  retrieveStaticSubtitle = (id: string, ttml_url: string): void => {
    const xhr: XMLHttpRequest = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.status == 200 || xhr.status == 206) {
        this.addTTMLText(id, xhr.response);
        this.NXDebug.log('ttml-retrieve-success: ' + ttml_url);
      }
    };
    xhr.onerror = () => {
      this.NXDebug.log(
        'ttml-retrieve-failure: ' +
          xhr.status +
          ' ' +
          xhr.statusText +
          ' url:' +
          ttml_url
      );
    };
    xhr.onabort = () => {};
    xhr.open('GET', ttml_url, false);
    xhr.send();
  };

  /**
   *
   * @param periods
   * @param videoElement
   */
  parseTTMLFromMPD = (
    periods: Array<Period>,
    videoElement: HTMLVideoElement
  ): void => {
    let i: number;

    if (typeof periods === 'undefined') {
      LogHandler.log('error periods is undefined!!');
    }

    this.videoElement = videoElement;

    for (i = 0; i < periods.length; i++) {
      for (const as of periods[i].adaptationSets) {
        if (as.mimeType && as.mimeType == 'application/ttml+xml') {
          if (as.Role == 'undefined') {
            LogHandler.log('-->error adaptationSets.Role is undefined!! ');
            break;
          } else {
            if (as.Role == 'subtitle') {
              for (let k = 0; k < as.representations!.length; k++) {
                const baseURL: Nullable<string> =
                  as.representations![k].BaseURL[0].url;
                const id: string =
                  'ttml_' +
                  (as.representations![k].id || as.representations![k].index); //as.attrs.lang;
                if (!this.getSubtitleElementById(id)) {
                  this.addSubtitleElement(videoElement, id, {
                    src: baseURL,
                    srclang: (as.attrs! as { lang: string }).lang,
                  });
                }
                this.retrieveStaticSubtitle(id, baseURL!);
              }
            } else {
              this.NXDebug.log('adaptationSets.Role != subtitle >> ' + as.Role);
              break;
            }
          }
        }
      }
    }

    const subtitleCount: number = this.getSubtitleElementCount();
    // 字幕は初期表示しない（すべて非表示）
    if (subtitleCount > 0) {
      this.select_subtitle_index = 0;
      for (i = 0; i < subtitleCount; i++) {
        const subtitle: TTMLSubtitleElement = this.getSubtitleElement(i);
        document.getElementById(subtitle.getID())!.style.display = 'none';
      }
    } else {
      this.select_subtitle_index = -1;
    }

    // ParsedイベントCall
    this.callParsedEvent();
  };

  /*
   * Parsed後イベントのCall
   */
  callParsedEvent = (): void => {
    for (let i = 0; i < this.parsedEvent.length; i++) {
      this.parsedEvent[i]();
    }
  };

  /**
   * レンダラーに追加された字幕エレメント数を返す
   * @returns {Number}
   */
  getSubtitleElementCount = (): number => this.arr_subtitle_element.length;

  /**
   * indexから字幕エレメントを取得
   * @param {number} index 0～getSubtitleCountまでの字幕数
   * @returns {TTMLSubtitleElement}
   */
  getSubtitleElement = (index: number): TTMLSubtitleElement => {
    return this.arr_subtitle_element[index];
  };

  /**
   * 字幕Seek後に呼ばれる
   * @private
   */
  private videoSeeked = () => {
    this.parseTTMLElements();
  };

  /**
   * 字幕エレメントをvideoに追加する
   * @param {element} eVideo VideoのElement
   * @param {string} id 字幕のid(HTMLのDOM中で一意に指定)
   * @param {{}} subtitle_attr kind,src,srclang,label
   */
  addSubtitleElement = (
    eVideo: HTMLVideoElement,
    id: string,
    subtitle_attr: {
      src: Nullable<string>;
      srclang: Nullable<string>;
    }
  ): void => {
    if (this.seekedListener == null) {
      this.seekedListener = this.videoSeeked.bind(this);

      this.videoElement!.addEventListener('seeked', this.seekedListener);
    }

    const subtitle: TTMLSubtitleElement = new TTMLSubtitleElement(
      this,
      eVideo,
      id,
      subtitle_attr
    );
    this.arr_subtitle_element.push(subtitle);

    if (isUndefined(this.presentationTimer))
      this.presentationTimer = setInterval(
        this.presentationTTMLElements,
        this.setting.presentation_interval
      );

    if (isUndefined(this.parseTimer))
      this.parseTimer = setInterval(this.parseTTMLElements, PARSE_INTERVAL);
  };

  /**
   * TTML提示用エレメントに字幕（XML）を追加
   * @param {string} id 字幕を追加する対象となるエレメントのid
   * @param {XML} ttml_xml 字幕DOM(xml)
   */
  addTTMLText = (id: string, ttml_xml: string | Document): void => {
    const subtitle_element: Nullable<TTMLSubtitleElement> =
      this.getSubtitleElementById(id);
    if (isUndefined(subtitle_element)) {
      return;
    }

    // パース用Cueに蓄積
    subtitle_element!.addTTMLCue(ttml_xml);

    // 初回パース(このあとのparseはtimerから呼ばれる）
    this.parseTTMLElements();
  };

  /**
   * keyframesの配列からstyleを生成
   * @param {Array} keyframes keyframeのパラメーター配列
   * @param {string} subtitle_id 字幕Element(親)のID
   * @param {number} caption_id 字幕(そのもの)のID（提示字幕単位）
   * @private
   */
  createKeyFrame = (
    keyframes: Array<TTMLKeyFrame>,
    subtitle_id: string,
    caption_id: Nullable<string>
  ): void => {
    if (this._head == null) {
      this._head = document.getElementsByTagName('head')[0];
    }
    if (keyframes.length > 0) {
      const tmp_style: HTMLCollectionOf<HTMLStyleElement> =
        this._head.getElementsByTagName('style');
      if (tmp_style.length > 0) {
        if (hasProperty(tmp_style, 'getElementById')) {
          const tmp_style_one: Element = (
            tmp_style as unknown as {
              getElementById: (string) => Element;
            }
          ).getElementById('temp_keyframes_' + subtitle_id + '_' + caption_id);
          if (tmp_style_one) {
            this._head.removeChild(tmp_style_one);
          }
        }
      }

      let style_txt: string = '';

      for (const keyframe of keyframes) {
        style_txt += '@-webkit-keyframes ' + keyframe.name + '{';
        for (let j = 0; j < keyframe.positions.length; j++) {
          style_txt +=
            keyframe.positions[j].position + keyframe.positions[j].styles;
          style_txt += '\n';
        }
        style_txt += '}\n';
      }

      const _style: HTMLStyleElement = document.createElement('style');
      _style.type = 'text/css';
      _style.id = 'temp_keyframes_' + subtitle_id + '_' + caption_id;
      _style.innerHTML = style_txt;

      this._head.appendChild(_style);
    }
  };

  /**
   * 指定したfontfaceの配列から、font-faceのstyleを生成する
   * @param {Array} fontfaces 配列(font-faceパラメーターのKey->valueの配列)
   * @param {string} subtitle_id 字幕の提示するElementのID
   * @param {number} caption_id 字幕ID(提示単位)
   * @private
   */
  createFontFace = (
    fontfaces: Array<TTMLFontFace>,
    subtitle_id: string,
    caption_id: Nullable<string>
  ): void => {
    let style_txt: string = '';

    if (this._head == null) {
      this._head = document.getElementsByTagName('head')[0];
    }

    if (fontfaces.length > 0) {
      for (let i = 0; i < fontfaces.length; i++) {
        style_txt = '@font-face {';
        for (const s in fontfaces[i]) {
          if (s == 'id') continue;
          style_txt += s + ':' + fontfaces[i][s] + ';';
        }
        style_txt += '}';

        const _style: HTMLStyleElement = document.createElement('style');
        _style.type = 'text/css';
        _style.id =
          'temp_fontfaces_' +
          subtitle_id +
          '_' +
          caption_id +
          '_' +
          fontfaces[i]['id'];
        _style.innerHTML = style_txt;

        this._head.appendChild(_style);
      }
    }
  };

  /**
   * 提示時間の元になる時間を取得する（videoと同期するかどうか）
   * @return {number} 提示時刻
   */
  getCurrentTime = (): number => {
    // 受信時間
    if (this.setting.presentation_timing == 0) {
      return new Date().getTime();
    } else {
      if (this.videoElement) {
        return this.videoElement.currentTime * 1000;
      } else {
        this.NXDebug.error('videoElement is null...');
        return 0;
      }
    }
  };

  /**
   * 全字幕エレメントごとの字幕を提示
   */
  presentationTTMLElements = (): void => {
    if (this.arr_subtitle_element.length > 0) {
      const currentTime: number = this.getCurrentTime();
      for (const i in this.arr_subtitle_element) {
        this.arr_subtitle_element[i].presentationTTML(currentTime);
      }
    }
  };

  /**
   * 全字幕エレメントの字幕を解析する
   */
  parseTTMLElements = (): void => {
    if (this.arr_subtitle_element.length > 0) {
      const currentTime: number = this.getCurrentTime();
      for (let i = 0; i < this.arr_subtitle_element.length; i++) {
        this.arr_subtitle_element[i].parseCue(currentTime);
      }
    }
  };

  /**
   * DashTVPlayer
   * @param dashTvPlayer
   */
  setDashTVPlayer = (dashTvPlayer: DashTVPlayer): void => {
    // 生成されたTrackから字幕をParserへ通す
    dashTvPlayer.addEventListener(
      'manifestUpdated',
      () => {
        const periods: Array<Period> = dashTvPlayer.getPeriodInfo();
        this.parseTTMLFromMPD(
          periods,
          dashTvPlayer.getVideoModel().getElement()!
        );
      },
      false
    );
  };

  /**
   * setting指定
   * @property {number} presentation_timing 提示タイミング(0:提示環境の時間を参照, 1:videoのcurrentTimeを参照）
   * @property {number} presentation_interval ttml提示間隔(ms) 提示精度をこの値で調整
   * @param {{ttml_show_timing, TTML_SHOW_INTERVAL}} _setting
   */
  setSetting = (_setting: {
    presentation_timing: number;
    presentation_interval: number;
  }): void => {
    this.setting = _setting;
  };
}

export const ttml_renderer: TTMLRenderer = new TTMLRenderer();
