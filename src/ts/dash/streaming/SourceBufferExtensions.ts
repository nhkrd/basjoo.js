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

import { EventBus } from '../core/EventBus';
import LogHandler from '../core/LogHandler';
import Debug from '../core/Debug';
import VideoModel, { DummyVideoModel } from './VideoModel';

/**
 * SourceBufferExtensions
 *
 * @module SourceBufferExtensions（SourceBufferExtensionsモジュール）
 */

const logHandler = LogHandler;

const NXDebug: Debug = new Debug();

/**
 * SourceBufferExtensions
 * @constructor
 */
export class SourceBufferExtensions {
  playbackStarted: boolean;
  prefetchThreshold: BufferThreshold;
  appendEnableThreshold: BufferThreshold;
  eventBus: EventBus;
  useFetch: boolean;
  videoModel?: VideoModel | DummyVideoModel;
  buffers: Array<ExSourceBuffer>;
  mse?: MediaSource;
  append: (
    buffer: ExSourceBuffer,
    bytes: Nullable<Uint8Array>,
    init: InitData,
    reqstarttime: number,
    starttime: number,
    dur: number,
    pStart: number,
    offset: number,
    minSize: number,
    quality: number,
    asetIdx: number,
    divNum: number,
    index: number
  ) => number | ChunkQ | undefined;
  appendFromQ: (
    buffer: ExSourceBuffer,
    waitingForBuffer: boolean,
    bufferThreshold?: number
  ) => void;

  constructor(params: Paramstype, eventBus: EventBus) {
    this.playbackStarted = false;
    this.prefetchThreshold = {
      video:
        params.BUFFER_PREFETCH_THRESHOLD_V !== undefined
          ? params.BUFFER_PREFETCH_THRESHOLD_V
          : params.BUFFER_PREFETCH_THRESHOLD || 15,
      audio:
        params.BUFFER_PREFETCH_THRESHOLD_A !== undefined
          ? params.BUFFER_PREFETCH_THRESHOLD_A
          : params.BUFFER_PREFETCH_THRESHOLD || 15,
    };
    this.appendEnableThreshold = {
      video:
        params.MSE_APPEND_ENABLE_THRESHOLD_V !== undefined
          ? params.MSE_APPEND_ENABLE_THRESHOLD_V
          : params.MSE_APPEND_ENABLE_THRESHOLD || 5,
      audio:
        params.MSE_APPEND_ENABLE_THRESHOLD_A !== undefined
          ? params.MSE_APPEND_ENABLE_THRESHOLD_A
          : params.MSE_APPEND_ENABLE_THRESHOLD || 5,
    };
    this.eventBus = eventBus;
    this.useFetch = params.USE_FETCH && 'fetch' in window ? true : false;
    this.buffers = [];
    this.append = this.useFetch ? this.appendF : this.appendX;
    this.appendFromQ = this.useFetch ? this.appendFromQF : this.appendFromQX;
  }

  findBuffer = (b: ExSourceBuffer): Nullable<ExSourceBuffer> => {
    for (let i = 0; i < this.buffers.length; i++) {
      if (this.buffers[i] === b) {
        return this.buffers[i];
      }
    }

    return null;
  };

  //NSV-a  const tmp64BitNumber = (high, low) => high * 4294967296 + low;
  //NSV-a
  //NSV-a  const tmp64to32Bit = (num) => {
  //NSV-a    let high;
  //NSV-a    let low;
  //NSV-a    high = num / 4294967296;
  //NSV-a    low = num & 0xffffffff;
  //NSV-a    return {
  //NSV-a      high,
  //NSV-a      low,
  //NSV-a    };
  //NSV-a  };

  _appendBuffer = (
    buffer: ExSourceBuffer,
    data: BufferSource | undefined,
    dur: number,
    dataStart: number,
    dataEnd: number
  ): void => {
    if ('appendBuffer' in buffer) {
      buffer.appendBuffer!(data!);
    } else if ('append' in buffer) {
      // @ts-ignore
      buffer.append(data);
    }

    buffer.lastAppendtime = new Date().getTime();
    if (this.videoModel && !this.videoModel.getNeedsMoreData()) {
      buffer.preDur = dur * 1000;
    }
    buffer.updatingRange = {
      start: dataStart,
      end: dataEnd,
    };
    data = void 0;
  };

  appendX = (
    buffer: ExSourceBuffer,
    bytes: Nullable<Uint8Array>,
    init: InitData,
    reqstarttime: number,
    starttime: number,
    dur: number,
    pStart: number,
    offset: number,
    _minSize: number,
    quality: number,
    asetIdx: number,
    divNum: number,
    index: number
  ): number => {
    try {
      if (init) {
        if (!(pStart in buffer.initQ!)) {
          buffer.initQ![pStart] = [];
        }
        if (!(asetIdx in buffer.initQ![pStart])) {
          buffer.initQ![pStart][asetIdx] = [];
        }
        buffer.initQ![pStart][asetIdx][quality] = init;
      }

      for (const q of buffer.queue!) {
        if (
          pStart == q.pStart &&
          starttime == q.time &&
          dur == q.dur &&
          quality == q.quality &&
          asetIdx == q.asetIdx
        ) {
          return buffer.queue!.length;
        }
      }

      buffer.queue!.push({
        type: 'data',
        data: bytes,
        rstime: reqstarttime,
        time: starttime,
        dur,
        quality,
        pStart,
        offset,
        asetIdx,
        divNum,
        ridx: index,
      });
      // sort
      // const compare3 = (d1, d2) => {
      //   if (d1.pStart < d2.pStart) return -1;
      //   if (d1.pStart == d2.pStart) {
      //     if (d1.time < d2.time) return -1;
      //     if (d1.time > d2.time) return 1;
      //   }
      //   if (d1.pStart > d2.pStart) return 1;
      //   return 0;
      // };

      /* istanbul ignore next */
      const compare3 = (d1: ChunkQ, d2: ChunkQ): number => {
        if (d1.pStart < d2.pStart) return -1;
        if (d1.pStart == d2.pStart) {
          if (d1.rstime < d2.rstime) return -1;
          if (d1.rstime > d2.rstime) return 1;
          if (d1.rstime == d2.rstime) {
            if (d1.divNum < d2.divNum) return -1;
            if (d1.divNum > d2.divNum) return 1;
          }
        }
        if (d1.pStart > d2.pStart) return 1;
        return 0;
      };
      buffer.queue!.sort(compare3);

      if (buffer.updating === undefined) {
        // eslint-disable-line no-empty
      } else {
        if (buffer.updating === false) {
          // eslint-disable-line no-empty
        } else {
          // waiting updateend event
        }
      }
    } catch (err: any) {
      logHandler.log(err);
      NXDebug.info(err);
    }

    return buffer.queue!.length;
  };

  appendF = (
    buffer: ExSourceBuffer,
    bytes: Nullable<Uint8Array>,
    init: InitData,
    reqstarttime: number,
    starttime: number,
    dur: number,
    pStart: number,
    offset: number,
    _minSize: number,
    quality: number,
    asetIdx: number,
    divNum: number,
    index: number
  ): ChunkQ | undefined => {
    let q: ChunkQ | undefined;
    try {
      if (init) {
        if (!(pStart in buffer.initQ!)) {
          buffer.initQ![pStart] = [];
        }
        if (!(asetIdx in buffer.initQ![pStart])) {
          buffer.initQ![pStart][asetIdx] = [];
        }
        buffer.initQ![pStart][asetIdx][quality] = init;
      }

      for (const qq of buffer.queue!) {
        if (
          pStart == qq.pStart &&
          starttime == qq.time &&
          dur == qq.dur &&
          quality == qq.quality &&
          asetIdx == qq.asetIdx
        ) {
          return q;
        }
      }

      q = {
        type: 'data',
        data: bytes,
        rstime: reqstarttime,
        time: starttime,
        dur,
        quality,
        pStart,
        offset,
        asetIdx,
        divNum,
        ridx: index,
        chunks: [],
        progress: [],
        chunkEnd: 0,
        chunkStartTime: -1,
        chunkDur: 0,
        done: false,
        appending: false,
        params: init.params,
      };
      buffer.queue!.push(q);

      // sort
      // const compare3 = (d1, d2) => {
      //   if (d1.pStart < d2.pStart) return -1;
      //   if (d1.pStart == d2.pStart) {
      //     if (d1.time < d2.time) return -1;
      //     if (d1.time > d2.time) return 1;
      //   }
      //   if (d1.pStart > d2.pStart) return 1;
      //   return 0;
      // };

      /* istanbul ignore next */
      const compare3 = (d1: ChunkQ, d2: ChunkQ): number => {
        if (d1.pStart < d2.pStart) return -1;
        if (d1.pStart == d2.pStart) {
          if (d1.rstime < d2.rstime) return -1;
          if (d1.rstime > d2.rstime) return 1;
        }
        if (d1.pStart > d2.pStart) return 1;
        return 0;
      };
      buffer.queue!.sort(compare3);
      return q;
    } catch (err: any) {
      logHandler.log(err);
      NXDebug.info(err);
      throw err;
    }
  };

  appendFromQX = (
    buffer: ExSourceBuffer,
    waitingForBuffer: boolean,
    bufferStartThreshold?: number
  ): void => {
    let d: Nullable<ChunkQ> | undefined = null;
    let q: Nullable<ChunkQ> = null;
    let data: Nullable<Uint8Array> | undefined = null;
    let queue: Array<ChunkQ>;
    let startTime: number = 0;
    let dataStart: number = 0;
    let dataEnd: number = 0;
    let curTime: number;
    let range: Nullable<TimeRange>;
    let end: number;
    const now: number = new Date().getTime();
    let bufferThreshold: number = bufferStartThreshold || 5;
    let bf: ExSourceBuffer;

    try {
      if (buffer.appendStart == false) return;
      if (buffer.queue!.length === 0) return;
      if (buffer.waiting) return;

      queue = buffer.queue!;

      /* istanbul ignore if */
      if (
        (buffer.updating !== undefined &&
          buffer.updating == false &&
          now - buffer.lastAppendtime! > buffer.preDur! / 3) ||
        (buffer.updating === undefined &&
          now - buffer.lastAppendtime! > buffer.preDur! / 3)
      ) {
        if (waitingForBuffer === false) {
          buffer.startTimeAfterSeek = Number.MAX_VALUE;
          curTime = this.playbackStarted
            ? this.videoModel!.getCurrentTime()
            : this.videoModel!.getStartTime();
          range = this.getBufferRange(buffer, curTime);
          end = range ? range.end : curTime;

          while (queue.length > 0) {
            d = queue[0];
            dataStart = d.time;
            dataEnd = d.time + d.dur;

            if (dataEnd < curTime - d.dur) {
              NXDebug.log(
                '[' +
                  buffer.type +
                  ']discard curTime:' +
                  curTime +
                  ', q:end' +
                  dataEnd
              );
              logHandler.log(
                '[' +
                  buffer.type +
                  ']discard curTime:' +
                  curTime +
                  ', q:end' +
                  dataEnd
              );
              queue.shift();
            } else if (end + 0.1 < dataStart) {
              if (dataEnd - curTime > 20) {
                return;
              } else if (
                d.rstime <= end + 0.1 &&
                d.rstime < dataStart &&
                d.rstime != d.pStart
              ) {
                logHandler.log(
                  '[' +
                    buffer.type +
                    '] Gap!!' +
                    'end:' +
                    end +
                    ', rstime:' +
                    d.rstime +
                    ', dataStart:' +
                    dataStart
                );
                NXDebug.info(
                  '[' +
                    buffer.type +
                    '] Gap!!' +
                    'end:' +
                    end +
                    ', rstime:' +
                    d.rstime +
                    ', dataStart:' +
                    dataStart
                );
                this.eventBus.dispatchEvent({
                  type: 'checkBufferGap',
                  data: {
                    type: buffer.type,
                    time: d.rstime - d.dur / 2,
                  },
                });
                return;
              } else {
                if (
                  end < buffer.updatingRange!.end - 0.1 &&
                  buffer.updatingRange!.start - 0.1 < end &&
                  now - buffer.lastAppendtime! > (buffer.preDur! * 2) / 3
                ) {
                  logHandler.log(
                    'updating?? end:' +
                      end +
                      ', exp:' +
                      buffer.updatingRange!.end +
                      ', q:' +
                      dataStart
                  );
                  NXDebug.log(
                    '[' +
                      buffer.type +
                      '] updating?? end:' +
                      end +
                      ', exp start:' +
                      buffer.updatingRange!.start +
                      ',end:' +
                      buffer.updatingRange!.end +
                      ', q:' +
                      dataStart +
                      ',st:' +
                      buffer.startTimeAfterSeek
                  );
                  if (buffer.laData) {
                    queue.unshift(buffer.laData);
                  } else {
                    // eslint-disable-line no-empty
                  }
                } else {
                  break;
                }
              }
            } else {
              break;
            }
          }

          if (queue.length == 0) return;
          d = queue.shift();

          if (buffer.pStart !== d!.pStart) {
            NXDebug.debug(
              '***** period change **** from:' +
                buffer.pStart +
                ', to:' +
                d!.pStart
            );
            NXDebug.debug('***** startTime :::' + d!.time + ' ******');
            buffer.pStart = d!.pStart;
            buffer.quality = -1;
          }
          if (buffer.asetIdx != d!.asetIdx) {
            NXDebug.debug(
              '***** AdaptationSet change **** from:' +
                buffer.asetIdx +
                ', to:' +
                d!.asetIdx
            );
            NXDebug.debug('***** startTime :::' + d!.time + ' ******');
            buffer.asetIdx = d!.asetIdx;
            buffer.quality = -1;
          }

          if (buffer.quality !== d!.quality) {
            data = null;
            if (buffer.type === 'video') {
              logHandler.log_V2Q('bf[' + d!.quality + '] init,ps=' + d!.pStart);
            } else {
              logHandler.log_A2Q('bf[' + d!.quality + '] init,ps=' + d!.pStart);
            }

            if (d!.offset !== buffer.timestampOffset) {
              buffer.timestampOffset = d!.offset;
            }

            data = new Uint8Array(
              d!.data!.length +
                buffer.initQ![d!.pStart][d!.asetIdx][d!.quality].data.length
            );
            data.set(buffer.initQ![d!.pStart][d!.asetIdx][d!.quality].data, 0);

            if (buffer.type === 'video') {
              logHandler.log_V2Q(
                'bf[' +
                  d!.quality +
                  '] t=' +
                  parseInt(String(d!.time * 100.0)) / 100.0
              );
            } else {
              logHandler.log_A2Q(
                'bf[' +
                  d!.quality +
                  '] t=' +
                  parseInt(String(d!.time * 100.0)) / 100.0
              );
            }
            data.set(
              d!.data!,
              buffer.initQ![d!.pStart][d!.asetIdx][d!.quality].data.length
            );
            this._appendBuffer(buffer, data, d!.dur, dataStart, dataEnd);
            buffer.quality = d!.quality;
          } else {
            if (buffer.type === 'video') {
              logHandler.log_V2Q(
                'bf[' +
                  d!.quality +
                  '] t=' +
                  parseInt(String(d!.time * 100.0)) / 100.0
              );
            } else {
              logHandler.log_A2Q(
                'bf[' +
                  d!.quality +
                  '] t=' +
                  parseInt(String(d!.time * 100.0)) / 100.0
              );
            }

            if (d!.offset !== buffer.timestampOffset) {
              buffer.timestampOffset = d!.offset;
            }
            this._appendBuffer(buffer, d!.data!, d!.dur, dataStart, dataEnd);
          }
          NXDebug.debug(
            '[' +
              buffer.type +
              '] appended t=' +
              d!.time +
              ', q:' +
              queue.length
          );
          buffer.laData = d;
          d = void 0;
        } else {
          if (!buffer.playbackStarted) {
            if (!buffer.ready) {
              for (let i = 0; i < queue.length; i++) {
                q = queue[i];
                if (q.rstime == buffer.startTimeAfterSeek) {
                  dataStart = q.time;
                  startTime = q.rstime;
                  buffer.tmpData = {
                    diff: dataStart - startTime,
                    start: dataStart,
                    offset: q.offset,
                  };
                  buffer.ready = true;
                  break;
                } else if (q.rstime > buffer.startTimeAfterSeek!) {
                  break;
                }
              }
              if (!buffer.ready) return;
            }

            let ready: boolean = true;
            for (let i = 0; i < this.buffers.length; i++) {
              if (!this.buffers[i].ready) {
                ready = false;
              }
            }
            if (ready) {
              let minDiff: number = Number.MAX_VALUE;
              let modOffset: boolean = false;

              for (let i = 0; i < this.buffers.length; i++) {
                bf = this.buffers[i];
                if (bf.tmpData && bf.tmpData.diff < minDiff) {
                  minDiff = bf.tmpData.diff;
                }
              }
              if (minDiff > 1.0) {
                modOffset = true;
              } else if (minDiff < 0) {
                for (let i = 0; i < this.buffers.length; i++) {
                  if (
                    this.buffers[i].tmpData &&
                    this.buffers[i].tmpData!.start +
                      this.buffers[i].tmpData!.offset <
                      0
                  ) {
                    logHandler.log(
                      '[' +
                        this.buffers[i].type +
                        ', s:' +
                        this.buffers[i].tmpData!.start +
                        ', o:' +
                        this.buffers[i].tmpData!.offset
                    );
                    modOffset = true;
                    break;
                  }
                }
              }
              if (modOffset == true) {
                for (let i = 0; i < this.buffers.length; i++) {
                  for (let j = 0; j < this.buffers[i].queue!.length; j++) {
                    this.buffers[i].queue![j].offset -= minDiff;
                    this.buffers[i].queue![j].time -= minDiff;
                  }
                }
              }
              for (let i = 0; i < this.buffers.length; i++) {
                bf = this.buffers[i];
                bf.waiting = false;
                bf.ready = false;
                bf.playbackStarted = true;
                if (modOffset) {
                  this.eventBus.dispatchEvent({
                    type: 'needToModifyOffset',
                    data: {
                      type: bf.type,
                      minDiff,
                    },
                  });
                }
              }
            } else {
              buffer.waiting = true;
              return;
            }
          }

          const dataArray: Array<Uint8Array> = [];
          let dataLength: number = 0;
          let dataOffset: number = 0;
          let dataDur: number = 0;
          let ast: string = '';
          let qTime: number;
          let qDur: number;
          let rstime: number;
          let startDiff: number = 0;
          curTime = this.playbackStarted
            ? this.videoModel!.getCurrentTime()
            : this.videoModel!.getStartTime();
          while (queue.length > 0) {
            d = queue[0];
            dataStart = d.time;
            dataEnd = d.time + d.dur;
            qTime = d.time;
            qDur = d.dur;
            rstime = d.rstime;
            startDiff = 0;

            if (
              dataStart + qDur + qDur < curTime &&
              rstime < buffer.startTimeAfterSeek!
            ) {
              logHandler.log(
                '[' +
                  buffer.type +
                  '] packet received before seek -> discard c:' +
                  curTime +
                  ', q:' +
                  qTime +
                  ', rstime:' +
                  rstime
              );
              NXDebug.info(
                '[' +
                  buffer.type +
                  '] packet received before seek -> discard c:' +
                  curTime +
                  ', q:' +
                  qTime +
                  ', rstime:' +
                  rstime
              );
              queue.shift();
              if (queue.length > 0) {
                continue;
              } else {
                return;
              }
            }

            if (rstime > buffer.startTimeAfterSeek!) {
              return;
            }

            if (
              rstime != buffer.startTimeAfterSeek &&
              curTime + 0.1 < dataStart
            ) {
              range = this.getBufferRange(buffer, curTime);
              if (range != null && dataStart <= range.end + 0.1) {
                bufferThreshold -= dataStart - curTime;
                break;
              } else {
                end = range != null ? range.end : curTime;
                logHandler.log(
                  '[' +
                    buffer.type +
                    '] Gap!!! c:' +
                    curTime +
                    ', l:' +
                    end +
                    'q:' +
                    qTime +
                    ', qc:' +
                    qTime +
                    ', s' +
                    this.videoModel!.getStartTime() +
                    ',st:' +
                    buffer.startTimeAfterSeek
                );
                NXDebug.info(
                  '[' +
                    buffer.type +
                    '] Gap!!! c:' +
                    curTime +
                    ', l:' +
                    end +
                    'q:' +
                    qTime +
                    ', qc:' +
                    qTime +
                    ', s' +
                    this.videoModel!.getStartTime() +
                    ',st:' +
                    buffer.startTimeAfterSeek
                );
                let checkTime: number = 0;
                if (rstime <= end + 0.1 && rstime < dataStart) {
                  checkTime = rstime - qDur / 2;
                } else {
                  checkTime = end;
                }
                this.eventBus.dispatchEvent({
                  type: 'checkBufferGap',
                  data: {
                    type: buffer.type,
                    time: checkTime,
                  },
                });
                return;
              }
            } else {
              startDiff = dataStart < curTime ? curTime - dataStart : 0;

              bufferThreshold += startDiff;
              break;
            }
          }

          let preE: number = dataStart!;
          let blen: number = 0;
          let qc: number = 0;
          for (let i = 0; i < queue.length; i++) {
            if (i !== 0 && preE + 0.1 < queue[i].time) {
              //logHandler.log("Gap???: preE:"+preE+", curS:"+buffer.queue[i].time);
              break;
            }

            dataDur += queue[i].dur;
            preE += queue[i].dur;
            blen = this.getBufferLength(buffer, preE);
            preE += blen;
            dataDur += blen;
            qc++;
            if (bufferThreshold <= dataDur) {
              break;
            }
          }

          if (
            dataDur < bufferThreshold - 0.1 &&
            dataDur < this.prefetchThreshold[buffer.type] - 0.5
          ) {
            NXDebug.info(
              'append[' +
                buffer.type +
                ']: dataDur:' +
                dataDur +
                ', bufferThreshold:' +
                bufferThreshold +
                ', ' +
                this.prefetchThreshold[buffer.type] +
                ', qlen:' +
                queue.length
            );
            buffer.underThreshold = true;

            return;
          } else {
            dataDur = 0;
          }
          buffer.underThreshold = false;

          d = buffer.queue![0];
          startTime = d.rstime;
          while (queue.length > 0) {
            d = buffer.queue!.shift();

            if (buffer.pStart !== d!.pStart) {
              if (dataLength === 0) {
                NXDebug.debug(
                  '***** period change **** from:' +
                    buffer.pStart +
                    ', to:' +
                    d!.pStart
                );
                NXDebug.debug('***** startTime :::' + d!.time + ' ******');

                buffer.pStart = d!.pStart;
                buffer.quality = -1;
              } else {
                buffer.queue!.unshift(d!);
                break;
              }
            }
            if (buffer.asetIdx !== d!.asetIdx) {
              if (dataLength === 0) {
                NXDebug.debug(
                  '***** AdaptationSet change **** from:' +
                    buffer.asetIdx +
                    ', to:' +
                    d!.asetIdx
                );
                NXDebug.debug('***** startTime :::' + d!.time + ' ******');

                buffer.asetIdx = d!.asetIdx;
                buffer.quality = -1;
              } else {
                queue.unshift(d!);
                break;
              }
            }

            if (buffer.quality !== d!.quality) {
              if (buffer.type === 'video') {
                logHandler.log_V2Q('bf[' + d!.quality + '] init');
              } else {
                logHandler.log_A2Q('bf[' + d!.quality + '] init');
              }
              dataLength +=
                buffer.initQ![d!.pStart][d!.asetIdx][d!.quality].data.length;
              dataArray.push(
                buffer.initQ![d!.pStart][d!.asetIdx][d!.quality].data
              );

              buffer.quality = d!.quality;
            }

            dataOffset = d!.offset;
            dataLength += d!.data!.length;
            dataArray.push(d!.data!);
            dataDur += d!.dur;
            ast += '*';
            if (buffer.type === 'video') {
              logHandler.log_V2Q(
                'bf[' +
                  d!.quality +
                  '] t=' +
                  parseInt(String(d!.time * 100.0)) / 100.0 +
                  ast
              );
              NXDebug.debug(
                'bfv[' +
                  d!.quality +
                  '] t=' +
                  parseInt(String(d!.time * 100.0)) / 100.0
              );
            } else {
              logHandler.log_A2Q(
                'bf[' +
                  d!.quality +
                  '] t=' +
                  parseInt(String(d!.time * 100.0)) / 100.0 +
                  ast
              );
              NXDebug.debug(
                'bfa[' +
                  d!.quality +
                  '] t=' +
                  parseInt(String(d!.time * 100.0)) / 100.0
              );
            }
            qc--;
            if (
              qc == 0 ||
              startDiff + this.appendEnableThreshold[buffer.type] < dataDur ||
              d!.time + d!.dur > this.mse!.duration
            ) {
              break;
            }
            d = null;
          }
          if (dataLength == 0) {
            return;
          }
          dataEnd = dataStart + dataDur;
          dataDur -= startDiff;
          //// concatenate
          data = new Uint8Array(dataLength);
          let pos: number = 0;
          let da: Uint8Array | undefined;
          while (dataArray.length > 0) {
            da = dataArray.shift();
            data.set(da!, pos);
            pos += da!.length;
          }

          if (dataOffset !== buffer.timestampOffset) {
            buffer.timestampOffset = dataOffset;
          }

          buffer.startTimeAfterSeek = Number.MAX_VALUE;
          this._appendBuffer(buffer, data, dataDur, dataStart, dataEnd);
          this.eventBus.dispatchEvent({
            type: 'appendedEnoughDataToStart',
            data: {
              type: buffer.type,
            },
          });
          data = void 0;
        }
      } else if (now < buffer.lastAppendtime!) {
        logHandler.log('now:' + now + ', last:' + buffer.lastAppendtime);
        buffer.lastAppendtime = now;
      }
    } catch (err: any) {
      NXDebug.log('append error!! Q');
      logHandler.log('append error!! Q');
      logHandler.log(err.message);
      buffer.queue!.unshift(d!);
      NXDebug.log('#############################################');
      NXDebug.log(err);
    }
  };

  appendFromQF = (
    buffer: ExSourceBuffer,
    waitingForBuffer: boolean,
    Threshold?: number
  ): void => {
    let d: Nullable<ChunkQ> | undefined = null;
    let q: Nullable<ChunkQ> = null;
    let data: Nullable<Uint8Array> | undefined = null;
    let init: Nullable<Uint8Array> = null;
    let len: number = 0;
    let cur: number = 0;
    let chunkQ: Nullable<Array<ChunkQ>> = null;
    let offset: number = 0;
    let ast: string = '';
    let appended: boolean = false;
    let queue: Array<ChunkQ> | undefined = undefined;
    let curTime: number;
    let range: Nullable<TimeRange> = null;
    let end: number;
    let chunkStart: number = 0;
    let chunkEnd: number = 0;
    let bufferThreshold: number = Threshold || 5;
    let bf: ExSourceBuffer;

    try {
      if (buffer.appendStart == false) return;
      if (buffer.queue!.length === 0) return;
      if (buffer.waiting) return;

      queue = buffer.queue;

      d = queue![0];
      /* istanbul ignore if */
      if (d.appending == true) {
        if (d.chunks && d.chunks.length > 0) {
          chunkQ = d.chunks;

          chunkStart = chunkQ[0].start!;
          chunkEnd =
            chunkQ[chunkQ.length - 1].start! + chunkQ[chunkQ.length - 1].dur;

          chunkQ.forEach((c) => {
            len += c.data!.length;
          });

          data = new Uint8Array(len);

          chunkQ.forEach((c) => {
            data!.set(c.data!, cur);
            cur += c.data!.length;
          });

          buffer.appendBuffer!(data);
          buffer.updatingRange = {
            start: chunkStart,
            end: chunkEnd,
          };
          appended = true;
          data = null;
          len = 0;
          cur = 0;
          d.chunks = [];
        }

        if (d.done) {
          if (buffer.type === 'video') {
            logHandler.log_V2Q(
              'bf[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ast
            );
            NXDebug.debug(
              'bfv[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ',appended:' +
                appended
            );
          } else {
            logHandler.log_A2Q(
              'bf[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ast
            );
            NXDebug.debug(
              'bfa[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ',appended:' +
                appended
            );
          }

          queue!.shift();
          d = void 0;
          if (queue!.length == 0) return;
        }
        if (appended) return;
      }

      /* istanbul ignore next */
      if (waitingForBuffer === false) {
        buffer.startTimeAfterSeek = Number.MAX_VALUE;
        curTime = this.playbackStarted
          ? this.videoModel!.getCurrentTime()
          : this.videoModel!.getStartTime();
        range = this.getBufferRange(buffer, curTime);
        end = range ? range.end : curTime;

        while (queue!.length > 0) {
          chunkStart = 0;
          chunkEnd = 0;
          d = queue![0];

          if (d.chunks && d.done) {
            if (d.chunks.length == 0) {
              queue!.shift();
              continue;
            } else {
              chunkStart = d.chunks[0].start!;
              chunkEnd =
                d.chunks[d.chunks.length - 1].start! +
                d.chunks[d.chunks.length - 1].dur;
            }
          } else {
            if (d.chunks && d.chunks.length > 0) {
              chunkStart = d.chunks[0].start!;
              chunkEnd =
                d.chunks[d.chunks.length - 1].start! +
                d.chunks[d.chunks.length - 1].dur;
            } else {
              return;
            }
          }
          if (chunkEnd < curTime - d.dur) {
            NXDebug.log(
              '[' +
                buffer.type +
                ']discard curTime:' +
                curTime +
                ', q:end' +
                chunkEnd
            );
            logHandler.log(
              '[' +
                buffer.type +
                ']discard curTime:' +
                curTime +
                ', q:end' +
                chunkEnd
            );
            queue!.shift();
          } else if (end + 0.1 < chunkStart) {
            if (chunkEnd - curTime > 20) {
              return;
            } else if (
              d.rstime <= end + 0.1 &&
              d.rstime < chunkStart &&
              d.rstime != d.pStart
            ) {
              logHandler.log(
                '[' +
                  buffer.type +
                  '] Gap!!' +
                  ' end:' +
                  end +
                  ', rstime:' +
                  d.rstime +
                  ', chunkStart:' +
                  chunkStart +
                  ',ps:' +
                  d.pStart
              );
              NXDebug.info(
                '[' +
                  buffer.type +
                  '] Gap!!' +
                  ' end:' +
                  end +
                  ', rstime:' +
                  d.rstime +
                  ', chunkStart:' +
                  chunkStart
              );
              this.eventBus.dispatchEvent({
                type: 'checkBufferGap',
                data: {
                  type: buffer.type,
                  time: d.rstime - d.dur / 2,
                },
              });
              return;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        if (queue!.length == 0) return;
        d = queue![0];

        if (buffer.pStart !== d.pStart) {
          NXDebug.debug(
            '***** period change **** from:' +
              buffer.pStart +
              ', to:' +
              d.pStart
          );
          NXDebug.debug('***** startTime :::' + d.time + ' ******');
          buffer.pStart = d.pStart;
          buffer.quality = -1;
        }
        if (buffer.asetIdx != d.asetIdx) {
          NXDebug.debug(
            '***** AdaptationSet change **** from:' +
              buffer.asetIdx +
              ', to:' +
              d.asetIdx
          );
          NXDebug.debug('***** startTime :::' + d.time + ' ******');
          buffer.asetIdx = d.asetIdx;
          buffer.quality = -1;
        }

        if (buffer.quality != d.quality) {
          if (buffer.type === 'video') {
            logHandler.log_V2Q('bf[' + d.quality + '] init');
          } else {
            logHandler.log_A2Q('bf[' + d.quality + '] init');
          }

          len += buffer.initQ![d.pStart][d.asetIdx][d.quality].data.length;
          init = buffer.initQ![d.pStart][d.asetIdx][d.quality].data;

          buffer.quality = d.quality;
        }

        offset = d.offset;

        if (offset != buffer.timestampOffset) {
          buffer.timestampOffset = offset;
        }

        chunkQ = d.chunks!;

        chunkQ.forEach((c) => {
          len += c.data!.length;
        });

        data = new Uint8Array(len);

        if (init) {
          data.set(init, cur);
          cur += init.length;
        }

        chunkQ.forEach((c) => {
          data!.set(c.data!, cur);
          cur += c.data!.length;
        });
        buffer.appendBuffer!(data);
        buffer.updatingRange = {
          start: chunkStart,
          end: chunkEnd,
        };
        //NXDebug.debug("["+buffer.type+"] appended t="+d.time+", q:"+buffer.queue.length);

        //####/// buffer.laData = d;

        data = void 0;
        d.chunks = [];
        d.appending = true;

        if (d.done) {
          if (buffer.type === 'video') {
            logHandler.log_V2Q(
              'bf[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ast
            );
            NXDebug.debug(
              'bfv[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ', ' +
                parseInt(String(d.rstime * 100.0)) / 100.0
            );
          } else {
            logHandler.log_A2Q(
              'bf[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ast
            );
            NXDebug.debug(
              'bfa[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ', ' +
                parseInt(String(d.rstime * 100.0)) / 100.0
            );
          }
          queue!.shift();
          d = void 0;
        }
      } else {
        if (!buffer.playbackStarted) {
          if (!buffer.ready) {
            for (let i = 0; i < queue!.length; i++) {
              q = queue![i];
              if (q.rstime == buffer.startTimeAfterSeek) {
                if (q.chunks!.length == 0) return;
                chunkStart = q.time;
                const startTime: number = q.rstime;
                buffer.tmpData = {
                  diff: chunkStart - startTime,
                  start: chunkStart,
                  offset: q.offset,
                };
                //logHandler.log("diff: "+buffer.tmpData.diff+" , start:"+chunkStart+", offet:"+q.offset);
                buffer.ready = true;
                break;
              } else if (q.rstime > buffer.startTimeAfterSeek!) {
                break;
              }
            }
            if (!buffer.ready) return;
          }

          let ready: boolean = true;
          for (let i = 0; i < this.buffers.length; i++) {
            if (!this.buffers[i].ready) {
              ready = false;
            }
          }
          if (ready) {
            let minDiff: number = Number.MAX_VALUE;
            let modOffset: boolean = false;

            for (let i = 0; i < this.buffers.length; i++) {
              bf = this.buffers[i];
              if (bf.tmpData!.diff < minDiff) {
                minDiff = bf.tmpData!.diff;
              }
            }
            if (minDiff > 1.0) {
              modOffset = true;
            } else if (minDiff < 0) {
              for (let i = 0; i < this.buffers.length; i++) {
                if (
                  this.buffers[i].tmpData!.start +
                    this.buffers[i].tmpData!.offset <
                  0
                ) {
                  logHandler.log(
                    '[' +
                      this.buffers[i].type +
                      ', s:' +
                      this.buffers[i].tmpData!.start +
                      ', o:' +
                      this.buffers[i].tmpData!.offset
                  );
                  modOffset = true;
                  break;
                }
              }
            }
            if (modOffset == true) {
              for (let i = 0; i < this.buffers.length; i++) {
                for (let j = 0; j < this.buffers[i].queue!.length; j++) {
                  this.buffers[i].queue![j].offset -= minDiff;
                  if (this.buffers[i].queue![j].chunks!.length > 0) {
                    this.buffers[i].queue![j].time -= minDiff;
                  }
                  if (this.buffers[i].queue![j].chunkStartTime! > -1)
                    this.buffers[i].queue![j].chunkStartTime! -= minDiff;

                  for (
                    let k = 0;
                    k < this.buffers[i].queue![j].chunks!.length;
                    k++
                  ) {
                    this.buffers[i].queue![j].chunks![k].start! -= minDiff;
                  }
                }
              }
            }
            for (let i = 0; i < this.buffers.length; i++) {
              bf = this.buffers[i];
              bf.waiting = false;
              bf.ready = false;
              bf.playbackStarted = true;

              if (modOffset) {
                this.eventBus.dispatchEvent({
                  type: 'needToModifyOffset',
                  data: {
                    type: bf.type,
                    minDiff,
                  },
                });
              }
            }
          } else {
            buffer.waiting = true;
            return;
          }
        }

        const dataArray: Array<Uint8Array> = [];
        let dataLength: number = 0;
        let dataOffset: number = 0;
        let dataDur: number = 0;
        let qTime: number;
        let qDur: number;
        let rstime: number = 0;
        let startDiff: number = 0;
        let chunks: Array<ChunkQ> | undefined = undefined;
        data = null;
        ast = '';
        curTime = this.playbackStarted
          ? this.videoModel!.getCurrentTime()
          : this.videoModel!.getStartTime();
        chunkStart = 0;
        chunkEnd = 0;

        while (queue!.length > 0) {
          d = queue![0];
          chunks = d.chunks;
          if (chunks!.length > 0) {
            chunkStart = d.chunks![0].start!;
            chunkEnd =
              d.chunks![d.chunks!.length - 1].start! +
              d.chunks![d.chunks!.length - 1].dur;
          } else {
            chunkStart = d.time;
            chunkEnd = d.time + d.dur;
          }
          qTime = d.time;
          qDur = d.dur;
          rstime = d.rstime;
          startDiff = 0;

          if (
            chunkStart + qDur + qDur < curTime &&
            rstime < buffer.startTimeAfterSeek!
          ) {
            logHandler.log(
              '[' +
                buffer.type +
                '] packet received before seek -> discard c:' +
                curTime +
                ', q:' +
                qTime +
                ', rstime:' +
                rstime
            );
            NXDebug.info(
              '[' +
                buffer.type +
                '] packet received before seek -> discard c:' +
                curTime +
                ', q:' +
                qTime +
                ', rstime:' +
                rstime
            );
            queue!.shift();
            if (queue!.length > 0) {
              continue;
            } else {
              return;
            }
          }

          if (rstime > buffer.startTimeAfterSeek!) {
            return;
          }

          if (chunks!.length == 0) return;

          if (
            rstime != buffer.startTimeAfterSeek &&
            curTime + 0.1 < chunkStart
          ) {
            range = this.getBufferRange(buffer, curTime);
            if (range != null && chunkStart <= range.end + 0.1) {
              bufferThreshold -= chunkStart - curTime;
              break;
            } else {
              end = range != null ? range.end : curTime;
              logHandler.log(
                '[' +
                  buffer.type +
                  '] Gap!!! c:' +
                  curTime +
                  ', l:' +
                  end +
                  'q:' +
                  qTime +
                  ', qc:' +
                  chunks![0].start +
                  ', s' +
                  this.videoModel!.getStartTime()
              );
              NXDebug.info(
                '[' +
                  buffer.type +
                  '] Gap!!! c:' +
                  curTime +
                  ', l:' +
                  end +
                  'q:' +
                  qTime +
                  ', qc:' +
                  chunks![0].start +
                  ', s' +
                  this.videoModel!.getStartTime()
              );
              let checkTime = 0;
              if (rstime <= end + 0.1 && rstime < chunkStart) {
                checkTime = rstime - qDur / 2;
              } else {
                checkTime = end;
              }
              this.eventBus.dispatchEvent({
                type: 'checkBufferGap',
                data: {
                  type: buffer.type,
                  time: checkTime,
                },
              });
              return;
            }
          } else {
            startDiff = chunkStart < curTime ? curTime - chunkStart : 0;

            bufferThreshold += startDiff;
            break;
          }
        }

        let preE: number = chunkStart;
        let blen: number = 0;
        let qc: number = 0;
        let dur: number;
        for (let i = 0; i < queue!.length; i++) {
          q = queue![i];
          dur = 0;

          if (q.chunks!.length == 0) break;

          if (i !== 0 && preE + 0.1 < q.chunks![0].start!) {
            break;
          }
          dur =
            q.chunks![q.chunks!.length - 1].dur +
            (q.chunks![q.chunks!.length - 1].start! - q.chunks![0].start!);
          dataDur += dur;
          preE += dur;
          blen = this.getBufferLength(buffer, preE);
          preE += blen;
          dataDur += blen;
          qc++;
          if (bufferThreshold <= dataDur) {
            break;
          }
        }

        if (
          dataDur < bufferThreshold - 0.1 &&
          dataDur < this.prefetchThreshold[buffer.type] - 0.5
        ) {
          NXDebug.info(
            'append[' +
              buffer.type +
              ']: dataDur:' +
              dataDur +
              ', bufferThreshold:' +
              bufferThreshold +
              ', ' +
              this.prefetchThreshold[buffer.type] +
              ', qlen:' +
              queue!.length +
              ',chunkStart:' +
              chunkStart +
              ', curTime:' +
              curTime +
              ', rstime:' +
              rstime
          );
          buffer.underThreshold = true;
          return;
        } else {
          dataDur = 0;
        }
        buffer.underThreshold = false;

        if (chunks && chunks.length == 0) return;
        while (queue!.length > 0) {
          d = queue![0];

          if (buffer.pStart !== d.pStart) {
            if (dataLength === 0) {
              NXDebug.debug(
                '***** period change **** from:' +
                  buffer.pStart +
                  ', to:' +
                  d.pStart
              );
              NXDebug.debug('***** startTime :::' + d.time + ' ******');

              buffer.pStart = d.pStart;
              buffer.quality = -1;
            } else {
              break;
            }
          }
          if (buffer.asetIdx !== d.asetIdx) {
            if (dataLength === 0) {
              NXDebug.debug(
                '***** AdaptationSet change **** from:' +
                  buffer.asetIdx +
                  ', to:' +
                  d.asetIdx
              );
              NXDebug.debug('***** startTime :::' + d.time + ' ******');

              buffer.asetIdx = d.asetIdx;
              buffer.quality = -1;
            } else {
              break;
            }
          }

          if (buffer.quality !== d.quality) {
            if (buffer.type === 'video') {
              logHandler.log_V2Q('bf[' + d.quality + '] init');
            } else {
              logHandler.log_A2Q('bf[' + d.quality + '] init');
            }
            dataLength +=
              buffer.initQ![d.pStart][d.asetIdx][d.quality].data.length;
            dataArray.push(buffer.initQ![d.pStart][d.asetIdx][d.quality].data);

            buffer.quality = d.quality;
          }

          dataOffset = d.offset;
          d.chunks!.forEach((c) => {
            dataLength += c.data!.length;
            dataDur += c.dur;
            dataArray.push(c.data!);
          });

          ast += '*';
          if (buffer.type === 'video') {
            logHandler.log_V2Q(
              'bf[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ast
            );
            NXDebug.debug(
              'bfv[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ', ' +
                parseInt(String(d.rstime * 100.0)) / 100.0
            );
          } else {
            logHandler.log_A2Q(
              'bf[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ast
            );
            NXDebug.debug(
              'bfa[' +
                d.quality +
                '] t=' +
                parseInt(String(d.time * 100.0)) / 100.0 +
                ', ' +
                parseInt(String(d.rstime * 100.0)) / 100.0
            );
          }
          d.chunks = [];
          d.appending = true;
          if (d.done) {
            queue!.shift();
          } else {
            break;
          }
          qc--;
          if (
            qc == 0 ||
            startDiff! + this.appendEnableThreshold[buffer.type] < dataDur ||
            d.time + d.dur > this.mse!.duration
          ) {
            break;
          }
          d = null;
        }
        if (dataLength == 0) {
          return;
        }
        chunkEnd = chunkStart + dataDur;
        if (startDiff) dataDur -= startDiff;
        //// concatenate
        data = new Uint8Array(dataLength);
        let pos: number = 0;
        let da: Uint8Array | undefined;
        while (dataArray.length > 0) {
          da = dataArray.shift();
          data.set(da!, pos);
          pos += da!.length;
        }

        if (dataOffset !== buffer.timestampOffset) {
          buffer.timestampOffset = dataOffset;
        }

        buffer.startTimeAfterSeek = Number.MAX_VALUE;
        buffer.appendBuffer!(data);
        buffer.updatingRange = {
          start: chunkStart,
          end: chunkEnd,
        };
        this.eventBus.dispatchEvent({
          type: 'appendedEnoughDataToStart',
          data: {
            type: buffer.type,
          },
        });
        data = void 0;
      }
    } catch (err: any) {
      NXDebug.log('append error!! Q');
      logHandler.log('append error!! Q');
      logHandler.log(err.message);
      if (queue) queue.unshift(d!);
      NXDebug.log('#############################################');
      NXDebug.log(err);
    }
  };

  playbackStart = (): void => {
    this.playbackStarted = true;
  };
  setVideoModel = (value: VideoModel | DummyVideoModel): void => {
    this.videoModel = value;
  };
  setAppendStatus = (
    value: boolean,
    buffers: Array<ExSourceBuffer>,
    val: number
  ) => {
    for (let i = 0; i < buffers.length; i++) {
      buffers[i].quality = val;
      buffers[i].appendStart = value;
      this.appendFromQ(buffers[i], true);
    }
  };
  directAppend = (buffer: ExSourceBuffer, data: Uint8Array) => {
    if ('appendBuffer' in buffer) {
      buffer.appendBuffer!(data);
    } else if ('append' in buffer) {
      buffer.append!(data);
    }
  };

  attachBuffer = (buffer: ExSourceBuffer): Nullable<ExSourceBuffer> => {
    if (!buffer) return null;

    let b: Nullable<ExSourceBuffer> = this.findBuffer(buffer);

    if (!b) {
      this.buffers.push(buffer);
    }
    return b;
  };

  detachBuffer = (buffer: ExSourceBuffer): void => {
    const idx: number = this.buffers.indexOf(buffer);

    if (idx > -1) {
      this.buffers.splice(idx, 1);
    }
  };
  detachAllBuffers = (): void => {
    this.buffers = [];
  };

  createSourceBuffer = (
    mediaSource: MediaSource,
    codec: string
  ): {
    status: string;
    data?: SourceBuffer;
    msg?: string;
  } => {
    try {
      return {
        status: 'ok',
        data: mediaSource.addSourceBuffer(codec),
      };
    } catch (ex: any) {
      return {
        status: 'error',
        msg: ex.dscription,
      };
    }
  };

  removeSourceBuffer = (
    mediaSource: MediaSource,
    buffer: ExSourceBuffer
  ): void => {
    try {
      mediaSource.removeSourceBuffer(buffer as SourceBuffer);
    } catch (ex: any) {
      logHandler.log(ex.description);
    }
  };

  getBufferRange = (
    buffer: Nullable<ExSourceBuffer>,
    time: number,
    tolerance?: number
  ): Nullable<TimeRange> => {
    let ranges: Nullable<TimeRanges> = null;
    let start: number = 0;
    let end: number = 0;
    let firstStart: Nullable<number> = null;
    let lastEnd: Nullable<number> = null;
    let gap: number = 0;
    const toler1: number = tolerance || 0.15;
    const toler2: number = tolerance || 0.15;

    try {
      ranges = buffer!.buffered;
    } catch (ex: any) {
      return null;
    }

    if (ranges != null) {
      for (let i = 0, len = ranges.length; i < len; i += 1) {
        start = ranges.start(i);
        end = ranges.end(i);
        if (firstStart === null) {
          gap = Math.abs(start - time);
          if (time >= start && time < end) {
            // start the range
            firstStart = start;
            lastEnd = end;
            continue;
          } else if (gap <= toler1) {
            // start the range even though the buffer does not contain time 0
            firstStart = start;
            lastEnd = end;
            continue;
          }
        } else {
          gap = start - lastEnd!;
          if (gap <= toler2) {
            // the discontinuity is smaller than the tolerance, combine the ranges
            lastEnd = end;
          } else {
            break;
          }
        }
      }

      if (firstStart !== null) {
        return {
          start: firstStart,
          end: lastEnd!,
        };
      }
    }

    return null;
  };

  getAllRanges = (buffer: ExSourceBuffer): Nullable<TimeRanges> => {
    let ranges: Nullable<TimeRanges> = null;

    try {
      ranges = buffer.buffered;
      return ranges;
    } catch (ex: any) {
      return null;
    }
  };

  getBufferLength(
    buffer: ExSourceBuffer,
    time: number,
    tolerance?: number
  ): number {
    const range: Nullable<TimeRange> = this.getBufferRange(
      buffer,
      time,
      this.videoModel!.getCurrentTime() > 0 ? tolerance : 0.5
    );

    if (range === null) {
      return 0;
    } else {
      return range.end - time;
    }
  }

  waitForUpdateEnd = (
    buffer: ExSourceBuffer,
    callback: (boolean) => void
  ): void => {
    if (buffer.updating === false) {
      callback(true);
      return;
    }

    let intervalId: ReturnType<typeof setTimeout>;
    const CHECK_INTERVAL: number = 50;

    /* istanbul ignore next */
    const checkIsUpdateEnded = (): void => {
      // if undating is still in progress do nothing and wait for the next check again.
      if (buffer.updating) return;
      // updating is completed, now we can stop checking and resolve the promise
      clearInterval(intervalId);
      callback(true);
    };

    /* istanbul ignore next */
    const updateEndHandler = (): void => {
      if (buffer.updating) return;

      buffer.removeEventListener!('updateend', updateEndHandler, false);
      callback(true);
    };

    // use updateend event if possible
    if (typeof buffer.addEventListener === 'function') {
      try {
        buffer.addEventListener('updateend', updateEndHandler, false);
      } catch (err: any) {
        // use setInterval to periodically check if updating has been completed
        intervalId = setInterval(checkIsUpdateEnded, CHECK_INTERVAL);
      }
    } else {
      // use setInterval to periodically check if updating has been completed
      intervalId = setInterval(checkIsUpdateEnded, CHECK_INTERVAL);
    }
  };

  dataQduration = (buffer: ExSourceBuffer, _segTmpl): number => {
    const curTime: number = this.playbackStarted
      ? this.videoModel!.getCurrentTime()
      : this.videoModel!.getStartTime();

    const range: Nullable<TimeRange> = this.getBufferRange(buffer, curTime);
    const endTime: number = range != null ? range.end : curTime;
    let dur: number = 0;
    let q: ChunkQ;

    if (true) {
      // eslint-disable-line no-constant-condition
      if (buffer.queue)
        for (let i = 0; i < buffer.queue.length; i++) {
          q = buffer.queue[i];
          if (q.type === 'data') {
            if (
              q.time < endTime + this.prefetchThreshold[buffer.type] &&
              endTime < q.time + q.dur
            ) {
              dur += q.dur;
            }
          }
        }
    } /* istanbul ignore next */ else {
      let endPlusQ: number = endTime;
      if (buffer.queue)
        for (let i = 0; i < buffer.queue!.length; i++) {
          q = buffer.queue![i];
          if (q.type === 'data') {
            if (q.time + q.dur < endPlusQ) {
              //
            } else if (
              (q.time < endPlusQ && endPlusQ < q.time + q.dur) ||
              q.time - endPlusQ < 0.5
            ) {
              endPlusQ = q.time + q.dur;
            } else {
              break;
            }
          }
        }
      dur = endPlusQ - endTime;
      if (buffer.type == 'video') {
        if (
          buffer.queue &&
          buffer.queue!.length > 0 &&
          dur < buffer.queue![0].dur * buffer.queue!.length - 1
        ) {
          logHandler.log(
            'dur:::' +
              dur +
              ', endTime:' +
              endTime +
              ', updating:' +
              buffer.updating
          );
          for (let i = 0; i < buffer.queue!.length; i++) {
            q = buffer.queue![i];

            logHandler.log(
              'dur:::start' + q.time + ', dur:' + q.dur + ', type:' + q.type
            );
          }
        }
      }
    }

    return dur;
  };

  // endTime = (buffer: ExSourceBuffer): number => {
  //   let endTime: number = 0;
  //   let len: number = 0;
  //   if (buffer.queue) {
  //     len = buffer.queue.length;
  //     if (len > 0) {
  //       endTime = buffer.queue[len - 1].time + buffer.queue[len - 1].dur;
  //     }
  //   }
  //   return endTime;
  // };

  // dataQlength = (buffer: ExSourceBuffer): number => {
  //   let len: number = 0;
  //   if (buffer.queue)
  //     for (let i = 0; i < buffer.queue.length; i++) {
  //       if (buffer.queue[i].type === 'data') {
  //         len += 1;
  //       }
  //     }
  //   return len;
  // };

  setMediaSource = (value: MediaSource): void => {
    this.mse = value;
  };

  remove = (
    buffer: ExSourceBuffer,
    start: number,
    end: number,
    _duration: number,
    mediaSource: MediaSource,
    callback: (boolean) => void
  ): void => {
    try {
      // make sure that the given time range is correct. Otherwise we will get InvalidAccessError
      if (start >= 0 && end > start && mediaSource.readyState !== 'ended') {
        buffer.remove!(start, end);
      }
      // updating is in progress, we should wait for it to complete before signaling that this operation is done
      this.waitForUpdateEnd(buffer, (_f) => {
        // eslint-disable-line no-unused-vars
        callback(true);
      });
    } catch (err: any) {
      callback(false);
    }
  };

  abort = (mediaSource: MediaSource, buffer: ExSourceBuffer): void => {
    this.playbackStarted = false;
    try {
      if (mediaSource.readyState === 'open') {
        buffer.abort!();
      }
    } catch (ex: any) {
      logHandler.log(ex.description);
    }
  };
}
