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

import LogHandler from '../core/LogHandler';
import { _log, _debug, _info } from '../core/Debug';
import { EventBus } from '../core/EventBus';

/**
 * VideoModel
 *
 * @module VideoModel（VideoModelモジュール）
 */

/**
 * VideoModel
 * @constructor
 */
class VideoModel {
  element: NXHTMLVideoElement;
  eventBus: EventBus;

  constructor(value: NXHTMLVideoElement, eventBus: EventBus) {
    this.element = value;
    this.eventBus = eventBus;
  }

  autoPlay: boolean = true;
  selfPaused: boolean = false;
  //NSV-a  let manualPause = true;
  startTime: number = NaN;
  startOffset: number = 0;
  stalledStreams: Array<string> = [];

  sourceBuffers: {
    video: SourceBuffer | undefined;
    audio: SourceBuffer | undefined;
  } = {
    video: undefined,
    audio: undefined,
  };

  epsilonVal: { video: number; audio: number } = {
    video: 0,
    audio: 0,
  };

  //NSV-a  let seekedListener;
  //NSV-a  let seekedListener2;

  canplaythroughListener: (evt: Event) => void = () => {};
  adjusting: boolean = false;
  needsMoreData: boolean = true;
  skipGapAtHOB: boolean = false;
  playbackStarted: boolean = false;
  playCheckTimerId: Nullable<ReturnType<typeof setTimeout>> = null;

  isStalled = (): boolean => this.stalledStreams.length > 0;

  /* istanbul ignore next */
  playCheck = (cur: number): void => {
    const self = this;
    let timeupdateListener;
    let internalPause = false;

    const onTimeupdate = (cur: number): void => {
      if (cur != this.element.currentTime) {
        this.element.removeEventListener('timeupdate', timeupdateListener);
        if (this.playCheckTimerId != null) {
          clearTimeout(this.playCheckTimerId);
        }
      }
    };

    const checkState = (readyState: number): void => {
      this.playCheckTimerId = null;
      if (!this.element.paused || internalPause) {
        if (cur == this.element.currentTime) {
          if (this.element.readyState < 3) {
            const b = this.element.buffered;

            for (let i = 0; i < b.length; i++) {
              if (b.start(i) <= cur && cur < b.end(i)) {
                if (b.end(i) - cur > 10) {
                  this.element.removeEventListener(
                    'timeupdate',
                    timeupdateListener
                  );
                  self.silentSeek(cur + 0.01);
                } else {
                  this.playCheckTimerId = setTimeout(
                    checkState.bind(self, this.element.readyState),
                    2000
                  );
                }
              }
            }
          } else {
            if (readyState > 2) {
              this.element.removeEventListener(
                'timeupdate',
                timeupdateListener
              );
              if (this.element.paused) {
                this.playCheckTimerId = setTimeout(
                  checkState.bind(self, this.element.readyState),
                  2000
                );
                this.play.call(self);
              } else {
                self.silentSeek(cur + 0.1);
              }
            } else {
              this.playCheckTimerId = setTimeout(
                checkState.bind(self, this.element.readyState),
                1000
              );
              this.element.pause();
              internalPause = true;
            }
          }
        } else {
          this.element.removeEventListener('timeupdate', timeupdateListener);
        }
      }
    };

    if (this.playCheckTimerId != null) {
      clearTimeout(this.playCheckTimerId);
    }

    timeupdateListener = onTimeupdate.bind(self, cur);
    this.element.addEventListener('timeupdate', timeupdateListener);

    //@ts-ignore
    this.playCheckTimerId = setTimeout(checkState.bind(self), 2000);
  };

  addStalledStream = (type: string): void => {
    if (type === null) {
      return;
    }

    const evt = document.createEvent('HTMLEvents');
    evt.initEvent('buffering', true, false);
    (evt as ExHTMLEvent).visibility = true;

    LogHandler.log(
      '*** addStalledStream trigger: ' +
        type +
        ', paused: ' +
        this.element.paused
    );

    this.element.dispatchEvent(evt);

    if (!this.element.paused) {
      this.selfPaused = true;
      this.element.pause();
    }

    if (this.stalledStreams.indexOf(type) !== -1) {
      return;
    }
    this.stalledStreams.push(type);
  };

  play = (manual?: boolean): void => {
    if (manual) {
      //NSV-a      manualPause = false;
    } else {
    }

    if (this.element.paused) {
      let promise: Promise<void>;

      const _play = () => {
        promise = this.element.play();

        if (promise !== undefined) {
          promise
            .then(() => {
              this.eventBus.dispatchEvent({
                type: 'PLAY_PROMISE',
                data: { element: this.element },
              });
            })
            .catch(() => {
              this.eventBus.dispatchEvent({
                type: 'PLAY_PROMISE_ERROR',
                data: { element: this.element },
              });
            });
        } else {
        }
      };

      _play();
    }

    LogHandler.log('*** PLAY');
    _log('*** PLAY');
  };

  removeStalledStream = (type: string): void => {
    const self = this;

    if (type === null) {
      return;
    }

    const evt = document.createEvent('HTMLEvents');
    evt.initEvent('buffering', true, false);
    (evt as ExHTMLEvent).visibility = false;

    const index = this.stalledStreams.indexOf(type);
    if (index !== -1) {
      this.stalledStreams.splice(index, 1);
    }

    if (!this.isStalled()) {
      LogHandler.log(
        '*** removeStalledStream paused: ' +
          this.element.paused +
          ', selfPaused: ' +
          this.selfPaused +
          ',readyState:' +
          this.element.readyState
      );

      this.element.dispatchEvent(evt);

      this.adjustCurrentTime.call(this, () => {
        this.playCheck.call(self, this.element.currentTime);
        if (this.element.paused && this.selfPaused) {
          this.selfPaused = false;
          this.play.call(self);

          if (!this.playbackStarted) {
            this.playbackStarted = true;
            this.eventBus.dispatchEvent({
              type: 'playbackStarted',
              data: {},
            });
          }
        } else {
        }
      });
    }
  };

  pause = (manual?: boolean): void => {
    if (manual) {
      //NSV-a      manualPause = true;
    } else {
    }
    this.element.pause();
    LogHandler.log('*** PAUSE');
    _log('*** PAUSE');
  };

  stallStream = (type: string, isStalled: boolean): void => {
    if (isStalled) {
      this.addStalledStream(type);
    } else {
      this.removeStalledStream.call(this, type);
    }
  };

  //NSV-a  const onSeeked = () => {
  //NSV-a    LogHandler.log('currentTime:' + this.element.currentTime);
  //NSV-a    this.element.removeEventListener('seeked', seekedListener, false);
  //NSV-a    eventBus.dispatchEvent({
  //NSV-a      type: 'releaseSeekInhibition',
  //NSV-a      data: {},
  //NSV-a    });
  //NSV-a
  //NSV-a    adjusting = false;
  //NSV-a    eventBus.dispatchEvent({
  //NSV-a      type: 'ADJUST_CURRENTTIME_END',
  //NSV-a      data: {
  //NSV-a        ctime: this.element.currentTime,
  //NSV-a      },
  //NSV-a    });
  //NSV-a  };
  //NSV-a
  //NSV-a  const onSilentSeeked = () => {
  //NSV-a    LogHandler.log('currentTime[s]:' + this.element.currentTime);
  //NSV-a
  //NSV-a    this.element.removeEventListener('seeked', seekedListener2, false);
  //NSV-a    eventBus.dispatchEvent({
  //NSV-a      type: 'releaseSeekInhibition',
  //NSV-a      data: {},
  //NSV-a    });
  //NSV-a
  //NSV-a    adjusting = false;
  //NSV-a    eventBus.dispatchEvent({
  //NSV-a      type: 'ADJUST_CURRENTTIME_END',
  //NSV-a      data: {
  //NSV-a        ctime: this.element.currentTime,
  //NSV-a      },
  //NSV-a    });
  //NSV-a  };

  adjustCurrentTime = (_callback: (variable: number) => void) => {
    const self = this;
    const callback = _callback || (() => {});

    //const ranges = this.element.buffered;
    let vRanges;

    let aRanges;
    const ctime = this.element.currentTime;
    let ttime = ctime;
    let target = ctime;
    const eps = this.skipGapAtHOB || this.playbackStarted ? 0 : 0.5;
    let i;

    vRanges = this.sourceBuffers['video']
      ? this.sourceBuffers['video'].buffered
      : null;
    aRanges = this.sourceBuffers['audio']
      ? this.sourceBuffers['audio'].buffered
      : null;

    if (vRanges === null || this.element.readyState == 0) {
      callback(ctime);
    } else {
      for (i = 0; i < vRanges.length; i++) {
        if (vRanges.start(i) - 1.0 < ctime && ctime < vRanges.start(i)) {
          ttime = vRanges.start(i);
          break;
        } else if (vRanges.start(i) <= ctime && ctime < vRanges.end(i)) {
          //ttime = ctime;
          break;
        }
      }
      if (aRanges) {
        for (i = 0; i < aRanges.length; i++) {
          if (aRanges.start(i) - 1.0 < ttime && ttime < aRanges.start(i)) {
            target = aRanges.start(i);
            break;
          } else if (aRanges.start(i) <= ttime && ttime < aRanges.end(i)) {
            target = ttime;
            break;
          }
        }
      } else {
        target = ttime;
      }

      if (
        (ctime == 0 && ctime + eps < target) ||
        (ctime != 0 && ctime < target)
      ) {
        _debug('adjusted start time !!! ' + ctime + '=>' + target);
        LogHandler.log('adjusted start time !!! ' + ctime + '=>' + target);
        self.silentSeek(target, (dtime: number) => {
          if (dtime < target) {
            self.silentSeek(target + 0.1, (ddtime: number) => {
              callback(ddtime);
            });
          } else {
            callback(dtime);
          }
        });
      } else {
        callback(ctime);
      }
    }
  };

  silentSeek = (time: number, _callback?: (variable: number) => void): void => {
    const self = this;
    const callback = _callback || (() => {});

    const silentSeekEndListener = (evt) => {
      this.eventBus.removeEventListener(
        'ADJUST_CURRENTTIME_END',
        silentSeekEndListener,
        false
      );
      this.adjusting = false;
      callback(evt.data.ctime);
    };

    const silentSeekListener = () => {
      this.eventBus.removeEventListener(
        'ADJUST_CURRENTTIME_END',
        silentSeekListener,
        false
      );

      this.adjusting = true;
      this.eventBus.addEventListener(
        'ADJUST_CURRENTTIME_END',
        silentSeekEndListener,
        false
      );

      self.setCurrentTime(time);
      //LogHandler.log("silent seek to:"+time);
    };

    if (this.adjusting) {
      this.eventBus.addEventListener(
        'ADJUST_CURRENTTIME_END',
        silentSeekListener,
        false
      );
    } else {
      silentSeekListener();
    }
  };

  onCanplaythrough = (): void => {
    this.unlisten('canplaythrough', this.canplaythroughListener);

    LogHandler.log('CanplayThrough!!!!!!!!!');
    this.needsMoreData = false;
    _info('CanplayThrough!!!!!!!!!');
  };

  checkCanplaythrough = (): void => {
    this.canplaythroughListener = this.onCanplaythrough.bind(this);
    this.listen('canplaythrough', this.canplaythroughListener);
  };

  isPaused = (): boolean => {
    return this.element.paused;
  };

  getPlaybackRate = (): number => {
    return this.element.playbackRate;
  };

  // setPlaybackRate = (value: number): void => {
  //   this.element.playbackRate = value;
  // };

  getCurrentTime = (): number => {
    return this.element.currentTime;
  };

  setCurrentTime = (currentTime: number): void => {
    // if (this.element.currentTime == currentTime) return;
    this.element.currentTime = currentTime;
  };

  getDuration = (): number => {
    return this.element.duration;
  };

  // setDuration = (_duration: number): void => {
  //   this.element.duration = duration;
  // };

  getCanPlayType = (codec: string): string => {
    return this.element.canPlayType(codec);
  };

  getReadyState = (): number => {
    return this.element.readyState;
  };

  getBuffered = (): TimeRanges => {
    return this.element.buffered;
  };

  listen = (type: string, callback: (evt: Event) => void): void => {
    this.element.addEventListener(type, callback, false);
  };

  unlisten = (type: string, callback: (evt: Event) => void): void => {
    this.element.removeEventListener(type, callback, false);
  };

  getElement = (): Nullable<NXHTMLVideoElement> => {
    return this.element;
  };

  // setElement = (value: NXHTMLVideoElement): void => {
  //   this.element = value;
  // };

  setSource = (source: Nullable<string>): void => {
    //@ts-ignore
    this.element.src = source;
  };

  // getPlaybackQuality = () => {
  //   const hasWebKit = 'webkitDroppedFrameCount' in this.element;
  //   const hasQuality = 'getVideoPlaybackQuality' in this.element;
  //   let result;
  //   if (hasQuality) {
  //     return this.element.getVideoPlaybackQuality();
  //   } else if (hasWebKit) {
  //     return {
  //       droppedVideoFrames: (this.element as WebkitHTMLVideoElement)
  //         .webkitDroppedFrameCount,
  //       creationTime: new Date(),
  //     };
  //   }
  //   return result;
  // };

  setAutoPlay = (value: boolean): void => {
    this.autoPlay = value;
    if (this.autoPlay) {
      //NSV-a        manualPause = false;
      this.selfPaused = true;
    }

    if (!this.autoPlay && !this.playbackStarted) {
      let listener = () => {};
      const onPlay = () => {
        this.element.removeEventListener('play', listener);
        if (!this.playbackStarted) {
          this.playbackStarted = true;
          this.eventBus.dispatchEvent({
            type: 'playbackStarted',
            data: {},
          });
        }
      };

      listener = onPlay.bind(this);
      this.element.addEventListener('play', listener);
    }
  };

  setStartTime = (value: number): void => {
    this.startTime = value;
  };

  getStartTime = (): number => {
    return this.startTime;
  };

  setStartOffset = (value: number): void => {
    this.startOffset = value;
  };

  // getStartOffset = (): number => {
  //   return this.startOffset;
  // };

  // setPlaybackState = (value: boolean): void => {
  //   this.playbackStarted = value;
  // };

  getPlaybackState = (): boolean => {
    return this.playbackStarted;
  };

  reset = (): void => {
    this.startTime = NaN;
    this.startOffset = 0;
    //NSV-a      manualPause = true;
    this.selfPaused = false;
    this.stalledStreams = [];
    this.playbackStarted = false;
    this.sourceBuffers = {
      video: undefined,
      audio: undefined,
    };

    this.unlisten('canplaythrough', this.canplaythroughListener);
    this.canplaythroughListener = () => {};
    this.needsMoreData = true;
  };

  setSelfPaused = (value: boolean): void => {
    this.selfPaused = value;
  };

  getSelfPaused = () => {
    return this.selfPaused;
  };

  getNeedsMoreData = (): boolean => {
    return this.needsMoreData || this.element.readyState < 4;
  };

  // needsMoreDataState = (): boolean => {
  //   if (this.element.readyState < 4) {
  //     return true;
  //   } else {
  //     return false;
  //   }
  // };

  setSourceBuffer = (type: string, val: ExSourceBuffer): void => {
    this.sourceBuffers[type] = val;
  };

  setEpsilonFor = (type: string, val: number): void => {
    this.epsilonVal[type] = val;
  };

  setSkipGapAtHOB = (value: boolean): void => {
    this.skipGapAtHOB = value;
  };

  onAdjusting = (): boolean => {
    return this.adjusting;
  };

  isDummy = (): boolean => {
    return false;
  };

  setCurrentStatus = (status: VideoStatus): void => {
    this.autoPlay = status.autoPlay;
    this.selfPaused = status.selfPaused;
    //NSV-a      manualPause = status.manualPause;
    this.startTime = status.startTime;
    this.startOffset = status.startOffset;
    this.stalledStreams = status.stalledStreams;
    this.epsilonVal = status.epsilonVal;
    this.adjusting = status.adjusting;
    this.playbackStarted = status.playbackStarted;
  };
}

export class DummyVideoModel {
  value: Nullable<NXHTMLVideoElement>;
  eventBus: EventBus;

  constructor(value: Nullable<NXHTMLVideoElement>, eventBus: EventBus) {
    this.value = value;
    this.eventBus = eventBus;
  }

  autoPlay: boolean = true;
  selfPaused: boolean = false;
  manualPause: boolean = true;
  startTime: number = NaN;
  startOffset: number = 0;
  stalledStreams: Array<string> = [];

  sourceBuffers: {
    video: SourceBuffer | undefined;
    audio: SourceBuffer | undefined;
  } = {
    video: undefined,
    audio: undefined,
  };

  epsilonVal: { video: number; audio: number } = {
    video: 0,
    audio: 0,
  };

  canplaythroughListener: (evt: Event) => void = () => {};
  adjusting: boolean = false;
  //NSV-a  const skipGapAtHOB = false;

  playbackStarted: boolean = false;

  addStalledStream = (type: string): void => {
    if (type === null) {
      return;
    }

    LogHandler.log('*** addStalledStream trigger: ' + type + ', paused: true');

    if (this.stalledStreams.indexOf(type) !== -1) {
      return;
    }

    this.stalledStreams.push(type);
  };

  removeStalledStream = (): void => {};

  play = (manual?: boolean): void => {
    if (manual) {
      this.manualPause = false;
    } else {
    }
  };

  pause = (manual?: boolean): void => {
    if (manual) {
      this.manualPause = true;
    } else {
    }
  };

  stallStream = (type: string, isStalled: boolean): void => {
    if (isStalled) {
      this.addStalledStream(type);
    } else {
      this.removeStalledStream.call(this);
    }
  };

  //NSV-a  const onSeeked = () => {};
  //NSV-a  const onSilentSeeked = () => {};

  adjustCurrentTime = (_callback: (variable: number) => void): void => {};

  silentSeek = (
    _time: number,
    _callback?: (variable: number) => void
  ): void => {};

  //NSV-a  const onCanplaythrough = (evt) => {};

  checkCanplaythrough = (): void => {};

  isPaused = (): boolean => {
    return true;
  };

  getPlaybackRate = (): number => {
    return 1;
  };

  // setPlaybackRate = (): void => {};

  getCurrentTime = (): number => {
    return 0;
  };

  setCurrentTime = (): void => {};

  getDuration = (): number => {
    return Infinity;
  };

  // setDuration = (): void => {};

  getCanPlayType = (): string => {
    return 'probably';
  };

  getReadyState = (): number => {
    return 1;
  };

  getBuffered = (): TimeRanges => {
    return {
      length: 0,
      start: (_index: number) => 0,
      end: (_index: number) => 0,
    };
  };

  listen = (): void => {};

  unlisten = (): void => {};

  getElement = (): Nullable<NXHTMLVideoElement> => {
    return null;
  };

  // setElement = (): void => {};

  setSource = (): void => {};

  setAutoPlay = (value: boolean): void => {
    this.autoPlay = value;
    if (this.autoPlay) {
      this.manualPause = false;
      this.selfPaused = true;
    }
  };

  setStartTime = (value: number): void => {
    this.startTime = value;
  };

  getStartTime = (): number => {
    return this.startTime;
  };

  setStartOffset = (value: number): void => {
    this.startOffset = value;
  };

  // getStartOffset = (): number => {
  //   return this.startOffset;
  // };

  // setPlaybackState = (value: boolean): void => {
  //   this.playbackStarted = value;
  // };

  getPlaybackState = (): boolean => {
    return this.playbackStarted;
  };

  reset = () => {
    this.startTime = NaN;
    this.startOffset = 0;
    this.manualPause = true;
    this.selfPaused = false;
    this.stalledStreams = [];
    this.playbackStarted = false;
    this.sourceBuffers = {
      video: undefined,
      audio: undefined,
    };

    this.unlisten();
    this.canplaythroughListener = () => {};
  };

  setSelfPaused = (value: boolean): void => {
    this.selfPaused = value;
  };

  getSelfPaused = () => {
    return this.selfPaused;
  };

  getNeedsMoreData = (): boolean => {
    return true;
  };

  // needsMoreDataState = (): boolean => {
  //   return true;
  // };

  setSourceBuffer = (type: string, val: ExSourceBuffer): void => {
    this.sourceBuffers[type] = val;
  };

  setEpsilonFor = (type: string, val: number): void => {
    this.epsilonVal[type] = val;
  };

  setSkipGapAtHOB = (): void => {
    //NSV-a      skipGapAtHOB = value;
  };

  onAdjusting = (): boolean => {
    return this.adjusting;
  };

  getCurrentStatus = (): VideoStatus => {
    const status: VideoStatus = {
      autoPlay: this.autoPlay,
      selfPaused: this.selfPaused,
      manualPause: this.manualPause,
      startTime: this.startTime,
      startOffset: this.startOffset,
      stalledStreams: this.stalledStreams,
      epsilonVal: this.epsilonVal,
      adjusting: this.adjusting,
      playbackStarted: this.playbackStarted,
    };

    return status;
  };

  isDummy = (): boolean => {
    return true;
  };
}

export default VideoModel;
