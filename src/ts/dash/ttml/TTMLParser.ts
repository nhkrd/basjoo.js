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
import { hasProperty } from '../core/Utils';

/**
 * <br/>
 * TTML字幕提示モジュール<br/>
 *
 * @module TTMLParser（字幕解析モジュール）
 */

/**
 * TTMLパーサー
 * @constructor
 */

export class TTMLParser {
  NXDebug: Debug;
  _root: HTMLCollectionOf<Element> | never[];
  _body: HTMLCollectionOf<Element> | never[];
  _head: HTMLCollectionOf<Element> | never[];
  _styling: HTMLCollectionOf<Element> | never[];
  _layout: HTMLCollectionOf<Element> | never[];
  _styles: HTMLCollectionOf<Element> | never[];
  _regions: HTMLCollectionOf<Element> | never[];
  _arib_keyframes: HTMLCollectionOf<Element> | never[];
  _arib_fontfaces: HTMLCollectionOf<Element> | never[];

  // styling>styleから[xml:id] => array([変換後styleName]=>[変換後スタイル値]);
  arr_styles: Array<TTMLStyle>;
  // layout>regionから{id:[xml:id],begin:[begin], end:[end], array([変換後styleName]=>[変換後スタイル値])}オブジェクトの配列;
  arr_regions: Array<TTMLRegion>;
  // arr_styles, arr_regionからstylesheetの元になる配列を生成
  arr_styleSheets: Array<TTMLRegion>;

  arr_keyframes: Array<TTMLKeyFrame>;
  arr_fontfaces: Array<TTMLFontFace>;

  arr_captions: Array<TTMLCaption>;

  // TTMLのbaseURL（urlの変換に使用）
  baseURL: string;

  constructor() {
    this.NXDebug = new Debug();

    this._root = [];
    this._body = [];
    this._head = [];
    this._styling = [];
    this._layout = [];
    this._styles = [];
    this._regions = [];
    this._arib_keyframes = [];
    this._arib_fontfaces = [];
    this.arr_styles = [];
    this.arr_regions = [];
    this.arr_styleSheets = [];
    this.arr_keyframes = [];
    this.arr_fontfaces = [];
    this.arr_captions = [];
    this.baseURL = '';
  }

  /**
   * @namespace NS 各名前空間の定数定義
   * @property {string} XHTML XHTML 名前空間
   * @property {string} TTML TTML 名前空間
   * @property {string} SMPTE smpte-TT名前空間
   * @property {string} ARIB ARIB-TTの名前空間
   * @type {{XHTML: string, TTML: string, SMPTE: string, ARIB: string, getTagName: Function}}
   */
  NS = {
    XHTML: 'http://www.w3.org/1999/xhtml',
    TTML: 'http://www.w3.org/ns/ttml',
    SMPTE: 'http://www.smpte-ra.org/schemas/2052-1/2013/smpte-tt',
    ARIB: 'http://www.arib.or.jp/ns/arib-tt',
    /**
     * 指定したElementの名前空間に応じたタグ名を返す
     * @param {{}} _e DOMObject
     * @returns {string} タグ名称
     */
    getTagName(_e: Element): string {
      const tag = _e.localName;
      switch (_e.namespaceURI) {
        case this.XHTML:
          return tag;
        case this.TTML:
          return 'tt:' + tag;
        case this.SMPTE:
          return 'smpte:' + tag;
        case this.ARIB:
          return 'arib-tt:' + tag;
        default:
          return '';
      }
    },
  };

  /**
   * _eに属するDOMObjectをtagNameから取得する
   * @param {{}} _e 親のDOMObj
   * @param {string} tagName タグ名
   * @returns {Array} Elementの配列
   */
  getObjFromTagName = (
    _e: HTMLCollectionOf<Element>,
    tagName: string
  ): HTMLCollectionOf<Element> => {
    return _e[0].getElementsByTagName(tagName);
  };

  /**
   * TTMLを解析して字幕、FontFace、KeyFramesを返す
   * @param {string|xml} ttml TTML字幕の文字列(or xml)
   * @param {string} baseURL ttmlを取得したurl
   * @returns {{captions: Array, fontfaces: Array, keyframes: Array}}
   */
  parse = (
    xml: string | Document,
    _baseURL: string,
    parse_range: TTMLRange
  ): TTML => {
    this.baseURL = _baseURL;

    if (typeof xml === 'string') {
      xml = this.parseXML(xml);
    }

    this._root = xml.getElementsByTagName('tt');

    this.arr_captions = [];

    if (this._root.length > 0) {
      this._head = this.getObjFromTagName(this._root, 'head');

      this._styling =
        this._head.length == 0
          ? []
          : this.getObjFromTagName(this._head, 'styling');
      this._styles =
        this._styling.length == 0
          ? []
          : this.getObjFromTagName(
              this._styling as HTMLCollectionOf<Element>,
              'style'
            );

      this._layout =
        this._head.length == 0
          ? []
          : this.getObjFromTagName(this._head, 'layout');
      this._regions =
        this._layout.length == 0
          ? []
          : this.getObjFromTagName(
              this._layout as HTMLCollectionOf<Element>,
              'region'
            );

      this._arib_keyframes =
        this._head.length == 0
          ? []
          : this.getObjFromTagName(this._head, 'keyframes');
      this._arib_fontfaces =
        this._head.length == 0
          ? []
          : this.getObjFromTagName(this._head, 'font-face');

      this._body = this.getObjFromTagName(this._root, 'body');

      try {
        // styling, region, keyframes, font-faceのパース
        this.parseStyle();

        if (this.isUndefined(parse_range)) {
          parse_range = {
            begin_time: 0,
            end_time: 36000000,
          };
        }

        // 最大値は10時間までとする
        this.listupCaptions(
          this._body[0],
          {
            begin_time: 0,
            end_time: 36000000,
          },
          parse_range
        );
      } catch (err: any) {
        const err_msg = '**ERR** ' + err.message;
        this.NXDebug.debug(err_msg);
      }
    }

    return {
      captions: this.arr_captions,
      fontfaces: this.arr_fontfaces,
      keyframes: this.arr_keyframes,
    };
  };

  /**
   * styling, region, keyframes, font-faceのパース
   */
  parseStyle = (): void => {
    let _e: Element;
    let ret: TTMLAttribute;
    let id: string;
    let i: number;
    let s: string;
    let _e_children: NodeListOf<ChildNode>;
    let _e1: ChildNode;

    // 初期化
    this.arr_regions = [];
    this.arr_styles = [];

    // style
    for (i = 0; i < this._styles.length; i++) {
      _e = this._styles[i];
      if (_e.nodeType != 3) {
        ret = this.transAttrFromElement(_e);
        if (hasProperty(ret.htmlAttrs, 'id')) {
          id = ret.htmlAttrs.id;
          // styleの参照があれば付加
          if (hasProperty(ret.htmlAttrs, 'style_ref')) {
            ret.htmlCss['style_ref'] = ret.htmlAttrs['style_ref'];
          }
          this.arr_styles[id] = ret.htmlCss;
        } else {
          this.NXDebug.log(
            'ERROR : style.id(xml:id) attribute is not found !!! '
          );
        }
      }
    }

    // region
    for (let j = 0; j < this._regions.length; j++) {
      _e = this._regions[j];
      if (_e.nodeType != 3) {
        ret = this.transAttrFromElement(_e);
        if (hasProperty(ret.htmlAttrs, 'id')) {
          id = ret.htmlAttrs.id;
          let begin: Nullable<string> = null;
          let end: Nullable<string> = null;
          // styleの参照があれば付加
          if (hasProperty(ret.htmlAttrs, 'style_ref')) {
            ret.htmlCss['style_ref'] = ret.htmlAttrs['style_ref'];
          }
          if (hasProperty(ret.htmlAttrs, 'begin')) {
            begin = ret.htmlAttrs['begin'];
          }
          if (hasProperty(ret.htmlAttrs, 'end')) {
            end = ret.htmlAttrs['end'];
          }
          this.arr_regions.push({
            id: ret.htmlAttrs.id,
            begin,
            end,
            styles: ret.htmlCss,
          });
        } else {
          this.NXDebug.error(
            'ERROR : region.id(xml:id) attribute is not found !!!'
          );
        }
      }
    }

    // arib-tt:keyframesをパース
    this.arr_keyframes = [];
    for (let k = 0; k < this._arib_keyframes.length; k++) {
      _e = this._arib_keyframes[k];

      if (_e.nodeType != 3) {
        ret = this.transAttrFromElement(_e);
        let animationName: string = '';
        if (hasProperty(ret.htmlAttrs, 'animationName')) {
          animationName = ret.htmlAttrs.animationName;
          const arr_position: Array<TTMLPosition> = [];
          _e_children = _e.childNodes;
          for (i = 0; i < _e_children.length; i++) {
            _e1 = _e_children[i];

            if (_e1.nodeType != 3) {
              ret = this.transAttrFromElement(_e1 as Element);
              if (hasProperty(ret.htmlAttrs, 'keyframeposition')) {
                const position: string = ret.htmlAttrs['keyframeposition'];
                let styles: string = '';
                for (s in ret.htmlCss) {
                  if (styles != '') styles += ';';
                  styles += s + ':' + ret.htmlCss[s];
                }
                if (styles != '') styles += ';';
                arr_position.push({
                  position,
                  styles: '{' + styles + '}',
                });
              } else {
                this.NXDebug.error(
                  'ERROR : arib-tt:keyframe.position is not found '
                );
              }
            }
          }
          this.arr_keyframes.push({
            name: animationName,
            positions: arr_position,
          });
        }
      }
    }

    // arib-tt:fontfaceをパース
    this.arr_fontfaces = [];
    for (let l = 0; l < this._arib_fontfaces.length; l++) {
      _e = this._arib_fontfaces[l];
      if (_e.nodeType != 3) {
        ret = this.transAttrFromElement(_e);
        if (hasProperty(ret.htmlAttrs, 'id')) {
          const temp_arr_styles: TTMLFontFace = {};
          id = ret.htmlAttrs.id;
          for (s in ret.htmlAttrs) {
            if (hasProperty(ret.htmlAttrs, s)) {
              if (s == 'font-family') {
                temp_arr_styles[s] = "'" + ret.htmlAttrs[s] + "'";
              } else {
                temp_arr_styles[s] = ret.htmlAttrs[s];
              }
            }
          }

          _e_children = _e.childNodes;
          for (i = 0; i < _e_children.length; i++) {
            _e1 = _e_children[i];

            if (_e1.nodeType != 3) {
              ret = this.transAttrFromElement(_e1 as Element);
              for (s in ret.htmlAttrs) {
                if (hasProperty(ret.htmlAttrs, s)) {
                  temp_arr_styles[s] = ret.htmlAttrs[s];
                }
              }
            }
          }
          this.arr_fontfaces.push(temp_arr_styles);
        }
      }
    }

    this.arr_styleSheets = [];
    for (i = 0; i < this.arr_regions.length; i++) {
      const region: TTMLRegion = this.arr_regions[i];
      this.arr_styleSheets.push({
        id: region.id,
        begin: region.begin,
        end: region.end,
        styles: this.applyStyleToRegion(region.styles),
      });
    }
    for (let i in this.arr_styles) {
      const style: TTMLStyle = this.arr_styles[i];
      this.arr_styleSheets.push({
        id: i,
        begin: null,
        end: null,
        styles: this.applyStyleToRegion(style),
      });
    }
  };

  /**
   * 指定したElement(_e)要素以下から字幕データを抽出しttmlListへ追加する(再起処理として使用)
   * @param {{}} _e 対象Element（DOMObject）
   * @param parent_range 親のElementのbegin～end(子要素のbegin,endはこの範囲内となるため下位要素へ渡す)
   * @private
   */
  listupCaptions = (
    _e: Element,
    parent_range: TTMLRange,
    parse_range: Nullable<TTMLRange>
  ): void => {
    let begin_time: number = parent_range.begin_time;
    let end_time: number = parent_range.end_time;

    const attr_begin: Nullable<string> = _e.getAttribute('begin');
    const attr_end: Nullable<string> = _e.getAttribute('end');
    const id: Nullable<string> = _e.getAttribute('xml:id');

    if (attr_begin == null && attr_end == null) {
      // eslint-disable-line no-empty
    } else {
      // msに変換
      const begin = this.parseTime(attr_begin!) + begin_time;
      const end = this.parseTime(attr_end!);

      if (parse_range) {
        // パースする対象なので提示時間のみで判断する

        if (parse_range.begin_time <= begin && begin < parse_range.end_time) {
          // eslint-disable-line no-empty
        } else {
          return;
        }
      }

      //
      if (_e.getAttribute('parsed') == 'true') {
        return;
      }

      // 変換
      const _trans_e: Element = this.transElement(_e);

      _e.setAttribute('parsed', 'true');

      this.arr_captions.push({
        begin_time: begin,
        end_time: end,
        id,
        caption: _trans_e,
      });

      begin_time = begin;
      end_time = end;
    }

    const _e_children = _e.childNodes;
    for (let i = 0; i < _e_children.length; i++) {
      if (_e_children[i].nodeName != '#text') {
        this.listupCaptions(
          _e_children[i] as Element,
          {
            begin_time,
            end_time,
          },
          parse_range
        );
      }
    }
  };

  /**
   * regionに対するstyle適用（style自身も再帰的に適用する）
   * @param {Array} arr regionの配列
   * @returns {Array} styleが適用されたregionの配列
   * @private
   */
  applyStyleToRegion = (arr: TTMLStyle): TTMLStyle => {
    if (hasProperty(arr, 'style_ref')) {
      const style_id: string = arr.style_ref;
      delete arr['style_ref'];
      if (hasProperty(this.arr_styles, style_id)) {
        const style = this.arr_styles[style_id];
        for (const v in style) {
          if (!hasProperty(arr, v)) arr[v] = style[v];
        }
        arr = this.applyStyleToRegion(arr);
      } else {
        this.NXDebug.error(
          'ERROR : style id is not found in region/style!!! id=' + style_id
        );
      }
    }
    return arr;
  };

  /**
   * 指定したelementにデフォルトのStyleを適用する
   * @param {{}} _e デフォルトStyleを適用するelement
   */
  applyDefaultStyleToElement = (_e: HTMLElement): HTMLElement => {
    _e.style['position'] = 'absolute';
    _e.style['margin'] = '0px';
    _e.style['padding'] = '0px';
    _e.style['whiteSpace'] = 'nowrap';
    _e.style['offset'] = '0px';
    _e.style['border'] = '0px';
    _e.style['overflow'] = 'hidden';

    return _e;
  };

  /**
   * Styleシートの定義をElementへ反映
   * @param {{}} _e 対象のelement
   */
  applyRegionStyleToElement = (_e: HTMLElement): void => {
    // regionの適用
    const region: Nullable<string> = _e.getAttribute('region');
    if (!this.isUndefined(region)) {
      this.applyStyleSheet(_e, region!);
    }
    // 現状、styling以外（p,div,span）に対するstyleは運用外だが処理はしておく
    const style: Nullable<string> = _e.getAttribute('style');
    if (!this.isUndefined(style)) {
      this.applyStyleSheet(_e, style!);
    }
  };

  /**
   * arr_stylesheetsからidのStyleを_eに適用する
   * @param {{}} _e 対象のelement
   * @param {string} id styleのid
   * @private
   */
  applyStyleSheet = (_e: HTMLElement, id: string): void => {
    const e_begin: Nullable<string> = _e.getAttribute('begin');
    const e_end: Nullable<string> = _e.getAttribute('end');
    const parent_range: TTMLStringRange = {
      begin: e_begin,
      end: e_end,
    };
    let child_range: TTMLStringRange;

    let stylesheet: TTMLRegion;
    for (let i = 0; i < this.arr_styleSheets.length; i++) {
      if (id == this.arr_styleSheets[i].id) {
        stylesheet = this.arr_styleSheets[i];

        child_range = {
          begin: stylesheet.begin,
          end: stylesheet.end,
        };
        if (this.checkRange(parent_range, child_range)) {
          for (const key in stylesheet.styles) {
            _e.style[key] = stylesheet.styles[key];
          }
        }
      }
    }
  };

  /**
   * parent.begin～parent.endがchild.begin～child.endの範囲内かをチェックする
   * @param {{}} parent begin(datetime), end(datetime)を持つObject
   * @param {{}} child begin(datetime), end(datetime)を持つObject
   * @returns {boolean}
   */
  checkRange = (parent: TTMLStringRange, child: TTMLStringRange): boolean => {
    if (this.isUndefined(parent.begin) && this.isUndefined(parent.end))
      return true;
    if (this.isUndefined(child.begin) && this.isUndefined(child.end))
      return true;

    if (!this.isUndefined(parent.begin) && !this.isUndefined(child.begin)) {
      if (parent.begin! > child.begin!) {
        return false;
      }
    }

    if (!this.isUndefined(parent.end) && !this.isUndefined(child.end)) {
      if (parent.end! < child.end!) {
        return false;
      }
    }
    return true;
  };

  /* istanbul ignore next */
  /**
   * TTMLのelementをHTMLに変換する(再起的に処理される）
   * @param {{}} _e 対象となる最初のElement(DOMObject)
   * @returns {{}} 変換後のElement(DOMObject)
   * @private
   */
  transElement = (_e: Element): Element => {
    // Tag名変換
    const htmlTagName: string = _e.localName;

    let _trans: HTMLElement = document.createElement(htmlTagName);
    let i: number;
    let attr: Attr;

    // デフォルトスタイルの適用
    _trans = this.applyDefaultStyleToElement(_trans);

    _trans.style['position'] = 'absolute';
    _trans.style['margin'] = '0px';
    _trans.style['padding'] = '0px';
    _trans.style['whiteSpace'] = 'nowrap';
    _trans.style['offset'] = '0px';
    _trans.style['border'] = '0px';
    _trans.style['overflow'] = 'hidden';

    // stylesheet(styling)の適用
    const v_region: Nullable<string> = _e.getAttribute('region');
    const v_style: Nullable<string> = _e.getAttribute('style');

    if (v_region != null && typeof v_region != 'undefined') {
      _trans.setAttribute('region', v_region!);
    }

    if (v_style != null && typeof v_style != 'undefined') {
      _trans.setAttribute('style', v_style!);
    }
    this.applyRegionStyleToElement(_trans);

    // attributeをリストアップ（名前だけではない特別な変換を要するものはここで変換）
    const htmlAttrs: TTMLDictionary = {};
    const arr_processed_attr: Array<string> = [];

    for (i = 0; i < _e.attributes.length; i++) {
      attr = _e.attributes[i];
      switch (attr.name) {
        case 'tts:fontSize':
          const value: string = attr.value;
          const size: Array<string> = value.split(/\s/);
          if (size.length == 2) {
            _trans.style[attr.name] = size[1];

            const ratio: number =
              +size[0].replace('px', '') / +size[1].replace('px', '');
            if (ratio != 1) {
              _trans.style['transform'] = 'scaleX(' + ratio + ')';
              _trans.style['transform-origin'] = 'left top';
              _trans.style['-webkit-transform'] = 'scaleX(' + ratio + ')';
              _trans.style['-webkit-transform-origin'] = 'left top';
              _trans.style['-moz-transform'] = 'scaleX(' + ratio + ')';
              _trans.style['-moz-transform-origin'] = 'left top';
              _trans.style['-o-transform'] = 'scaleX(' + ratio + ')';
              _trans.style['-o-transform-origin'] = 'left top';
              _trans.style['-ms-transform'] = 'scaleX(' + ratio + ')';
              _trans.style['-ms-transform-origin'] = 'left top';

              // letter-spacingがあればtransformに影響しないように値を調整
              const temp_value: Nullable<string> = _e.getAttribute(
                'arib-tt:letter-spacing'
              );

              if (typeof temp_value !== 'undefined') {
                const ls: number = +temp_value!.replace('px', '') / ratio;
                _trans.style['letter-spacing'] = ls + 'px';
                arr_processed_attr.push('letter-spacing');
              }
            }
          } else {
            _trans.style['font-size'] = value;
          }
          break;

        case 'smpte:backgroundImage':
          const img_obj: HTMLElement = document.createElement('img');
          img_obj.setAttribute('src', this.baseURL + attr.value);
          _trans.appendChild(img_obj);
          break;
        default:
          htmlAttrs[attr.localName] = attr.value;
          break;
      }
    }

    // 上で処理済みのattributeはこの先で処理しない
    for (i = 0; i < arr_processed_attr.length; i++) {
      delete htmlAttrs[arr_processed_attr[i]];
    }

    // タグの指定によるものはここで変換
    const ttmlTagName: string = this.NS.getTagName(_e);
    switch (ttmlTagName) {
      // arib-tt:audio
      case 'arib-tt:audio':
        //autoplayは提示時にセットhtmlAttrs["autoplay"] = "autoplay";
        if (_e.getAttribute('loop') == 'false') {
          delete htmlAttrs['loop'];
        }
        break;
    }

    // 属性変換
    for (const attr in htmlAttrs) {
      if (hasProperty(htmlAttrs, attr)) {
        const ret: TTMLAttribute = this.transAttr(attr, htmlAttrs[attr]);

        for (const attr2 in ret.htmlAttrs) {
          if (hasProperty(ret.htmlAttrs, attr2)) {
            _trans.setAttribute(attr2, ret.htmlAttrs[attr2]);
          }
        }
        for (const css in ret.htmlCss) {
          if (hasProperty(ret.htmlCss, css)) {
            _trans.style[css] = ret.htmlCss[css];
          }
        }
      }
    }

    // 下階層へ再起処理
    const _e_children: NodeListOf<ChildNode> = _e.childNodes;
    for (i = 0; i < _e_children.length; i++) {
      // Text
      if (_e_children[i].nodeType == 3) {
        // eslint-disable-line no-empty
      } else {
        const t_ele: Element = this.transElement(_e_children[i] as Element);
        _trans.appendChild(t_ele);
      }
    }

    const _e_childnodes: NodeListOf<ChildNode> = _e.childNodes;
    for (i = 0; i < _e_childnodes.length; i++) {
      // Text
      if (_e_childnodes[i].nodeType == 3) {
        const tmp_data: string = (_e_childnodes[i] as Text).data.replace(
          /[\s\n\t]+/gm,
          ''
        );
        if (tmp_data != '') {
          _trans.appendChild(
            document.createTextNode((_e_childnodes[i] as Text).data)
          );
        }
      } else {
        // eslint-disable-line no-empty
      }
    }

    return _trans;
  };

  /**
   * textをxmlパース
   * @param {string} val 対象のテキスト
   * @returns {HTMLDocument}
   */
  parseXML = (val: string): Document => {
    const parser: DOMParser = new DOMParser();
    return parser.parseFromString(val, 'application/xml');
  };

  /**
   * TTMLの時刻(begin,end)の記述"hh:mm:ss.nnn"をmsに変換
   * @param {string} value 提示時刻
   * @returns {number} 提示時間(ms)
   */
  parseTime = (value: string): number => {
    const temp1: Array<string> = value.split('.');
    let ms: number = 0;
    if (temp1.length >= 2) ms = parseInt(temp1[1], 10);
    let h: number = 0;
    let m: number = 0;
    let s: number = 0;
    if (temp1.length >= 1) {
      const temp2: Array<string> = temp1[0].split(':');
      if (temp2.length >= 3) {
        h = parseInt(temp2[0], 10);
        m = parseInt(temp2[1], 10);
        s = parseInt(temp2[2], 10);
        return 1000 * (h * 60 * 60 + m * 60 + s) + ms;
      }
    }
    return 0;
  };

  /**
   * 指定したElementの属性を変換する
   * @param {{}} _e 対象のelement
   * @private
   */
  transAttrFromElement = (_e: Element): TTMLAttribute => {
    let arr_attrs: TTMLDictionary = {};
    const _e_attributes: NamedNodeMap = _e.attributes;
    let i: number;

    for (i = 0; i < _e_attributes.length; i++) {
      arr_attrs[_e_attributes[i].localName] = _e_attributes[i].value;
    }

    const arr_html_attr: TTMLDictionary = {};
    const arr_html_css: TTMLDictionary = {};

    switch (_e.tagName) {
      case 'arib-tt:src':
        if (typeof arr_attrs['url'] != 'undefined') {
          let arib_tt_url: string =
            'url(' + "'" + this.baseURL + arr_attrs['url'] + "'" + ') ';
          if (typeof arr_attrs['format'] != 'undefined') {
            arib_tt_url += 'format(' + "'" + arr_attrs['format'] + "'" + ')';
          }
          arr_html_attr['src'] = arib_tt_url;
        }
        // このタグの属性は上記で処理済みのためすべて削除
        arr_attrs = {};
        break;
    }

    // 属性変換
    for (const attr in arr_attrs) {
      if (hasProperty(arr_attrs, attr)) {
        const ret = this.transAttr(attr, arr_attrs[attr]);
        for (let i in ret.htmlAttrs) arr_html_attr[i] = ret.htmlAttrs[i];
        for (let i in ret.htmlCss) arr_html_css[i] = ret.htmlCss[i];
      }
    }

    return {
      htmlAttrs: arr_html_attr,
      htmlCss: arr_html_css,
    };
  };

  /**
   * TTML XMLの属性から HTMLの属性とcssへ変換<br/>
   * htmlAttrsに属性のKey=Value連想配列、htmlCssにCssのKey=Value連想配列が返る
   * @param {string} name 変換元(TTML)属性名
   * @param {string} value 変換元(TTML)属性の値
   * @returns {{arr_html_attr: Array, arr_html_css: Array}} arr_html_attr:属性の配列, arr_html_css:CSSの配列
   * @private
   */
  transAttr = (name: string, value: string): TTMLAttribute => {
    const arr_html_css: TTMLDictionary = {};
    const arr_html_attr: TTMLDictionary = {};
    let arr_color: Array<string>;
    let idx: number;

    switch (name) {
      case 'animation':
        arr_html_css['WebkitAnimation'] = value;
        arr_html_css['white-space'] = 'nowrap';
        break;

      case 'animationName':
        arr_html_attr['animationName'] = value;
        break;
      case 'position':
        // attributeにpositionを入れられないのでrenameする
        arr_html_attr['keyframeposition'] = value;
        break;
      case 'style':
        arr_html_attr['style_ref'] = value;
        break;
      case 'region':
        arr_html_attr['class'] = value; // inlineで使用しない場合用に入れておく
        arr_html_attr['region'] = value;
        break;
      case 'id':
        arr_html_attr[name] = value;
        break;
      case 'extent':
        const dim: Array<string> = value.split(/\s/);
        arr_html_css['width'] = dim[0];
        arr_html_css['height'] = dim[1];
        break;
      case 'origin':
        const pos: Array<string> = value.split(/\s/);
        arr_html_css['position'] = 'absolute';
        arr_html_css['left'] = pos[0];
        arr_html_css['top'] = pos[1];
        break;
      case 'color':
      case 'backgroundColor':
        if (value.indexOf('#') == 0) {
          if (name == 'backgroundColor') name = 'background-color';
          arr_color = [];
          idx = 0;
          while (idx * 2 + 1 <= value.length - 1) {
            arr_color[idx] = value.substr(idx * 2 + 1, 2);
            idx += 1;
          }
          if (arr_color.length == 4) {
            arr_html_css[name] =
              'rgba(' +
              parseInt(arr_color[0], 16) +
              ',' +
              parseInt(arr_color[1], 16) +
              ',' +
              parseInt(arr_color[2], 16) +
              ',' +
              (parseInt(arr_color[3], 16) + 1) / 256 +
              ')';
          } else {
            arr_html_css[name] =
              'rgb(' +
              parseInt(arr_color[0], 16) +
              ',' +
              parseInt(arr_color[1], 16) +
              ',' +
              parseInt(arr_color[2], 16) +
              ')';
          }
        } else {
          this.NXDebug.debug(
            'ERROR: color,backgroundColor format is only #nnnnnn[nn] ... value=' +
              value
          );
        }

        break;
      case 'src':
        arr_html_attr['src'] = this.baseURL + value;
        break;
      case 'border':
        const arr_border: Array<string> = value.split(' ');
        let bcolor: string;
        if (arr_border && arr_border.length == 3) {
          arr_color = [];
          idx = 0;
          const cc: string = arr_border[2];
          while (idx * 2 + 1 <= cc.length - 1) {
            arr_color[idx] = cc.substr(idx * 2 + 1, 2);
            idx += 1;
          }
          if (arr_color.length == 4) {
            bcolor =
              'rgba(' +
              parseInt(arr_color[0], 16) +
              ',' +
              parseInt(arr_color[1], 16) +
              ',' +
              parseInt(arr_color[2], 16) +
              ',' +
              (parseInt(arr_color[3], 16) + 1) / 256 +
              ')';
          } else {
            bcolor =
              'rgb(' +
              parseInt(arr_color[0], 16) +
              ',' +
              parseInt(arr_color[1], 16) +
              ',' +
              parseInt(arr_color[2], 16) +
              ')';
          }
          arr_html_css[name] =
            arr_border[0] + ' ' + arr_border[1] + ' ' + bcolor;
        } else {
          arr_html_css[name] = value;
        }
        break;
      case 'border-left':
      case 'border-right':
      case 'border-top':
      case 'border-bottom':
        arr_html_css[name] = value;
        break;
      case 'textOutline':
        const arr_outline: Array<string> = value.split(' ');
        if (arr_outline && arr_outline.length == 3) {
          const blur: number =
            parseInt(arr_outline[2]) + parseInt(arr_outline[1]);
          //arr_html_css['-webkit-text-stroke-color'] = arr_outline[0];
          arr_color = [];
          idx = 0;
          const valueColor: string = arr_outline[0];
          while (idx * 2 + 1 <= valueColor.length - 1) {
            arr_color[idx] = valueColor.substr(idx * 2 + 1, 2);
            idx += 1;
          }
          if (arr_color.length == 4) {
            arr_html_css['-webkit-text-stroke-color'] =
              'rgba(' +
              parseInt(arr_color[0], 16) +
              ',' +
              parseInt(arr_color[1], 16) +
              ',' +
              parseInt(arr_color[2], 16) +
              ',' +
              (parseInt(arr_color[3], 16) + 1) / 256 +
              ')';
          } else {
            arr_html_css['-webkit-text-stroke-color'] =
              'rgb(' +
              parseInt(arr_color[0], 16) +
              ',' +
              parseInt(arr_color[1], 16) +
              ',' +
              parseInt(arr_color[2], 16) +
              ')';
          }
          arr_html_css['-webkit-text-stroke-width'] = arr_outline[1];
          arr_html_css['-webkit-text-shadow'] =
            -1 * blur +
            'px ' +
            -1 * blur +
            'px ' +
            arr_outline[0] +
            ',' +
            blur +
            'px ' +
            -1 * blur +
            'px ' +
            arr_outline[0] +
            ',' +
            -1 * blur +
            'px ' +
            blur +
            'px ' +
            arr_outline[0] +
            ',' +
            blur +
            'px ' +
            blur +
            'px ' +
            arr_outline[0];
        } else {
          this.NXDebug.debug(
            'ERROR: textOutline format is unavailable ... value = ' + value
          );
        }
        break;

      case 'opacity':
        arr_html_css['opacity'] = value;
        break;
      case 'fontSize':
        const size: Array<string> = value.split(/\s/);
        if (size.length > 1) {
          arr_html_css['font-size'] = size[1];
        } else {
          arr_html_css['font-size'] = value;
        }
        break;
      case 'fontFamily':
        arr_html_css['font-family'] = '"' + value + '"';
        break;
      case 'fontStyle':
      case 'fontWeight':
      case 'lineHeight':
      case 'textDecoration':
      case 'letter-spacing':
        arr_html_css[name] = value;
        break;
      default:
        arr_html_attr[name] = value;
        break;
    }

    return {
      htmlAttrs: arr_html_attr,
      htmlCss: arr_html_css,
    };
  };

  /**
   * undefined or null 判定をする
   * @param {{}} val undefined判定をする値
   * @returns {boolean}
   */
  isUndefined = (val: any): boolean => {
    return typeof val === 'undefined' || val == null;
  };
}
