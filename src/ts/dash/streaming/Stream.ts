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
import { BufferController } from './BufferController';
import { DashHandler } from '../manifest/DashHandler';
import Debug from '../core/Debug';
import ErrorHandler from '../core/ErrorHandler';
import { EventBus } from '../core/EventBus';
import { FragmentController } from './FragmentController';
import LogHandler from '../core/LogHandler';
import { AdaptationSet, ManifestModel } from '../manifest/ManifestModel';
import MetricsModel from './MetricsModel';
import { Period } from '../manifest/Period';
import VideoModel, { DummyVideoModel } from './VideoModel';
import { SourceBufferExtensions } from './SourceBufferExtensions';
import { UpdateDataReason } from './StreamController';
import { hasProperty } from '../core/Utils';
import { ProtectionController } from '../protection/ProtectionController';

/**
 * Stream
 *
 * @module Stream（Streamモジュール）
 */

/**
 * Stream
 * @constructor
 */
export class Stream {
  manifest: Nullable<ManifestModel>;
  mediaSource: Nullable<MediaSource>;
  videoCodec: Nullable<string>;
  audioCodec: Nullable<string>;
  contentProtections: Nullable<Array<ContentProtection>>;
  videoController: Nullable<BufferController>;
  audioController: Nullable<BufferController>;
  textController: Nullable<BufferController>;
  autoPlay: boolean;
  periodChgCheck: boolean;
  initialized: boolean;
  errored: boolean;
  xhrCustom: XHRCustom;
  audioInitData: Array<InitData>;
  videoInitData: Array<InitData>;
  eventTimerList: Array<Nullable<ReturnType<typeof setTimeout>>>;
  audioInitReceived: boolean;
  videoInitReceived: boolean;
  drmInitialized: boolean;
  drmKeyProcessing: boolean;
  drmKeyProcessingTimerId: Nullable<ReturnType<typeof setTimeout>>;
  lastCheckGapTime: number;
  stalledListener?: (evt: Event) => void;
  checkGapTimerId: Nullable<ReturnType<typeof setTimeout>>;
  nextPeriodTopIsAlreadyBuffered: boolean;
  CHECK_GAP_INTERVAL: number;
  updateDataReason = UpdateDataReason;
  dataIsUpdating: boolean;
  updateQue: Array<UpdateInfo>;
  checkGapQue: Array<Nullable<CheckGapQue>>;
  loadedListener?: (evt: Event) => void;
  playListener?: (evt: Event) => void;
  pauseListener?: (evt: Event) => void;
  errorListener?: (evt: Event) => void;
  seekingListener?: (evt: Event) => void;
  seekedListener?: (evt: Event) => void;
  timeupdateListener?: (evt: Event) => void;
  ratechangeListener?: (evt: Event) => void;
  canplaythroughListener?: (evt: Event) => void;
  periodInfo: Nullable<Period>;
  periodInfoArray: Nullable<Array<Period>>;
  currentPeriodIdx: number;
  initialPresentationStartTime: number;
  presentationEndTime: number;
  ltimeupdate: number;
  lastSeekTime: number;
  seeking: boolean;
  seekWaiting: boolean;
  scheduleWhilePaused: boolean;
  errHandler = ErrorHandler;
  logHandler = LogHandler;
  NXDebug: Debug;
  sourceBufferExt: Nullable<SourceBufferExtensions>;
  indexHandler: DashHandler;
  videoModel: Nullable<VideoModel | DummyVideoModel>;
  fragmentController: Nullable<FragmentController>;
  bufferState: number;
  protectionController: Nullable<ProtectionController>;
  EPSILON: number;
  SKIP_PERIOD_BOUNDARY: boolean;
  DEFAULT_ROLE_FOR_VIDEO: string;
  DEFAULT_ROLE_FOR_AUDIO: string;
  deletePastDashEvent: boolean;
  eventBus: EventBus;
  manifestModel: ManifestModel;
  params: Paramstype;
  metricsModel: MetricsModel;
  abrController: AbrController;

  constructor(
    params: Paramstype,
    eventBus: EventBus,
    manifestModel: ManifestModel,
    metricsModel: MetricsModel,
    abrController: AbrController,
    xhrCustom?: XHRCustom
  ) {
    this.manifest = null;
    this.mediaSource = null;
    this.videoCodec = null;
    this.audioCodec = null;
    this.contentProtections = null;
    this.videoController = null;
    this.audioController = null;
    this.textController = null;
    this.autoPlay = true;
    this.periodChgCheck = true;
    this.initialized = false;
    this.errored = false;
    this.xhrCustom = xhrCustom || {};
    this.audioInitData = [];
    this.videoInitData = [];
    this.eventTimerList = [];
    this.audioInitReceived = false;
    this.videoInitReceived = false;
    this.drmInitialized = false;
    this.drmKeyProcessing = false;
    this.drmKeyProcessingTimerId = null;
    this.lastCheckGapTime = -1;
    //NSV-a lastUpdateTime = -1,
    this.checkGapTimerId = null;
    this.nextPeriodTopIsAlreadyBuffered = false;
    this.CHECK_GAP_INTERVAL = 0.2;
    this.updateDataReason = UpdateDataReason;
    this.dataIsUpdating = false;
    this.updateQue = [];
    this.checkGapQue = [];
    this.periodInfo = null;
    this.periodInfoArray = null;
    this.currentPeriodIdx = 0;
    this.initialPresentationStartTime = 0;
    this.presentationEndTime = NaN;
    this.ltimeupdate = 0;
    this.lastSeekTime = NaN;
    this.seeking = false;
    this.seekWaiting = false;
    this.scheduleWhilePaused = true;
    this.NXDebug = new Debug();
    this.sourceBufferExt = new SourceBufferExtensions(params, eventBus);
    this.indexHandler = new DashHandler(
      params,
      eventBus,
      hasProperty(xhrCustom, 'seg') ? xhrCustom!['seg'] : {}
    );
    this.videoModel = null;
    this.fragmentController = null;
    this.bufferState = 0;
    this.protectionController = null;
    this.EPSILON = -0.1;
    this.SKIP_PERIOD_BOUNDARY = params.SKIP_PERIOD_BOUNDARY || false;
    this.DEFAULT_ROLE_FOR_VIDEO = params.DEFAULT_ROLE_FOR_VIDEO || 'main';
    this.DEFAULT_ROLE_FOR_AUDIO = params.DEFAULT_ROLE_FOR_AUDIO || 'main';
    this.deletePastDashEvent = params.DELETE_PAST_DASHEVENT || false;
    this.eventBus = eventBus;
    this.manifestModel = manifestModel;
    this.params = params;
    this.metricsModel = metricsModel;
    this.abrController = abrController;
  }

  play = (manual?: boolean): void => {
    if (!this.initialized) {
      return;
    }
    this.videoModel!.play(manual);
  };

  pause = (manual: boolean): void => {
    this.scheduleWhilePaused = false;
    this.suspend.call(this);

    this.videoModel!.pause(manual);
    this.videoModel!.setSelfPaused(manual);
  };

  seek = (time: number): void => {
    if (!this.initialized) {
      return;
    }
    this.NXDebug.debug('Do seek: ' + time);

    if (!this.videoModel!.isDummy()) {
      this.eventBus.dispatchEvent({
        type: 'setCurrentTime',
        data: {},
      });
      this.videoModel!.setCurrentTime(time);
    } else {
      this.videoModel!.setStartTime(time);
    }

    this.startBuffering(time, time, '1');
  };

  supportsCodec = (element: NXHTMLVideoElement, codec: string): boolean => {
    if (!(element instanceof HTMLVideoElement)) {
      throw 'element must be of type HTMLVideoElement.';
    }
    this.logHandler.log('codec:::' + codec);
    const canPlay: string = element.canPlayType(codec);
    this.logHandler.log('canPlay:::' + canPlay);
    return canPlay === 'probably' || canPlay === 'maybe';
  };

  //NSV-a // Media Source
  //NSV-a const setUpMediaSource = function (mediaSourceArg, _callback) {
  //NSV-a     const callback = _callback || (() => {});
  //NSV-a     const self = this;
  //NSV-a
  //NSV-a     const onMediaSourceOpen = (e) => {
  //NSV-a       NXDebug.debug('MediaSource is open!');
  //NSV-a       NXDebug.debug(e);
  //NSV-a
  //NSV-a       mediaSourceArg.removeEventListener('sourceopen', onMediaSourceOpen);
  //NSV-a       mediaSourceArg.removeEventListener(
  //NSV-a         'webkitsourceopen',
  //NSV-a         onMediaSourceOpen
  //NSV-a       );
  //NSV-a       logHandler.log('readyState :' + mediaSourceArg.readyState);
  //NSV-a       callback(mediaSourceArg);
  //NSV-a     };
  //NSV-a
  //NSV-a     mediaSourceArg.addEventListener('sourceopen', onMediaSourceOpen, false);
  //NSV-a     mediaSourceArg.addEventListener(
  //NSV-a       'webkitsourceopen',
  //NSV-a       onMediaSourceOpen,
  //NSV-a       false
  //NSV-a     );
  //NSV-a
  //NSV-a     attachMediaSource.call(self, mediaSourceArg, videoModel);
  //NSV-a
  //NSV-a     setTimeout(() => {
  //NSV-a       NXDebug.log('readyState : ' + mediaSourceArg.readyState);
  //NSV-a     }, 3000);
  //NSV-a   };

  tearDownMediaSource = (): void => {
    if (this.videoController != null) {
      this.videoController.reset(this.errored);
    }
    if (this.audioController != null) {
      this.audioController.reset(this.errored);
    }
    if (this.textController != null) {
      this.textController.reset(this.errored);
    }

    if (this.mediaSource != null) {
      this.sourceBufferExt!.setAppendStatus(false, [], 0);
      this.sourceBufferExt!.detachAllBuffers();
    }

    this.initialized = false;

    this.audioInitData = [];
    this.videoInitData = [];
    this.eventTimerList = [];
    this.audioInitReceived = false;
    this.videoInitReceived = false;
    this.lastCheckGapTime = -1;
    if (this.checkGapTimerId) {
      clearInterval(this.checkGapTimerId);
      this.checkGapTimerId = null;
    }
    this.nextPeriodTopIsAlreadyBuffered = false;

    this.contentProtections = null;

    this.videoController = null;
    this.audioController = null;
    this.textController = null;
    this.sourceBufferExt = null;

    this.videoCodec = null;
    this.audioCodec = null;

    this.mediaSource = null;
    this.manifest = null;
  };

  //NSV-a const setMinTimestampOffset = () => {
  //NSV-a   let asets;
  //NSV-a   let i;
  //NSV-a   let j;
  //NSV-a   let reps;
  //NSV-a
  //NSV-a   if (periodInfo.timestampOffsetFor32bitVE === 0) {
  //NSV-a     asets = periodInfo.adaptationSets;
  //NSV-a     let minTimestampOffset = 0xffffffffffffffff;
  //NSV-a     for (i = 0; i < asets.length; i++) {
  //NSV-a       reps = asets[i].representations;
  //NSV-a       for (j = 0; j < reps.length; j++) {
  //NSV-a         if (minTimestampOffset > reps[j].timestampOffsetFor32bitVE) {
  //NSV-a           minTimestampOffset = reps[j].timestampOffsetFor32bitVE;
  //NSV-a         }
  //NSV-a       }
  //NSV-a     }
  //NSV-a     periodInfo.timestampOffsetFor32bitVE = minTimestampOffset;
  //NSV-a   } else {
  //NSV-a     asets = periodInfo.adaptationSets;
  //NSV-a     for (i = 0; i < asets.length; i++) {
  //NSV-a       reps = asets[i].representations;
  //NSV-a       for (j = 0; j < reps.length; j++) {
  //NSV-a         reps[j].presentationTimeOffset -=
  //NSV-a           periodInfo.timestampOffsetFor32bitVE;
  //NSV-a       }
  //NSV-a     }
  //NSV-a   }
  //NSV-a };

  /* istanbul ignore next */
  initializeVideoSource = (
    startTime: number,
    callback: (d: ResponseData) => void
  ): void => {
    const self = this;
    const videoData: Nullable<AdaptationSet> = this.periodInfo!.getDataForRole(
      'video',
      this.DEFAULT_ROLE_FOR_VIDEO
    );
    let convertCodecType: boolean = false;
    let buffer: Nullable<ExSourceBuffer> = null;

    if (videoData !== null) {
      this.videoCodec = videoData.getCodec();
      this.NXDebug.log('Video codec: ' + this.videoCodec);
      if (
        this.videoCodec.indexOf('hvc') > -1 ||
        this.videoCodec.indexOf('hev') > -1
      ) {
        this.params.BDAT_INSERT_MODE = false;
      }

      this.contentProtections = videoData.getContentProtectionData();

      if (
        !this.supportsCodec.call(
          self,
          this.videoModel!.getElement()!,
          this.videoCodec
        )
      ) {
        const msg: string =
          'Video Codec (' + this.videoCodec + ') is not supported.';
        if (this.videoCodec.indexOf('hev1') > -1) {
          if (
            this.supportsCodec.call(
              self,
              this.videoModel!.getElement()!,
              this.videoCodec.replace('hev1', 'hvc1')
            )
          ) {
            this.videoCodec = this.videoCodec.replace('hev1', 'hvc1');
            this.logHandler.log('Trying to convert hev1 -> hvc1');
            convertCodecType = true;
          } else {
            this.errHandler.manifestError(
              this.eventBus,
              msg,
              'codec',
              this.manifest!
            );
            this.NXDebug.log(msg);
            //return false;
            callback({
              status: 'fail',
              msg,
            });
          }
        } else {
          this.errHandler.manifestError(
            this.eventBus,
            msg,
            'codec',
            this.manifest!
          );
          this.NXDebug.log(msg);
          //return false;
          callback({
            status: 'fail',
            msg,
          });
        }
      } else if (
        this.contentProtections != null &&
        !this.protectionController!.supportsProtection()
      ) {
        this.logHandler.log('initializeVideoSource noProtection');
        this.errHandler.capabilityError(this.eventBus, 'mediakeys');
        this.contentProtections = null;
        //return false;
        callback({
          status: 'fail',
          msg: 'initializeVideoSource noProtection ',
        });
      } else {
        this.logHandler.log_item('codec_video', 'V-Codec: ' + this.videoCodec);
        let result: ResponseData = this.sourceBufferExt!.createSourceBuffer(
          this.mediaSource!,
          this.videoCodec
        );
        if (result.status === 'ok') {
          buffer = result.data as ExSourceBuffer;
          this.logHandler.log(
            'video buffer was successfully created.' + this.videoCodec
          );
          if (buffer === null) {
            this.NXDebug.log('No buffer was created, skipping video stream.');
            callback({
              status: 'ok',
              data: null,
            });
          } else {
            this.videoController = new BufferController();
            buffer.type = 'video';
            // @ts-ignore
            if (convertCodecType == true) {
              buffer.convertCodecType = true;
            }
            this.videoController.initialize(
              this.params,
              'video',
              this.periodInfo!,
              videoData,
              buffer,
              this.videoModel!,
              this.fragmentController!,
              this.mediaSource!,
              this.eventBus,
              this.manifestModel,
              this.metricsModel,
              this.abrController,
              this.sourceBufferExt!,
              this.indexHandler,
              startTime,
              (d: ResponseData) => {
                if (d.status == 'ok') {
                  this.NXDebug.log('Video is ready!');
                  callback({
                    status: 'ok',
                    data: d.data,
                  });
                } else {
                  callback({
                    status: 'fail',
                    msg: d.msg,
                  });
                }
              }
            );
          }

          //return true;
        } else {
          this.logHandler.log(
            'Failed to create video buffer' + this.videoCodec
          );

          if (this.videoCodec.indexOf('hev1') > -1) {
            this.videoCodec = this.videoCodec.replace('hev1', 'hvc1');
            this.logHandler.log('Trying to convert hev1 -> hvc1');
            convertCodecType = true;
            result = this.sourceBufferExt!.createSourceBuffer(
              this.mediaSource!,
              this.videoCodec
            );
            if (result.status === 'ok') {
              buffer = result.data as ExSourceBuffer;
              this.logHandler.log(
                'video buffer was successfully created.' + this.videoCodec
              );
              if (buffer === null) {
                this.NXDebug.log(
                  'No buffer was created, skipping video stream.'
                );
                callback({
                  status: 'ok',
                  data: null,
                });
              } else {
                this.videoController = new BufferController();
                buffer.type = 'video';
                if (convertCodecType == true) {
                  buffer.convertCodecType = true;
                }
                this.videoController.initialize(
                  this.params,
                  'video',
                  this.periodInfo!,
                  videoData,
                  buffer,
                  this.videoModel!,
                  this.fragmentController!,
                  this.mediaSource!,
                  this.eventBus,
                  this.manifestModel,
                  this.metricsModel,
                  this.abrController,
                  this.sourceBufferExt!,
                  this.indexHandler,
                  startTime,
                  (d: ResponseData) => {
                    if (d.status == 'ok') {
                      this.NXDebug.log('Video is ready!');
                      callback({
                        status: 'ok',
                        data: d.data,
                      });
                    } else {
                      callback({
                        status: 'fail',
                        msg: d.msg,
                      });
                    }
                  }
                );
              }

              //return true;
            } else {
              this.errHandler.mediaSourceError(
                this.eventBus,
                'Error creating video source buffer.'
              );
              //return true;
              callback({
                status: 'ok',
                data: null,
              });
            }
          } else {
            this.errHandler.mediaSourceError(
              this.eventBus,
              'Error creating video source buffer.'
            );
            callback({
              status: 'ok',
              data: null,
            });
            //return true;
          }
        }
      }
    } else {
      this.NXDebug.log('No video data.');
      this.eventBus.dispatchEvent({
        type: 'initDataReceived',
        data: {
          type: 'video',
          initData: null,
        },
      });
      callback({
        status: 'ok',
        data: null,
      });

      //return true;
    }
  };

  /* istanbul ignore next */
  initializeAudioSource = (
    startTime: number,
    callback: (d: ResponseData) => void
  ): void => {
    const self = this;
    const primaryAudioData: Nullable<AdaptationSet> =
      this.periodInfo!.getDataForRole('audio', this.DEFAULT_ROLE_FOR_AUDIO);

    if (primaryAudioData !== null) {
      this.audioCodec = primaryAudioData.getCodec();
      this.NXDebug.log('Audio codec: ' + this.audioCodec);

      this.contentProtections = primaryAudioData.getContentProtectionData();

      if (
        !this.supportsCodec.call(
          self,
          this.videoModel!.getElement()!,
          this.audioCodec
        )
      ) {
        const msg: string =
          'Audio Codec (' + this.audioCodec + ') is not supported.';
        this.errHandler.manifestError(
          this.eventBus,
          msg,
          'codec',
          this.manifest as ManifestModel
        );
        this.NXDebug.log(msg);
        //return false;
        callback({
          status: 'fail',
          msg,
        });
      } else if (
        this.contentProtections != null &&
        !this.protectionController!.supportsProtection()
      ) {
        this.errHandler.capabilityError(this.eventBus, 'mediakeys');
        this.contentProtections = null;
        //return false;
        callback({
          status: 'fail',
          msg: 'Audio contents protection error',
        });
      } else {
        this.logHandler.log_item('codec_audio', 'A-Codec: ' + this.audioCodec);
        const result: ResponseData = this.sourceBufferExt!.createSourceBuffer(
          this.mediaSource!,
          this.audioCodec
        );
        if (result.status === 'ok') {
          const buffer: ExSourceBuffer = result.data as ExSourceBuffer;
          this.NXDebug.debug(String(buffer));
          if (buffer === null) {
            this.NXDebug.log('No buffer was created, skipping audio stream.');
            callback({
              status: 'ok',
              data: null,
            });
          } else {
            this.audioController = new BufferController();
            buffer.type = 'audio';
            this.audioController.initialize(
              this.params,
              'audio',
              this.periodInfo!,
              primaryAudioData,
              buffer,
              this.videoModel!,
              this.fragmentController!,
              this.mediaSource!,
              this.eventBus,
              this.manifestModel,
              this.metricsModel,
              this.abrController,
              this.sourceBufferExt!,
              this.indexHandler,
              startTime,
              (d: ResponseData) => {
                if (d.status == 'ok') {
                  callback({
                    status: 'ok',
                    data: d.data,
                  });
                } else {
                  callback({
                    status: 'fail',
                    msg: d.msg,
                  });
                }
              }
            );
          }

          //return true;
        } else {
          this.errHandler.mediaSourceError(
            this.eventBus,
            'Error creating audio source buffer.'
          );
          //return true;
          callback({
            status: 'ok',
            data: null,
          });
        }
      }
    } else {
      this.NXDebug.log('No audio streams.');
      this.eventBus.dispatchEvent({
        type: 'initDataReceived',
        data: {
          type: 'audio',
          initData: null,
        },
      });
      callback({
        status: 'ok',
        data: null,
      });
      //return true;
    }
  };

  tempInitializeVideoSource = (
    startTime: number,
    callback: (d: ResponseData) => void
  ): void => {
    const videoData: Nullable<AdaptationSet> = this.periodInfo!.getDataForRole(
      'video',
      this.DEFAULT_ROLE_FOR_VIDEO
    );

    if (videoData !== null) {
      this.videoCodec = videoData.getCodec();
      this.NXDebug.log('Video codec: ' + this.videoCodec);
      if (
        this.videoCodec.indexOf('hvc') > -1 ||
        this.videoCodec.indexOf('hev') > -1
      ) {
        this.params.BDAT_INSERT_MODE = false;
      }

      this.contentProtections = videoData.getContentProtectionData();

      this.logHandler.log_item('codec_video', 'V-Codec: ' + this.videoCodec);

      const buffer: ExSourceBuffer = {
        type: 'video',
        buffered: {
          length: 0,
          start: (_index: number) => 0,
          end: (_index: number) => 0,
        },
      };

      this.videoController = new BufferController();
      this.videoController.initialize(
        this.params,
        'video',
        this.periodInfo!,
        videoData,
        buffer,
        this.videoModel!,
        this.fragmentController!,
        this.mediaSource!,
        this.eventBus,
        this.manifestModel,
        this.metricsModel,
        this.abrController,
        this.sourceBufferExt!,
        this.indexHandler,
        startTime,
        (d: ResponseData) => {
          if (d.status == 'ok') {
            this.NXDebug.log('Video is ready!');
            callback({
              status: 'ok',
              data: d.data,
            });
          } else {
            callback({
              status: 'fail',
              msg: d.msg,
            });
          }
        }
      );
    } else {
      this.NXDebug.log('No video data.');
      this.eventBus.dispatchEvent({
        type: 'initDataReceived',
        data: {
          type: 'video',
          initData: null,
        },
      });
      callback({
        status: 'ok',
        data: null,
      });
    }
  };

  tempInitializeAudioSource = (
    startTime: number,
    callback: (d: ResponseData) => void
  ): void => {
    const primaryAudioData: Nullable<AdaptationSet> =
      this.periodInfo!.getDataForRole('audio', this.DEFAULT_ROLE_FOR_AUDIO);

    if (primaryAudioData !== null) {
      this.audioCodec = primaryAudioData.getCodec();
      this.NXDebug.log('Audio codec: ' + this.audioCodec);

      this.contentProtections = primaryAudioData.getContentProtectionData();

      this.logHandler.log_item('codec_audio', 'A-Codec: ' + this.audioCodec);

      const buffer: ExSourceBuffer = {
        type: 'audio',
        buffered: {
          length: 0,
          start: (_index: number) => 0,
          end: (_index: number) => 0,
        },
      };

      this.audioController = new BufferController();
      this.audioController.initialize(
        this.params,
        'audio',
        this.periodInfo!,
        primaryAudioData,
        buffer,
        this.videoModel!,
        this.fragmentController!,
        this.mediaSource!,
        this.eventBus,
        this.manifestModel,
        this.metricsModel,
        this.abrController,
        this.sourceBufferExt!,
        this.indexHandler,
        startTime,
        (d: ResponseData) => {
          if (d.status == 'ok') {
            callback({
              status: 'ok',
              data: d.data,
            });
          } else {
            callback({
              status: 'fail',
              msg: d.msg,
            });
          }
        }
      );
    } else {
      this.NXDebug.log('No audio streams.');
      this.eventBus.dispatchEvent({
        type: 'initDataReceived',
        data: {
          type: 'audio',
          initData: null,
        },
      });
      callback({
        status: 'ok',
        data: null,
      });
    }
  };

  /* istanbul ignore next */
  updateSourceBuffer = (): void => {
    let buffer: ExSourceBuffer;
    let result: ResponseData;
    if (this.videoController != null) {
      const videoData: Nullable<AdaptationSet> =
        this.periodInfo!.getDataForRole('video', this.DEFAULT_ROLE_FOR_VIDEO);

      if (videoData !== null) {
        this.videoCodec = videoData.getCodec();
        this.NXDebug.log('Video codec: ' + this.videoCodec);
        if (
          this.videoCodec.indexOf('hvc') > -1 ||
          this.videoCodec.indexOf('hev') > -1
        ) {
          this.params.BDAT_INSERT_MODE = false;
        }

        result = this.sourceBufferExt!.createSourceBuffer(
          this.mediaSource!,
          this.videoCodec
        );
        if (result.status === 'ok') {
          buffer = result.data as ExSourceBuffer;
          this.logHandler.log(
            'video buffer was successfully created.' + this.videoCodec
          );
          if (buffer === null) {
            this.NXDebug.log('No buffer was created, skipping video stream.');
          } else {
            this.videoController.update(
              buffer,
              this.videoModel!,
              this.mediaSource!
            );
          }
        } else {
          this.logHandler.log(
            'Failed to create video buffer' + this.videoCodec
          );

          if (this.videoCodec.indexOf('hev1') > -1) {
            this.videoCodec = this.videoCodec.replace('hev1', 'hvc1');
            this.logHandler.log('Trying to convert hev1 -> hvc1');
            result = this.sourceBufferExt!.createSourceBuffer(
              this.mediaSource!,
              this.videoCodec
            );
            if (result.status === 'ok') {
              buffer = result.data as ExSourceBuffer;
              this.logHandler.log(
                'video buffer was successfully created.' + this.videoCodec
              );
              if (buffer === null) {
                this.NXDebug.log(
                  'No buffer was created, skipping video stream.'
                );
              } else {
                this.videoController.update(
                  buffer,
                  this.videoModel!,
                  this.mediaSource!,
                  true
                );
              }
            }
          }
        }
      }
    }
    if (this.audioController != null) {
      const primaryAudioData: Nullable<AdaptationSet> =
        this.periodInfo!.getDataForRole('audio', this.DEFAULT_ROLE_FOR_AUDIO);

      if (primaryAudioData !== null) {
        this.audioCodec = primaryAudioData.getCodec();
        this.NXDebug.log('Audio codec: ' + this.audioCodec);

        result = this.sourceBufferExt!.createSourceBuffer(
          this.mediaSource!,
          this.audioCodec
        );
        if (result.status === 'ok') {
          buffer = result.data as ExSourceBuffer;
          this.NXDebug.debug(String(buffer));
          if (buffer === null) {
            this.NXDebug.log('No buffer was created, skipping audio stream.');
          } else {
            this.audioController.update(
              buffer,
              this.videoModel!,
              this.mediaSource!
            );
          }
        }
      }
    }
  };

  //NSV-a //Check This function should be reviewed about "buffer" as an undefined variable.
  //NSV-a const initializeTextSource = () => {
  //NSV-a     const textData = periodInfo.getPrimaryMediaData('text');
  //NSV-a     let mimeType;
  //NSV-a
  //NSV-a     if (textData !== null) {
  //NSV-a       mimeType = textData.getMimeType();
  //NSV-a       const result = sourceBufferExt.createSourceBuffer(
  //NSV-a         mediaSource,
  //NSV-a         mimeType
  //NSV-a       );
  //NSV-a       if (result.status === 'ok') {
  //NSV-a         if (buffer === null) {
  //NSV-a           NXDebug.log('Source buffer was not created for text track');
  //NSV-a         } else {
  //NSV-a           textController = new DashTVPlayer.TextController();
  //NSV-a           textController.initialize(
  //NSV-a             periodInfo,
  //NSV-a             textData,
  //NSV-a             buffer,
  //NSV-a             videoModel,
  //NSV-a             mediaSource
  //NSV-a           );
  //NSV-a           if (utils.hasProperty(buffer, 'initialize')) {
  //NSV-a             buffer.initialize(mimeType, textController);
  //NSV-a           }
  //NSV-a           return true;
  //NSV-a         }
  //NSV-a       } else {
  //NSV-a         NXDebug.log('Error creating text source buffer:');
  //NSV-a         NXDebug.log(result.msg);
  //NSV-a         errHandler.mediaSourceError(
  //NSV-a           eventBus,
  //NSV-a           'Error creating text source buffer.'
  //NSV-a         );
  //NSV-a         return true;
  //NSV-a       }
  //NSV-a     } else {
  //NSV-a       NXDebug.log('No text tracks.');
  //NSV-a       return true;
  //NSV-a     }
  //NSV-a   };

  initializeMediaSource = (callback: (val: boolean) => void): void => {
    const self = this;
    if (!this.manifestModel.getIsDynamic(this.manifest!)) {
      this.videoModel!.setStartTime(this.initialPresentationStartTime);
    }

    if (this.protectionController) {
      this.protectionController!.createMediaKeysFromMPD(
        this.periodInfo!.getDataForRole('video', this.DEFAULT_ROLE_FOR_VIDEO),
        this.periodInfo!.getDataForRole('audio', this.DEFAULT_ROLE_FOR_AUDIO)
      );
    }

    this.initializeVideoSource(
      this.initialPresentationStartTime,
      (d: ResponseData) => {
        if (d.status == 'ok') {
          const ist: number =
            d.data != null ? d.data : this.initialPresentationStartTime;
          this.initializeAudioSource(ist, (f) => {
            if (f.status == 'ok') {
              if (!this.videoController && !this.audioController) {
                callback(false);
              } else {
                this.startBuffering.call(self, ist, f.data, 'INITIAL');
                callback(true);
              }
            } else {
              this.startBuffering.call(self, ist, ist, 'INITIAL');
              callback(true);
            }
          });
        } else {
          callback(false);
        }
      }
    );
  };

  tempInitializeMediaSource = (callback: (val: boolean) => void): void => {
    const self = this;
    if (!this.manifestModel.getIsDynamic(this.manifest!)) {
      this.videoModel!.setStartTime(this.initialPresentationStartTime);
    }

    this.tempInitializeVideoSource(this.initialPresentationStartTime, (d) => {
      if (d.status == 'ok') {
        const ist: number = d.data || this.initialPresentationStartTime;
        this.tempInitializeAudioSource(ist, (f: ResponseData) => {
          if (f.status == 'ok') {
            if (!this.videoController && !this.audioController) {
              callback(false);
            } else {
              this.startBuffering.call(self, ist, f.data, 'INITIAL');
              callback(true);
            }
          } else {
            this.startBuffering.call(self, ist, ist, 'INITIAL');
            callback(true);
          }
        });
      } else {
        callback(false);
      }
    });
  };

  setDuration = (update?: boolean): void => {
    if (this.manifest!.mpd!.type === 'static') {
      try {
        if (
          this.manifest!.mpd!.mediaPresentationDuration != null &&
          this.manifest!.mpd!.mediaPresentationDuration !== Infinity
        ) {
          this.mediaSource!.duration =
            this.manifest!.mpd!.mediaPresentationDuration;
        } else {
          this.mediaSource!.duration =
            this.periodInfoArray![this.periodInfoArray!.length - 1].end;
        }
      } catch (e) {
        this.logHandler.log('duration cannot be changed while buffer updating');
      }
      this.NXDebug.log(
        'Duration successfully set to: ' + this.mediaSource!.duration
      );
    } else {
      if (update) this.mediaSource!.duration = this.periodInfo!.mpd!.liveEdge;
    }
  };

  //NSV-a const checkAcrossPeriods = (curTime) => {
  //NSV-a   for (let i = 0; i < periodInfoArray.length; i++) {
  //NSV-a     if (
  //NSV-a       lastUpdateTime < periodInfoArray[i].end - 0.15 &&
  //NSV-a       periodInfoArray[i].end - 0.15 <= curTime
  //NSV-a     ) {
  //NSV-a       eventBus.dispatchEvent({
  //NSV-a         type: 'periodEnded',
  //NSV-a         data: i,
  //NSV-a       });
  //NSV-a       break;
  //NSV-a     }
  //NSV-a   }
  //NSV-a   lastUpdateTime = curTime;
  //NSV-a };

  /* istanbul ignore next */
  checkGap = (nextIdx: number, nextStart: number): void => {
    //const self = this;
    const curTime: number = this.videoModel!.getCurrentTime();
    const periodStart: number = nextStart;
    let checkGapEnd = false;

    if (curTime !== this.lastCheckGapTime) {
      this.lastCheckGapTime = curTime;
      if (curTime > periodStart - this.CHECK_GAP_INTERVAL) {
        this.eventBus.dispatchEvent({
          type: 'periodEnded',
          data: nextIdx - 1,
        });
        if (Math.abs(this.videoModel!.getCurrentTime() - curTime) < 0.5) {
          if (this.bufferGapBetweenPeriods(curTime, periodStart)) {
            this.logHandler.log(
              '### detected the buffer gap. force seeking to start time of period[' +
                nextIdx +
                '] ***' +
                this.videoModel!.getCurrentTime() +
                ', ' +
                curTime
            );
            this.NXDebug.debug(
              '### detected the buffer gap. force seeking to start time of period[' +
                nextIdx +
                '] ***' +
                this.videoModel!.getCurrentTime() +
                ', ' +
                curTime
            );
            this.seekToNearestStartTime(periodStart);
          } else if (this.SKIP_PERIOD_BOUNDARY) {
            this.logHandler.log(
              '### SKIP_PERIOD_BOUNDARY switch is on. force seeking to start time of period[' +
                nextIdx +
                '] ***'
            );
            this.NXDebug.debug(
              '### SKIP_PERIOD_BOUNDARY switch is on. force seeking to start time of period[' +
                nextIdx +
                '] ***'
            );
            this.seekToNearestStartTime(periodStart);
          }
        }

        checkGapEnd = true;
      } else if (curTime > periodStart + this.EPSILON - 0.5) {
        if (this.bufferGapOnlyInVideoBuffer(curTime, periodStart)) {
          checkGapEnd = true;

          this.logHandler.log(
            '### stalled due to the buffer gap. force seeking to start time of period[' +
              nextIdx +
              '] ***'
          );
          this.NXDebug.debug(
            '### stalled due to the buffer gap. force seeking to start time of period[' +
              nextIdx +
              '] ***'
          );

          this.eventBus.dispatchEvent({
            type: 'periodEnded',
            data: nextIdx - 1,
          });

          if (Math.abs(this.videoModel!.getCurrentTime() - curTime) < 0.5) {
            this.seekToNearestStartTime(periodStart);
          } else {
            // eslint-disable-line no-empty
          }
        }
      }
    } else if (
      curTime < periodStart &&
      curTime > periodStart + this.EPSILON - 0.5
    ) {
      checkGapEnd = true;

      this.eventBus.dispatchEvent({
        type: 'periodEnded',
        data: nextIdx - 1,
      });

      if (Math.abs(this.videoModel!.getCurrentTime() - curTime) < 0.5) {
        if (this.bufferGapBetweenPeriods(curTime, periodStart)) {
          this.logHandler.log(
            '*** stalled due to the buffer gap. force seeking to start time of period[' +
              nextIdx +
              '] ***' +
              curTime
          );
          this.NXDebug.debug(
            '*** stalled due to the buffer gap. force seeking to start time of period[' +
              nextIdx +
              '] ***'
          );
          this.seekToNearestStartTime(periodStart);
        } else {
          // eslint-disable-line no-empty
        }
      } else {
        // eslint-disable-line no-empty
      }
    }
    if (
      !this.nextPeriodTopIsAlreadyBuffered &&
      periodStart - 4 < curTime &&
      curTime < periodStart - this.CHECK_GAP_INTERVAL
    ) {
      const prepared: boolean = this.checkNextPeriodTop(periodStart);

      this.eventBus.dispatchEvent({
        type: 'PeriodChangeCheck',
        data: {
          periodIdx: nextIdx - 1,
          timeToEnd: periodStart - curTime,
          prepared,
        },
      });
    }

    if (curTime >= periodStart) {
      checkGapEnd = true;
    }
    if (checkGapEnd) {
      clearInterval(this.checkGapTimerId!);
      this.checkGapTimerId = null;
      this.lastCheckGapTime = -1;
      this.nextPeriodTopIsAlreadyBuffered = false;
    }
  };

  dispatchCheckGap = (curTime: number): void => {
    var q: Nullable<CheckGapQue> = null;
    var i: number = 0;

    for (i = this.checkGapQue.length - 1; 0 <= i; i--) {
      if (this.checkGapQue[i]!.nextStart < curTime) {
        this.checkGapQue.splice(i, 1);
      } else if (
        this.checkGapQue[i]!.curStart < curTime &&
        curTime < this.checkGapQue[i]!.nextStart &&
        this.checkGapQue[i]!.nextStart - 2 < curTime
      ) {
        q = this.checkGapQue.shift()!;
        break;
      }
    }
    if (q != null) {
      if (this.checkGapTimerId) clearInterval(this.checkGapTimerId);
      this.checkGapTimerId = setInterval(
        this.checkGap!.bind(this, q.nextIdx, q.nextStart),
        this.CHECK_GAP_INTERVAL * 1000
      );
    }
  };

  onCanPlayThrough = (): void => {
    this.videoModel!.unlisten('canplaythrough', this.canplaythroughListener!);
  };

  onLoad = (): void => {
    this.NXDebug.log('Got loadmetadata event.');
    if (this.contentProtections === null) {
      this.setAppendStatus(true, 0);
      this.setInitialSeekTime.call(this, (_val: boolean) => {});
    }

    this.eventBus.dispatchEvent({
      type: 'GOT_LOADED_METADATA',
      data: {},
    });
  };

  onPlay = (): void => {
    this.updateCurrentTime.call(this);
  };

  onPause = (): void => {
    this.suspend.call(this);
    this.scheduleWhilePaused = true;
    this.ltimeupdate = NaN;
  };

  onStalled = (): void => {};

  onError = (event: ExEvent): void => {
    const error = event.srcElement!.error;
    const code: number = error.code;
    let msg: string = '';

    if (code === -1) {
      // not an error!
      return;
    }

    switch (code) {
      case 1:
        msg = 'MEDIA_ERR_ABORTED';
        break;
      case 2:
        msg = 'MEDIA_ERR_NETWORK';
        break;
      case 3:
        msg = 'MEDIA_ERR_DECODE';
        break;
      case 4:
        msg = 'MEDIA_ERR_SRC_NOT_SUPPORTED';
        break;
      case 5:
        msg = 'MEDIA_ERR_ENCRYPTED';
        break;
    }

    this.errored = true;

    this.NXDebug.log('Video Element Error: ' + msg);
    this.NXDebug.log(error);

    this.errHandler.mediaSourceError(this.eventBus, msg);
    this.logHandler.log('##### STREAM Video Element Error: ' + msg);
    this.reset();
  };

  setAppendStatus = (value: boolean, quality?: number): void => {
    const controllers: Array<Nullable<BufferController>> = [
      this.videoController,
      this.audioController,
    ];
    const qty: number = quality || -1;

    controllers.forEach((c) => {
      if (c != null && c.getBuffer()!.appendStart !== value) {
        c.getBuffer()!.appendStart = value;
        c.getBuffer()!.quality = qty;
        c.appendFromQ();
      }
    });
  };

  setInitData = (
    vInitData: Nullable<Uint8Array>,
    aInitData: Nullable<Uint8Array>
  ): void => {
    let buffer: ExSourceBuffer;
    if (this.videoController != null && vInitData != null) {
      buffer = this.videoController.getBuffer()!;
      if (buffer.updating === undefined) {
        buffer.append!(vInitData);
      } else {
        buffer.appendBuffer!(vInitData);
      }
    }
    if (this.audioController != null && aInitData != null) {
      buffer = this.audioController.getBuffer()!;
      if (buffer.updating === undefined) {
        buffer.append!(aInitData);
      } else {
        buffer.appendBuffer!(aInitData);
      }
    } else {
      /*
        setAppendStatus(true,0);
        setInitialSeekTime.call(this,function(){
        });
      */
    }
  };

  setDummy = (): void => {
    if (this.videoController != null) {
      this.videoController.setDummy();
    }

    if (this.audioController != null) {
      this.audioController.setDummy();
    }
  };

  //NSV-a const setStalledState = () => {
  //NSV-a   if (videoController != null) {
  //NSV-a     videoController.setStalledState(true);
  //NSV-a   }
  //NSV-a   if (audioController != null) {
  //NSV-a     audioController.setStalledState(true);
  //NSV-a   }
  //NSV-a };

  /* istanbul ignore next */
  _seeking = (): void => {
    const self = this;
    let changePeriod: boolean = false;
    const time: number = this.videoModel!.getCurrentTime();
    this.ltimeupdate = NaN;
    this.NXDebug.debug(' ### onSeeking : ' + time);
    this.logHandler.log(' ### onSeeking : ' + time);
    if (this.seeking == true) {
      return;
    }
    this.seeking = true;
    if (this.lastSeekTime == time) {
      // eslint-disable-line no-empty
    }

    if (this.checkGapTimerId) {
      clearInterval(this.checkGapTimerId);
      this.checkGapTimerId = null;
    }

    if (this.eventTimerList.length > 0) {
      this.eventTimerList.forEach(function (
        e: Nullable<ReturnType<typeof setTimeout>>
      ) {
        clearTimeout(e!);
        e = null;
      });
      this.eventTimerList = [];
    }

    if (this.videoModel!.onAdjusting()) {
      this.eventBus.dispatchEvent({
        type: 'ADJUST_CURRENTTIME_END',
        data: {
          ctime: time,
        },
      });
      //startBuffering.call(self,time,time,'2');
      this.seeking = false;
      return;
    }

    if (this.videoController != null) {
      this.videoController.cancelPendingRequests('video');
      this.videoController.abortOnGoingRequests();
    }
    if (this.audioController != null) {
      this.audioController.cancelPendingRequests('audio');
      this.audioController.abortOnGoingRequests();
    }

    for (let i = this.periodInfoArray!.length - 1; i >= 0; i--) {
      if (this.periodInfoArray![i].start <= time) {
        if (this.periodInfo!.start !== this.periodInfoArray![i].start) {
          this.currentPeriodIdx = i;
          this.updateDataInfo(
            this.updateDataReason.PERIOD_CHANGE,
            this.periodInfoArray![i],
            time,
            (_d: ResponseData) => {
              if (this.videoController != null) {
                this.videoController.getSegmentStartTime(
                  time,
                  (videoStartTime: number) => {
                    if (this.audioController != null) {
                      this.audioController.getSegmentStartTime(
                        videoStartTime,
                        (time: number) => {
                          //startBuffering.call(self,videoStartTime,videoStartTime,'3');
                          this.startBuffering.call(
                            self,
                            videoStartTime,
                            time,
                            '3'
                          );
                        }
                      );
                    } else {
                      this.startBuffering(videoStartTime, videoStartTime, '4');
                    }
                  }
                );
              } else {
                this.startBuffering.call(self, time, time, '5');
              }
            }
          );
          changePeriod = true;
        }
        break;
      }
    }

    if (!changePeriod) {
      if (this.videoController != null) {
        this.videoController.getSegmentStartTime(
          time,
          (videoStartTime: number) => {
            if (this.audioController != null) {
              this.audioController.getSegmentStartTime(
                videoStartTime,
                (_time: number) => {
                  this.NXDebug.debug('=====StartBuffering======');
                  this.startBuffering(videoStartTime, videoStartTime, '6');
                }
              );
            } else {
              this.startBuffering(videoStartTime, videoStartTime, '7');
            }
          }
        );
      } else {
        this.startBuffering(time, time, '8');
      }
    }
    this.lastSeekTime = NaN;
  };

  onSeeking = (): void => {
    if (this.seeking) {
      this.seekWaiting = true;
    } else {
      this._seeking.call(this);
    }
  };

  onSeekInhibition = (): void => {
    this.videoModel!.unlisten('seeking', this.seekingListener!);
  };

  onReleaseSeekInhibition = (): void => {
    this.videoModel!.listen('seeking', this.seekingListener!);
  };

  onPlaybackStarted = (): void => {
    this.sourceBufferExt!.playbackStart();
  };

  onSeeked = (): void => {
    this.videoModel!.listen('seeking', this.seekingListener!);
    this.videoModel!.unlisten('seeked', this.seekedListener!);
  };

  //NSV-a const onProgress = function () {
  //NSV-a   updateBuffer.call(this);
  //NSV-a };

  onUpdateDataEnd = (evt: ExEvent): void => {
    let q: Nullable<UpdateInfo> = null;

    while (this.updateQue.length > 0) {
      q = this.updateQue.shift()!;
      if (
        q!.reason == this.updateDataReason.PERIOD_CHANGE &&
        q!.reason == evt.data.reason &&
        q!.time == evt.data.time
      ) {
        q = null;
      } else {
        break;
      }
    }

    if (q != null) {
      this.updateDataInfo.call(this, q.reason, q.period, q.time, q.callback);
    }
  };

  /* istanbul ignore next */
  dispatchDashEvent = (): void => {
    const self = this;
    const c: number = this.videoModel!.getCurrentTime();

    const _checkEvent = (list: Array<DashEvent>): void => {
      let i: number = 0;
      let length: number = list.length;
      let dispatchList: Array<DispatchDashEvent> = [];
      for (i = 0; i < length; i++) {
        const de: DashEvent = list[i];
        if (
          !isNaN(this.ltimeupdate) &&
          c <= de.presentationTime! &&
          de.presentationTime! < c + (c - this.ltimeupdate)
        ) {
          let d: DispatchDashEvent = {
            index: i,
            de: de,
            timerId: null,
            delta: (de!.presentationTime! - c) * 1000,
          };
          dispatchList.push(d);

          /*
          this.eventBus.dispatchEvent({
            type: de.schemeIdUri!,
            data: {
              eventList: list,
              index: i,
              event: de,
            },
          });
          */
        }
      }

      dispatchList.forEach(function (d: DispatchDashEvent) {
        d.timerId = setTimeout(() => {
          self.eventBus.dispatchEvent({
            type: d.de!.schemeIdUri!,
            data: {
              eventList: list,
              index: d.index,
              event: d.de,
            },
          });
          if (self.deletePastDashEvent) {
            list.splice(list.indexOf(d.de), 1);
          }
          self.eventTimerList.splice(self.eventTimerList.indexOf(d.timerId), 1);
        }, d.delta);
        self.eventTimerList.push(d.timerId);
      });
    };

    for (let s in this.periodInfo!.inEventList) {
      _checkEvent(this.periodInfo!.inEventList[s]);
    }

    for (let s in this.periodInfo!.outEventList) {
      _checkEvent(this.periodInfo!.outEventList[s]);
    }

    this.ltimeupdate = c;
  };

  /* istanbul ignore next */
  onTimeupdate = (): void => {
    const self = this;
    let allRanges: Nullable<TimeRanges>;
    const curTime: number = this.videoModel!.getCurrentTime();

    this.updateBuffer.call(this);

    this.dispatchDashEvent.call(this);

    this.dispatchCheckGap.call(this, curTime);

    if (
      !isNaN(this.presentationEndTime) &&
      curTime > this.presentationEndTime
    ) {
      this.videoModel!.pause();
      return;
    }

    if (
      curTime > this.videoModel!.getDuration() - 4 &&
      //liveMulti
      this.mediaSource &&
      this.mediaSource.readyState === 'open' &&
      !this.manifestModel.getIsDynamic(this.manifest!)
    ) {
      //liveMulti
      const ranges: TimeRanges = this.videoModel!.getBuffered();
      if (
        ranges.start(ranges.length - 1) <= curTime &&
        ranges.end(ranges.length - 1) > this.videoModel!.getDuration() - 0.5
      ) {
        if (this.videoController != null) {
          allRanges = this.sourceBufferExt!.getAllRanges(
            this.videoController.getBuffer()!
          );
          if (allRanges) {
            if (allRanges.length > 0) {
              for (let i = 0, len = allRanges.length; i < len; i += 1) {
                this.NXDebug.debug(
                  '[video] Buffered Range[' +
                    i +
                    ']: ' +
                    allRanges.start(i) +
                    ' - ' +
                    allRanges.end(i)
                );
              }
            }
          }
        }

        if (this.audioController != null) {
          allRanges = this.sourceBufferExt!.getAllRanges(
            this.audioController.getBuffer()!
          );
          if (allRanges) {
            if (allRanges.length > 0) {
              for (let i = 0, len = allRanges.length; i < len; i += 1) {
                this.NXDebug.debug(
                  '[audio] Buffered Range[' +
                    i +
                    ']: ' +
                    allRanges.start(i) +
                    ' - ' +
                    allRanges.end(i)
                );
              }
            }
          }
        }
        this.logHandler.log(
          '********** onTimeupdate: signalEndOfStream ************'
        );
        this.signalEndOfStream.call(this, this.mediaSource);

        if (this.videoController != null) {
          this.videoController.clearTimer();
        }
        if (this.audioController != null) {
          this.audioController.clearTimer();
        }
      }
    }
    const checkPeriodIdx = this.currentPeriodIdx;
    if (
      this.periodChgCheck &&
      !this.dataIsUpdating &&
      this.currentPeriodIdx < this.periodInfoArray!.length - 1 &&
      curTime + 7 >= this.periodInfoArray![this.currentPeriodIdx].end
    ) {
      this.periodChgCheck = false;

      const results: Array<boolean> = [];
      results.push(
        this.videoController!.getIsStreamCompleted() ||
          this.alreadyBufferedAllSegments(
            this.videoController,
            curTime,
            this.periodInfoArray![this.currentPeriodIdx].end - 0.4
          )
      );
      results.push(
        this.audioController!.getIsStreamCompleted() ||
          this.alreadyBufferedAllSegments(
            this.audioController,
            curTime,
            this.periodInfoArray![this.currentPeriodIdx].end - 0.4
          )
      );

      if (
        results[0] &&
        results[1] &&
        checkPeriodIdx === this.currentPeriodIdx
      ) {
        if (this.currentPeriodIdx < this.periodInfoArray!.length - 1) {
          this.currentPeriodIdx++;
          this.logHandler.log(
            '*** appended all segments in this period. start fetching period[' +
              this.currentPeriodIdx +
              '] *** : ' +
              checkPeriodIdx
          );
          this.updateDataInfo(
            this.updateDataReason.PERIOD_CHANGE,
            this.periodInfoArray![this.currentPeriodIdx],
            this.periodInfoArray![this.currentPeriodIdx].start,
            (d: ResponseData) => {
              this.startBuffering.call(self, d.data, d.data, '9');
              /*
              if (this.checkGapTimerId) {
                //clearInterval(this.checkGapTimerId);
                //this.checkGapTimerId = null;
              } else {
                const nextStart =
                  this.periodInfoArray![this.currentPeriodIdx].start;
                this.checkGapTimerId = setInterval(
                  this.checkGap.bind(this, this.currentPeriodIdx, nextStart),
                  this.CHECK_GAP_INTERVAL * 1000
                );
              }
              */
            }
          );
        } else {
          // eslint-disable-line no-empty
        }
      } else if (checkPeriodIdx !== this.currentPeriodIdx) {
        this.logHandler.log(
          '### currentPeriodIdx: ' +
            this.currentPeriodIdx +
            ', checkPeriodIdx: ' +
            checkPeriodIdx
        );
      }
      this.periodChgCheck = true;
    }
  };

  bufferGapBetweenPeriods = (curTime: number, targetTime: number): boolean => {
    const vgap: boolean = this.checkBufferGap(
      this.videoController,
      curTime,
      targetTime
    );
    const agap: boolean = this.checkBufferGap(
      this.audioController,
      curTime,
      targetTime
    );

    if (vgap == true || agap == true) {
      return true;
    } else {
      return false;
    }
  };

  checkBufferGap = (
    bfController: Nullable<BufferController>,
    curTime: number,
    targetTime: number
  ): boolean => {
    let range: Nullable<TimeRange>;
    if (bfController != null) {
      const toler: number = bfController.getTolerance();
      range = this.sourceBufferExt!.getBufferRange(
        bfController.getBuffer(),
        targetTime - toler,
        toler
      );

      if (
        range != null &&
        range.start <= curTime &&
        targetTime + 0.1 <= range.end
      ) {
        return false;
      } else {
        return true;
      }
    } else {
      return false;
    }
  };

  alreadyBufferedAllSegments = (
    bfController: Nullable<BufferController>,
    curTime: number,
    endTime: number
  ): boolean => {
    let range: Nullable<TimeRange>;

    if (bfController != null) {
      range = this.sourceBufferExt!.getBufferRange(
        bfController.getBuffer(),
        curTime,
        bfController.getTolerance()
      );
      if (range != null && range.end >= endTime) {
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  };

  bufferGapOnlyInVideoBuffer = (curTime: number, endTime: number): boolean => {
    let vrange: Nullable<TimeRange> = null;
    let arange: Nullable<TimeRange> = null;

    if (this.videoController != null) {
      vrange = this.sourceBufferExt!.getBufferRange(
        this.videoController.getBuffer(),
        curTime,
        this.videoController.getTolerance()
      );
      if (vrange != null && vrange.end < endTime) {
        if (this.audioController != null) {
          arange = this.sourceBufferExt!.getBufferRange(
            this.audioController.getBuffer(),
            curTime,
            this.audioController.getTolerance()
          );

          if (arange != null && arange.end >= endTime) {
            return true;
          } else {
            return false;
          }
        } else {
          return true;
        }
      } else {
        return false;
      }
    } else {
      return false;
    }
  };

  checkNextPeriodTop = (temporalStartTime: number): boolean => {
    let range: Nullable<TimeRange> = this.sourceBufferExt!.getBufferRange(
      this.videoController!.getBuffer(),
      temporalStartTime + 1.5,
      this.videoController!.getTolerance()
    );
    if (range != null) {
      if (this.audioController != null) {
        range = this.sourceBufferExt!.getBufferRange(
          this.audioController.getBuffer(),
          temporalStartTime + 1.5,
          this.audioController.getTolerance()
        );
        return range != null ? true : false;
      } else {
        return true;
      }
    }
    return false;
  };

  seekToNearestStartTime = (temporalStartTime: number): void => {
    let startTime: number = 0;
    let range: Nullable<TimeRange> = this.sourceBufferExt!.getBufferRange(
      this.videoController!.getBuffer(),
      temporalStartTime + 0.5,
      this.videoController!.getTolerance()
    );
    if (range != null) {
      if (range.start < temporalStartTime) {
        startTime = temporalStartTime;
      } else {
        startTime = range.start;
      }
      if (this.audioController != null) {
        range = this.sourceBufferExt!.getBufferRange(
          this.audioController.getBuffer(),
          temporalStartTime + 0.5,
          this.audioController.getTolerance()
        );
        if (startTime < range!.start) {
          startTime = range!.start;
        }
      }
      this.logHandler.log('ST:' + startTime);
      this.videoModel!.silentSeek(startTime);
    } else {
      this.logHandler.log('?????');
      startTime = temporalStartTime;
      this.videoModel!.setCurrentTime(startTime + 0.2);
    }
  };

  //NSV-a const searchNearestStartTime = (temporalStartTime) => {
  //NSV-a   let startTime = 0;
  //NSV-a   let range = null;
  //NSV-a
  //NSV-a   range = sourceBufferExt.getBufferRange(
  //NSV-a     videoController.getBuffer(),
  //NSV-a     temporalStartTime + 0.5,
  //NSV-a     videoController.getTolerance()
  //NSV-a   );
  //NSV-a   if (range != null) {
  //NSV-a     if (range.start < temporalStartTime) {
  //NSV-a       startTime = temporalStartTime + 0.2;
  //NSV-a     } else {
  //NSV-a       startTime = range.start;
  //NSV-a     }
  //NSV-a     if (audioController != null) {
  //NSV-a       range = sourceBufferExt.getBufferRange(
  //NSV-a         audioController.getBuffer(),
  //NSV-a         temporalStartTime + 0.5,
  //NSV-a         audioController.getTolerance()
  //NSV-a       );
  //NSV-a       if (startTime < range.start) {
  //NSV-a         startTime = range.start;
  //NSV-a       }
  //NSV-a     }
  //NSV-a     logHandler.log('ST:' + startTime);
  //NSV-a   } else {
  //NSV-a     logHandler.log('?????');
  //NSV-a     startTime = temporalStartTime;
  //NSV-a   }
  //NSV-a
  //NSV-a   return startTime;
  //NSV-a };

  /* istanbul ignore next */
  onRatechange = (): void => {
    /*
      if (videoController) {
          videoController.updateStalledState();
      }
      if (audioController) {
          audioController.updateStalledState();
      }
    */
  };

  updateBuffer = (): void => {
    if (this.videoController) {
      this.videoController.updateBufferState();
    }

    if (this.audioController) {
      this.audioController.updateBufferState();
    }
  };

  startBuffering = (vtime?: number, atime?: number, msg?: string): void => {
    if (this.videoController) {
      if (vtime === undefined) {
        this.videoController.start('33333');
      } else {
        if (!this.seekWaiting) {
          this.videoController.seek(vtime, '{' + msg + '} [video] seek');
        } else {
          // eslint-disable-line no-empty
        }
      }
    }

    if (this.audioController) {
      if (atime === undefined) {
        this.audioController.start('44444');
      } else {
        if (!this.seekWaiting) {
          this.audioController.seek(atime, '{' + msg + '}[audio] seek');
        }
      }
    }
    this.seeking = false;
    if (this.seekWaiting) {
      this.seekWaiting = false;
      this._seeking.call(this);
    }
  };

  stopBuffering = (): void => {
    if (this.videoController) {
      this.videoController.stop();
    }
    if (this.audioController) {
      this.audioController.stop();
    }
  };

  suspend = (): void => {
    if (
      !this.scheduleWhilePaused ||
      this.manifestModel.getIsDynamic(this.manifest!)
    ) {
      this.stopBuffering.call(this);
    }
  };

  updateCurrentTime = (): void => {
    if (this.videoModel!.isPaused()) return;
    if (this.dataIsUpdating) return;
    this.startBuffering();
  };

  /* istanbul ignore next */
  doLoad = (manifestResult: ManifestModel): void => {
    const self = this;

    const initialize = (): void => {
      this.eventBus.removeEventListener('MEDIASOURCE_IS_SET', initialize);
      this.setDuration.call(self);
      this.initializeMediaSource.call(self, (result: boolean) => {
        if (result) {
          this.NXDebug.log('Playback initialized!');
          this.initialized = true;
          this.NXDebug.log('element loaded!');
          this.eventBus.dispatchEvent({
            type: 'PLAYBACK_INITIALIZED',
            data: {},
          });
        }
      });
    };

    this.manifest = manifestResult;

    this.videoModel!.setAutoPlay(this.autoPlay);

    if (this.mediaSource != null) {
      initialize();
    } else {
      this.eventBus.addEventListener('MEDIASOURCE_IS_SET', initialize);
    }
  };

  /* istanbul ignore next */
  tempLoad = (manifestResult: ManifestModel): void => {
    const self = this;
    const initialize = (): void => {
      this.tempInitializeMediaSource.call(self, (result: boolean) => {
        if (result) {
          this.NXDebug.log('Playback initialized!');
          this.initialized = true;
          this.NXDebug.log('element loaded!');
          this.eventBus.dispatchEvent({
            type: 'PLAYBACK_INITIALIZED',
            data: {},
          });
        }
      });
    };

    this.manifest = manifestResult;

    this.videoModel!.setAutoPlay(this.autoPlay);
    initialize();
  };

  currentTimeChanged = (): void => {
    this.NXDebug.log('Current time has changed, block programmatic seek.');

    this.videoModel!.unlisten('seeking', this.seekingListener!);
    this.videoModel!.listen('seeked', this.seekedListener!);
  };

  bufferingCompleted = (_evt: ExEvent): void => {
    // if there is at least one buffer controller that has not completed buffering yet do nothing
    if (
      (this.videoController && !this.videoController.isBufferingCompleted) ||
      (this.audioController && !this.audioController.isBufferingCompleted)
    ) {
      return;
    }

    // buffering has been complted, now we can signal end of stream
    if (this.mediaSource) {
      this.logHandler.log(' *** bufferingCompleted ***');
    }
  };

  segmentLoadingFailed = (): void => {
    this.stopBuffering.call(this);
  };

  /* istanbul ignore next */
  processProtection = (
    type: string,
    initDataArray: Array<InitData>,
    idx: number
  ): void => {
    const self = this;
    let buffer: Nullable<ExSourceBuffer> = null;
    let listener: NXEventListener;

    const processProtectionHandler = (): void => {
      this.eventBus.removeEventListener('ON_KEY_ADDED', listener);

      if (idx === 1) {
        if (type === 'video' && this.audioInitData.length !== 0) {
          this.processProtection.call(self, 'audio', this.audioInitData, 0);
        } else {
          this.NXDebug.debug('process protection end!!!');
          this.setAppendStatus(true, 0);
          this.setInitialSeekTime.call(this, (_val: boolean) => {
            //   setAppendStatus(true, 0);
          });
        }
      } else {
        buffer =
          type === 'video'
            ? this.videoController!.getBuffer()
            : this.audioController!.getBuffer();

        if (buffer!.updating === undefined) {
          buffer!.append!(initDataArray[idx].data);
        } else {
          buffer!.appendBuffer!(initDataArray[idx].data);
        }

        this.drmKeyProcessing = true;

        this.drmKeyProcessingTimerId = setTimeout(() => {
          if (this.drmKeyProcessing) {
            this.drmKeyProcessing = false;
            this.eventBus.dispatchEvent({
              type: 'ON_KEY_ADDED',
              data: {},
            });
          }
          this.drmKeyProcessingTimerId = null;
        }, 1000);

        this.processProtection.call(self, type, initDataArray, idx + 1);
      }
    };

    if (this.drmKeyProcessing) {
      listener = processProtectionHandler.bind(self);
      this.eventBus.addEventListener('ON_KEY_ADDED', listener);
    } else {
      processProtectionHandler();
    }
  };

  setInitialSeekTime = (callback: (val: boolean) => void): void => {
    if (this.videoModel!.getCurrentTime() === 0) {
      const initialSeekTime: number = this.videoModel!.getStartTime();

      const target: number = initialSeekTime;
      this.NXDebug.log(
        'Starting playback at offset: ' +
          initialSeekTime +
          ', adjusted:' +
          target
      );
      this.logHandler.log(
        'Starting playback at offset: ' +
          initialSeekTime +
          ', adjusted:' +
          target
      );
      if (target > 0.5) {
        this.videoModel!.silentSeek(target, () => {
          callback(true);
        });
      } else {
        callback(true);
      }
    }
  };

  /* istanbul ignore next */
  streamIsCompleted = (e: ExEvent): void => {
    const self = this;
    this.NXDebug.debug('[' + e.data!.type + '] Stream is completed.----');
    let completed: boolean = false;
    const curTime: number = this.videoModel!.getCurrentTime();
    if (e.data!.type === 'video') {
      if (this.audioController) {
        if (
          this.audioController.getIsStreamCompleted() ||
          this.alreadyBufferedAllSegments(
            this.audioController,
            curTime,
            e.data!.pEnd - 0.2
          )
        ) {
          completed = true;
        }
      } else {
        completed = true;
      }
    } else {
      if (this.videoController) {
        if (
          this.videoController.getIsStreamCompleted() ||
          this.alreadyBufferedAllSegments(
            this.videoController,
            curTime,
            e.data!.pEnd - 0.2
          )
        ) {
          completed = true;
        }
      } else {
        completed = true;
      }
    }

    if (completed) {
      for (let ii = 0; ii < this.periodInfoArray!.length; ii++) {
        if (this.periodInfoArray![ii].start == e.data!.pStart) {
          if (ii < this.periodInfoArray!.length) {
            this.currentPeriodIdx = ii + 1;
          } else {
            this.currentPeriodIdx = ii;
          }
          break;
        }
      }
      if (e.data!.pStart < this.periodInfoArray![0].start) {
        this.currentPeriodIdx = 0;
      }

      if (this.periodInfoArray!.length > this.currentPeriodIdx) {
        if (
          this.periodInfoArray![this.currentPeriodIdx].start ==
          this.periodInfo!.start
        )
          return;
        for (let i = 0; i < this.updateQue.length; i++) {
          if (
            this.updateQue[i].reason == this.updateDataReason.PERIOD_CHANGE &&
            this.updateQue[i].time ==
              this.periodInfoArray![this.currentPeriodIdx].start
          )
            return;
        }

        this.logHandler.log(
          '*** -appended all segments in this period. start fetching period[' +
            this.currentPeriodIdx +
            ']  p:' +
            e.data!.pStart +
            ', n:' +
            this.periodInfoArray![this.currentPeriodIdx].start +
            ' ***'
        );
        this.NXDebug.info(
          '*** -appended all segments in this period. start fetching period[' +
            this.currentPeriodIdx +
            '] p:' +
            e.data!.pStart +
            ', n:' +
            this.periodInfoArray![this.currentPeriodIdx].start +
            ' ***'
        );
        const nextStart: number =
          this.periodInfoArray![this.currentPeriodIdx].start;
        this.updateDataInfo(
          this.updateDataReason.PERIOD_CHANGE,
          this.periodInfoArray![this.currentPeriodIdx],
          this.periodInfoArray![this.currentPeriodIdx].start,
          (d: ResponseData) => {
            this.startBuffering.call(self, d.data, d.data, '10');

            this.checkGapQue.push({
              curStart: e.data.pStart,
              nextIdx: this.currentPeriodIdx,
              nextStart: nextStart,
            });
          }
        );
      } else if (this.mediaSource && this.mediaSource.readyState === 'open') {
        // eslint-disable-line no-empty
      }
    } else {
      // eslint-disable-line no-empty
    }
  };

  /* istanbul ignore next */
  initDataReceived = (e: ExEvent): void => {
    if (this.videoModel!.getCurrentTime() !== 0) {
      return;
    }

    if (e.data!.type === 'video') {
      this.videoInitReceived = true;
      this.videoInitData = e.data!.initData;
    } else if (e.data!.type === 'audio') {
      this.audioInitReceived = true;
      this.audioInitData = e.data!.initData;
    }

    if (this.videoInitReceived && this.audioInitReceived) {
      const setup = (): void => {
        this.eventBus.removeEventListener('MEDIASOURCE_UPDATED', setup);
        this.setDummy();
        const vInitData: Nullable<Uint8Array> =
          this.videoInitData != null ? this.videoInitData[0].data : null;
        const aInitData: Nullable<Uint8Array> =
          this.audioInitData != null ? this.audioInitData[0].data : null;
        if (this.contentProtections === null) {
          this.setInitData(vInitData, aInitData);
        } else if (
          this.protectionController!.supportsMediaKeys() ||
          this.protectionController!.supportsEME01b()
        ) {
          const _onKeyAdded = (): void => {
            this.eventBus.removeEventListener('ON_KEY_ADDED', _onKeyAdded);
            this.setAppendStatus(true, 0);
            this.setInitialSeekTime.call(this, (_val: boolean) => {});
          };
          this.setInitData(vInitData, aInitData);
          if (!this.drmInitialized) {
            this.eventBus.addEventListener('ON_KEY_ADDED', _onKeyAdded);
          } else {
            this.setAppendStatus(true, 0);
            this.setInitialSeekTime.call(this, function () {});
          }
        } else {
          this.setInitData(vInitData, aInitData);
        }
      };

      if (!this.videoModel!.isDummy()) {
        setup();
      } else {
        this.eventBus.addEventListener('MEDIASOURCE_UPDATED', setup);
      }
    }
  };

  bufferStateChange = (e: ExEvent) => {
    let state: number;
    if (e.data!.type == 'video') {
      if (this.audioController != null)
        state = Math.min(e.data!.state, this.audioController.getBufferState());
    } else {
      if (this.videoController != null)
        state = Math.min(e.data!.state, this.videoController.getBufferState());
    }

    if (this.bufferState != state!) {
      this.bufferState = state!;

      this.eventBus.dispatchEvent({
        type: 'BUFFER_STATE_CHANGE',
        data: this.bufferState,
      });
    }
  };

  clearInitTimer = (): void => {
    if (this.drmKeyProcessingTimerId) {
      clearTimeout(this.drmKeyProcessingTimerId);
      this.drmKeyProcessingTimerId = null;
    }
  };

  onKeyAdded = (): void => {
    this.drmKeyProcessing = false;
    this.eventBus.dispatchEvent({
      type: 'ON_KEY_ADDED',
      data: {},
    });
    this.NXDebug.debug('onKeyAdded!!!!!');
    this.drmInitialized = true;
  };

  clearPreparedRequests = (): void => {
    if (this.videoController != null) {
      this.videoController.cancelPendingRequests('video');
      this.videoController.clearAllSegments();
    }
    if (this.audioController != null) {
      this.audioController.cancelPendingRequests('audio');
      this.audioController.clearAllSegments();
    }
  };

  getCurrentAdaptationIdxFor = (type: string): number => {
    if (type === 'video' && this.videoController) {
      const videoData: AdaptationSet = this.videoController.getData()!;
      return videoData.index;
    } else if (type === 'audio' && this.audioController) {
      const audioData: AdaptationSet = this.audioController.getData()!;
      return audioData.index;
    } else {
      return -1;
    }
  };

  setAdaptationIdxFor = (type: string, idx: number): void => {
    if (type === 'video' && this.videoController) {
      this.videoController.updateData(
        this.updateDataReason.ADAPTATION_CHANGE,
        this.periodInfo!.getDataForIndex(idx),
        this.periodInfo! /*, pending */,
        0
      );
    } else if (type === 'audio' && this.audioController) {
      this.audioController.updateData(
        this.updateDataReason.ADAPTATION_CHANGE,
        this.periodInfo!.getDataForIndex(idx),
        this.periodInfo! /*, pending */,
        0
      );
    }
  };

  setAdaptationRoleFor = (type: string, value: RoleType) => {
    const roles: Array<RoleType> = this.periodInfo!.getRolesFor(type);
    let idx: number = -1;

    for (let i = 0; i < roles.length; i++) {
      if (roles[i].role == value) {
        idx = roles[i].index;
        break;
      }
    }
    if (type === 'video' && this.videoController && idx != -1) {
      this.videoController.updateData(
        this.updateDataReason.ADAPTATION_CHANGE,
        this.periodInfo!.getDataForIndex(idx),
        this.periodInfo! /*, pending */,
        0
      );
    } else if (type === 'audio' && this.audioController && idx != -1) {
      this.audioController.updateData(
        this.updateDataReason.ADAPTATION_CHANGE,
        this.periodInfo!.getDataForIndex(idx),
        this.periodInfo! /*, pending */,
        0
      );
    }
  };

  /* istanbul ignore next*/
  updateDataInfo = (
    reason: string,
    updatedPeriodInfo: Period,
    time: number,
    callback: (d: ResponseData) => void
  ): void => {
    let videoData: Nullable<AdaptationSet> | undefined;
    let audioData: Nullable<AdaptationSet> | undefined;
    let tmpData: Nullable<AdaptationSet>;
    let isClientServerTimeSyncCompletedForTC: boolean = false;
    let clientServerTimeShift: number = 0;
    let timestampOffsetFor32bitVE: number = 0;
    let inEventList: Array<Array<DashEvent>> = [];
    let liveEdgeFromRequest: number = 0;

    const dispatchUpdateDataEnd = (reason: string, time: number): void => {
      this.dataIsUpdating = false;
      this.eventBus.dispatchEvent({
        type: 'UPDATE_DATA_END',
        data: {
          reason,
          time,
        },
      });
    };

    this.dataIsUpdating = true;
    this.manifest = this.manifestModel.getValue();
    if (this.manifestModel.getIsDynamic(this.manifest!) == false) {
      this.periodInfo = null;
    }
    if (this.periodInfo) {
      isClientServerTimeSyncCompletedForTC =
        this.periodInfo.isClientServerTimeSyncCompletedForTC;
      clientServerTimeShift = this.periodInfo.clientServerTimeShift;
      timestampOffsetFor32bitVE = this.periodInfo.timestampOffsetFor32bitVE;
      inEventList = this.periodInfo.inEventList;
      liveEdgeFromRequest = this.periodInfo.liveEdgeFromRequest;
      if (reason == this.updateDataReason.MPD_UPDATE) {
        updatedPeriodInfo.mpd!.liveEdge = this.periodInfo.mpd!.liveEdge;
        updatedPeriodInfo.mpd!.liveEdgeS = this.periodInfo.mpd!.liveEdgeS;
        updatedPeriodInfo.mpd!.liveEdgeE = this.periodInfo.mpd!.liveEdgeE;
        updatedPeriodInfo.mpd!.liveEdgeC = this.periodInfo.mpd!.liveEdgeC;
      }
      this.periodInfo = updatedPeriodInfo;
      this.periodInfo.isClientServerTimeSyncCompletedForTC =
        isClientServerTimeSyncCompletedForTC;
      this.periodInfo.clientServerTimeShift = clientServerTimeShift;
      this.periodInfo.timestampOffsetFor32bitVE = timestampOffsetFor32bitVE;
      this.periodInfo.inEventList = inEventList;
      this.periodInfo.liveEdgeFromRequest = liveEdgeFromRequest;
    } else {
      this.periodInfo = updatedPeriodInfo;
    }
    this.currentPeriodIdx = this.periodInfo.index;

    this.NXDebug.log('Manifest updated... set new data on buffers.' + time);

    const updateController = (
      bfController: BufferController,
      type: string,
      adaptation: Nullable<AdaptationSet> | undefined,
      callback?: (d: ResponseData) => void
    ): void => {
      callback = callback || ((_d: ResponseData) => {});
      if (this.manifestModel.getIsDynamic(this.manifest!)) {
        adaptation = bfController.getData();
        if (
          adaptation != null &&
          adaptation.period!.start == this.periodInfo!.start
        ) {
          if (adaptation != null && hasProperty(adaptation, 'id')) {
            tmpData = this.periodInfo!.getDataForId(adaptation.id!);
          } else {
            tmpData = this.periodInfo!.getDataForIndex(adaptation.index);
          }
        } else {
          tmpData = this.periodInfo!.getPrimaryMediaData(type);
        }
      } else {
        tmpData = this.periodInfo!.getPrimaryMediaData(type);
      }
      if (!tmpData) {
        callback({
          status: 'fail',
          msg: 'no ' + type + ' AdaptationSets??',
        });
        return;
      }

      if (type == 'video') {
        this.protectionController!.createMediaKeysFromMPD(tmpData, null);
      } else {
        this.protectionController!.createMediaKeysFromMPD(null, tmpData);
      }

      bfController.updateData(
        reason,
        tmpData,
        this.periodInfo!,
        time,
        (f: ResponseData) => {
          callback!(f);
        }
      );
    };

    if (this.videoController != null && this.audioController != null) {
      updateController(this.videoController, 'video', videoData, (_f) => {
        updateController(
          this.audioController!,
          'audio',
          audioData,
          (f: ResponseData) => {
            callback(f);
            dispatchUpdateDataEnd(reason, time);
          }
        );
      });
    } else if (this.videoController != null) {
      updateController(
        this.videoController,
        'video',
        videoData!,
        (f: ResponseData) => {
          callback(f);
          dispatchUpdateDataEnd(reason, time);
        }
      );
    } else if (this.audioController != null) {
      updateController(
        this.audioController,
        'audio',
        audioData!,
        (f: ResponseData) => {
          callback(f);
          dispatchUpdateDataEnd(reason, time);
        }
      );
    } else {
      callback({
        status: 'ok',
        data: time,
      });
      dispatchUpdateDataEnd(reason, time);
    }
  };

  signalEndOfStream = (source: MediaSource): void => {
    source.endOfStream();
  };

  setup = (): void => {
    this.eventBus.addEventListener(
      'setCurrentTime',
      this.currentTimeChanged.bind(this)
    );
    this.eventBus.addEventListener(
      'bufferingCompleted',
      this.bufferingCompleted.bind(this)
    );
    this.eventBus.addEventListener(
      'segmentLoadingFailed',
      this.segmentLoadingFailed.bind(this)
    );

    this.eventBus.addEventListener(
      'initDataReceived',
      this.initDataReceived.bind(this)
    );
    this.eventBus.addEventListener(
      'streamIsCompleted',
      this.streamIsCompleted.bind(this)
    );
    this.eventBus.addEventListener(
      'bufferStateChangeInt',
      this.bufferStateChange.bind(this)
    );

    this.eventBus.addEventListener(
      'seekInhibition',
      this.onSeekInhibition.bind(this)
    );
    this.eventBus.addEventListener(
      'releaseSeekInhibition',
      this.onReleaseSeekInhibition.bind(this)
    );
    this.eventBus.addEventListener(
      'playbackStarted',
      this.onPlaybackStarted.bind(this)
    );
    this.eventBus.addEventListener(
      'UPDATE_DATA_END',
      this.onUpdateDataEnd.bind(this)
    );

    this.fragmentController = new FragmentController(
      this.params,
      this.eventBus,
      this.metricsModel,
      hasProperty(this.xhrCustom, 'seg') ? this.xhrCustom['seg'] : {}
    );

    this.playListener = this.onPlay.bind(this);
    this.pauseListener = this.onPause.bind(this);

    this.stalledListener = this.onStalled.bind(this);

    this.errorListener = this.onError.bind(this);
    this.seekingListener = this.onSeeking.bind(this);
    this.seekedListener = this.onSeeked.bind(this);
    this.ratechangeListener = this.onRatechange.bind(this);
    this.timeupdateListener = this.onTimeupdate.bind(this);
    this.loadedListener = this.onLoad.bind(this);
    this.canplaythroughListener = this.onCanPlayThrough.bind(this);
  };

  load = (
    manifest: ManifestModel,
    periodInfoValue: Period,
    periodInfoArrayValue: Array<Period>
  ): void => {
    this.periodInfo = periodInfoValue;

    this.periodInfoArray = periodInfoArrayValue;
    this.currentPeriodIdx = this.periodInfo.index;
    if (!this.videoModel!.isDummy()) {
      this.doLoad.call(this, manifest);
    } else {
      this.tempLoad.call(this, manifest);
    }
  };

  updatePlaybackCondition = (
    manifest: ManifestModel,
    _periodInfoValue: Period,
    periodInfoArrayValue: Array<Period>
  ): void => {
    this.periodInfoArray = periodInfoArrayValue;
    this.manifest = manifest;
    if (this.manifest.mpd!.type === 'static') {
      try {
        if (
          this.manifest.mpd!.mediaPresentationDuration != null &&
          this.manifest.mpd!.mediaPresentationDuration !== Infinity
        ) {
          if (
            this.mediaSource!.duration <
            this.manifest.mpd!.mediaPresentationDuration
          ) {
            this.mediaSource!.duration =
              this.manifest.mpd!.mediaPresentationDuration;
          }
        } else {
          this.mediaSource!.duration =
            this.periodInfoArray[this.periodInfoArray.length - 1].end;
        }
      } catch (e) {
        this.logHandler.log('duration cannot be changed while buffer updating');
      }
      this.NXDebug.log(
        'Duration successfully set to: ' + this.mediaSource!.duration
      );
    }
  };

  setVideoModel = (value: VideoModel | DummyVideoModel): void => {
    this.videoModel = value;
    this.videoModel.listen('play', this.playListener!);
    this.videoModel.listen('pause', this.pauseListener!);

    this.videoModel.listen('stalled', this.stalledListener!);

    this.videoModel.listen('error', this.errorListener!);
    this.videoModel.listen('seeking', this.seekingListener!);
    this.videoModel.listen('timeupdate', this.timeupdateListener!);
    //videoModel.listen("progress", progressListener);
    this.videoModel.listen('ratechange', this.ratechangeListener!);
    this.videoModel.listen('loadedmetadata', this.loadedListener!);
    this.videoModel.listen('canplaythrough', this.canplaythroughListener!);

    this.sourceBufferExt!.setVideoModel(value);
  };

  initProtection = (): void => {
    if (!this.videoModel!.isDummy()) {
      this.protectionController = new ProtectionController(
        this.params,
        this.eventBus,
        hasProperty(this.xhrCustom, 'drm') ? this.xhrCustom['drm'] : {}
      );
      this.protectionController.init(this);
    }
  };

  getVideoModel = (): VideoModel | DummyVideoModel => {
    return this.videoModel!;
  };

  getManifestModel = (): ManifestModel => {
    return this.manifestModel;
  };

  setAutoPlay = (value: boolean): void => {
    this.autoPlay = value;
  };

  getAutoPlay = () => {
    return this.autoPlay;
  };

  reset = () => {
    this.pause.call(this, true);
    this.videoModel!.unlisten('play', this.playListener!);
    this.videoModel!.unlisten('pause', this.pauseListener!);

    this.videoModel!.unlisten('stalled', this.stalledListener!);

    this.videoModel!.unlisten('error', this.errorListener!);
    this.videoModel!.unlisten('seeking', this.seekingListener!);
    this.videoModel!.unlisten('timeupdate', this.timeupdateListener!);
    //videoModel.unlisten("progress", progressListener);
    this.videoModel!.unlisten('loadedmetadata', this.loadedListener!);
    this.videoModel!.unlisten('canplaythrough', this.canplaythroughListener!);

    this.videoModel!.reset();

    this.fragmentController!.reset();
    this.fragmentController = null;

    this.tearDownMediaSource.call(this);

    this.protectionController!.reset();

    this.drmKeyProcessing = false;
    this.xhrCustom = {};
    this.dataIsUpdating = false;
    this.updateQue = [];
    this.checkGapQue = [];
    this.bufferState = 0;
  };

  // getDuration() {
  //   return periodInfo.duration;
  // }

  // getStartTime() {
  //   return periodInfo.start;
  // }

  // getPeriodIndex() {
  //   return periodInfo.index;
  // }

  // getId() {
  //   return periodInfo.id;
  // }

  getPeriodInfo(): Period {
    return this.periodInfo!;
  }

  setPresentationStartTime = (value: number): void => {
    this.initialPresentationStartTime = value;
  };

  setPresentationEndTime = (value: number): void => {
    this.presentationEndTime = value;
  };

  setMediaSource = (value: Nullable<MediaSource>): void => {
    if (value != null) {
      this.mediaSource = value;
      this.sourceBufferExt!.setMediaSource(value);
      this.eventBus.dispatchEvent({
        type: 'MEDIASOURCE_IS_SET',
        data: value,
      });
    }
  };

  updateMediaSource = (): void => {
    const update = () => {
      this.eventBus.removeEventListener('MEDIASOURCE_IS_SET', update);
      this.setDuration(true);
      this.updateSourceBuffer();
      this.eventBus.dispatchEvent({
        type: 'MEDIASOURCE_UPDATED',
        data: {},
      });
    };

    this.eventBus.addEventListener('MEDIASOURCE_IS_SET', update);
  };

  getBufferState = (): number => {
    return this.bufferState;
  };

  getBufferFor = (type: string): Nullable<ExSourceBuffer> => {
    if (type == 'video' && this.videoController != null) {
      return this.videoController.getBuffer();
    } else if (type == 'audio' && this.audioController != null) {
      return this.audioController.getBuffer();
    } else {
      return null;
    }
  };

  // getFetchingPeriodIdx = ():number => {
  //   return this.currentPeriodIdx;
  // };

  end = (): void => {
    this.pause.call(this, true);

    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      this.logHandler.log('********** stop: signalEndOfStream ************');
      this.signalEndOfStream.call(this, this.mediaSource);
    }
  };

  updateData = (
    reason: string,
    period: Period,
    time: number,
    callback: (d: ResponseData) => void
  ) => {
    const self = this;
    let uq: UpdateInfo;

    if (this.dataIsUpdating) {
      if (this.updateQue.length > 0) {
        for (let i = this.updateQue.length - 1; i >= 0; i--) {
          uq = this.updateQue[i];
          if (uq.reason == this.updateDataReason.PERIOD_CHANGE) {
            this.updateQue.pop();
          }
        }
      }
      this.updateQue.push({
        reason,
        period,
        time,
        callback,
      });
    } else {
      this.updateDataInfo.call(self, reason, period, time, callback);
    }
  };
}
