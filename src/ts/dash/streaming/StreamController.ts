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

import { AbrController } from './AbrController';
import Debug from '../core/Debug';
import { EventBus } from '../core/EventBus';
import ErrorHandler from '../core/ErrorHandler';
import LogHandler from '../core/LogHandler';
import MetricsModel from './MetricsModel';
import VideoModel, { DummyVideoModel } from './VideoModel';
import { Period } from '../manifest/Period';
import { ManifestModel } from '../manifest/ManifestModel';
import { Stream } from './Stream';

/**
 * StreamController
 *
 * @module StreamController（StreamControllerモジュール）
 */

/*
 * StreamController aggregates all streams defined as Period sections in the manifest file
 * and implements corresponding logic to switch between them.
 */
export const UpdateDataReason = {
  INITIAL_UPDATE: 'initialize',
  PERIOD_CHANGE: 'period_change',
  ADAPTATION_CHANGE: 'adaptation_change',
  MPD_UPDATE: 'mpd_update',
};

/**
 * StreamController
 * @constructor
 */
export class StreamController {
  activeStream: Nullable<Stream>;
  autoPlay: boolean;
  pauseListener: (evt: Event) => void;
  playListener: (evt: Event) => void;
  NXDebug: Debug;
  params: Paramstype;
  eventBus: EventBus;
  metricsModel: MetricsModel;
  abrController: AbrController;
  xhrCustom: XHRCustom;
  logHandler = LogHandler;
  errHandler = ErrorHandler;
  updateDataReason = UpdateDataReason;
  videoModel?: VideoModel | DummyVideoModel;
  mediaSource: Nullable<MediaSource>;
  initialPresentationStartTime: number;
  initialPresentationEndTime: number;
  manifestModel: ManifestModel;

  constructor(
    params: Partial<Paramstype>,
    _eventBus: EventBus,
    metricsModel: MetricsModel,
    abrController: AbrController,
    _xhrCustom: XHRCustom
  ) {
    this.activeStream = null;
    this.autoPlay = true;
    this.pauseListener = this.onPause.bind(this);
    this.playListener = this.onPlay.bind(this);
    this.NXDebug = new Debug();
    this.params = params;
    this.eventBus = _eventBus;
    this.metricsModel = metricsModel;
    this.abrController = abrController;
    this.xhrCustom = _xhrCustom;
    this.mediaSource = null;
    this.initialPresentationStartTime = NaN;
    this.initialPresentationEndTime = NaN;
    this.manifestModel = new ManifestModel(
      this.params,
      this.eventBus,
      this.xhrCustom
    );
    this.eventBus.addEventListener(
      'manifestUpdated',
      this.manifestHasUpdated.bind(this)
    );
  }
  play = (manual: boolean): void => {
    this.activeStream!.play(manual);
  };

  pause = (manual: boolean): void => {
    this.activeStream!.pause(manual);
  };

  seek = (time: number): void => {
    this.activeStream!.seek(time);
  };

  attachVideoEvents = (videoModel: VideoModel | DummyVideoModel): void => {
    videoModel.listen('pause', this.pauseListener);
    videoModel.listen('play', this.playListener);
  };

  detachVideoEvents = (videoModel: VideoModel | DummyVideoModel): void => {
    videoModel.unlisten('pause', this.pauseListener);
    videoModel.unlisten('play', this.playListener);
  };

  onPause = (): void => {
    if (!this.videoModel!.getSelfPaused()) {
      this.manifestModel.manifestUpdateStop();
    }
  };
  onPlay = (): void => {
    this.manifestModel.manifestUpdateStart();
  };

  composeStreams = (_callback: (d: ResponseData) => void): void => {
    const self = this;
    const manifest: Nullable<ManifestModel> = this.manifestModel.getValue();
    const callback: (d: ResponseData) => void = _callback || (() => {});
    let period: Period;
    let t: number;
    if (!manifest) {
      callback({
        status: 'ok',
        data: false,
      });
      return;
    }
    const periods: Array<Period> = manifest.mpd!.periods;
    if (periods.length === 0) {
      callback({
        status: 'error',
        msg: 'There are no regular periods',
      });
      return;
    }
    let tt: number = this.videoModel!.getCurrentTime();
    if (this.activeStream != null) {
      const cPeriod: Period = this.activeStream.getPeriodInfo();
      const ct: number = this.videoModel!.getCurrentTime();
      t = ct > cPeriod.start ? ct : cPeriod.start;
      tt = t;
      for (let ii = periods.length - 1; ii >= 0; ii--) {
        if (periods[ii].start <= t) {
          period = periods[ii];
          break;
        }
      }
      this.activeStream.updatePlaybackCondition(manifest, period!, periods);
    }
    /* istanbul ignore next */
    if (!this.activeStream) {
      //liveMulti
      if (isNaN(this.initialPresentationStartTime)) {
        if (manifest.mpd!.type == 'dynamic') {
          if (this.params.START_FROM_MPDTOP_FORLIVE == true) {
            period = periods[0];
          } else {
            const lperiod: Period = periods[periods.length - 1];
            if (lperiod.end == Infinity) {
              period = lperiod;
            } else {
              t = lperiod.end - manifest.mpd!.suggestedPresentationDelay!;
              if (t < periods[0].start) {
                period = periods[0];
              } else {
                for (let ii = periods.length - 1; ii >= 0; ii--) {
                  if (periods[ii].start <= t) {
                    period = periods[ii];
                    break;
                  }
                }
              }
            }
          }
        } else {
          this.initialPresentationStartTime = 0;
          period = periods[0];
        }
      } else {
        if (this.initialPresentationStartTime < periods[0].start) {
          this.logHandler.log('Playback stat time is out of range.');
          this.initialPresentationStartTime = periods[0].start;
          period = periods[0];
        } else {
          for (let ii = periods.length - 1; ii >= 0; ii--) {
            if (periods[ii].start <= this.initialPresentationStartTime) {
              period = periods[ii];
              break;
            }
          }
        }
      }
      //liveMulti
      if (!period!) {
        callback({
          status: 'error',
          msg: 'Playback stat time is out of range.',
        });
        return;
      }
      this.activeStream = new Stream(
        this.params,
        this.eventBus,
        this.manifestModel,
        this.metricsModel,
        this.abrController,
        this.xhrCustom
      );
      this.activeStream.setup();
      this.activeStream.setVideoModel(this.videoModel!);
      this.activeStream.initProtection();
      this.activeStream.setPresentationStartTime(
        this.initialPresentationStartTime
      );
      this.activeStream.setPresentationEndTime(this.initialPresentationEndTime);
      this.activeStream.setAutoPlay(this.autoPlay);
      this.activeStream.setMediaSource(this.mediaSource);
      this.activeStream.load(manifest, period!, periods);
      this.attachVideoEvents.call(self, this.activeStream.getVideoModel());
      callback({
        status: 'ok',
        data: true,
      });
    } else {
      this.activeStream.updateData(
        this.updateDataReason.MPD_UPDATE,
        period!,
        tt,
        (f) => {
          //callback({status:"ok", data:true});
          callback(f);
        }
      );
    }
  };
  createMediaSource = (): Nullable<MediaSource> => {
    const hasWebKit: boolean = 'WebKitMediaSource' in window;
    const hasMediaSource: boolean = 'MediaSource' in window;
    if (hasMediaSource) {
      return new MediaSource();
    } else if (hasWebKit) {
      // @ts-ignore
      return new WebKitMediaSource();
    }
    return null;
  };
  attachMediaSource = (
    source: MediaSource,
    videoModel: VideoModel | DummyVideoModel
  ): void => {
    videoModel.setSource(window.URL.createObjectURL(source));
  };
  detachMediaSource = (videoModel: VideoModel | DummyVideoModel): void => {
    // it seems that any value passed to the setSource is cast to a sting when setting element.src,
    // so we cannot use null or undefined to reset the element. Use empty string instead.
    videoModel.setSource(null);
    // @ts-ignore
    if (videoModel.getElement()!.setMediaKeys) {
      // @ts-ignore
      videoModel.getElement()!.setMediaKeys(null);
    }
  };
  _setUpMediaSource = (
    mediaSourceArg: MediaSource,
    _callback: (val: MediaSource) => void
  ): void => {
    const callback: (val: MediaSource) => void = _callback || (() => {});
    const self = this;
    const onMediaSourceOpen = (e: Event) => {
      this.NXDebug.debug('MediaSource is open!');
      this.NXDebug.debug(String(e));
      mediaSourceArg.removeEventListener('sourceopen', onMediaSourceOpen);
      mediaSourceArg.removeEventListener('webkitsourceopen', onMediaSourceOpen);
      this.logHandler.log('readyState :' + mediaSourceArg.readyState);
      callback(mediaSourceArg);
    };
    mediaSourceArg.addEventListener('sourceopen', onMediaSourceOpen, false);
    mediaSourceArg.addEventListener(
      'webkitsourceopen',
      onMediaSourceOpen,
      false
    );
    this.attachMediaSource.call(self, mediaSourceArg, this.videoModel!);
  };
  manifestHasUpdated = (): void => {
    const self = this;
    this.composeStreams.call(self, (d) => {
      if (d.status === 'ok') {
        this.NXDebug.debug('composeStreams ok');
        this.manifestModel.onManifestRefreshEnd.call(self);
      } else {
        this.NXDebug.debug('composeStreams fail');
        if (this.getIsDynamic()) {
          this.manifestModel.onManifestRefreshEnd.call(self);
          this.manifestModel.manifestUpdateStartPoll.call(self);
        } else {
          this.logHandler.log('ERROR:' + d.msg);
          this.errHandler.manifestError(
            this.eventBus,
            d.msg!,
            'nostreamscomposed',
            this.manifestModel.getValue()!
          );
          self.reset();
        }
      }
    });
  };
  getManifestModel = (): ManifestModel => {
    return this.activeStream!.getManifestModel();
  };
  setAutoPlay = (value: boolean): void => {
    this.autoPlay = value;
  };
  // getAutoPlay = (): boolean => {
  //   return this.autoPlay;
  // };
  getIsDynamic = (): boolean => {
    const manifest: Nullable<ManifestModel> = this.manifestModel.getValue();
    if (manifest) {
      return manifest.mpd!.type === 'dynamic';
    } else {
      return false;
    }
  };
  getPeriodInfo = (): Array<Period> => {
    const manifest: Nullable<ManifestModel> = this.manifestModel.getValue();
    let periods: Array<Period> = [];
    if (manifest) {
      periods = manifest.mpd!.periods;
    }
    return periods;
  };
  getPeriodIdxForTime = (time: number): number => {
    const periods: Array<Period> = this.manifestModel.getValue()!.mpd!.periods;
    for (let i = 0; i < periods.length; i++) {
      if (time < periods[i].end) {
        return i;
      }
    }
    return periods.length - 1;
  };
  getPeriodInfoForIdx = (idx: number): Nullable<Period> => {
    const periods: Array<Period> = this.manifestModel.getValue()!.mpd!.periods;
    if (idx >= 0 && idx < periods.length) {
      return periods[idx];
    } else {
      return null;
    }
  };
  getBaseURLIdxFor = (idx: number): Nullable<number> => {
    const periods: Array<Period> = this.manifestModel.getValue()!.mpd!.periods;
    if (idx >= 0 && idx < periods.length) {
      return periods[idx].selectedBaseURLIdx;
    } else {
      return null;
    }
  };
  getMaxBaseURLIdxFor = (idx: number): Nullable<number> => {
    const periods: Array<Period> = this.manifestModel.getValue()!.mpd!.periods;
    if (idx >= 0 && idx < periods.length) {
      return periods[idx].BaseURL.length - 1;
    } else {
      return null;
    }
  };
  setBaseURLIdxFor = (periodIdx: number, idx: number): void => {
    const periods: Array<Period> = this.manifestModel.getValue()!.mpd!.periods;
    if (periodIdx >= 0 && periodIdx < periods.length) {
      if (idx >= 0 && idx < periods[periodIdx].BaseURL.length) {
        periods[periodIdx].selectedBaseURLIdx = idx;
        if (this.activeStream != null) {
          const cPeriod = this.activeStream.getPeriodInfo();
          if (cPeriod.index == periodIdx) {
            this.activeStream.clearPreparedRequests();
          }
        }
      }
    }
  };
  getCurrentAdaptationIdxFor = (type: string): number => {
    return this.activeStream!.getCurrentAdaptationIdxFor(type);
  };
  setAdaptationIdxFor = (type: string, idx: number): void => {
    this.activeStream!.setAdaptationIdxFor(type, idx);
  };
  setAdaptationRoleFor = (type: string, value: RoleType): void => {
    this.activeStream!.setAdaptationRoleFor(type, value);
  };
  setCueingPeriodIdx = (value: number): void => {
    if (!this.activeStream) return;
    const periods: Array<Period> = this.manifestModel.getValue()!.mpd!.periods;
    if (value < periods.length) {
      this.videoModel!.setCurrentTime(periods[value].start + 0.2);
    }
  };
  getVideoModel = (): VideoModel | DummyVideoModel => {
    return this.videoModel!;
  };
  getCurrentManifestData = (): Nullable<ManifestModel> => {
    return this.manifestModel.getValue();
  };
  getBufferState = (): number => {
    if (this.activeStream != null) {
      return this.activeStream.getBufferState();
    } else {
      return 0;
    }
  };
  getBufferFor = (type: string): Nullable<ExSourceBuffer> => {
    if (this.activeStream != null) {
      return this.activeStream.getBufferFor(type);
    } else {
      return null;
    }
  };
  getMediaSourceReadyState = (): string => {
    if (this.mediaSource != null) {
      return this.mediaSource.readyState;
    } else {
      return 'null';
    }
  };
  setVideoModel = (value: VideoModel | DummyVideoModel) => {
    this.videoModel = value;
    if (this.params.SKIP_GAP_AT_HOB == true) {
      this.videoModel.setSkipGapAtHOB(true);
    }
  };
  setUpMediaSource = (value: Nullable<HTMLVideoElement>): void => {
    if (value != null) {
      const self = this;
      const mse: Nullable<MediaSource> = this.createMediaSource.call(self);
      this._setUpMediaSource.call(self, mse!, (mediaSourceResult) => {
        this.mediaSource = mediaSourceResult;
        if (this.activeStream != null) {
          this.activeStream.setMediaSource(this.mediaSource);
        }
      });
    }
  };
  load = (url: UrlType): void => {
    const self = this;
    if (url.type === 'url') {
      const loadManifestListener = (evt: ExEvent): void => {
        if (evt.data.success) {
          this.manifestModel.setValue(evt.data.result);
          this.NXDebug.log('Manifest has loaded.');
        } else {
          self.reset();
        }
        this.eventBus.removeEventListener(
          'LOAD_MANIFEST_END',
          loadManifestListener
        );
      };
      this.eventBus.addEventListener('LOAD_MANIFEST_END', loadManifestListener);
      this.manifestModel.loadManifest(url.source);
    } else if (url.type === 'xml') {
      this.manifestModel.setManifestFromExt(url.baseUrl!, url.source);
    } else if (url.type === 'data') {
      this.manifestModel.setValue(url.source as ManifestModel);
    }
  };
  updateVideoModel = (vm: VideoModel): void => {
    this.setVideoModel(vm);
    this.setUpMediaSource(vm.getElement());
    this.attachVideoEvents(vm);
    if (this.activeStream != null) {
      this.activeStream.setVideoModel(vm);
      this.activeStream.initProtection();
      this.activeStream.updateMediaSource();
    }
  };
  setManifestFromExt = (url: string, data: string): void => {
    this.manifestModel.setManifestFromExt(url, data);
  };
  setBandwidthLimit = (
    min: {
      video: number;
      audio: number;
    },
    max: {
      video: number;
      audio: number;
    }
  ): void => {
    this.manifestModel.setBandwidthLimit(min, max);
  };
  reset = (): void => {
    if (this.activeStream != null) {
      this.detachVideoEvents.call(this, this.activeStream.getVideoModel());
      this.activeStream.reset();
    }
    if (this.mediaSource != null) {
      this.detachMediaSource.call(self, this.videoModel!);
    }
    this.manifestModel.manifestUpdateStop();
    this.manifestModel.setValue(null);
    this.eventBus.clearAllEventListener();
    this.activeStream = null;
    this.xhrCustom = {};
  };
  end = (): void => {
    if (this.activeStream) {
      this.activeStream.end();
    }
    if (this.mediaSource) {
      this.detachMediaSource.call(this, this.videoModel!);
    }
  };
  // setXhrCustom = (value: XHRCustom): void => {
  //   this.xhrCustom = value;
  // };
  setPresentationStartTime = (value: number): void => {
    this.initialPresentationStartTime = value;
  };
  setPresentationEndTime = (value: number): void => {
    this.initialPresentationEndTime = value;
  };
}
