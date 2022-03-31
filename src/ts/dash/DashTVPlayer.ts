/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * Copyright (c) 2022, NHK(Japan Broadcasting Corporation).
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * - Neither the names of the copyright holders nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { AbrController } from './streaming/AbrController';
import Debug from './core/Debug';
import ErrorHandler from './core/ErrorHandler';
import { EventBus } from './core/EventBus';
import { hasProperty } from './core/Utils';
import LogHandler from './core/LogHandler';
import MetricsModel, { Metrics } from './streaming/MetricsModel';
import VideoModel, { DummyVideoModel } from './streaming/VideoModel';
import { Period } from './manifest/Period';
import { StreamController } from './streaming/StreamController';
import { ManifestModel } from './manifest/ManifestModel';
import { ttml_renderer } from './ttml/TTMLRenderer';

/**
 * DashTVPlayer
 *
 * @module DashTVPlayer（インターフェースモジュール）
 */

/**
 * DashTVPlayer
 * @constructor
 */
export class DashTVPlayer {
  VERSION: string;
  DEPLOY_DATE: string;
  params: Paramstype;
  element: Nullable<NXHTMLVideoElement>;
  source?: Nullable<UrlType>;
  streamController?: Nullable<StreamController>;
  playing: boolean;
  autoPlay: boolean;
  eventBus: EventBus;
  static Debug: Debug = new Debug();
  NXDebug: Debug;
  metricsModel: MetricsModel;
  abrController: AbrController;
  errHandler = ErrorHandler;
  static LogHandler = LogHandler;
  videoModel: Nullable<VideoModel | DummyVideoModel>;
  xhrCustom: Nullable<Partial<XHRCustom>> = null;
  initialPresentationStartTime: number;
  initialPresentationEndTime: number;
  minBandwidth: Bandwidth;
  maxBandwidth: Bandwidth;
  static ttml_renderer = ttml_renderer;

  constructor(view: Nullable<NXHTMLVideoElement>) {
    this.VERSION = '1.9.10';
    this.DEPLOY_DATE = 'ver.<deploy_date>';
    this.params = {};
    this.element = view;
    this.playing = false;
    this.autoPlay = true;
    this.eventBus = new EventBus();
    this.NXDebug = DashTVPlayer.Debug;
    this.metricsModel = new MetricsModel();
    this.abrController = new AbrController();
    this.errHandler = ErrorHandler;
    this.videoModel =
      this.element != null
        ? new VideoModel(this.element, this.eventBus)
        : new DummyVideoModel(this.element, this.eventBus);
    this.xhrCustom = null;
    this.initialPresentationStartTime = NaN;
    this.initialPresentationEndTime = NaN;
    this.minBandwidth = {
      video: NaN,
      audio: NaN,
    };
    this.maxBandwidth = {
      video: NaN,
      audio: NaN,
    };
    DashTVPlayer.LogHandler.log(this.DEPLOY_DATE);
    DashTVPlayer.LogHandler.log_item(
      'player_version',
      this.DEPLOY_DATE + ' / ' + this.VERSION
    );
  }

  /**
   * 再生に必要な情報が揃っているかの判定
   * @param (なし)
   * @return {boolean} 判定値
   */
  isReady = (): boolean => this.element != null && this.source != null;

  /**
   * MediaSourceのサポート判定
   * @return {boolean} 判定地
   */
  supportsMediaSource = (): boolean => {
    const hasWebKit: boolean = 'WebKitMediaSource' in window;
    const hasMediaSource: boolean = 'MediaSource' in window;
    return hasWebKit || hasMediaSource;
  };

  /**
   * メディアの再生
   * @return (なし)
   */
  play = (): void => {
    if (!this.supportsMediaSource.call(this)) {
      this.errHandler.capabilityError(this.eventBus, 'mediasource');
      return;
    }
    if (this.source && hasProperty(this.source, 'params')) {
      this.params = this.source.params;
    }

    this.playing = true;

    this.xhrCustom =
      this.source && hasProperty(this.source, 'xhrCustom')
        ? this.source.xhrCustom!
        : {};
    this.streamController = new StreamController(
      this.params,
      this.eventBus,
      this.metricsModel,
      this.abrController,
      this.xhrCustom!
    );
    this.streamController.setVideoModel(this.videoModel!);

    this.streamController.setUpMediaSource(this.element);

    this.streamController.setPresentationStartTime(
      this.initialPresentationStartTime
    );
    this.streamController.setPresentationEndTime(
      this.initialPresentationEndTime
    );
    this.streamController.setBandwidthLimit(
      this.minBandwidth,
      this.maxBandwidth
    );

    this.streamController.setAutoPlay(this.autoPlay);
    this.streamController.load(this.source!);
  };

  /**
   * 自動再生の設定 isReadyの状態で判断
   * @return (なし)
   */

  //NSV-a const doAutoPlay = () => {
  //NSV-a   if (isReady()) {
  //NSV-a     play.call(this);
  //NSV-a   }
  //NSV-a };

  /**
   * 内部のEventBusにハンドラを登録
   * @param {string} type - イベントの種別
   * @param {function} listener - イベントを処理する関数
   * @param {boolean} useCapture - captureフラグ
   * @return (なし)
   */

  addEventListener(
    type: string,
    listener: NXEventListener,
    useCapture: boolean
  ): void {
    //this.
    this.eventBus.addEventListener(type, listener, useCapture);
  }

  /**
   * 内部のEventBusに登録したハンドラを解除
   * @param {string} type - イベントの種別
   * @param {function} listener - イベントを処理する関数
   * @param {boolean} useCapture - captureフラグ
   */
  removeEventListener(
    type: string,
    listener: NXEventListener,
    useCapture: boolean
  ): void {
    //this.
    this.eventBus.removeEventListener(type, listener, useCapture);
  }

  /**
   * バージョンの取得
   * @this DashTVPlayer
   * @return バージョン
   */
  getVersion(): string {
    return this.VERSION;
  }

  /**
   * デバッグ情報の出力先の取得
   * @return デバッグ情報出力用オブジェクト
   */
  getDebug(): Debug {
    return this.NXDebug;
  }

  /**
   * ビデオ処理用インスタンスを参照する
   * @return ビデオ処理用インスタンス
   */
  getVideoModel(): VideoModel | DummyVideoModel {
    return this.videoModel!;
  }

  /**
   * AutoPlayの設定
   * @param {boolean} value - trueで自動再生on/falseで自動再生off
   * @return (なし)
   */
  setAutoPlay(value: boolean): void {
    this.autoPlay = value;
  }

  /**
   * AutoPlayが設定されていればtrueを返す。
   * @return {boolean} true/false
   */
  getAutoPlay(): boolean {
    return this.autoPlay;
  }

  /**
   * mpdの種別がdynamicであればtrueを返す。
   * @return {boolean} true/false
   */
  getIsDynamic(): boolean {
    return this.streamController!.getIsDynamic();
  }

  /**
   * 全ピリオド情報の取得
   * @return {array} 全ピリオド情報
   */
  getPeriodInfo(): Array<Period> {
    return this.streamController!.getPeriodInfo();
  }

  /**
   * インデックスを指定してピリオド情報を取得
   * @param {int} idx - ピリオドのインデックス
   * @return {period} ピリオド情報
   */
  getPeriodInfoForIdx(idx: number): Nullable<Period> {
    return this.streamController!.getPeriodInfoForIdx(idx);
  }

  /**
   * 時刻指定して該当ピリオドのインデックスを取得
   * @param {float} time - 取得したいピリオドの時刻（秒）を指定
   * @return {int} ピリオドのインデックス
   */
  getPeriodIdxForTime(time: number): number {
    return this.streamController!.getPeriodIdxForTime(time);
  }

  /**
   * 再生中のピリオドのインデックスを取得
   * @return {int} ピリオドのインデックス
   */
  getCurrentPlayingPeriodIdx(): number {
    const ctime: number = this.videoModel!.getCurrentTime();
    //return streamController.getCurrentPlayingPeriodIdx();
    return this.streamController!.getPeriodIdxForTime(ctime);
  }

  /**
   * 指定されたピリオドのBaseURLのインデックスを取得
   * @param {int} idx - ピリオドのインデックス
   * @return {int} BaseURLのインデックス
   */
  getBaseURLIdxFor(idx: number): number | null {
    return this.streamController!.getBaseURLIdxFor(idx);
  }

  /**
   * 指定されたピリオドのBaseURLのインデックスの最大値を取得
   * @param {int} idx - ピリオドのインデックス
   * @return {int} BaseURLのインデックスの最大値
   */
  getMaxBaseURLIdxFor(idx: number): number | null {
    return this.streamController!.getMaxBaseURLIdxFor(idx);
  }

  /**
   * 指定されたピリオドのBaseURLのインデックスを設定
   * @param {int} periodIdx - ピリオドのインデックス
   * @param {int} idx - BaseURLのインデックス
   * @return (なし)
   */
  setBaseURLIdxFor(periodIdx: number, idx: number): void {
    this.streamController!.setBaseURLIdxFor(periodIdx, idx);
  }

  /**
   * 指定された種別のアダプテーションのインデックスの取得
   * @param {string} type - "video" または "audio"
   * @return {int} アダプテーションインデックス 種別が誤りの場合-1
   */
  getCurrentAdaptationIdxFor(type: 'video' | 'audio'): number {
    return this.streamController!.getCurrentAdaptationIdxFor(type);
  }

  /**
   * アダプテーションインデックスの指定
   * @param {string} type - "video" または "audio"
   * @param {int} idx - インデックス
   * @return (なし)
   */
  setAdaptationIdxFor(type: 'video' | 'audio', idx: number): void {
    this.streamController!.setAdaptationIdxFor(type, idx);
  }

  /**
   * アダプテーションのRole指定
   * @param {string} type - "video" または "audio"
   * @param {string} value - Roleのvalue値
   * @return (なし)
   */
  setAdaptationRoleFor(type: 'video' | 'audio', value: RoleType): void {
    this.streamController!.setAdaptationRoleFor(type, value);
  }

  /**
   * 指定したピリオドの先頭に遷移する
   * @param {int} value - 遷移したいピリオドのインデックス
   * @return (なし)
   */
  setCueingPeriodIdx(value: number): void {
    this.streamController!.setCueingPeriodIdx(value);
  }

  /**
   * メトリックスのインスタンスを取得
   * @return MetricsModelのインスタンス
   */
  getMetricsExt(): MetricsModel {
    //return this.metricsModel;
    return this.metricsModel;
  }

  /**
   * getMetricsFor
   * @param {string} type - メディア種別('video'または'audio')
   * @return ??
   */
  getMetricsFor(type: 'video' | 'audio'): Metrics {
    //const metrics = this.metricsModel.getReadOnlyMetricsFor(type);
    const metrics: Metrics = this.metricsModel.getMetricsFor(type);
    return metrics;
  }

  /**
   * 指定した種別の最大品質を指すインデックス値の取得
   * @param {string} type - メディア種別('video'または'audio')
   * @return {int} 最大品質を指すインデックス値
   */
  getMaxQualityIndexFor(type: 'video' | 'audio'): number {
    return this.abrController.getMaxQualityIndexFor(type);
  }

  /**
   * 指定した種別の現在の品質指すインデックス値の取得
   * @param {string} type - メディア種別('video'または'audio')
   * @return {int} 現在の品質を指すインデックス値
   */
  getQualityFor(type: 'video' | 'audio'): number {
    return this.abrController.getQualityFor(type);
  }

  /**
   * 指定した種別の品質インデックスを指定する
   * @param {string} type - メディア種別('video'または'audio')
   * @param {int} value 品質を指すインデックス値
   */
  setQualityFor(type: 'video' | 'audio', value: number): void {
    this.abrController.setPlaybackQuality(type, value);
  }

  /**
   * 指定した種別の現在の品質指すインデックス値の取得
   * @param {string} type - メディア種別('video'または'audio')
   * @return {int} 現在の品質を指すインデックス値
   */
  getDefaultQualityFor(type: 'video' | 'audio'): number {
    return this.abrController.getDefaultQualityFor(type);
  }

  /**
   * 指定した種別の品質のインデックスのデフォルト値を指定する
   * @param {string} type - メディア種別('video'または'audio')
   * @param {int} value 品質を指すインデックス値
   */
  setDefaultQualityFor(type: 'video' | 'audio', value: number): void {
    this.abrController.setDefaultPlaybackQuality(type, value);
    this.abrController.setPlaybackQuality(type, value);
  }

  /**
   * 指定したメディア種別のビットレートの最小値を設定する。
   * MPD内の設定値より小さいbandwidthのrepresentationは除外します。
   * (すべてが設定値より小さい場合はその中で最大の値を選択します。)
   * @param {string} type - メディア種別('video'または'audio')
   * @param {int} value - ビットレート値(bps)
   * @return (なし)
   */
  setMinBandwidthFor(type: 'video' | 'audio', value: number): void {
    this.minBandwidth[type] = value;
  }

  /**
   * 指定したメディア種別のビットレートの最大値を設定する。
   * MPD内の設定値より大きいbandwidthのrepresentationは除外します。
   * (すべてが設定値より大きい場合はその中で最小の値を選択します。)
   * @param {string} type - メディア種別('video'または'audio')
   * @param {int} value - ビットレート値(bps)
   * @return (なし)
   */
  setMaxBandwidthFor(type: 'video' | 'audio', value: number): void {
    this.maxBandwidth[type] = value;
  }

  /**
   * ABR機能の設定値を取得
   * @return {boolean} true(ABR機能ON)/false(ABR機能OFF)
   */
  getAutoSwitchQuality(): boolean {
    return this.abrController.getAutoSwitchBitrate();
  }

  /**
   * 指定したメディア種別のソースバッファを取得する。
   * @param {string} type - メディア種別('video'または'audio')
   * @return (SourceBuffer)
   */
  getBufferFor(type: 'video' | 'audio'): Nullable<ExSourceBuffer> {
    return this.streamController!.getBufferFor(type);
  }

  /**
   * メディアソースのreadyStateを取得する。
   * @return (string)
   */
  getMediaSourceReadyState(): string {
    return this.streamController!.getMediaSourceReadyState();
  }

  /**
   * ABR機能を設定する
   * @param {boolean} value - true(ABR機能ON)/false(ABR機能OFF)
   * @return (なし)
   */
  setAutoSwitchQuality(value: boolean): void {
    this.abrController.setAutoSwitchBitrate(value);
  }

  /**
   * DashTVPlayerにvideo要素を紐付ける
   * @param {video_element}
   * @return (なし)
   */
  attachView(view: Nullable<NXHTMLVideoElement>): void {
    this.element = view;

    if (this.element) {
      let status: Nullable<VideoStatus> = null;
      if (this.videoModel != null && this.videoModel.isDummy()) {
        status = (this.videoModel as DummyVideoModel).getCurrentStatus();
      }
      this.videoModel = new VideoModel(this.element, this.eventBus);
      if (status != null) {
        this.videoModel.setCurrentStatus(status);
      }

      this.streamController!.updateVideoModel(this.videoModel);
    } else {
      this.videoModel = null;
    }
  }

  /**
   * 再生するコンテンツの情報を設定
   * @param {string} _source - 再生コンテンツURL
   * @param {float} start (省略化) - 再生開始時刻
   * @param {float} end (省略化) - 再生終了時刻
   */
  attachSource(_source: Nullable<UrlType>, start?: number, end?: number): void {
    this.initialPresentationStartTime = start! >= 0 ? start! : NaN;
    this.initialPresentationEndTime = end || NaN;

    this.source = _source;

    if (this.playing && this.streamController) {
      DashTVPlayer.LogHandler.clearLogs();
      this.streamController.reset();
      this.streamController = null;
      this.playing = false;
    }

    if (this.source != null) {
      if (!this.videoModel!.isDummy()) {
        (this.videoModel as VideoModel).checkCanplaythrough();
        if (this.isReady()) {
          this.play.call(this);
        }
      } else {
        this.play.call(this);
      }
    }
  }

  /**
   * マニフェスト情報を直接指定する
   * @param {text} url - セグメントファイルのbaseurl
   * @param {xml} data - マニフェスト情報
   */
  setManifestFromExt(url: string, data: string): void {
    this.streamController!.setManifestFromExt(url, data);
  }

  /**
   * プレーヤをリセットする
   * @return (なし)
   */
  reset(): void {
    this.attachSource(null);
    this.attachView(null);
    this.minBandwidth = {
      video: NaN,
      audio: NaN,
    };
    this.maxBandwidth = {
      video: NaN,
      audio: NaN,
    };
  }

  /**
   * 再生時刻（先頭からの時間）の指定
   * @param {float} value - コンテンツ開始からvalue秒指定
   * @return (なし)
   */
  setCurrentTime(value: number): void {
    const currentTime: number = this.videoModel!.getCurrentTime();
    const mediaDur: number = this.videoModel!.getDuration();
    let seekTime: number = value;

    if (seekTime < 0) {
      seekTime = 0;
    } else if (seekTime > mediaDur) {
      seekTime = mediaDur;
    } else {
      // eslint-disable-line no-empty
    }

    DashTVPlayer.LogHandler.log(
      '*** SEEK: ' + value + ' [' + currentTime + '] -> [' + seekTime + ']'
    );
    this.NXDebug.log(
      '*** SEEK: ' + value + ' [' + currentTime + '] -> [' + seekTime + ']'
    );
    if (!this.videoModel!.isDummy()) {
      if (!(this.videoModel as VideoModel).isPaused()) {
        this.setPause();
      }
      this.videoModel!.setCurrentTime(seekTime);
    } else {
      this.streamController!.seek(seekTime);
    }
  }

  getBufferState(): number {
    return this.streamController!.getBufferState();
  }

  /**
   * 再生時刻のシーク値(delta)の指定
   * @param {float} value - 再生中時刻から＋/-dalta秒指定してシーク
   * @param {boolean} _silent - シーク後のイベント処理をスキップするか否か
   * @return (なし)
   */
  setCurrentTimeDelta(value: number, _silent: boolean): void {
    const currentTime: number = this.videoModel!.getCurrentTime();
    const mediaDur: number = this.videoModel!.getDuration();
    const silent: boolean = _silent || false;

    let seekTime: number = currentTime + value;
    if (seekTime < 0) {
      seekTime = 0;
    } else if (seekTime > mediaDur) {
      seekTime = mediaDur;
    } else {
      // eslint-disable-line no-empty
    }
    DashTVPlayer.LogHandler.log(
      '*** SEEK: ' + value + ' [' + currentTime + '] -> [' + seekTime + ']'
    );
    this.NXDebug.log(
      '*** SEEK: ' + value + ' [' + currentTime + '] -> [' + seekTime + ']'
    );

    if (!this.videoModel!.isDummy()) {
      if (silent) {
        this.videoModel!.silentSeek(seekTime);
      } else {
        if (!this.videoModel!.isPaused()) {
          this.setPause();
        }
        this.videoModel!.setCurrentTime(seekTime);
      }
    } else {
      this.streamController!.seek(seekTime);
    }
  }

  /**
   * 再生時刻のオフセット指定
   * @param {float} value - 再生中時刻から＋value秒指定して再生
   * @return (なし)
   */
  setSeekTime(value: number): void {
    const currentTime: number = this.videoModel!.getCurrentTime();
    const mediaDur: number = this.videoModel!.getDuration();
    let seekTime: number = currentTime + value;
    if (seekTime < 0) {
      seekTime = 0;
    } else if (seekTime > mediaDur) {
      seekTime = mediaDur;
    } else {
      // eslint-disable-line no-empty
    }
    DashTVPlayer.LogHandler.log(
      '*** SEEK: ' + value + ' [' + currentTime + '] -> [' + seekTime + ']'
    );
    this.NXDebug.log(
      '*** SEEK: ' + value + ' [' + currentTime + '] -> [' + seekTime + ']'
    );

    if (!this.videoModel!.isDummy()) {
      if (!(this.videoModel as VideoModel).isPaused()) {
        this.setPause();
      }
      this.videoModel!.setCurrentTime(seekTime);
    } else {
      this.streamController!.seek(seekTime);
    }
  }

  getCurrentManifestData(): Nullable<ManifestModel> {
    return this.streamController!.getCurrentManifestData();
  }

  /**
   * 一時停止状態にする
   * @param {boolean} _manual - manual pause を指定する 省略時はtrue
   * @return (なし)
   */
  setPause(_manual?: boolean): void {
    const manual: boolean = _manual || true;
    this.streamController!.pause(manual);
  }

  /**
   * 再生状態にする
   * @param {boolean} _manual - manual pause を指定する 省略時はtrue
   * @return (なし)
   */
  setPlay(_manual?: boolean): void {
    const manual: boolean = _manual || true;
    this.streamController!.play(manual);
  }

  /**
   * コンテンツの再生を終了する
   * @return (なし)
   */
  end(): void {
    if (this.streamController) {
      this.streamController.end();
    }
  }

  /**
   * 再生開始時刻を指定する
   * @param  {float} value - 再生開始時刻（秒）
   * @return (なし)
   */
  setPresentationStartTime(value: number): void {
    this.initialPresentationStartTime = value;
  }

  setDebugMode(mode: DebugMode): void {
    this.NXDebug.setMode(mode);
  }

  getDebugMode(): DebugMode {
    return this.NXDebug.getMode();
  }
}
