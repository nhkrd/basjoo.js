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
import { EventBus } from '../core/EventBus';
import { FragmentController } from './FragmentController';
import { FragmentModel } from './FragmentModel';
import { AdaptationSet, ManifestModel } from '../manifest/ManifestModel';
import { Period } from '../manifest/Period';
import { Representation } from '../manifest/Representation';
import { SourceBufferExtensions } from './SourceBufferExtensions';
import { UpdateDataReason } from './StreamController';
import { DashHandler, Segment, SegmentRequest } from '../manifest/DashHandler';
import Debug from '../core/Debug';
import LogHandler from '../core/LogHandler';
import MetricsModel, { Metrics } from './MetricsModel';
import VideoModel, { DummyVideoModel } from './VideoModel';

/**
 * BufferController
 *
 * @module BufferController（BufferControllerモジュール）
 */

const MSE_ver = (buffer: ExSourceBuffer): string => {
  let ver: string = '';
  try {
    ver =
      ver +
      ('append' in buffer
        ? '<span style="color:#e7527d">append</span>'
        : '<span style="color:#808080">append</span>');
    ver =
      ver +
      ' ' +
      ('appendBuffer' in buffer
        ? '<span style="color:#e7527d">appendBuffer</span>'
        : '<span style="color:#808080">appendBuffer</span>');
  } catch (err) {
    ver = 'err';
  }

  LogHandler.log_item('MSE_ver', 'MSE: ' + ver);
  return ver;
};

/**
 * BufferController
 * @constructor
 */
export class BufferController {
  STALL_THRESHOLD: number;
  //PlayList
  INITIAL_PLAY_START_REASON: string;
  SEEK_START_REASON: string;
  //PlayList.Trace
  USER_REQUEST_STOP_REASON: string;
  REPRESENTATION_SWITCH_STOP_REASON: string;

  REBUFFERING_REASON: string;
  WAITING: string;
  READY: string;
  VALIDATING: string;
  LOADING: string;
  RESET: number;
  UPDATE: number;
  NOCHANGE: number;
  MSE_APPEND_ENABLE_THRESHOLD?: number;
  DEFAULT_MIN_BUFFER_TIME?: number;
  BUFFER_PREFETCH_THRESHOLD?: number;
  EXTRACT_ALL_IDR_IN_MOOF?: boolean;
  DEV_TYPE?: string;
  STORE_MEASURED_DATA?: boolean;
  START_FROM_MPDTOP_FORLIVE?: boolean;

  updateDataReason: UpdateDataReason;
  state: string;
  ready: boolean;
  started: boolean;
  waitingForBuffer: boolean;
  initialPlayback: boolean;
  playbackStarted: boolean;
  initializationData: Array<{
    [key: number]: Array<InitData>;
  }>;

  seeking: boolean;
  seekTarget: number;
  availableRepresentations?: Array<Representation>;
  currentRepresentation?: Nullable<Representation>;
  isSegmentTemplate: boolean;
  requiredQuality: number;
  currentQuality: number;
  stalled: boolean;
  isDynamic: boolean;
  isBufferingCompleted: boolean;
  isStreamCompleted: boolean;
  //NSV-a  initIsLoading: boolean;
  preAppendTime: number;
  periodInfo: Nullable<Period>;
  fragmentsToLoad: number;
  fragmentModel: Nullable<FragmentModel>;
  bufferLevel: number;
  tlen: number;
  fragmentDuration: number;
  mediaSource?: MediaSource;
  appendFromBufferQisProcessing: boolean;
  appendFromBufferQ?: () => void;

  liveEdgeSearchRange: {
    start: Nullable<number>;
    end: Nullable<number>;
  };
  liveEdgeInitialSearchPosition: Nullable<number>;
  liveEdgeSearchStep: Nullable<number>;
  useBinarySearch: boolean;
  setLiveStartTime: boolean;

  type?: 'video' | 'audio' | '';
  currentAdaptation: Nullable<AdaptationSet>;
  buffer?: Nullable<ExSourceBuffer>;
  minBufferTime?: number;
  forceDefaultMBT: boolean;
  useFetch: boolean;
  bufferStartThreshold?: number;

  listenToCanplay: boolean;
  bDatInsertMode: boolean;
  silaInsertMode: boolean;
  ullMode: boolean;
  dmyData: Nullable<Uint8Array>;
  isProtection: boolean;

  tolerance: number;
  incrementalMode: boolean;
  playListMetrics: Nullable<PlayListMetrics>;
  playListTraceMetrics: Nullable<PlayListTraceMetrics>;
  playListTraceMetricsClosed: boolean;
  scheduleWhilePaused: boolean;
  sourceBufferExt?: SourceBufferExtensions;
  manifestModel?: ManifestModel;
  metricsModel?: MetricsModel;
  metrics?: Nullable<Metrics>;
  abrController?: AbrController;
  eventBus?: EventBus;
  indexHandler?: DashHandler;

  fragmentController?: FragmentController;
  videoModel?: VideoModel | DummyVideoModel;
  SCHEDULE_EXECUTE_INTERVAL: number;
  isScheduled: boolean;
  requestScheduler?: Nullable<ReturnType<typeof setTimeout>>;
  bufferState: number;
  logHandler = LogHandler;
  NXDebug: Debug;

  constructor() {
    this.STALL_THRESHOLD = 0.1;
    //PlayList
    this.INITIAL_PLAY_START_REASON = 'initial_start';
    this.SEEK_START_REASON = 'seek';
    //PlayList.Trace
    this.USER_REQUEST_STOP_REASON = 'user_request';
    this.REPRESENTATION_SWITCH_STOP_REASON = 'representation_switch';

    this.REBUFFERING_REASON = 'rebuffering';
    this.WAITING = 'WAITING';
    this.READY = 'READY';
    this.VALIDATING = 'VALIDATING';
    this.LOADING = 'LOADING';
    this.RESET = 1;
    this.UPDATE = 2;
    this.NOCHANGE = 3;

    this.updateDataReason = UpdateDataReason;
    this.state = this.WAITING;
    this.ready = false;
    this.started = false;
    this.waitingForBuffer = false;
    this.initialPlayback = true;
    this.playbackStarted = false;
    this.initializationData = [];

    this.seeking = false;
    this.seekTarget = -1;
    this.isSegmentTemplate = false;
    this.requiredQuality = -1;
    this.currentQuality = -1;
    this.stalled = false;
    this.isDynamic = false;
    this.isBufferingCompleted = false;
    this.isStreamCompleted = false;
    //NSV-a  this.initIsLoading = false;
    this.preAppendTime = -1;
    this.periodInfo = null;
    this.fragmentsToLoad = 0;
    this.fragmentModel = null;
    this.bufferLevel = 0;
    this.tlen = 0;
    this.fragmentDuration = 0;
    this.appendFromBufferQisProcessing = false;

    this.liveEdgeSearchRange = {
      start: null,
      end: null,
    };
    this.liveEdgeInitialSearchPosition = null;
    this.liveEdgeSearchStep = null;
    this.useBinarySearch = false;
    this.setLiveStartTime = false;

    this.currentAdaptation = null;
    this.buffer = null;
    this.forceDefaultMBT = false;
    this.useFetch = false;
    this.listenToCanplay = false;
    this.bDatInsertMode = false;
    this.silaInsertMode = false;
    this.ullMode = false;
    this.dmyData = null;
    this.isProtection = false;

    this.tolerance = 0.15;
    this.incrementalMode = false;
    this.playListMetrics = null;
    this.playListTraceMetrics = null;
    this.playListTraceMetricsClosed = true;
    this.scheduleWhilePaused = false;

    this.SCHEDULE_EXECUTE_INTERVAL = 500;
    this.isScheduled = false;
    this.bufferState = 0;
    this.NXDebug = new Debug();
  }

  setState = (value: string): void => {
    this.state = value;
    if (this.fragmentModel !== null) {
      if (this.state === this.READY) {
        if (this.type == 'video') {
          const ln: Array<SegmentRequest> =
            this.fragmentModel.getLoadingRequests();
          if (ln.length == 0) {
            this.fragmentModel.executeCurrentRequest();
          }
        } else {
          this.fragmentModel.executeCurrentRequest();
        }
      }
    }
  };

  clearPlayListTraceMetrics = (endTime: Date, stopreason: string): void => {
    let duration: number = 0;
    let startTime: Nullable<Date> = null;

    if (
      this.playListTraceMetricsClosed === false &&
      this.playListTraceMetrics
    ) {
      startTime = this.playListTraceMetrics.start!;
      duration = endTime.getTime() - startTime.getTime();

      this.playListTraceMetrics.duration = duration;
      this.playListTraceMetrics.stopreason = stopreason;

      this.playListTraceMetricsClosed = true;
    }
  };

  setBufferState = (actLen: number, reqLen: number): void => {
    let value: number = 0;
    if (this.minBufferTime)
      if (actLen < this.minBufferTime) {
        value = 1;
      } else if (actLen >= this.minBufferTime && actLen < reqLen) {
        value = 2;
      } else if (actLen >= reqLen) {
        value = 3;
      }
    //NSV-a    else {
    //NSV-a    }

    if (this.bufferState != value && this.eventBus) {
      this.bufferState = value;
      this.eventBus.dispatchEvent({
        type: 'bufferStateChangeInt',
        data: {
          type: this.type,
          state: this.bufferState,
        },
      });
    }
  };

  startScheduling = (func: () => void): void => {
    const self = this;
    if (this.requestScheduler) {
      clearInterval(this.requestScheduler);
    }
    this.requestScheduler = setInterval(
      func.bind(self),
      this.SCHEDULE_EXECUTE_INTERVAL
    );
    this.isScheduled = true;
    func.call(self);
  };

  stopScheduling = (): void => {
    if (this.requestScheduler) {
      clearInterval(this.requestScheduler);
      this.requestScheduler = null;
    }
    this.isScheduled = false;
  };

  startPlayback = (): void => {
    if (!this.ready || !this.started) {
      return;
    }

    this.setState.call(this, this.READY);
    this.startScheduling.call(this, this.validate);
  };

  start = (val: string | number): void => {
    let currentTime: Date;

    this.isStreamCompleted = false;
    if (this.isScheduled) {
      this.stopScheduling.call(this);
    }

    if (this.seeking === false && this.metrics && this.type) {
      currentTime = new Date();
      this.clearPlayListTraceMetrics(
        currentTime,
        this.USER_REQUEST_STOP_REASON
      );
      this.playListMetrics = this.metrics.addPlayList(
        this.type,
        currentTime,
        0,
        this.INITIAL_PLAY_START_REASON
      );
    }

    this.NXDebug.debug('[' + this.type + '] BufferController start.' + val);

    this.started = true;
    this.updateBufferLevel.call(this);
    if (!this.waitingForBuffer && this.bufferLevel <= this.STALL_THRESHOLD) {
      this.waitingForBuffer = true;
      this.bufferStartThreshold = Math.min(
        this.minBufferTime! || this.DEFAULT_MIN_BUFFER_TIME!,
        this.getTimeToEnd.call(self)
      );
    }
    this.startPlayback.call(this);
  };

  /* istanbul ignore next */
  checkQ = (_seekTarget?: number): void => {
    const self = this;
    let curTime: number;
    let q: ChunkQ | undefined;
    let i: number;
    if (!this.buffer) return;
    if (!this.playbackStarted) {
      if (this.videoModel!.isDummy()) {
        curTime = this.videoModel!.getCurrentTime();
        for (i = 0; i < this.buffer.queue!.length; i++) {
          q = this.buffer.queue![i];
          if (curTime >= q!.time && curTime < q!.time + q!.dur) break;
        }

        while (i > 1) {
          //0??
          this.buffer.queue!.shift();
          i--;
        }
      } else {
        return;
      }
    }

    const ld: Array<SegmentRequest> = this.fragmentModel!.getLoadingRequests();

    for (let i = ld.length - 1; i >= 0; i--) {
      if (!ld[i].keep) {
        const rs: number = ld[i].startTime;
        ld.splice(i, 1);
        this.fragmentModel!.abortRequestForTime(rs);
      }
    }
    this.cancelPendingRequests.call(self, this.type!, this.NOCHANGE, 1);
    this.fragmentModel!.removeAllExecutedRequests();

    let clearQ: boolean = true;
    if (this.videoModel) curTime = this.videoModel.getCurrentTime();

    if (this.buffer.queue!.length > 0) {
      const range: Nullable<TimeRange> = this.sourceBufferExt!.getBufferRange(
        this.buffer,
        curTime!,
        this.tolerance
      );
      const btime: number = range != null ? range.end : curTime!;
      const bqsTime: number = this.buffer.queue![0].time - 0.1;

      const bqeTime: number =
        this.buffer.queue![this.buffer.queue!.length - 1].time +
        this.buffer.queue![this.buffer.queue!.length - 1].dur +
        0.1;

      if (
        (!this.playbackStarted &&
          this.BUFFER_PREFETCH_THRESHOLD &&
          btime < bqsTime &&
          bqsTime - btime < this.BUFFER_PREFETCH_THRESHOLD) ||
        (bqsTime <= btime && btime < bqeTime)
      ) {
        //NXDebug.log("buffer queue will be used. btime:"+btime+", bqsTime:"+bqsTime+", bqeTime:"+bqeTime);
        for (let i = this.buffer.queue!.length - 1; i >= 0; i--) {
          const s: number = this.buffer.queue![i].time;

          if (s - btime > this.BUFFER_PREFETCH_THRESHOLD!) {
            let dn: number;
            q = this.buffer.queue!.pop();
            dn = q!.divNum;
            q = void 0;
            while (dn > 0) {
              let qt: ChunkQ | undefined = this.buffer.queue!.pop();
              dn = qt!.divNum;
              qt = void 0;
              i--;
            }
          }
        }
        clearQ = false;
      } else {
        //NXDebug.log("clear buffer queue");
      }
    }

    if (clearQ) {
      this.buffer.queue = [];
      this.buffer.lastAppendtime = -1;
      this.preAppendTime = -1;
    }
    this.buffer.laData = null;
  };

  /* istanbul ignore next */
  seek = (time: number, msg: string): void => {
    let currentTime: Date;
    const self = this;
    let curTime: number;
    let dataView: DataView;
    let ud: Uint8Array;
    this.isStreamCompleted = false;
    this.seeking = true;
    this.seekTarget =
      this.type == 'audio' && this.isSegmentTemplate == true && this.periodInfo
        ? Math.max(time - 1, this.periodInfo.start)
        : time;
    this.setIncrementalMode.call(self, false, 1);
    currentTime = new Date();
    this.clearPlayListTraceMetrics(currentTime, this.USER_REQUEST_STOP_REASON);
    if (this.metrics && this.type)
      this.playListMetrics = this.metrics.addPlayList(
        this.type,
        currentTime,
        this.seekTarget,
        this.SEEK_START_REASON
      );

    this.NXDebug.debug(
      '[' +
        this.type +
        '] BufferController seek: ' +
        time +
        ', bufferLevel: ' +
        this.bufferLevel +
        ',' +
        msg
    );

    this.updateBufferLevel.call(self);

    curTime = this.videoModel!.getCurrentTime();
    if (!this.buffer) return;
    if (!this.stalled) {
      this.bufferStartThreshold = Math.min(
        this.minBufferTime! || this.DEFAULT_MIN_BUFFER_TIME!,
        this.getTimeToEnd.call(self)
      );

      if (this.videoModel && this.videoModel.isPaused()) {
        this.stalled = true;
        this.waitingForBuffer = true;
        this.stallStream.call(self, this.stalled, 0);

        if (this.bufferLevel < this.bufferStartThreshold) {
          if (
            this.abrController &&
            this.abrController.getAutoSwitchBitrate() &&
            this.type
          ) {
            this.abrController.setPlaybackQuality(
              this.type,
              this.abrController.getDefaultQualityFor(this.type)
            );
          }
        }
      } else {
        if (this.seekTarget < curTime) {
          const blen: number = this.sourceBufferExt!.getBufferLength(
            this.buffer,
            curTime,
            this.tolerance
          );
          if (blen > 0) {
            this.seeking = false;
          }
        } else {
          // eslint-disable-line no-empty
        }
      }
    }

    if (this.seeking) this.loadFirstSegmentRequestAfterSeek(this.seekTarget);
    if (this.bDatInsertMode && this.buffer.updating === undefined) {
      for (let i = this.buffer.buffered.length - 1; i >= 0; i--) {
        if (this.buffer.buffered.start(i) > curTime + 0.5) {
          if (
            this.buffer.buffered.end(i) - this.buffer.buffered.start(i) <
            1.5
          ) {
            // eslint-disable-line no-empty
          } else {
            let remTime: number = this.buffer.buffered.start(i) - 0.3;
            if (this.getMSEDuration.call(self) - remTime < 20) continue;
            if (remTime < 0) remTime = 0;

            dataView = new DataView(this.dmyData!);

            if (this.type === 'video') {
              if (!this.isProtection) {
                dataView.setUint32(846 + 20, 30000 * remTime);
                dataView.setUint32(938 + 12, 30000 * remTime);

                dataView.setUint32(25306 + 20, 30000 * remTime); // 0.5s
                dataView.setUint32(25398 + 12, 30000 * remTime); // 0.5s
              } else {
                dataView.setUint32(1624 + 20, 30000 * remTime);
                dataView.setUint32(1716 + 12, 30000 * remTime);

                dataView.setUint32(42809 + 20, 30000 * remTime); // 0,5s
                dataView.setUint32(42901 + 12, 30000 * remTime); // 0.5s
              }
            } else {
              if (!this.isProtection) {
                // eslint-disable-line no-empty
              } else {
                // eslint-disable-line no-empty
              }
            }

            this.buffer.timestampOffset = 0;
            if (this.buffer.updating === undefined) {
              ud = new Uint8Array(this.dmyData!);
              this.buffer.append!(ud);
            } else {
              this.buffer.appendBuffer!(this.dmyData!);
            }
            this.buffer.quality = -1;
            break;
          }
        }
      }

      //checkQ.call(self,seekTarget);
      this.NXDebug.debug(
        '[' +
          this.type +
          '] BufferController  seek: ' +
          time +
          ', bufferLevel: ' +
          this.bufferLevel +
          ', qlen:' +
          this.buffer.queue!.length
      );
      this.start.call(self, '11111');
    } else if ('remove' in this.buffer && this.buffer.updating !== undefined) {
      if (
        this.periodInfo &&
        this.buffer.buffered.length > 0 &&
        (curTime + 30 <
          this.buffer.buffered.end(this.buffer.buffered.length - 1) ||
          this.periodInfo.end <
            this.buffer.buffered.end(this.buffer.buffered.length - 1))
      ) {
        const end: number = this.buffer.buffered.end(
          this.buffer.buffered.length - 1
        );
        this.sourceBufferExt!.waitForUpdateEnd(this.buffer, () => {
          const blen: number =
            this.sourceBufferExt!.getBufferLength(
              this.buffer!,
              curTime,
              this.tolerance
            ) + 0.5;
          this.sourceBufferExt!.remove(
            this.buffer!,
            Math.min(curTime + Math.max(blen, 30), this.periodInfo!.end),
            end,
            this.periodInfo!.duration,
            this.mediaSource!,
            () => {
              //incrementalMode=false;

              this.NXDebug.debug(
                '[' +
                  this.type +
                  '] BufferController  seek: ' +
                  time +
                  ', bufferLevel: ' +
                  this.bufferLevel +
                  ', qlen:' +
                  this.buffer!.queue!.length
              );
              this.start.call(self, '11111-');
            }
          );
        });
      } else {
        this.NXDebug.debug(
          '[' +
            this.type +
            '] BufferController  seek: ' +
            time +
            ', bufferLevel: ' +
            this.bufferLevel +
            ', qlen:' +
            this.buffer.queue!.length
        );
        this.start.call(self, '11111+');
      }
    } else {
      this.NXDebug.debug(
        '[' +
          this.type +
          '] BufferController  seek: ' +
          time +
          ', bufferLevel: ' +
          this.bufferLevel
      );
      this.start.call(self, '11111');
    }
  };

  stop = (): void => {
    if (this.state === this.WAITING) return;

    this.NXDebug.debug('[' + this.type + '] BufferController stop.');
    this.setState.call(
      this,
      this.isBufferingCompleted ? this.READY : this.WAITING
    );
    this.stopScheduling.call(this);
    this.started = false;
    this.clearPlayListTraceMetrics(new Date(), this.USER_REQUEST_STOP_REASON);
  };

  setIncrementalMode = (value: boolean, _loc?: number): void => {
    this.incrementalMode = value;
  };

  stallStream = (isStalled: boolean, _value?: number): void => {
    if (this.STORE_MEASURED_DATA) {
      if (isStalled) {
        this.metrics!.addBufferingEvent(
          new Date().getTime(),
          0,
          this.videoModel!.getCurrentTime()
        );
      } else {
        this.metrics!.addBufferingEvent(
          new Date().getTime(),
          1,
          this.videoModel!.getCurrentTime()
        );
      }
    }
    this.videoModel!.stallStream(this.type!, isStalled);
  };

  getRepresentationForQuality = (quality: number): Representation =>
    this.availableRepresentations![quality];

  //NSV-a  const setRepresentationTimeOffset = (offset) => {
  //NSV-a    for (let i = 0; i < availableRepresentations.length; i++) {
  //NSV-a      const pto = availableRepresentations[i].presentationTimeOffset;
  //NSV-a      availableRepresentations[i].presentationTimeOffset = offset + pto;
  //NSV-a    }
  //NSV-a  };

  cancelPendingRequests = (
    type: string,
    flagnum?: number,
    loc?: number
  ): void => {
    let flag: number = flagnum || this.RESET;
    let index: number = -1;
    if (flag == this.UPDATE) {
      const pen: Array<SegmentRequest> =
        this.fragmentModel!.getPendingRequests();
      index = -1;

      flag = this.NOCHANGE;
      for (let i = 0; i < pen.length; i++) {
        if (
          !pen[i].keep &&
          pen[i].periodIdx == this.periodInfo!.index &&
          pen[i].adaptationIdx == this.currentAdaptation!.index
        ) {
          index = pen[i].index;
          if (index > 0) index -= 1;
          flag = this.UPDATE;
          break;
        }
      }
    }

    this.fragmentModel!.cancelPendingRequests();
    if (flag != this.NOCHANGE) {
      this.indexHandler!.setupRequestStatus(type, index, loc);
    }
  };

  clearAllSegments = (): void => {
    const reps: Array<Representation> =
      this.currentAdaptation!.representations!;
    for (let i = 0; i < reps.length; i++) {
      reps[i].segments = null;
    }
  };

  abortOnGoingRequests = (): void => {
    this.fragmentModel!.abortRequests(true);
  };

  /* istanbul ignore next */
  checkLoadingRequests = (type: string, totalBufferLevel: number): boolean => {
    const self = this;
    let aborted: boolean = false;
    if (this.fragmentModel != null) {
      const requests: Array<SegmentRequest> =
        this.fragmentModel.getLoadingRequests();
      if (requests.length > 0) {
        for (let i = 0; i < requests.length; i++) {
          const request: SegmentRequest = requests[i];
          const now: number = new Date().getTime();
          const loadingTime: number = (now - request.requestStartTime) / 1000;

          const abortThreshold: number =
            (totalBufferLevel > request.duration * 3
              ? request.duration * 2
              : request.duration * 1.2) *
            ((request.quality == 0 ? 1 : 0) + 1);

          if (loadingTime > abortThreshold) {
            if (request.quality !== 0 || !request.aborted) {
              this.NXDebug.info(
                '[' +
                  type +
                  ']============= This request should be aborted. ================' +
                  requests.length
              );
              this.logHandler.log(
                '[' +
                  i +
                  '/' +
                  requests.length +
                  '][' +
                  this.buffer!.type +
                  ']abort time:' +
                  request.startTime +
                  ',q: ' +
                  request.quality +
                  ', diff:' +
                  (now - request.requestStartTime) / 1000 +
                  ',request.aborted:' +
                  request.aborted
              );
              aborted = true;
              break;
            }
          } else if (loadingTime > request.duration && request.quality !== 0) {
            this.fragmentModel.setRestrictMultiLoad(true);
          }
        }
        if (aborted) {
          const sts: Array<{
            startTime: number;
            representation: Representation;
          }> = [];
          for (let i = 0; i < requests.length; i++) {
            sts.push({
              startTime: requests[i].startTime,
              representation: requests[i].representation!,
            });
            if (this.useFetch)
              this.checkRemoveQForTime.call(self, requests[i].startTime);
          }

          this.fragmentModel.abortRequests(false);
          this.cancelPendingRequests.call(this, type, this.RESET, 2);

          for (let i = 0; i < sts.length; i++) {
            const q: PlaybackQuality = this.abrController!.getPlaybackQuality(
              type,
              sts[i].representation.adaptation!,
              this.metrics!,
              totalBufferLevel,
              aborted,
              this.stalled
            );
            this.indexHandler!.getSegmentRequestForTime(
              sts[i].representation.adaptation!.representations![q.quality],
              sts[i].startTime,
              type,
              5,
              (d) => {
                let request: Nullable<SegmentRequest>;
                if (d.status === 'ok') {
                  if (d.data) {
                    request = d.data;
                    if (request != null) {
                      request.keep = true;
                      request.aborted = true;

                      if (
                        !this.fragmentController!.isFragmentLoadingOrPending(
                          self,
                          request
                        )
                      ) {
                        this.fragmentModel!.addRequest(request);
                      }
                    }
                  }
                } else {
                  request = null;
                }
              }
            );
          }
        }
      }
    }
    return aborted;
  };

  finishValidation = (): void => {
    const self = this;
    if (this.state === this.LOADING) {
      this.setState.call(self, this.READY);
    }
  };

  onBytesLoadingStart = (request: SegmentRequest): void => {
    if (this.fragmentController!.isInitializationRequest(request)) {
      this.setState.call(this, this.READY);
    } else {
      this.setState.call(this, this.LOADING);
      const self = this;

      if (!this.hasData()) return;

      this.setState.call(self, this.READY);
      if (this.fragmentController!.needToPrepareNewRequest(self)) {
        this.getPlaybackQuality.call(self);
        this.requestNewFragment.call(self);
      }
    }
  };

  onBytesLoaded = (request: SegmentRequest, response: Uint8Array): void => {
    if (this.type === 'video') {
      const totalBufferLevel: number =
        this.bufferLevel +
        this.sourceBufferExt!.dataQduration(
          this.buffer!,
          this.isSegmentTemplate
        );

      if (
        (request.requestEndTime - request.requestStartTime) / 1000 >
          request.duration &&
        totalBufferLevel < 10
      ) {
        this.cancelPendingRequests.call(this, this.type, this.UPDATE, 3);
      }
    }
    if (request.canceled) {
      this.fragmentModel!.removeExecutedRequest(request);
      return;
    }
    if (this.fragmentController!.isInitializationRequest(request)) {
      this.onInitializationLoaded.call(this, request, response);
    } else {
      this.onMediaLoaded.call(this, request, response);
    }
  };

  onFirstChunkLoaded = (req: SegmentRequest): number | ChunkQ => {
    const quality: number = req.quality;
    const index: number = req.index;
    const startTime: number = req.startTime;
    const dur: number = req.duration;
    const offset: number = req.MSETimeOffset;
    const curRep: Representation = req.representation!;
    const curAset: AdaptationSet = curRep.adaptation!;
    const asetIdx: number = req.adaptationIdx;
    const pStart: number = curAset.period!.start;
    const initData: InitData =
      this.initializationData[pStart][curAset.index][quality];

    const q: number | ChunkQ = this.sourceBufferExt!.append(
      this.buffer!,
      null,
      initData,
      startTime,
      startTime,
      dur,
      pStart,
      offset,
      this.minBufferTime!,
      quality,
      asetIdx,
      0,
      index
    )!;
    return q;
  };

  /* istanbul ignore next */
  onChunkLoaded = (done: boolean, q: ChunkQ, _in: Uint8Array): void => {
    const self = this;
    const chunk: {
      start?: number;
      data?: Uint8Array;
      dur?: number;
    } = {};
    //let tmplen: number;

    if (done) {
      q.done = true;
      if (q.chunks!.length > 0) {
        q.dur =
          q.chunks![q.chunks!.length - 1].dur +
          (q.chunks![q.chunks!.length - 1].start! - q.time);
      }
    } else {
      let data: Uint8Array;
      let pos: {
        curChunkEnd: number;
        nextChunkEnd: number;
        curChunkDur: number;
        nextChunkDur: number;
        curChunkStartTime: number;
        nextChunkStartTime: number;
      };
      let cur: number = 0;
      let len: number = 0;
      let tmplen: number = 0;
      q.progress!.push(_in);

      q.progress!.forEach((r) => {
        tmplen += r.length;
      });

      if (q.chunkEnd! > tmplen) {
        return;
      }

      pos = this.indexHandler!.extractChunk(
        q,
        tmplen,
        this.periodInfo!.inEventList as Array<DashEvent>,
        this.type!
      );

      if (pos.curChunkEnd == 0) {
        q.chunkEnd = pos.nextChunkEnd;
        q.chunkStartTime = pos.nextChunkStartTime;
        q.chunkDur = pos.nextChunkDur;
        return;
      } else {
        data = new Uint8Array(pos.curChunkEnd);

        for (let i = 0; i < q.progress!.length; i++) {
          const clen: number = q.progress![i].length;
          len += clen;

          if (len <= pos.curChunkEnd) {
            data.set(q.progress![i], cur);
            cur += clen;
            if (len == pos.curChunkEnd) {
              q.progress = [];
              q.chunkEnd = pos.nextChunkEnd;
              q.chunkStartTime = pos.nextChunkStartTime;
              q.chunkDur = pos.nextChunkDur;
              break;
            }
          } else {
            const sa1 = q.progress![i].subarray(
              0,
              clen - (len - pos.curChunkEnd)
            );

            const sa2 = q.progress![i].subarray(
              clen - (len - pos.curChunkEnd),
              clen
            );

            data.set(sa1, cur);
            q.progress = [sa2];
            q.chunkEnd =
              pos.nextChunkEnd > 0 ? pos.nextChunkEnd - pos.curChunkEnd : 0;
            q.chunkStartTime = pos.nextChunkStartTime;
            q.chunkDur = pos.nextChunkDur;
            break;
          }
        }
      }
      chunk.data = data;
      chunk.start = pos.curChunkStartTime;
      chunk.dur = pos.curChunkDur;
      if (!q.appending && q.chunks!.length == 0) {
        q.time = chunk.start;
      }
      q.chunks!.push(chunk as ChunkQ);
    }

    //appendFromBufferQForAB.call(self);
    this.appendFromBufferQ!.call(self);
  };

  onChunkLoadedError = (q: Nullable<ChunkQ>): void => {
    const idx: number = this.buffer!.queue!.indexOf(q!);
    if (idx > -1) {
      this.buffer!.queue!.splice(idx, 1);
    }
    q = null;
    return;
  };

  /* istanbul ignore next */
  onMediaLoaded = (
    request: SegmentRequest,
    data: Nullable<Uint8Array>
  ): void => {
    const self = this;
    const curRep: Representation = request.representation!;
    const path: Array<string> = request.url!.split('/');
    this.NXDebug.info(
      'str: [' +
        request.streamType +
        '] loaded, ' +
        path[path.length - 1] +
        ', i=' +
        request.index +
        ' ,t=' +
        Math.floor(request.startTime) +
        ' total=' +
        (request.requestEndTime - request.requestStartTime) +
        'ms' +
        ', ' +
        (data != null ? data.length : 'NULL') +
        'bytes' +
        ' rst:' +
        new Date().getTime()
    );
    if (this.isDynamic) {
      curRep.adaptation!.period!.liveEdgeFromRequest = Math.max(
        curRep.adaptation!.period!.liveEdgeFromRequest,
        request.startTime + request.duration
      );
    }

    if (!this.fragmentDuration && !isNaN(request.duration)) {
      this.fragmentDuration = request.duration;
    }
    if (data !== null) {
      this.appendToBuffer.call(self, data, request, (f) => {
        if (f) {
          if (
            curRep.lastRequestIndex === request.index &&
            !this.isBufferingCompleted
          ) {
            this.isBufferingCompleted = true;
            if (this.stalled) {
              this.stalled = false;
              this.stallStream.call(self, this.stalled, 1);
            }
            this.setState.call(self, this.READY);
            this.eventBus!.dispatchEvent({
              type: 'bufferingCompleted',
              data: this.type,
            });
          } else {
            if (this.fragmentController!.needToPrepareNewRequest(self)) {
              this.getPlaybackQuality.call(self);
              this.requestNewFragment.call(self);
            }
          }
          if (!this.useFetch) {
            this.appendFromBufferQ!.call(self);
          }
        } else {
          this.NXDebug.debug('ERROR: appentToBuffer');
        }
      });
    } else {
      this.NXDebug.log('No ' + this.type + ' bytes to push.');
    }
  };

  /* istanbul ignore next */
  appendToBuffer = (
    data: undefined | Nullable<Uint8Array>,
    req: SegmentRequest,
    callback: (val: boolean) => void
  ): void => {
    const self = this;
    const currentVideoTime: number = this.videoModel!.getCurrentTime();
    const currentTime: Date = new Date();
    const quality: number = req.quality;
    const rstime: number = req.startTime;
    let startTime: number = 0;
    let dur: number = req.duration;
    const offset: number = req.MSETimeOffset;
    const curRep: Representation = req.representation!;
    const curAset: AdaptationSet = curRep.adaptation!;
    const asetIdx: number = req.adaptationIdx;
    const pStart: number = curAset.period!.start;
    let initData: undefined | InitData;
    let diff_debug: number | string = 0;
    if (
      this.playListTraceMetricsClosed === true &&
      this.state !== this.WAITING &&
      this.requiredQuality !== -1
    ) {
      this.playListTraceMetricsClosed = false;
      this.playListTraceMetrics = this.metrics!.appendPlayListTrace(
        this.playListMetrics!,
        curRep.id!,
        null,
        currentTime,
        currentVideoTime,
        null,
        1.0,
        null
      );
    }
    if (!this.hasData()) {
      callback(false);
      return;
    }
    if (this.preAppendTime !== rstime) {
      diff_debug = Math.floor(rstime) - Math.floor(this.preAppendTime);
      if (this.preAppendTime === -1) diff_debug = '-';
      this.preAppendTime = rstime;
    } else {
      if (this.type === 'video') {
        this.logHandler.log_V2(
          this.type[0] +
            '[' +
            quality +
            '] t=' +
            parseInt(String(rstime * 100.0)) / 100.0 +
            ' dup'
        );
      } else {
        this.logHandler.log_A2(
          this.type![0] +
            '[' +
            quality +
            '] t=' +
            parseInt(String(rstime * 100.0)) / 100.0 +
            ' dup'
        );
      }
    }

    if (this.currentQuality !== quality) {
      this.currentQuality = quality;
      if (this.type === 'video') {
        this.logHandler.log_V2(
          this.type[0] + '[' + this.currentQuality + '] init'
        );
        this.logHandler.log_V2(
          this.type[0] +
            '[' +
            quality +
            '] t=' +
            parseInt(String(rstime * 100.0)) / 100.0 +
            ' : ' +
            diff_debug
        );

        this.logHandler.log_item(
          'bw_video',
          'Video: ' +
            curRep.bandwidth! / 1000 +
            ' Kbps' +
            ' (' +
            curRep.width +
            'x' +
            curRep.height +
            ')'
        );
      } else {
        this.logHandler.log_A2(
          this.type![0] + '[' + this.currentQuality + '] init'
        );
        this.logHandler.log_A2(
          this.type![0] +
            '[' +
            quality +
            '] t=' +
            parseInt(String(rstime * 100.0)) / 100.0 +
            ' : ' +
            diff_debug
        );

        this.logHandler.log_item(
          'bw_audio',
          'Audio: ' + curRep.bandwidth! / 1000 + ' Kbps'
        );
      }
    } else {
      if (this.type === 'video') {
        this.logHandler.log_V2(
          this.type![0] +
            '[' +
            quality +
            '] t=' +
            parseInt(String(rstime * 100.0)) / 100.0 +
            ' : ' +
            diff_debug
        );
      } else {
        this.logHandler.log_A2(
          this.type![0] +
            '[' +
            quality +
            '] t=' +
            parseInt(String(rstime * 100.0)) / 100.0 +
            ' : ' +
            diff_debug
        );
      }
    }
    if (this.useFetch) {
      callback(true);
      return;
    }
    try {
      initData = this.initializationData[pStart][curAset.index][quality];
    } catch (e) {
      initData = undefined;
    }
    if (!initData) {
      this.fragmentModel!.removeExecutedRequest(req);
      return;
    }

    if (this.type == 'video' && this.EXTRACT_ALL_IDR_IN_MOOF) {
      data = this.indexHandler!.extractIDRinMOOF(
        data!,
        initData.params!.timescale,
        curRep.codecs!
      );
    }

    const moofs: Array<Moof> = this.indexHandler!.parseFragment(
      data!,
      initData.params.timescale,
      initData.params.dsd,
      offset,
      this.type!,
      this.periodInfo!.inEventList as Array<DashEvent>
    );
    startTime = moofs[0].time!;
    dur =
      moofs[moofs.length - 1].time! + moofs[moofs.length - 1].dur! - startTime;

    if (dur < this.MSE_APPEND_ENABLE_THRESHOLD! + 1 || moofs.length < 2) {
      if (data != undefined)
        this.sourceBufferExt!.append(
          this.buffer!,
          data,
          initData,
          rstime,
          startTime,
          dur,
          pStart,
          offset,
          this.minBufferTime!,
          quality,
          asetIdx,
          0,
          req.index
        );
    } else {
      let s_offset: number | undefined = undefined;
      let s_startTime: number | undefined = undefined;
      let s_dur: number = 0;
      let divNum: number = 0;

      for (let i = 0; i < moofs.length; i++) {
        const t_offset: number = moofs[i].offset;
        const t_size: number = moofs[i].size!;
        const t_startTime: number = moofs[i].time!;
        const t_dur = moofs[i].dur;
        let tmp: Uint8Array;
        if (s_dur === 0) {
          //s_startTime = t_startTime + pStart;
          //s_startTime = startTime + (t_startTime-earliestStartTime);
          s_startTime = t_startTime;
          s_offset = t_offset;
        }
        s_dur += t_dur!;
        if (
          s_dur > this.MSE_APPEND_ENABLE_THRESHOLD! ||
          i == moofs.length - 1
        ) {
          tmp = data!.subarray(s_offset, t_offset + t_size);
          this.sourceBufferExt!.append(
            this.buffer!,
            tmp,
            initData,
            rstime,
            s_startTime!,
            s_dur,
            pStart,
            offset,
            this.minBufferTime!,
            quality,
            asetIdx,
            divNum,
            req.index
          );
          s_dur = 0;
          divNum++;
        }
      }
    }
    data = void 0;
    // if (!isScheduled && isSchedulingRequired.call(self)) {
    //   start.call(self, '222222');
    // }
    this.updateBufferLevel.call(self);
    const ranges: Nullable<TimeRanges> = this.sourceBufferExt!.getAllRanges(
      this.buffer!
    );
    if (ranges) {
      if (ranges.length > 0) {
        const len: number = ranges.length;

        for (let i = 0; i < len; i += 1) {
          this.NXDebug.debug(
            '[' +
              this.type +
              '] Buffered Range[' +
              i +
              ']: ' +
              ranges.start(i) +
              ' - ' +
              ranges.end(i)
          );
        }
      }
    }
    callback(true);
  };

  firstSegmentInCurrentPeriod = (): boolean => {
    if (this.buffer!.queue!.length == 0) return false;

    const q: ChunkQ = this.buffer!.queue![0];

    if (q.pStart! == this.periodInfo!.start) {
      if (q.time - this.periodInfo!.start <= this.tolerance) {
        const ct = this.videoModel!.getCurrentTime();
        if (this.periodInfo!.start - ct < this.MSE_APPEND_ENABLE_THRESHOLD!) {
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    return false;
  };

  appendFromBufferQv01 = (): void => {
    if (
      this.bufferLevel < this.MSE_APPEND_ENABLE_THRESHOLD! ||
      this.waitingForBuffer ||
      this.firstSegmentInCurrentPeriod()
    ) {
      this.sourceBufferExt!.appendFromQ(
        this.buffer!,
        this.waitingForBuffer,
        this.bufferStartThreshold
      );
    }
  };

  /* istanbul ignore next */
  appendFromBufferQForAB = (): void => {
    if (this.appendFromBufferQisProcessing) return;

    if (
      this.bufferLevel < this.MSE_APPEND_ENABLE_THRESHOLD! ||
      this.waitingForBuffer ||
      this.firstSegmentInCurrentPeriod() ||
      this.videoModel!.getNeedsMoreData()
    ) {
      this.appendFromBufferQisProcessing = true;
      this.sourceBufferExt!.waitForUpdateEnd(this.buffer!, () => {
        if ('remove' in this.buffer! && this.buffer!.buffered.length > 0) {
          const curTime: number = this.videoModel!.getCurrentTime();
          const bStart: number = this.buffer!.buffered.start(0);
          if (bStart + 35 < curTime) {
            this.sourceBufferExt!.remove(
              this.buffer!,
              bStart,
              curTime - 30,
              this.periodInfo!.duration,
              this.mediaSource!,
              () => {
                this.sourceBufferExt!.appendFromQ(
                  this.buffer!,
                  this.waitingForBuffer,
                  this.bufferStartThreshold
                );
                this.appendFromBufferQisProcessing = false;
              }
            );
          } else {
            this.sourceBufferExt!.appendFromQ(
              this.buffer!,
              this.waitingForBuffer,
              this.bufferStartThreshold
            );
            this.appendFromBufferQisProcessing = false;
          }
        } else {
          this.sourceBufferExt!.appendFromQ(
            this.buffer!,
            this.waitingForBuffer,
            this.bufferStartThreshold
          );
          this.appendFromBufferQisProcessing = false;
        }
      });
    }
  };

  updateBufferLevel = (): boolean => {
    if (!this.hasData()) return false;
    const self = this;
    const currentTime: number = this.getWorkingTime.call(self);

    const bufferLength: number = this.sourceBufferExt!.getBufferLength(
      this.buffer!,
      currentTime,
      this.tolerance
    );

    this.tlen = this.sourceBufferExt!.getBufferLength(
      this.buffer!,
      currentTime + 1.0,
      this.tolerance
    );
    if (!this.hasData()) {
      return false;
    }
    this.bufferLevel = bufferLength;
    this.buffer!.level = this.bufferLevel;
    this.metrics!.addBufferLevel(
      this.type!,
      new Date().getTime(),
      this.bufferLevel,
      this.sourceBufferExt!.dataQduration(this.buffer!, this.isSegmentTemplate),
      currentTime
    );
    this.checkIfSufficientBuffer.call(self);

    /* istanbul ignore if */
    if (!this.started) {
      if (this.type === 'video') {
        this.logHandler.log_item(
          'ctime',
          'time: ' +
            new Number(this.videoModel!.getCurrentTime()).toFixed(2) +
            ', dur: ' +
            (isFinite(this.videoModel!.getDuration())
              ? new Number(this.videoModel!.getDuration()).toFixed(2)
              : this.videoModel!.getDuration())
        );
        this.logHandler.log_item(
          'vlog',
          this.type +
            ' len: ' +
            this.buffer!.buffered.length +
            ', buffer: ' +
            parseInt(String(this.bufferLevel * 100.0)) / 100.0
        );
      } else {
        this.logHandler.log_item(
          'alog',
          this.type +
            ' len: ' +
            this.buffer!.buffered.length +
            ', buffer: ' +
            parseInt(String(this.bufferLevel * 100.0)) / 100.0
        );
      }
      this.logHandler.log_slider(
        this.videoModel!.getCurrentTime(),
        this.videoModel!.getDuration()
      );
    }

    return true;
  };

  //NSV-a  const clearBuffer = (_callback) => {
  //NSV-a    const callback = _callback || (() => {});
  //NSV-a    const currentTime = videoModel.getCurrentTime();
  //NSV-a    let removeStart = 0;
  //NSV-a    let removeEnd;
  //NSV-a    let req;
  //NSV-a    let range;
  //NSV-a
  //NSV-a    req = fragmentController.getExecutedRequestForTime(
  //NSV-a      fragmentModel,
  //NSV-a      currentTime
  //NSV-a    );
  //NSV-a    removeEnd =
  //NSV-a      req && !isNaN(req.startTime)
  //NSV-a        ? req.startTime - 5
  //NSV-a        : Math.floor(currentTime - 5);
  //NSV-a    fragmentDuration = req && !isNaN(req.duration) ? req.duration : 1;
  //NSV-a
  //NSV-a    range = sourceBufferExt.getBufferRange(buffer, currentTime, tolerance);
  //NSV-a
  //NSV-a    if (
  //NSV-a      range === null &&
  //NSV-a      seekTarget === currentTime &&
  //NSV-a      buffer.buffered.length > 0
  //NSV-a    ) {
  //NSV-a      removeEnd = buffer.buffered.end(buffer.buffered.length - 1);
  //NSV-a    }
  //NSV-a    removeStart = buffer.buffered.start(0);
  //NSV-a    sourceBufferExt.remove(
  //NSV-a      buffer,
  //NSV-a      removeStart,
  //NSV-a      removeEnd,
  //NSV-a      periodInfo.duration,
  //NSV-a      mediaSource,
  //NSV-a      (f) => {
  //NSV-a        if (f) {
  //NSV-a          fragmentController.removeExecutedRequestsBeforeTime(
  //NSV-a            fragmentModel,
  //NSV-a            removeEnd
  //NSV-a          );
  //NSV-a          callback(removeEnd - removeStart);
  //NSV-a        } else {
  //NSV-a          callback(0);
  //NSV-a        }
  //NSV-a      }
  //NSV-a    );
  //NSV-a  };

  onInitializationLoaded = (
    request: SegmentRequest,
    data: Nullable<Uint8Array>
  ): void => {
    const quality: number = request.quality;

    this.NXDebug.log('Initialization finished loading: ' + request.streamType);
    if (data !== null) {
      this.initializationData[this.periodInfo!.start][
        this.currentAdaptation!.index
      ][quality].data = data;
      //NSV-a      initIsLoading = false;
    } else {
      this.NXDebug.log('No ' + this.type + ' bytes to push.');
    }
  };

  /* istanbul ignore next */
  onBytesError = (evType: string, request: SegmentRequest): void => {
    const self = this;
    if (this.state === this.LOADING) {
      this.setState.call(this, this.READY);
    }

    if (!this.isScheduled) {
      this.cancelPendingRequests.call(self, this.type!, this.UPDATE, 4);
      return;
    }
    if (evType == 'onloadend') {
      let failedList: Array<Array<number>>;
      const lq: number = request.quality;

      if (request.failedList) {
        failedList = request.failedList;

        if (failedList[request.baseURLIdx].indexOf(lq) < 0) {
          failedList[request.baseURLIdx].push(lq);
        }
      } else {
        failedList = new Array(request.baseURL.length);
        for (let i = 0; i < failedList.length; i++) {
          failedList[i] = [];
        }

        failedList[request.baseURLIdx].push(request.quality);
      }

      const bs: number = request.baseURL.length;
      for (let i = 0; i < bs; i++) {
        if (failedList[i].indexOf(lq) < 0) {
          request.baseURLIdx = i;
          request.failedList = failedList;
          if (this.useFetch)
            this.checkRemoveQForTime.call(self, request.startTime);
          if (
            !this.fragmentController!.isFragmentLoadingOrPending(self, request)
          ) {
            this.fragmentModel!.addRequest(request);
          }
          return;
        }
      }
      const qs: number =
        request.representation!.adaptation!.representations!.length;
      let q: number = 0;
      const sbidx: number =
        request.representation!.adaptation!.period!.selectedBaseURLIdx;
      let bidx: number = sbidx;
      let decision: boolean = false;

      for (let i = 0; i < qs; i++) {
        if (failedList[sbidx].indexOf(i) < 0) {
          q = i;
          decision = true;
          break;
        }
      }
      if (decision == false) {
        for (let ii = 0; ii < bs; ii++) {
          if (ii == sbidx) continue;

          for (let i = 0; i < qs; i++) {
            if (failedList[ii].indexOf(i) < 0) {
              q = i;
              bidx = ii;
              decision = true;
              break;
            }
          }
          if (decision == true) break;
        }
      }

      this.indexHandler!.getSegmentRequestForTime(
        request.representation!.adaptation!.representations![q],
        request.startTime,
        this.type!,
        6,
        (d) => {
          let request: Nullable<SegmentRequest>;
          if (d.status === 'ok') {
            if (d.data) {
              request = d.data;
              if (request != null) {
                request.baseURLIdx = bidx;
                request.failedList = failedList;

                if (this.useFetch)
                  this.checkRemoveQForTime.call(self, request.startTime);

                if (
                  !this.fragmentController!.isFragmentLoadingOrPending(
                    self,
                    request
                  )
                ) {
                  this.fragmentModel!.addRequest(request);
                }
              }
            }
          } else {
            request = null;
          }
        }
      );
    } else if (evType == 'onabort') {
      // eslint-disable-line no-empty
    }
  };

  checkRemoveQForTime = (rstime: number): void => {
    for (let i = 0; i < this.buffer!.queue!.length; i++) {
      if (this.buffer!.queue![i].rstime == rstime) {
        if (!this.buffer!.queue![i].done) {
          this.buffer!.queue!.splice(i, 1);
        }
        break;
      }
    }
  };

  //NSV-a  const searchForLiveEdge = function (_callback) {
  //NSV-a    const self = this; // set the time span that limits our search range to a 12 hours in seconds
  //NSV-a    const callback = _callback || (() => {});
  //NSV-a
  //NSV-a    // all segments are supposed to be available in this interval
  //NSV-a    const availabilityRange = currentRepresentation.segmentAvailabilityRange;
  //NSV-a
  //NSV-a    const searchTimeSpan = 12 * 60 * 60;
  //NSV-a    // start position of the search, it is supposed to be a live edge - the last available segment for the current mpd
  //NSV-a    liveEdgeInitialSearchPosition = availabilityRange.end;
  //NSV-a    // we should search for a live edge in a time range which is limited by searchTimeSpan.
  //NSV-a    liveEdgeSearchRange = {
  //NSV-a      start: Math.max(0, liveEdgeInitialSearchPosition - searchTimeSpan),
  //NSV-a      end: liveEdgeInitialSearchPosition + searchTimeSpan,
  //NSV-a    };
  //NSV-a    // we have to use half of the availability interval (window) as a search step to ensure that we find a segment in the window
  //NSV-a    liveEdgeSearchStep = Math.floor(
  //NSV-a      (availabilityRange.end - availabilityRange.start) / 2
  //NSV-a    );
  //NSV-a    // start search from finding a request for the initial search time
  //NSV-a
  //NSV-a    indexHandler.getSegmentRequestForTime(
  //NSV-a      currentRepresentation,
  //NSV-a      liveEdgeInitialSearchPosition,
  //NSV-a      type,
  //NSV-a      findLiveEdge.bind(
  //NSV-a        self,
  //NSV-a        liveEdgeInitialSearchPosition,
  //NSV-a        onSearchForSegmentSucceeded,
  //NSV-a        onSearchForSegmentFailed,
  //NSV-a        callback
  //NSV-a      )
  //NSV-a    );
  //NSV-a  };

  findLiveEdge = (
    searchTime: number,
    onSuccess: (request: SegmentRequest, searchTime: number, callback) => void,
    onError: (request: SegmentRequest, searchTime: number, callback) => void,
    _callback: any,
    d: ResponseData
  ): void => {
    const self = this;
    const callback = _callback;
    let request: Nullable<SegmentRequest>;
    if (d.status === 'ok') {
      request = d.data;
    } else {
      request = null;
    }
    if (request === null) {
      // request can be null because it is out of the generated list of request. In this case we need to
      // update the list and the segmentAvailabilityRange
      this.currentRepresentation!.segments = null;
      this.currentRepresentation!.segmentAvailabilityRange = {
        start: searchTime - this.liveEdgeSearchStep!,
        end: searchTime + this.liveEdgeSearchStep!,
      };
      // try to get request object again
      this.indexHandler!.getSegmentRequestForTime(
        this.currentRepresentation!,
        searchTime,
        this.type!,
        0,
        this.findLiveEdge.bind(self, searchTime, onSuccess, onError, callback)
      );
    } else {
      this.fragmentController!.isFragmentExists(self, request, (isExist) => {
        if (isExist) {
          onSuccess.call(self, request!, searchTime, callback);
        } else {
          onError.call(self, request!, searchTime, callback);
        }
      });
    }
  };

  onSearchForSegmentFailed = (
    _request: SegmentRequest,
    lastSearchTime: number,
    callback: (data: ResponseData) => void
  ): void => {
    const searchTime: number = lastSearchTime - 5;

    if (
      searchTime < this.currentRepresentation!.segmentAvailabilityRange!.start
    ) {
      this.eventBus!.dispatchEvent({
        type: 'segmentLoadingFailed',
        data: {},
      });
    } else {
      this.setState.call(this, this.READY);
      this.indexHandler!.getSegmentRequestForTime(
        this.currentRepresentation!,
        searchTime,
        this.type!,
        0,
        this.findLiveEdge.bind(
          this,
          searchTime,
          this.onSearchForSegmentSucceeded,
          this.onSearchForSegmentFailed,
          callback
        )
      );
    }
  };

  onSearchForSegmentSucceeded = (
    request: SegmentRequest,
    lastSearchTime: number,
    _callback: (time: number) => void
  ): void => {
    const startTime: number = request.startTime;
    const self = this;
    const callback: (time: number) => void = _callback || (() => {});
    let searchTime: number;
    if (!this.useBinarySearch) {
      // if the fragment duration is unknown we cannot use binary search because we will not be able to
      // decide when to stop the search, so let the start time of the current segment be a liveEdge
      if (this.fragmentDuration === 0) {
        callback(startTime);
        return;
      }
      this.useBinarySearch = true;
      this.liveEdgeSearchRange.end = startTime + 2 * this.liveEdgeSearchStep!;

      //if the first request has succeeded we should check next segment - if it does not exist we have found live edge,
      // otherwise start binary search to find live edge
      if (lastSearchTime === this.liveEdgeInitialSearchPosition) {
        searchTime = lastSearchTime + this.fragmentDuration;
        this.indexHandler!.getSegmentRequestForTime(
          this.currentRepresentation,
          searchTime,
          this.type!,
          0,
          this.findLiveEdge.bind(
            self,
            searchTime,
            () => {
              this.binarySearch.call(self, true, searchTime, callback);
            },
            () => {
              callback(searchTime);
            },
            callback
          )
        );

        return;
      }
    }

    this.binarySearch.call(this, true, lastSearchTime, callback);
  };

  binarySearch = (
    lastSearchSucceeded: boolean,
    lastSearchTime: number,
    _callback: (val: number) => void
  ) => {
    let isSearchCompleted: boolean;
    const callback: (val: number) => void = _callback || (() => {});
    let searchTime: number;

    if (lastSearchSucceeded) {
      this.liveEdgeSearchRange.start = lastSearchTime;
    } else {
      this.liveEdgeSearchRange.end = lastSearchTime;
    }

    isSearchCompleted =
      Math.floor(
        this.liveEdgeSearchRange.end! - this.liveEdgeSearchRange.start!
      ) <= this.fragmentDuration;

    if (isSearchCompleted) {
      // search completed, we should take the time of the last found segment. If the last search succeded we
      // take this time. Otherwise, we should subtract the time of the search step which is equal to fragment duaration
      callback(
        lastSearchSucceeded
          ? lastSearchTime
          : lastSearchTime - this.fragmentDuration
      );
    } else {
      // update the search time and continue searching
      searchTime =
        (this.liveEdgeSearchRange.start! + this.liveEdgeSearchRange.end!) / 2;
      this.indexHandler!.getSegmentRequestForTime(
        this.currentRepresentation!,
        searchTime,
        this.type!,
        0,
        this.findLiveEdge.bind(
          this,
          searchTime,
          this.onSearchForSegmentSucceeded,
          this.onSearchForSegmentFailed,
          callback
        )
      );
    }
  };

  signalStreamComplete = (request: SegmentRequest): void => {
    if (request.periodIdx != this.periodInfo!.index) {
      return;
    }
    this.stop.call(this);

    this.keepCurrentRequests.call(this);
    this.isStreamCompleted = true;
    this.eventBus!.dispatchEvent({
      type: 'streamIsCompleted',
      data: {
        type: this.type,
        periodIdx: request.periodIdx,
        pStart: request.representation!.adaptation!.period!.start,
        pEnd: request.representation!.adaptation!.period!.end,
      },
    });
  };

  //NSV-a  const loadInitialization = function (_callback) {
  //NSV-a    const callback = _callback || (() => {});
  //NSV-a    if (initialPlayback) {
  //NSV-a      NXDebug.log('Marking a special seek for initial ' + type + ' playback.');
  //NSV-a
  //NSV-a      // If we weren't already seeking, 'seek' to the beginning of the stream.
  //NSV-a      if (!seeking) {
  //NSV-a        seeking = true;
  //NSV-a        seekTarget = 0;
  //NSV-a        setIncrementalMode.call(this, false, 2);
  //NSV-a      }
  //NSV-a
  //NSV-a      initialPlayback = false;
  //NSV-a    }
  //NSV-a
  //NSV-a    if (currentQuality !== requiredQuality || currentQuality === -1) {
  //NSV-a      if (
  //NSV-a        initializationData[periodInfo.start][currentAdaptation.index][
  //NSV-a          requiredQuality
  //NSV-a        ]
  //NSV-a      ) {
  //NSV-a        initIsLoading = false;
  //NSV-a        callback({
  //NSV-a          status: 'ok',
  //NSV-a          data: null,
  //NSV-a        });
  //NSV-a      } else if (initIsLoading) {
  //NSV-a        callback({
  //NSV-a          status: 'ok',
  //NSV-a          data: null,
  //NSV-a        });
  //NSV-a      } else {
  //NSV-a        initIsLoading = true;
  //NSV-a        indexHandler.getInitRequest(
  //NSV-a          availableRepresentations[requiredQuality],
  //NSV-a          type,
  //NSV-a          callback
  //NSV-a        );
  //NSV-a      }
  //NSV-a    }
  //NSV-a  };

  /* istanbul ignore next */
  loadFirstSegmentRequestAfterSeek = (seekTarget: number): void => {
    const self = this;
    let segmentTime: number;
    const time: number = seekTarget;
    let request: SegmentRequest;
    const ctime: number = this.videoModel!.getCurrentTime();
    const range: Nullable<TimeRange> = this.sourceBufferExt!.getBufferRange(
      this.buffer!,
      time,
      this.tolerance
    );
    if (
      this.isDynamic &&
      this.seeking &&
      (this.currentRepresentation!.segmentInfoType === 'SegmentTimeline' ||
        this.currentRepresentation!.segmentInfoType === 'SegmentTemplate' ||
        this.currentRepresentation!.segmentInfoType === 'SegmentList')
    ) {
      this.currentRepresentation!.segments = null;
    }

    segmentTime = range ? range.end : time;

    if (segmentTime < this.periodInfo!.start) {
      return;
    }

    if (range) {
      this.NXDebug.debug(
        '[' +
          this.type +
          '] Loading the fragment for seek time: ' +
          segmentTime +
          ', ' +
          time +
          ' [' +
          range.start +
          '-' +
          range.end +
          ']'
      );
    } else {
      this.NXDebug.debug(
        '[' +
          this.type +
          '] Loading the fragment for seek time: ' +
          segmentTime +
          ', ' +
          time
      );
    }

    if (
      ctime === 0 ||
      segmentTime < ctime + this.BUFFER_PREFETCH_THRESHOLD! * 1.5
    ) {
      this.setIncrementalMode.call(self, false, 3);
      this.seeking = false;
      this.indexHandler!.getSegmentRequestForTime(
        this.currentRepresentation!,
        segmentTime,
        this.type!,
        1,
        (d) => {
          if (d.status == 'ok') {
            request = d.data;
            if (request != null) {
              this.buffer!.startTimeAfterSeek = request.startTime;
              this.NXDebug.info(
                '[' +
                  this.type +
                  '] startTimeAfterSeek:' +
                  this.buffer!.startTimeAfterSeek
              );
              request.keep = true;
              request.las = true;
            } else {
              this.buffer!.startTimeAfterSeek = Number.MAX_VALUE;
            }

            const rqs: Array<Array<SegmentRequest>> = [
              this.fragmentModel!.getLoadingRequests(),
              this.fragmentModel!.getPendingRequests(),
            ];
            rqs.forEach((l) => {
              for (let i = 0; i < l.length; i++) {
                if (l[i].las) {
                  l[i].keep = false;
                }
              }
            });

            this.checkQ.call(self, seekTarget);

            if (this.useFetch)
              this.checkRemoveQForTime.call(self, request.startTime);

            if (
              request != null &&
              !this.fragmentController!.isFragmentLoadingOrPending(
                self,
                request
              )
            ) {
              this.fragmentModel!.addRequest(request);
            }
          }
          this.setIncrementalMode.call(self, true, 33);
          this.seeking = false;
          this.setState.call(self, this.READY);
        }
      );
    } else {
      this.NXDebug.debug(
        '[' +
          this.type +
          '] Loading the fragment for time: skip ' +
          ctime +
          ' : ' +
          segmentTime
      );
      this.seeking = false;
    }
  };

  /* istanbul ignore next */
  loadNextFragment = (_callback: (d: ResponseData) => void): void => {
    const callback: (d: ResponseData) => void = _callback;
    const self = this;
    const ctime: number = this.videoModel!.getCurrentTime();
    if (
      this.incrementalMode &&
      !this.indexHandler!.isInitialIndex(this.type!)
    ) {
      this.indexHandler!.getNextSegmentRequest(
        this.currentRepresentation!,
        this.type!,
        (d) => {
          if (d.status === 'ok') {
            if (
              d.data != null &&
              ctime + this.BUFFER_PREFETCH_THRESHOLD! * 1.5 < d.data.startTime
            ) {
              this.setIncrementalMode.call(self, true, 4);
            }
          }
          callback(d);
        }
      );
    } else {
      let segmentTime: number;
      let time: number;
      if (this.seeking) {
        time = this.seekTarget;
      } else {
        time = ctime > 0 ? ctime : this.videoModel!.getStartTime();
      }
      const range: Nullable<TimeRange> = this.sourceBufferExt!.getBufferRange(
        this.buffer!,
        time,
        this.tolerance
      );
      if (
        this.isDynamic &&
        this.seeking &&
        (this.currentRepresentation!.segmentInfoType === 'SegmentTimeline' ||
          this.currentRepresentation!.segmentInfoType === 'SegmentTemplate' ||
          this.currentRepresentation!.segmentInfoType === 'SegmentList')
      ) {
        this.currentRepresentation!.segments = null;
      }

      segmentTime = range ? range.end : time;

      if (segmentTime < this.periodInfo!.start) {
        // if (isScheduled) {
        //   segmentTime = periodInfo.start;
        // } else {
        //   return;
        // }
        return;
      }

      if (range) {
        this.NXDebug.debug(
          '[' +
            this.type +
            '] Loading the fragment for time: ' +
            segmentTime +
            ', ' +
            time +
            ' [' +
            range.start +
            '-' +
            range.end +
            ']'
        );
      } else {
        this.NXDebug.debug(
          '[' +
            this.type +
            '] Loading the fragment for time: ' +
            segmentTime +
            ', ' +
            time
        );
      }

      if (
        ctime === 0 ||
        segmentTime < ctime + this.BUFFER_PREFETCH_THRESHOLD! * 1.5
      ) {
        //reject
        this.setIncrementalMode.call(self, true, 5);
        this.indexHandler!.getSegmentRequestForTime(
          this.currentRepresentation!,
          segmentTime,
          this.type!,
          1,
          callback
        );
      } else {
        this.NXDebug.debug(
          '[' +
            this.type +
            '] Loading the fragment for time: skip ' +
            ctime +
            ' : ' +
            segmentTime
        );
        this.seeking = false;
        callback({
          status: 'ok',
          data: null,
        });
      }
      //seeking = false;
    }
  };
  //NSV-a  const hasAlreadyBuffered = (request) => {
  //NSV-a    let flag = false;
  //NSV-a    const length = sourceBufferExt.getBufferLength(
  //NSV-a      buffer,
  //NSV-a      request.startTime,
  //NSV-a      tolerance
  //NSV-a    );
  //NSV-a
  //NSV-a    flag = length > 0 ? true : false;
  //NSV-a    return flag;
  //NSV-a  };

  /* istanbul ignore next */
  onFragmentRequest = (d: ResponseData): void => {
    const self = this;
    let request: Nullable<SegmentRequest>;
    if (d.status === 'ok') {
      request = d.data;
    } else {
      request = null;
    }

    if (request !== null) {
      const length: number = this.sourceBufferExt!.getBufferLength(
        this.buffer!,
        request.startTime,
        this.tolerance
      );
      if (length > request.duration) {
        this.setIncrementalMode.call(self, false, 6);
        this.setState.call(self, this.READY);
      }
      // If we have already loaded the given fragment ask for the next one. Otherwise prepare it to get loaded
      else if (
        this.fragmentController!.isFragmentLoadedOrPending(self, request)
      ) {
        if (request.action !== 'complete') {
          this.NXDebug.debug(
            '[' +
              this.type +
              '] Index for time Next!!! cur idx: ' +
              request.index +
              ', t=' +
              request.startTime
          );
          this.indexHandler!.getNextSegmentRequest(
            this.currentRepresentation!,
            this.type!,
            this.onFragmentRequest.bind(self)
          );
        } else {
          this.stop.call(self);
          this.setState.call(self, this.READY);
        }
      } else {
        this.NXDebug.debug(
          '[' +
            this.type +
            '] startTime:' +
            request.startTime +
            ', length:' +
            length
        );
        if (this.seeking) {
          this.buffer!.startTimeAfterSeek = request.startTime;
          this.NXDebug.info(
            '[' +
              this.type +
              '] startTimeAfterSeek:' +
              this.buffer!.startTimeAfterSeek +
              ', length:' +
              length
          );
          request.keep = true;
          this.seeking = false;
        }
        this.fragmentModel!.addRequest(request);

        this.setState.call(self, this.READY);
      }
    } else {
      if (
        this.isDynamic &&
        this.isTargetType.call(self, this.type!) &&
        !this.isSegmentTemplate
      ) {
        this.manifestModel!.manifestUpdateStartPoll();
      }
      if (d.time != null) {
        if (d.time < this.periodInfo!.start) {
          this.keepCurrentRequests.call(self);
          this.seek.call(self, this.periodInfo!.start, 'no data');
        }
      }

      this.setState.call(self, this.READY);
    }
  };

  keepCurrentRequests = (): void => {
    const loadings: Array<SegmentRequest> =
      this.fragmentModel!.getLoadingRequests();
    const pendings: Array<SegmentRequest> =
      this.fragmentModel!.getPendingRequests();
    if (loadings.length > 0) {
      for (let i = 0; i < loadings.length; i++) {
        loadings[i].keep = true;
      }
    }
    if (pendings.length > 0) {
      for (let i = 0; i < pendings.length; i++) {
        pendings[i].keep = true;
      }
    }
  };

  /* istanbul ignore next */
  checkIfSufficientBuffer = (): void => {
    if (this.waitingForBuffer) {
      const currentTime: number = this.getWorkingTime();

      const timeToEnd: number = isNaN(this.getMSEDuration())
        ? Infinity
        : this.getMSEDuration() - currentTime;

      if (this.bufferLevel < this.tlen) {
        this.logHandler.log(
          'bufferLevel:' + this.bufferLevel + ', tlen:' + this.tlen
        );
      }
      this.NXDebug.debug(
        '[' +
          this.type +
          '] currentTime:' +
          currentTime +
          ', bufferLevel:' +
          this.tlen +
          ', minBufferTime:' +
          this.minBufferTime +
          ', timeToEnd:' +
          timeToEnd +
          ', isBufferingCompleted:' +
          this.isBufferingCompleted +
          ',qlen:' +
          this.buffer!.queue!.length +
          ',stalled:' +
          this.stalled
      );
      if (
        this.tlen < this.minBufferTime! &&
        (this.minBufferTime! < timeToEnd ||
          (this.minBufferTime! >= timeToEnd && !this.isBufferingCompleted))
      ) {
        if (!this.stalled) {
          this.NXDebug.debug(
            '[' +
              this.type +
              '] Waiting for more buffer before starting playback.'
          );
          this.logHandler.log(
            '[' +
              this.type +
              '] Waiting for more buffer before starting playback.'
          );
          this.stalled = true;
          this.stallStream.call(this, this.stalled, 3);

          if (this.abrController!.getAutoSwitchBitrate()) {
            this.abrController!.setPlaybackQuality(
              this.type!,
              this.videoModel!.getPlaybackState()
                ? 0
                : this.abrController!.getDefaultQualityFor(this.type!)
            );
          }
        }
      } else {
        this.NXDebug.debug(
          '[' +
            this.type +
            '] Got enough buffer to start.' +
            this.tlen +
            ', stalled:' +
            this.stalled
        );
        this.waitingForBuffer = false;
        this.seeking = false; ///
        this.buffer!.startTimeAfterSeek = Number.MAX_VALUE;
        if (this.stalled) {
          this.stalled = false;
          this.stallStream.call(this, this.stalled, 4);
        }
      }
    }
  };

  onNeedToModifyOffset = (evt: ExEvent): void => {
    if (evt.data.type == this.type) {
      const r: Array<Representation> = this.currentAdaptation!.representations!;
      for (let i = 0; i < r.length; i++) {
        r[i].segments = null;
        r[i].presentationTimeOffset += evt.data.minDiff;
      }
      this.cancelPendingRequests.call(self, this.type!, this.RESET, 5);

      if (this.useFetch) {
        const ld: Array<SegmentRequest> =
          this.fragmentModel!.getLoadingRequests();
        for (let i = 0; i < ld.length; i++) {
          let keep: boolean = false;
          for (let j = 0; j < this.buffer!.queue!.length; j++) {
            if (ld[i].startTime == this.buffer!.queue![j].rstime) {
              keep = true;
              break;
            }
          }
          if (!keep) {
            this.fragmentModel!.abortRequestForTime(ld[i].startTime);
          }
        }
      } else {
        this.fragmentModel!.abortRequests();
      }
      this.setIncrementalMode.call(this, false, 7);
    }
  };

  /* istanbul ignore next */
  onAppendedEnoughDataToStart = (evt: ExEvent): void => {
    const self = this;
    let _started: boolean = false;
    let checkStateId: Nullable<ReturnType<typeof setTimeout>> = null;
    const element: NXHTMLVideoElement = this.videoModel!.getElement()!;

    const start = (): void => {
      const ranges: Nullable<TimeRanges> = this.sourceBufferExt!.getAllRanges(
        this.buffer!
      );
      let i: number;
      let len: number;
      for (i = 0, len = ranges!.length; i < len; i += 1) {
        this.logHandler.log(
          '[' +
            this.type +
            '] Buffered Range[' +
            i +
            ']: ' +
            ranges!.start(i) +
            ' - ' +
            ranges!.end(i) +
            ', state:' +
            this.videoModel!.getReadyState() +
            ', c:' +
            this.videoModel!.getCurrentTime() +
            ', paused:' +
            this.videoModel!.isPaused()
        );
      }
      this.NXDebug.debug(
        '[' +
          this.type +
          '] Appended enough data to start.' +
          element.readyState
      );
      this.logHandler.log(
        '[' +
          this.type +
          '] Appended enough data to start.' +
          element.readyState
      );
      _started = true;
      if (this.buffer!.updating != undefined) {
        element.removeEventListener('canplay', start);
        this.buffer!.removeEventListener!('updateend', start);
        clearTimeout(checkStateId!);
      } else {
        // if (type == 'video') {
        //   const ctime = getWorkingTime.call(self);
        //   let blen = 0;
        //   blen = sourceBufferExt.getBufferLength(
        //     buffer,
        //     ctime + 0.8,
        //     tolerance
        //   );
        //   if (blen == 0 && cnt > 0) {
        //     setTimeout(start, 50);
        //     cnt--;
        //     return;
        //   }
        // }
      }
      this.buffer!.startTimeAfterSeek = Number.MAX_VALUE;

      if (this.stalled) {
        this.stalled = false;
        this.stallStream.call(self, this.stalled, 5);
      }

      this.playbackStarted = true;
    };

    const checkState = (): void => {
      if (!_started) {
        if (element.readyState > 2) {
          start();
        } else {
          const ctime: number = this.getWorkingTime.call(self);
          let blen: number = 0;
          blen = this.sourceBufferExt!.getBufferLength(
            this.buffer!,
            ctime + 0.5,
            this.tolerance
          );

          if (blen > 10 && element.readyState < 3) {
            start();
          } else {
            checkStateId = setTimeout(checkState, 1000);
          }
        }
      } else {
        // eslint-disable-line no-empty
      }
    };

    if (this.type === evt.data.type) {
      this.waitingForBuffer = false;

      if (!this.playbackStarted && evt.data.modOffset) {
        const r: Array<Representation> =
          this.currentAdaptation!.representations!;
        for (let i = 0; i < r.length; i++) {
          r[i].segments = null;
          r[i].presentationTimeOffset += evt.data.minDiff;
        }
        for (let i = 0; i < this.buffer!.queue!.length; i++) {
          this.buffer!.queue![i].offset -= evt.data.minDiff;
        }
        this.cancelPendingRequests.call(self, this.type!, this.UPDATE, 6);

        if (this.useFetch) {
          const ld: Array<SegmentRequest> =
            this.fragmentModel!.getLoadingRequests();
          for (let i = 0; i < ld.length; i++) {
            let keep: boolean = false;
            for (let j = 0; j < this.buffer!.queue!.length; j++) {
              if (ld[i].startTime == this.buffer!.queue![j].rstime) {
                keep = true;
                break;
              }
            }
            if (!keep) {
              this.fragmentModel!.abortRequestForTime(ld[i].startTime);
            }
          }
        } else {
          this.fragmentModel!.abortRequests();
        }
        this.setIncrementalMode.call(self, false, 8);
      }

      if (this.buffer!.updating != undefined) {
        if (this.listenToCanplay && element.readyState < 3) {
          element.addEventListener('canplay', start);
          checkStateId = setTimeout(checkState, 1000);
        } else if (this.buffer!.updating) {
          this.buffer!.addEventListener!('updateend', start);
        } else {
          start();
        }
      } else {
        setTimeout(start, 50);
      }
    }
  };

  /* istanbul ignore next */
  onCheckBufferGap = (evt: any): void => {
    const self = this;
    if (evt.data.type == this.type) {
      this.indexHandler!.getSegmentRequestForTime(
        this.currentRepresentation,
        evt.data.time,
        this.type!,
        2,
        (d) => {
          if (d.status === 'ok') {
            const request: Nullable<SegmentRequest> = d.data;
            if (request != null) {
              if (this.useFetch)
                this.checkRemoveQForTime.call(self, request.startTime);

              if (
                !this.fragmentController!.isFragmentLoadingOrPending(
                  self,
                  request
                )
              ) {
                this.fragmentModel!.addRequest(request);
                this.setIncrementalMode.call(self, false, 9);
              }
            }
          } else {
            this.logHandler.log('ERROR: getSegmentsStartTime ' + d.msg);
          }
        }
      );
    }
  };

  isSchedulingRequired = (): boolean => {
    const isPaused: boolean = this.videoModel!.isPaused();

    return !isPaused || (isPaused && this.scheduleWhilePaused);
  };

  hasData = (): boolean =>
    this.currentAdaptation != null && this.buffer != null;

  getTimeToEnd = (): number => {
    const currentTime: number = this.videoModel!.getCurrentTime();

    return this.getMSEDuration.call(this) - currentTime;
  };

  getMSEDuration = (): number => {
    if (this.mediaSource != null) return this.mediaSource.duration;
    else return Infinity;
  };

  setMSEDuration = (dur: number, msg: string): void => {
    if (this.mediaSource != null) {
      try {
        if (this.isTargetType(this.type!)) {
          if (
            isNaN(this.getMSEDuration()) ||
            this.getMSEDuration() == Infinity ||
            dur > this.getMSEDuration()
          ) {
            this.mediaSource.duration = dur;
          }
        }
      } catch (e) {
        this.NXDebug.debug('duration set failed!' + msg);
      }
    }
  };

  getWorkingTime = (): number => {
    let time: number = -1;
    time = this.videoModel!.getPlaybackState()
      ? this.videoModel!.getCurrentTime()
      : this.videoModel!.getStartTime();

    return time;
  };

  //NSV-a  const getBufferLevelFromExecutedRequests = function () {
  //NSV-a    const ex = fragmentController.getExecutedRequests(this);
  //NSV-a    const ct = videoModel.getCurrentTime();
  //NSV-a    let ii;
  //NSV-a
  //NSV-a    if (ex != null && ex.length > 0) {
  //NSV-a      const eb = [];
  //NSV-a      for (ii = 0; ii < ex.length; ii++) {
  //NSV-a        eb.push({
  //NSV-a          start: ex[ii].startTime,
  //NSV-a          end: ex[ii].startTime + ex[ii].duration,
  //NSV-a        });
  //NSV-a      }
  //NSV-a      const compare = (d1, d2) => {
  //NSV-a        if (d1.start < d2.start) return -1;
  //NSV-a        if (d1.start > d2.start) return 1;
  //NSV-a        return 0;
  //NSV-a      };
  //NSV-a      eb.sort(compare);
  //NSV-a
  //NSV-a      const bStart = eb[0].start;
  //NSV-a      let bEnd = eb[0].end;
  //NSV-a      for (ii = 1; ii < eb.length; ii++) {
  //NSV-a        if (bEnd + tolerance >= eb[ii].start) {
  //NSV-a          bEnd = eb[ii].end;
  //NSV-a        } else {
  //NSV-a          break;
  //NSV-a        }
  //NSV-a      }
  //NSV-a
  //NSV-a      if (bStart <= ct && ct <= bEnd) {
  //NSV-a        return bEnd - ct;
  //NSV-a      } else {
  //NSV-a        if (type === 'audio') {
  //NSV-a          logHandler.log(
  //NSV-a            'bStart:' +
  //NSV-a              '0' +
  //NSV-a              ', bEnd:' +
  //NSV-a              '0' +
  //NSV-a              ', ct:' +
  //NSV-a              videoModel.getCurrentTime()
  //NSV-a          );
  //NSV-a        }
  //NSV-a        return 0;
  //NSV-a      }
  //NSV-a    } else {
  //NSV-a      logHandler.log(
  //NSV-a        'bStart:' +
  //NSV-a          '-1' +
  //NSV-a          ', bEnd:' +
  //NSV-a          '-1' +
  //NSV-a          ', ct:' +
  //NSV-a          videoModel.getCurrentTime()
  //NSV-a      );
  //NSV-a      return 0;
  //NSV-a    }
  //NSV-a  };

  getRequiredFragmentCount = (
    _quality: number,
    _callback: (data: number) => void
  ): void => {
    const playbackRate: number = this.videoModel!.getPlaybackRate();

    const actualBufferedDuration: number =
      (this.bufferLevel +
        this.sourceBufferExt!.dataQduration(
          this.buffer!,
          this.isSegmentTemplate
        )) /
      Math.max(playbackRate, 1);

    const callback: (data: number) => void = _callback;

    const requiredBufferLength: number = this.getRequiredBufferLength.call(
      this,
      this.waitingForBuffer,
      this.SCHEDULE_EXECUTE_INTERVAL / 1000,
      this.isDynamic,
      this.periodInfo!.duration
    );

    this.indexHandler!.getSegmentCountForDuration(
      this.currentRepresentation,
      requiredBufferLength,
      actualBufferedDuration,
      (d) => {
        if (d.status === 'ok') {
          if (d.data > 0) {
            callback(d.data);
          } else {
            callback(0);
          }
        } else {
          callback(0);
        }
      }
    );
    this.setBufferState.call(
      this,
      actualBufferedDuration,
      requiredBufferLength
    );
  };

  requestNewFragment = (): void => {
    const self = this;
    const pendingRequests: Nullable<Array<SegmentRequest>> =
      this.fragmentController!.getPendingRequests(self);
    const loadingRequests: Nullable<Array<SegmentRequest>> =
      this.fragmentController!.getLoadingRequests(self);

    const ln: number =
      (pendingRequests ? pendingRequests.length : 0) +
      (loadingRequests ? loadingRequests.length : 0);

    if (this.fragmentsToLoad - ln > 0) {
      this.fragmentsToLoad--;
      this.loadNextFragment.call(self, this.onFragmentRequest.bind(self));
    } else {
      if (this.state === this.VALIDATING) {
        this.setState.call(self, this.READY);
      }

      this.finishValidation.call(this);
    }
  };

  getCurrentHttpRequestLatency = (tmetrics: Metrics): number => {
    const httpRequest: Nullable<HttpRequestMetrics> =
      tmetrics.getCurrentHttpRequest();
    if (httpRequest !== null) {
      return (httpRequest.tresponse! - httpRequest.trequest!) / 1000;
    }
    return 0;
  };

  decideBufferLength = (
    _minBufferTime: number,
    duration: number /*, waitingForBuffer*/
  ): number => {
    let minBufferTarget!: number;

    const minBufferTime: number =
      this.forceDefaultMBT == false
        ? _minBufferTime
        : this.DEFAULT_MIN_BUFFER_TIME!;

    if (
      isNaN(duration) ||
      duration < 0 ||
      (this.DEFAULT_MIN_BUFFER_TIME! < duration && minBufferTime < duration)
    ) {
      minBufferTarget =
        this.ullMode == true
          ? minBufferTime
          : Math.max(this.DEFAULT_MIN_BUFFER_TIME!, minBufferTime);
    } else if (minBufferTime >= duration) {
      minBufferTarget = Math.min(duration, this.DEFAULT_MIN_BUFFER_TIME!);
    } else {
      minBufferTarget = Math.min(duration, minBufferTime);
    }

    return minBufferTarget;
  };

  getRequiredBufferLength = (
    _waitingForBuffer: boolean,
    delay: number,
    _isDynamic: boolean,
    _duration: number
  ) => {
    // eslint-disable-line no-unused-vars

    const vmetrics: Metrics = this.metricsModel!.getMetricsFor('video');
    const ametrics: Metrics = this.metricsModel!.getMetricsFor('audio');
    let requiredBufferLength: number;

    requiredBufferLength =
      this.BUFFER_PREFETCH_THRESHOLD! +
      delay +
      Math.max(
        this.getCurrentHttpRequestLatency.call(this, vmetrics),
        this.getCurrentHttpRequestLatency.call(this, ametrics)
      );

    return requiredBufferLength;
  };

  //NSV-a  const createPSSHBox = (data) => {
  //NSV-a    // * desc@ getInitData
  //NSV-a    // *   generate PSSH data from PROHeader defined in MPD file
  //NSV-a    // *   PSSH format:
  //NSV-a    // *   size (4)
  //NSV-a    // *   box type(PSSH) (8)
  //NSV-a    // *   Protection SystemID (16)
  //NSV-a    // *   protection system data size (4) - length of decoded PROHeader
  //NSV-a    // *   decoded PROHeader data from MPD file
  //NSV-a    let byteCursor = 0;
  //NSV-a
  //NSV-a    let PROSize = 0;
  //NSV-a    let PSSHSize = 0;
  //NSV-a
  //NSV-a    //'PSSH' 8 bytes
  //NSV-a    const PSSHBoxType = new Uint8Array([
  //NSV-a      0x70,
  //NSV-a      0x73,
  //NSV-a      0x73,
  //NSV-a      0x68,
  //NSV-a      0x00,
  //NSV-a      0x00,
  //NSV-a      0x00,
  //NSV-a      0x00,
  //NSV-a    ]);
  //NSV-a
  //NSV-a    const playreadySystemID = new Uint8Array([
  //NSV-a      0x9a,
  //NSV-a      0x04,
  //NSV-a      0xf0,
  //NSV-a      0x79,
  //NSV-a      0x98,
  //NSV-a      0x40,
  //NSV-a      0x42,
  //NSV-a      0x86,
  //NSV-a      0xab,
  //NSV-a      0x92,
  //NSV-a      0xe6,
  //NSV-a      0x5b,
  //NSV-a      0xe0,
  //NSV-a      0x88,
  //NSV-a      0x5f,
  //NSV-a      0x95,
  //NSV-a    ]);
  //NSV-a
  //NSV-a    let uint8arraydecodedPROHeader = null;
  //NSV-a    let PSSHBoxBuffer = null;
  //NSV-a    let PSSHBox = null;
  //NSV-a    let PSSHData = null;
  //NSV-a
  //NSV-a    if ('pro' in data) {
  //NSV-a      uint8arraydecodedPROHeader = BASE64.decodeArray(data.pro);
  //NSV-a    } else if ('prheader' in data) {
  //NSV-a      // uint8arraydecodedPROHeader = BASE64.decodeArray(data.prheader);
  //NSV-a    } else {
  //NSV-a      return null;
  //NSV-a    }
  //NSV-a
  //NSV-a    PROSize = uint8arraydecodedPROHeader.length;
  //NSV-a    PSSHSize =
  //NSV-a      0x4 + PSSHBoxType.length + playreadySystemID.length + 0x4 + PROSize;
  //NSV-a
  //NSV-a    PSSHBoxBuffer = new ArrayBuffer(PSSHSize);
  //NSV-a
  //NSV-a    PSSHBox = new Uint8Array(PSSHBoxBuffer);
  //NSV-a    PSSHData = new DataView(PSSHBoxBuffer);
  //NSV-a
  //NSV-a    PSSHData.setUint32(byteCursor, PSSHSize);
  //NSV-a    byteCursor += 0x4;
  //NSV-a
  //NSV-a    PSSHBox.set(PSSHBoxType, byteCursor);
  //NSV-a    byteCursor += PSSHBoxType.length;
  //NSV-a
  //NSV-a    PSSHBox.set(playreadySystemID, byteCursor);
  //NSV-a    byteCursor += playreadySystemID.length;
  //NSV-a
  //NSV-a    PSSHData.setUint32(byteCursor, PROSize);
  //NSV-a    byteCursor += 0x4;
  //NSV-a
  //NSV-a    PSSHBox.set(uint8arraydecodedPROHeader, byteCursor);
  //NSV-a    byteCursor += PROSize;
  //NSV-a
  //NSV-a    return PSSHBox;
  //NSV-a  };
  //NSV-a
  //NSV-a  const checkAndInsertPSSHBox = (initData, aset) => {
  //NSV-a    if (aset.getContentProtectionData() == null) {
  //NSV-a      return initData;
  //NSV-a    } else {
  //NSV-a      let type = '';
  //NSV-a      let size = 0;
  //NSV-a      const ab = new ArrayBuffer(initData.length);
  //NSV-a      const ab8 = new Uint8Array(ab);
  //NSV-a      const d = new DataView(ab);
  //NSV-a      let pos = 0;
  //NSV-a      let i;
  //NSV-a      let c;
  //NSV-a      let moovPos = 0;
  //NSV-a      let psshBoxAvailable = false;
  //NSV-a
  //NSV-a      ab8.set(initData);
  //NSV-a      while (type !== 'moov' && pos < d.byteLength) {
  //NSV-a        size = d.getUint32(pos); // subtract 8 for including the size and type
  //NSV-a        pos += 4;
  //NSV-a
  //NSV-a        type = '';
  //NSV-a        for (i = 0; i < 4; i += 1) {
  //NSV-a          c = d.getInt8(pos);
  //NSV-a          type += String.fromCharCode(c);
  //NSV-a          pos += 1;
  //NSV-a        }
  //NSV-a
  //NSV-a        if (type !== 'moov') {
  //NSV-a          pos += size - 8;
  //NSV-a        } else {
  //NSV-a          moovPos = pos - 8;
  //NSV-a          type = '';
  //NSV-a          while (type !== 'pssh' && pos < d.byteLength) {
  //NSV-a            size = d.getUint32(pos); // subtract 8 for including the size and type
  //NSV-a            pos += 4;
  //NSV-a
  //NSV-a            type = '';
  //NSV-a            for (i = 0; i < 4; i += 1) {
  //NSV-a              c = d.getInt8(pos);
  //NSV-a              type += String.fromCharCode(c);
  //NSV-a              pos += 1;
  //NSV-a            }
  //NSV-a
  //NSV-a            if (type !== 'pssh') {
  //NSV-a              pos += size - 8;
  //NSV-a            } else {
  //NSV-a              psshBoxAvailable = true;
  //NSV-a            }
  //NSV-a          }
  //NSV-a          break;
  //NSV-a        }
  //NSV-a      }
  //NSV-a
  //NSV-a      if (psshBoxAvailable !== true) {
  //NSV-a        const cps = aset.getContentProtectionData();
  //NSV-a        for (let j = 0; j < cps.length; j++) {
  //NSV-a          if (
  //NSV-a            cps[j].schemeIdUri ==
  //NSV-a            'urn:uuid:79f0049a-4098-8642-ab92-e65be0885f95'
  //NSV-a          ) {
  //NSV-a            const psshBox = createPSSHBox(cps[j]);
  //NSV-a
  //NSV-a            NXDebug.info(psshBox);
  //NSV-a            const newInitDataBuffer = new ArrayBuffer(
  //NSV-a              initData.length + psshBox.length
  //NSV-a            );
  //NSV-a            const newInitData = new Uint8Array(newInitDataBuffer);
  //NSV-a            const newInitDataView = new DataView(newInitDataBuffer);
  //NSV-a
  //NSV-a            newInitData.set(initData, 0);
  //NSV-a            newInitData.set(psshBox, initData.length);
  //NSV-a            newInitDataView.setUint32(moovPos, newInitData.length - moovPos);
  //NSV-a            NXDebug.info(newInitData);
  //NSV-a            return newInitData;
  //NSV-a          }
  //NSV-a        }
  //NSV-a      } else {
  //NSV-a        return initData;
  //NSV-a      }
  //NSV-a    }
  //NSV-a  };

  /* istanbul ignore next */
  initializationDataLoads = (
    adaptation: AdaptationSet,
    callback: (val: boolean) => void
  ) => {
    let representationCount: number = 0;
    const periods: Array<Period> = adaptation.period!.mpd!.periods;
    const codec: string = adaptation.getCodec();
    let convertCodecType: undefined | boolean = undefined;

    for (let i = 0; i < periods.length; i++) {
      if (i < this.periodInfo!.index - 2 || this.periodInfo!.index + 2 < i) {
        if (periods[i].start in this.initializationData) {
          delete this.initializationData[periods[i].start];
        }
        if (periods[i].start in this.buffer!.initQ!) {
          delete this.buffer!.initQ![periods[i].start];
        }
      }
    }

    if (this.periodInfo!.start in this.initializationData) {
      // eslint-disable-line no-empty
    } else {
      this.initializationData[this.periodInfo!.start] = {};
    }
    if (adaptation.index in this.initializationData[this.periodInfo!.start]) {
      // eslint-disable-line no-empty
    } else {
      this.initializationData[this.periodInfo!.start][adaptation.index] = [];
    }

    if (
      this.initializationData[this.periodInfo!.start][adaptation.index]
        .length === 0
    ) {
      if (codec.indexOf('hev1') > -1) {
        if (this.videoModel!.getCanPlayType(codec) !== 'probably') {
          convertCodecType = true;
        }
      }

      this.initializationData[this.periodInfo!.start][adaptation.index] = [];
      representationCount = this.availableRepresentations!.length;
      for (let i = 0; i < this.availableRepresentations!.length; i++) {
        this.indexHandler!.getInitializationData(
          this.availableRepresentations![i],
          convertCodecType,
          this.initializationData[this.periodInfo!.start][adaptation.index],
          (d) => {
            if (d.status === 'ok') {
              // eslint-disable-line no-empty
            } else {
              this.logHandler.log(d.msg!);
            }
            representationCount--;

            if (representationCount === 0) {
              const initialized = () => {
                this.eventBus!.dispatchEvent({
                  type: 'initDataReceived',
                  data: {
                    type: this.type,
                    initData:
                      this.initializationData[this.periodInfo!.start][
                        adaptation.index
                      ],
                  },
                });

                callback(true);
              };

              if (
                !this.isDynamic &&
                this.silaInsertMode &&
                this.dmyData === null
              ) {
                this.indexHandler!.getFillerData(
                  this.isProtection,
                  this.type!,
                  this.availableRepresentations![0].adaptation!.getCodec(),
                  'SILA_INSERT_MODE',
                  (d) => {
                    if (d.status === 'ok') {
                      this.dmyData = d.data;
                      this.logHandler.log(
                        '[' +
                          this.type +
                          '] dmyData len: ' +
                          this.dmyData!.byteLength
                      );
                    } else {
                      this.logHandler.log('[' + this.type + ']' + d.msg);
                    }
                    initialized();
                  }
                );
              } else if (
                this.type === 'video' &&
                this.bDatInsertMode &&
                this.buffer!.updating === undefined &&
                this.dmyData === null
              ) {
                this.indexHandler!.getDummyData(
                  this.isProtection,
                  this.type,
                  (d) => {
                    if (d.status === 'ok') {
                      this.dmyData = d.data;
                    } else {
                      this.logHandler.log(d.msg!);
                    }
                    initialized();
                  }
                );
              } else {
                initialized();
              }
            }
          }
        );
      }
    } else {
      callback(true);
    }
  };

  setDummy = (): void => {
    if (this.silaInsertMode && this.dmyData !== null) {
      if (this.buffer!.appendBuffer) {
        this.buffer!.appendBuffer(this.dmyData);
      } else {
        this.buffer!.append!(this.dmyData);
      }
    }
  };

  clearTimer = (): void => {
    if (this.buffer!.timerId) {
      clearInterval(this.buffer!.timerId);
    }
    this.appendFromBufferQisProcessing = false;
  };

  isTargetType = (type: string): boolean => {
    if (this.periodInfo!.type === 'video/audio') {
      if (type === 'video') {
        return true;
      } else {
        return false;
      }
    } else if (this.periodInfo!.type === 'video') {
      if (type === 'video') {
        return true;
      }
    } else if (this.periodInfo!.type === 'audio') {
      if (type === 'audio') {
        return true;
      }
    }
    return false;
  };

  convertInitData = (): void => {
    let ps: string;
    let aid: string;
    let q: string;
    for (ps in this.initializationData) {
      for (aid in this.initializationData[ps]) {
        for (q in this.initializationData[ps][aid]) {
          this.initializationData[ps][aid][q].data =
            this.indexHandler!.checkAndConvertCodecType(
              this.initializationData[ps][aid][q].data
            );
        }
      }
    }

    for (ps in this.buffer!.initQ) {
      for (aid in this.buffer!.initQ![ps]) {
        for (q in this.buffer!.initQ![ps][aid]) {
          this.buffer!.initQ![ps][aid][q].data =
            this.indexHandler!.checkAndConvertCodecType(
              this.buffer!.initQ![ps][aid][q].data
            );
        }
      }
    }
  };
  // NSV-a  const updateForLiveEdge = (liveEdgeTime) => {};
  // liveMulti
  updateForLiveEdgeMPD = (): number => {
    this.NXDebug.debug(
      '================= updateForLiveEdge ===================================='
    );
    const startTime: number = this.periodInfo!.mpd!.liveEdgeE;
    this.indexHandler!.updateForLiveEdgeMPD(this.type!, this.periodInfo);

    this.setMSEDuration.call(
      this,
      this.periodInfo!.mpd!.liveEdge,
      'updateForLiveEdgeMPD'
    );
    this.NXDebug.debug(
      'liveEdge:' +
        this.periodInfo!.mpd!.liveEdge +
        ', minBufferTime:' +
        this.minBufferTime +
        ', startTime:' +
        startTime +
        ', dur:' +
        this.mediaSource!.duration
    );
    return startTime;
  };

  // liveMulti
  getPlaybackQuality = (): number => {
    const totalBufferLevel: number =
      this.bufferLevel +
      this.sourceBufferExt!.dataQduration(this.buffer!, this.isSegmentTemplate);

    const aborted: boolean = this.checkLoadingRequests.call(
      this,
      this.type!,
      totalBufferLevel
    );

    const qResult: PlaybackQuality = this.abrController!.getPlaybackQuality(
      this.type!,
      this.currentAdaptation!,
      this.metrics!,
      totalBufferLevel,
      aborted,
      this.stalled
    );

    const quality: number | undefined = qResult.quality;
    let qualityChanged: boolean = false;
    let newQuality: number;
    const now: Date = new Date();

    if (quality !== undefined) {
      newQuality = quality;
    }
    qualityChanged = quality !== this.requiredQuality;

    if (qualityChanged === true) {
      this.requiredQuality = newQuality!;
      // The quality has beeen changed so we should abort the requests that has not been loaded yet
      if (this.type === 'video') {
        this.cancelPendingRequests.call(this, this.type, this.UPDATE, 7);
      }
      this.currentRepresentation = this.getRepresentationForQuality.call(
        self,
        newQuality!
      );
      if (
        this.currentRepresentation === null ||
        this.currentRepresentation === undefined
      ) {
        throw 'Unexpected error!';
      }
      this.isSegmentTemplate =
        this.currentRepresentation.segmentInfoType === 'SegmentTemplate';

      this.clearPlayListTraceMetrics(
        now,
        this.REPRESENTATION_SWITCH_STOP_REASON
      );
      this.metrics!.addRepresentationSwitch(
        this.type!,
        now,
        this.videoModel!.getCurrentTime(),
        this.currentRepresentation.id!,
        undefined
      );
    }
    return quality;
  };

  /* istanbul ignore next */
  validate = () => {
    const self = this;
    const currentVideoTime: number = this.videoModel!.getCurrentTime();
    this.updateBufferLevel.call(self);
    if (this.type === 'video') {
      this.logHandler.log_item(
        'ctime',
        'time: ' +
          new Number(currentVideoTime).toFixed(2) +
          ', dur: ' +
          (isFinite(this.videoModel!.getDuration())
            ? new Number(this.videoModel!.getDuration()).toFixed(2)
            : this.videoModel!.getDuration())
      );
      this.logHandler.log_item(
        'vlog',
        this.type +
          ' len: ' +
          this.buffer!.buffered.length +
          ', buffer: ' +
          parseInt(String(this.bufferLevel * 100.0)) / 100.0
      );
    } else {
      this.logHandler.log_item(
        'alog',
        this.type +
          ' len: ' +
          this.buffer!.buffered.length +
          ', buffer: ' +
          parseInt(String(this.bufferLevel * 100.0)) / 100.0
      );
    }

    this.logHandler.log_slider(
      currentVideoTime,
      this.videoModel!.getDuration()
    );
    this.checkIfSufficientBuffer.call(self);
    if (
      !this.isSchedulingRequired.call(self) &&
      !this.initialPlayback &&
      !this.waitingForBuffer
    ) {
      this.stop.call(self);
      return;
    }

    if (
      this.bufferLevel <= this.STALL_THRESHOLD &&
      !this.stalled &&
      !this.videoModel!.onAdjusting()
    ) {
      if (this.tlen > this.STALL_THRESHOLD) {
        this.videoModel!.adjustCurrentTime((t: number) => {
          this.logHandler.log('skip small buffer gap.' + t);
        });
      } else {
        this.NXDebug.log(
          'Stalling ' + this.type + ' Buffer: ' + this.bufferLevel
        );

        this.clearPlayListTraceMetrics(new Date(), this.REBUFFERING_REASON);
        this.stalled = true;
        this.waitingForBuffer = true;
        this.bufferStartThreshold = Math.min(
          this.minBufferTime || this.DEFAULT_MIN_BUFFER_TIME!,
          this.getTimeToEnd()
        );

        this.cancelPendingRequests.call(this, this.type!, this.RESET, 8);

        this.stallStream.call(self, this.stalled, 6);
        if (this.abrController!.getAutoSwitchBitrate()) {
          this.abrController!.setPlaybackQuality(this.type!, 0);
        }
      }
    }

    if (this.state === this.READY) {
      this.setState.call(self, this.VALIDATING);
      const manifestMinBufferTime =
        this.manifestModel!.getValue()!.mpd!.minBufferTime;

      const minBufferTarget = this.decideBufferLength.call(
        self,
        manifestMinBufferTime!,
        this.periodInfo!.duration
      );

      this.setMinBufferTime(minBufferTarget);
      this.abrController!.setMinBufferTime(minBufferTarget);

      const quality = this.getPlaybackQuality.call(self);
      this.getRequiredFragmentCount.call(self, quality, (count) => {
        if (count === -1) {
          this.fragmentsToLoad = 0;
          this.setIncrementalMode.call(self, false, 10);
        } else {
          this.fragmentsToLoad =
            count > 0 || this.buffer!.underThreshold == false ? count : 1;
        }
        this.requestNewFragment.call(self);
      });
      if (this.isDynamic) {
        this.setMSEDuration.call(
          self,
          this.periodInfo!.mpd!.liveEdge,
          'validate'
        );
      }
    } else if (this.state === this.VALIDATING) {
      this.setState.call(self, this.READY);
    }
  };

  /* istanbul ignore next */
  initialize(
    params: Paramstype,
    type: 'audio' | 'video' | '',
    periodInfo: Period,
    data: AdaptationSet,
    buffer: ExSourceBuffer,
    videoModel: VideoModel | DummyVideoModel,
    fragmentController: FragmentController,
    source: MediaSource,
    _eventBus: EventBus,
    _manifestModel: ManifestModel,
    _metricsModel: MetricsModel,
    _abrController: AbrController,
    _sourceBufferExt: SourceBufferExtensions,
    _indexHandler: DashHandler,
    _iniStartTime: number,
    callback: (d: ResponseData) => void
  ) {
    const self = this;
    let manifest: ManifestModel;
    self.setMediaSource(source);
    self.setVideoModel(videoModel);
    self.setType(type);
    self.setBuffer(buffer);
    self.setFragmentController(fragmentController);

    this.eventBus = _eventBus;
    this.manifestModel = _manifestModel;
    this.metricsModel = _metricsModel;
    this.abrController = _abrController;
    this.sourceBufferExt = _sourceBufferExt;
    this.indexHandler = _indexHandler;
    this.fragmentModel = fragmentController.attachBufferController(self);
    fragmentController.prepareFragmentForLoading(
      self,
      this.onBytesLoadingStart,
      this.onBytesLoaded,
      this.onBytesError,
      this.signalStreamComplete,
      this.onFirstChunkLoaded,
      this.onChunkLoaded,
      this.onChunkLoadedError
    );
    this.sourceBufferExt.attachBuffer(this.buffer!);

    this.metrics = this.metricsModel.getMetricsFor(this.type!);

    this.listenToCanplay =
      params.LISTEN_TO_CANPLAY_AFTER_SEEK !== undefined
        ? params.LISTEN_TO_CANPLAY_AFTER_SEEK
        : false;

    this.bDatInsertMode =
      params.BDAT_INSERT_MODE !== undefined && type === 'video'
        ? params.BDAT_INSERT_MODE
        : false;

    this.silaInsertMode =
      params.SILA_INSERT_MODE !== undefined ? params.SILA_INSERT_MODE : false;

    this.MSE_APPEND_ENABLE_THRESHOLD =
      type == 'video'
        ? 'MSE_APPEND_ENABLE_THRESHOLD_V' in params
          ? params['MSE_APPEND_ENABLE_THRESHOLD_V']
          : params['MSE_APPEND_ENABLE_THRESHOLD'] || 5
        : 'MSE_APPEND_ENABLE_THRESHOLD_A' in params
        ? params['MSE_APPEND_ENABLE_THRESHOLD_A']
        : params['MSE_APPEND_ENABLE_THRESHOLD'] || 5;

    this.DEFAULT_MIN_BUFFER_TIME =
      params.DEFAULT_MIN_BUFFER_TIME !== undefined
        ? params.DEFAULT_MIN_BUFFER_TIME
        : 0.6;

    this.forceDefaultMBT = params.FORCE_DEFAULT_MBT || false;
    this.useFetch = params.USE_FETCH && 'fetch' in window ? true : false;

    this.BUFFER_PREFETCH_THRESHOLD =
      type == 'video'
        ? 'BUFFER_PREFETCH_THRESHOLD_V' in params
          ? params['BUFFER_PREFETCH_THRESHOLD_V']
          : params['BUFFER_PREFETCH_THRESHOLD'] || 15
        : 'BUFFER_PREFETCH_THRESHOLD_A' in params
        ? params['BUFFER_PREFETCH_THRESHOLD_A']
        : params['BUFFER_PREFETCH_THRESHOLD'] || 15;

    this.EXTRACT_ALL_IDR_IN_MOOF = params.EXTRACT_ALL_IDR_IN_MOOF || false;
    this.DEV_TYPE = params.DEV_TYPE || 'NORMAL';
    this.STORE_MEASURED_DATA = params.STORE_MEASURED_DATA || false;
    this.START_FROM_MPDTOP_FORLIVE = params.START_FROM_MPDTOP_FORLIVE || false;
    this.ullMode = 'ULL_MODE' in params ? params['ULL_MODE'] : false;

    if (this.STORE_MEASURED_DATA) {
      this.metrics.setStoreMeasuredData(this.STORE_MEASURED_DATA);
    }

    if (this.type === 'video') {
      this.tolerance = Math.ceil(1000 / data.getFrameRate()) / 1000;
    } else {
      this.tolerance =
        Math.ceil((1000 * 1024) / data.getAudioSamplingRate()) / 1000;
    }
    this.videoModel!.setEpsilonFor(this.type!, this.tolerance);
    this.indexHandler.setEpsilonFor(this.type!, this.tolerance);

    this.eventBus.addEventListener(
      'appendedEnoughDataToStart',
      this.onAppendedEnoughDataToStart.bind(this)
    );
    this.eventBus.addEventListener(
      'needToModifyOffset',
      this.onNeedToModifyOffset.bind(this)
    );
    this.eventBus.addEventListener(
      'checkBufferGap',
      this.onCheckBufferGap.bind(this)
    );

    manifest = this.manifestModel.getValue()!;
    this.isDynamic = this.manifestModel.getIsDynamic(manifest);

    this.isStreamCompleted = false;

    this.abrController.setMaxQualityIndex(
      this.type!,
      data.representations!.length
    );
    this.indexHandler.setupRequestStatus(this.type!);

    MSE_ver(buffer);
    this.videoModel!.setSourceBuffer(this.type!, buffer);

    this.isProtection = data.getContentProtectionData() === null ? false : true;

    buffer.queue = [];
    buffer.updatingRange = {
      start: 0,
      end: 0,
    };
    buffer.laData = null;
    buffer.initQ = {};
    buffer.quality = -1;
    buffer.asetIdx = -1;
    buffer.appendStart = false;
    buffer.type = this.type!;
    buffer.timerId = null;
    this.appendFromBufferQisProcessing = false;
    buffer.lastAppendtime = -1;
    buffer.preDur = 0;
    buffer.pStart = -1;
    buffer.underThreshold = false;
    buffer.startTimeAfterSeek = Number.MAX_VALUE;

    buffer.offset = periodInfo.start;
    buffer.level = 0;

    if (!this.videoModel!.isDummy()) {
      if (buffer.updating !== undefined) {
        this.appendFromBufferQ = this.appendFromBufferQForAB;
        //buffer.timerId = setInterval(appendFromBufferQForAB.bind(self), 500);
        buffer.timerId = setInterval(this.appendFromBufferQ.bind(self), 500);

        buffer.addEventListener!('updateend', (_e: Event) => {
          // eslint-disable-line no-unused-vars
          if (this.isDynamic)
            this.setMSEDuration.call(
              self,
              periodInfo.mpd!.liveEdge,
              'updateend'
            );
          const ranges: Nullable<TimeRanges> =
            this.sourceBufferExt!.getAllRanges(buffer);
          if (ranges) {
            if (ranges.length > 0) {
              for (let i = 0, len = ranges.length; i < len; i += 1) {
                this.NXDebug.log(
                  '[' +
                    this.type +
                    '] Buffered Range[' +
                    i +
                    ']: ' +
                    ranges.start(i) +
                    ' - ' +
                    ranges.end(i) +
                    ', state:' +
                    this.videoModel!.getReadyState() +
                    ', c:' +
                    this.videoModel!.getCurrentTime() +
                    ', paused:' +
                    this.videoModel!.isPaused()
                );
              }
            }
          }
          this.updateBufferLevel.call(self);
          //appendFromBufferQForAB.call(self);
        });
      } else {
        this.appendFromBufferQ = this.appendFromBufferQv01;
        buffer.timerId = setInterval(this.appendFromBufferQ.bind(self), 500);
      }
    } else {
      this.appendFromBufferQ = () => {};
    }
    self.updateData(
      this.updateDataReason.INITIAL_UPDATE,
      data,
      periodInfo,
      _iniStartTime,
      (f: ResponseData) => {
        if (f.status == 'ok') {
          if (!this.isDynamic) {
            this.ready = true;
            this.startPlayback.call(self);
            callback({
              status: 'ok',
              data: f.data,
            });
            return;
          }
          //liveMulti

          this.NXDebug.debug(
            '================= searchForLiveEdge ===================================='
          );

          let startTime: number;
          let segmentStart: number;
          if (
            this.setLiveStartTime == false &&
            this.START_FROM_MPDTOP_FORLIVE == true
          ) {
            startTime = periodInfo.mpd!.liveEdgeS;
          } else {
            //liveMulti
            if (!isNaN(_iniStartTime)) {
              startTime = _iniStartTime;
              if (startTime < periodInfo.mpd!.liveEdgeS) {
                startTime = periodInfo.mpd!.liveEdgeS;
              }
              if (startTime > periodInfo.mpd!.liveEdgeE) {
                startTime = periodInfo.mpd!.liveEdgeE;
              }
            } else {
              startTime = Math.max(
                periodInfo.mpd!.liveEdgeE,
                periodInfo.mpd!.liveEdgeS
              );
            }
            //liveMulti
          }
          this.indexHandler!.getSegmentRequestForTime(
            this.currentRepresentation,
            startTime,
            this.type!,
            3,
            (d) => {
              if (d.status === 'ok') {
                const request: SegmentRequest = d.data;
                segmentStart = request.startTime;

                //const tst: number = segmentStart;
                let tst = this.ullMode == true ? startTime : segmentStart;

                if (
                  isNaN(periodInfo.mpd!.liveEdgeC) ||
                  tst > periodInfo.mpd!.liveEdgeC
                ) {
                  periodInfo.liveEdgeC = tst;
                  //liveMulti
                  periodInfo.mpd!.liveEdgeC = tst;
                  //liveMulti
                } else {
                  // eslint-disable-line no-empty
                }

                if (!this.setLiveStartTime) {
                  //liveMulti
                  const st: number =
                    this.START_FROM_MPDTOP_FORLIVE == true
                      ? periodInfo.mpd!.liveEdgeS
                      : periodInfo.mpd!.liveEdgeC;
                  //liveMulti
                  if (isNaN(this.videoModel!.getStartTime())) {
                    this.videoModel!.setStartTime(st);
                  } else {
                    if (st > this.videoModel!.getStartTime()) {
                      this.videoModel!.setStartTime(st);
                    }
                  }
                  this.setLiveStartTime = true;
                }
                this.ready = true;
                if (this.DEV_TYPE === 'xxxxxx') {
                  this.indexHandler!.getFillerData(
                    this.isProtection,
                    this.type!,
                    this.currentRepresentation!.adaptation!.getCodec(),
                    'FILL_UP_THE_HEAD',
                    (d) => {
                      if (d.status === 'ok') {
                        this.dmyData = d.data;
                        this.logHandler.log(
                          'dmyData len: ' + this.dmyData!.byteLength
                        );
                        buffer.appendBuffer!(this.dmyData!);
                      } else {
                        this.logHandler.log(d.msg!);
                      }

                      callback({
                        status: 'ok',
                        data: segmentStart,
                      });
                    }
                  );
                } else {
                  callback({
                    status: 'ok',
                    data: segmentStart,
                  });
                }
              } else {
                callback({
                  status: 'fail',
                  msg: d.msg,
                });
              }
            }
          );
        } else {
          callback({
            status: 'fail',
            msg: f.msg,
          });
        }
      }
    );
    this.indexHandler.setIsDynamic(this.isDynamic);
    self.setMinBufferTime(
      this.decideBufferLength.call(
        self,
        manifest.mpd!.minBufferTime!,
        periodInfo.duration
        // this.waitingForBuffer
      )
    );
  }

  /* istanbul ignore next */
  update(
    _buffer: ExSourceBuffer,
    _videoModel: VideoModel | DummyVideoModel,
    _source: MediaSource,
    convertCodecType: boolean = false
  ) {
    _buffer.queue = this.buffer!.queue;
    _buffer.updatingRange = this.buffer!.updatingRange;
    _buffer.laData = this.buffer!.laData;
    _buffer.initQ = this.buffer!.initQ;
    _buffer.quality = this.buffer!.quality;
    _buffer.asetIdx = this.buffer!.asetIdx;
    _buffer.appendStart = this.buffer!.appendStart;
    _buffer.type = this.buffer!.type;
    _buffer.timerId = this.buffer!.timerId;
    _buffer.lastAppendtime = this.buffer!.lastAppendtime;
    _buffer.preDur = this.buffer!.preDur;
    _buffer.pStart = this.buffer!.pStart;
    _buffer.startTimeAfterSeek = this.buffer!.startTimeAfterSeek;
    _buffer.offset = this.buffer!.offset;
    _buffer.level = this.buffer!.level;
    _buffer.underThreshold = this.buffer!.underThreshold;

    this.sourceBufferExt!.detachBuffer(this.buffer!);
    this.setBuffer(_buffer);
    this.sourceBufferExt!.attachBuffer(_buffer);
    this.setMediaSource(_source);
    this.setVideoModel(_videoModel);

    if (convertCodecType) {
      this.convertInitData.call(this);
    }
    if (this.buffer!.updating !== undefined) {
      if (this.buffer!.timerId != null) {
        clearInterval(this.buffer!.timerId);
      }
      this.appendFromBufferQ = this.appendFromBufferQForAB;
      this.buffer!.timerId = setInterval(
        this.appendFromBufferQ.bind(self),
        500
      );

      this.buffer!.addEventListener!('updateend', (_e) => {
        const ranges: Nullable<TimeRanges> = this.sourceBufferExt!.getAllRanges(
          this.buffer!
        );
        if (ranges) {
          if (ranges.length > 0) {
            const len: number = ranges.length;
            for (let i = 0; i < len; i += 1) {
              this.NXDebug.log(
                '[' +
                  this.type +
                  '] Buffered Range[' +
                  i +
                  ']: ' +
                  ranges.start(i) +
                  ' - ' +
                  ranges.end(i) +
                  ', state:' +
                  this.videoModel!.getReadyState() +
                  ', c:' +
                  this.videoModel!.getCurrentTime() +
                  ', paused:' +
                  this.videoModel!.isPaused()
              );
            }
          }
        }
        this.updateBufferLevel.call(self);
        //appendFromBufferQForAB.call(self);
      });
    } else {
      if (this.buffer!.timerId != null) {
        clearInterval(this.buffer!.timerId);
      }
      this.appendFromBufferQ = this.appendFromBufferQv01;
      this.buffer!.timerId = setInterval(
        this.appendFromBufferQ.bind(self),
        500
      );
    }
  }

  getType(): string {
    return this.type!;
  }

  setType(value: 'audio' | 'video' | ''): void {
    this.type = value;
  }

  getPeriodInfo(): Nullable<Period> {
    return this.periodInfo;
  }

  getVideoModel = (): VideoModel | DummyVideoModel => {
    return this.videoModel!;
  };

  setVideoModel(value: VideoModel | DummyVideoModel): void {
    this.videoModel = value;
  }

  // getFragmentController(): FragmentController {
  //   return this.fragmentController!;
  // }

  setFragmentController(value: FragmentController): void {
    this.fragmentController = value;
  }

  getAutoSwitchBitrate(): boolean {
    return this.abrController!.getAutoSwitchBitrate();
  }

  // setAutoSwitchBitrate(value: boolean): void {
  //   this.abrController!.setAutoSwitchBitrate(value);
  // }

  getData(): Nullable<AdaptationSet> {
    return this.currentAdaptation;
  }

  /* istanbul ignore next */
  updateData(
    reason: string,
    dataValue: AdaptationSet,
    periodInfoValue: Period,
    curTime: number,
    _callback?: (d: ResponseData) => void
  ): void {
    const self = this;
    const callback = _callback || (() => {});
    let from: Nullable<AdaptationSet> = this.currentAdaptation;
    let currentSegments: Nullable<Array<Segment>> = null;
    let dynamicPeriodChange: boolean = false;
    let initReceived: boolean = false;

    if (!from) {
      from = dataValue;
    }
    this.currentAdaptation = dataValue;
    this.stop.call(self);
    this.NXDebug.info(reason);
    this.availableRepresentations = dataValue.getRepresentations();

    this.isDynamic = this.manifestModel!.getIsDynamic(
      this.manifestModel!.getValue()!
    );
    this.indexHandler!.setIsDynamic(this.isDynamic);

    if (this.isDynamic) {
      //liveMulti
      if (
        this.currentRepresentation != null &&
        this.currentRepresentation.adaptation!.period!.id == periodInfoValue.id
      ) {
        currentSegments = this.currentRepresentation
          ? this.currentRepresentation.segments
          : null;
      } else {
        this.currentRepresentation = null;
      }

      if (reason === this.updateDataReason.PERIOD_CHANGE) {
        this.indexHandler!.setupRequestStatus(dataValue.type!);
        this.requiredQuality = -1;
        this.currentQuality = -1;
        dynamicPeriodChange = true;
      } else if (reason === this.updateDataReason.MPD_UPDATE) {
        if (
          this.periodInfo != null &&
          this.periodInfo.start != periodInfoValue.start
        ) {
          this.indexHandler!.setupRequestStatus(dataValue.type!);
          this.requiredQuality = -1;
          this.currentQuality = -1;
          this.setIncrementalMode.call(self, false, 11);
          dynamicPeriodChange = true;
        }
      }

      //liveMulti
    } else {
      if (reason === this.updateDataReason.MPD_UPDATE) {
        this.initializationData = [];
        this.buffer!.initQ = {};
        this.buffer!.queue = [];
        this.buffer!.quality = -1;
        this.buffer!.laData = null;
      }
      this.currentRepresentation = null;
      this.indexHandler!.setupRequestStatus(dataValue.type!);

      this.requiredQuality = -1;
      this.currentQuality = -1;
    }
    this.periodInfo = periodInfoValue;
    this.abrController!.matchingQualityBetweenDifferentAdaptation(
      from,
      dataValue
    );

    //@ts-ignore
    const qResult: PlaybackQuality = this.abrController!.getPlaybackQuality(
      this.type,
      dataValue,
      this.metrics
    );
    if (!this.currentRepresentation) {
      this.currentRepresentation = this.getRepresentationForQuality.call(
        self,
        qResult.quality
      );
      this.isSegmentTemplate =
        this.currentRepresentation.segmentInfoType === 'SegmentTemplate';
    }
    this.initializationDataLoads.call(self, dataValue, () => {
      initReceived = true;
    });

    this.indexHandler!.getCurrentTime(
      this.currentRepresentation,
      curTime,
      (d: ResponseData) => {
        const handler = () => {
          this.eventBus!.removeEventListener('initDataReceived', handler);
          if (d.status === 'ok') {
            const time = d.data;
            this.requiredQuality = qResult.quality;
            this.currentRepresentation = this.getRepresentationForQuality.call(
              self,
              qResult.quality
            );
            this.isSegmentTemplate =
              this.currentRepresentation.segmentInfoType === 'SegmentTemplate';

            if (this.isDynamic) {
              this.currentRepresentation.segments = currentSegments;
            }
            if (this.isDynamic) {
              if (dynamicPeriodChange == false) {
                this.indexHandler!.updateSegmentList(
                  this.currentRepresentation,
                  (d) => {
                    if (d.status === 'ok') {
                      const requestedTimeFromCurrentIndex = d.data;
                      let startTime: number;

                      startTime = this.updateForLiveEdgeMPD.call(self);
                      //liveMulti
                      if (requestedTimeFromCurrentIndex === -1) {
                        this.indexHandler!.setupRequestStatus(dataValue.type!);
                        this.setIncrementalMode.call(self, false, 12);
                        this.start.call(self, 4444);
                        callback({
                          status: 'ok',
                          data: startTime,
                        });
                      } else {
                        this.start.call(self, 4444);
                        callback({
                          status: 'ok',
                          data: startTime,
                        });
                      }
                    } else {
                      this.NXDebug.debug('ERROR:' + d.msg);
                      callback({
                        status: 'fail',
                        msg: d.msg,
                      });
                    }
                  }
                );
              } else {
                this.setIncrementalMode.call(self, false, 13);
                callback({
                  status: 'ok',
                  data: time,
                });
              }
            } else if (reason === this.updateDataReason.MPD_UPDATE) {
              this.fragmentController!.clearAllRequestsForModel(
                this.fragmentModel
              );
              this.fragmentModel!.abortRequests(true);
              this.setIncrementalMode.call(self, false, 14);
              this.start.call(self, 4444);
              callback({
                status: 'ok',
                data: time,
              });
            } else if (reason === this.updateDataReason.INITIAL_UPDATE) {
              if (this.type == 'video') {
                self.getSegmentStartTime(time, (t) => {
                  callback({
                    status: 'ok',
                    data: t,
                  });
                });
              } else {
                callback({
                  status: 'ok',
                  data: time,
                });
              }
            } else if (reason == this.updateDataReason.ADAPTATION_CHANGE) {
              this.fragmentController!.clearAllRequestsForModel(
                this.fragmentModel
              );
              this.fragmentModel!.abortRequests(true);
              this.setIncrementalMode.call(self, false, 15);
              this.buffer!.queue = [];
              this.buffer!.quality = -1;
              this.start.call(self, 4444);
              callback({
                status: 'ok',
                data: time,
              });
            } else if (reason == this.updateDataReason.PERIOD_CHANGE) {
              this.setIncrementalMode.call(self, false, 16);

              callback({
                status: 'ok',
                data: time,
              });
            } else {
              this.seek.call(
                self,
                time,
                '[' + this.type + '] end of initialize'
              );
              callback({
                status: 'ok',
                data: time,
              });
            }
          } else {
            this.logHandler.log('ERROR:::' + d.msg);
            callback({
              status: 'fail',
              msg: 'updateData ERROR',
            });
          }
        };

        if (initReceived) {
          handler();
        } else {
          this.eventBus!.addEventListener('initDataReceived', handler);
        }
      }
    );
  }

  // getCurrentRepresentation(): Nullable<Representation> {
  //   return this.currentRepresentation!;
  // }

  getBuffer(): Nullable<ExSourceBuffer> {
    return this.buffer!;
  }

  setBuffer(value: ExSourceBuffer): void {
    this.buffer = value;
  }

  // getMinBufferTime(): number {
  //   return this.minBufferTime!;
  // }

  setMinBufferTime(value: number): void {
    this.minBufferTime = value;
  }

  setMediaSource(value: MediaSource): void {
    this.mediaSource = value;
  }

  isReady(): boolean {
    return this.state === this.READY;
  }

  // isStopped(): boolean {
  //   return this.started === false;
  // }

  clearMetrics(): void {
    if (this.type === null || this.type === '') {
      return;
    }
    this.metrics = null;
  }

  updateBufferState(): void {
    const self = this;

    this.updateBufferLevel.call(self);
  }

  updateStalledState(): void {
    this.stalled = (this.videoModel! as VideoModel).isStalled();
    this.checkIfSufficientBuffer.call(this);
  }

  setStalledState(value: boolean): void {
    this.stalled = value;
    this.waitingForBuffer = value;
    this.bufferStartThreshold = Math.min(
      this.minBufferTime || this.DEFAULT_MIN_BUFFER_TIME!,
      this.getTimeToEnd()
    );
    this.stallStream.call(this, this.stalled, 7);
    if (this.stalled) {
      if (this.abrController!.getAutoSwitchBitrate()) {
        this.abrController!.setPlaybackQuality(this.type!, 0);
      }
    }
  }

  appendFromQ(): void {
    this.appendFromBufferQ!.call(this);
  }

  reset(errored: boolean): void {
    const self = this;
    //NSV-a      cancel = function cancelDeferred(d) {
    //NSV-a        if (d) {
    //NSV-a          d.reject();
    //NSV-a          d = null;
    //NSV-a        }
    //NSV-a      };
    this.stop.call(self);
    //NSV-a      initIsLoading = false;
    this.isStreamCompleted = false;
    self.clearMetrics();
    this.fragmentController!.abortRequestsForModel(this.fragmentModel);
    this.fragmentController!.detachBufferController(this.fragmentModel!);
    this.fragmentModel = null;
    this.initializationData = [];
    this.initialPlayback = true;
    this.playbackStarted = false;
    this.liveEdgeSearchRange = {
      start: null,
      end: null,
    };
    this.liveEdgeInitialSearchPosition = null;
    this.useBinarySearch = false;
    this.liveEdgeSearchStep = null;
    this.setLiveStartTime = false;
    this.currentRepresentation = null;
    this.isSegmentTemplate = false;
    this.requiredQuality = -1;
    this.currentQuality = -1;
    this.stalled = false;
    this.isDynamic = false;
    this.isBufferingCompleted = false;
    this.preAppendTime = -1;

    if (!errored) {
      this.sourceBufferExt!.abort(this.mediaSource!, this.buffer!);
      this.sourceBufferExt!.removeSourceBuffer(this.mediaSource!, this.buffer!);
    }
    this.buffer!.queue = [];
    this.buffer!.updatingRange = {
      start: 0,
      end: 0,
    };
    this.buffer!.initQ = {};
    if (this.buffer!.timerId) {
      clearInterval(this.buffer!.timerId);
    }
    this.buffer!.timerId = null;
    this.appendFromBufferQisProcessing = false;
    this.buffer!.quality = -1;
    this.buffer!.underThreshold = false;
    this.buffer!.appendStart = false;
    this.currentAdaptation = null;
    this.buffer = null;
    if (this.requestScheduler) {
      clearInterval(this.requestScheduler);
      this.requestScheduler = null;
    }
    this.isScheduled = false;
  }

  getBufferState(): number {
    return this.bufferState;
  }

  getSegmentStartTime(time: number, _callback: (val: number) => void): void {
    const callback: (val: number) => void = _callback;
    this.indexHandler!.getSegmentRequestForTime(
      this.currentRepresentation,
      time,
      this.type!,
      9,
      (d) => {
        if (d.status === 'ok') {
          const request = d.data;
          if (request === null) {
            callback(time);
          } else {
            callback(request.startTime);
          }
        } else {
          this.logHandler.log('ERROR: getSegmentsStartTime ' + d.msg);
          callback(time);
        }
      }
    );
  }

  getTolerance(): number {
    return this.tolerance;
  }
  getIsStreamCompleted(): boolean {
    return this.isStreamCompleted;
  }
}

//NSV-a BufferControllerParameterSets = () => {};
