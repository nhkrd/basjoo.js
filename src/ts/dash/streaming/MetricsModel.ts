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

import { hasProperty } from '../core/Utils';

/**
 * MetricsModel
 *
 * @module MetricsModel（MetricsModelモジュール）
 */

/**
 * Metrics
 * @constructor
 */
export class Metrics {
  TcpList: Array<TcpConnectionMetrics> = [];
  HttpList: Array<HttpRequestMetrics> = [];
  revHttpList: Array<RevisedHttpRequestMetrics> = [];
  RepSwitchList: Array<RepresentationSwitchMetircs> = [];
  BufferLevel: Array<BufferLevelMetrics> = [];
  PlayList: Array<PlayListMetrics> = [];
  DroppedFrames: Array<DroppedFramesMetrics> = [];
  ReportHttpList: Array<ReportHttpRequestMetrics> = [];
  ReportBufferLevel: Array<ReportBufferLevelMetrics> = [];
  ReportBufferingEvent: Array<BufferingEventMetrics> = [];
  storeMeasuredData: boolean = false;

  constructor() {}

  setStoreMeasuredData = (value: boolean): void => {
    this.storeMeasuredData = value;
  };

  getCurrentBufferLevel = (): Nullable<BufferLevelMetrics> => {
    const bufferLevelLength: number = this.BufferLevel.length;

    if (bufferLevelLength <= 0) {
      return null;
    }

    return this.BufferLevel[bufferLevelLength - 1];
  };

  getCurrentHttpRequest = (): Nullable<HttpRequestMetrics> => {
    const httpListLength = this.HttpList.length;
    let httpListLastIndex;

    if (httpListLength <= 0) {
      return null;
    }

    httpListLastIndex = httpListLength - 1;

    while (httpListLastIndex >= 0) {
      if (this.HttpList[httpListLastIndex].responsecode) {
        return this.HttpList[httpListLastIndex];
      }
      httpListLastIndex -= 1;
    }
    return null;
  };

  getCurrentRevisedHttpRequest = (): Nullable<RevisedHttpRequestMetrics> => {
    const revHttpListLength = this.revHttpList.length;

    if (revHttpListLength <= 0) {
      return null;
    }

    return this.revHttpList[revHttpListLength - 1];
  };

  // getHttpRequests = (): Array<HttpRequestMetrics> => {
  //   return this.HttpList;
  // };

  // getCurrentDroppedFrames = (): Nullable<DroppedFramesMetrics> => {
  //   const droppedFramesLength = this.DroppedFrames.length;
  //   if (droppedFramesLength <= 0) {
  //     return null;
  //   }
  //   return this.DroppedFrames[droppedFramesLength - 1];
  // };

  shiftMetrics = <T extends Object>(metricsList?: Array<T>): T => {
    const defaultMetrics: T = {} as T;
    if (metricsList && metricsList.length > 9) {
      return metricsList.shift() || defaultMetrics;
    }
    return defaultMetrics;
  };

  // addTcpConnection = (
  //   _streamType: string, // unused argument
  //   tcpid: any,
  //   dest: any,
  //   topen: any,
  //   tclose: any,
  //   tconnect: any
  // ): TcpConnectionMetrics => {
  //   const vo = this.shiftMetrics<TcpConnectionMetrics>(this.TcpList);
  //   vo.tcpid = tcpid;
  //   vo.dest = dest;
  //   vo.topen = topen;
  //   vo.tclose = tclose;
  //   vo.tconnect = tconnect;
  //   this.TcpList.push(vo);
  //   return vo;
  // };

  addHttpRequest = (
    streamType?: string,
    tcpid?: any,
    type?: string,
    url?: string,
    baseURL?: string,
    range?: Nullable<string | number>,
    trequest?: Nullable<number>,
    tresponse?: any,
    tfinish?: any,
    responsecode?: any,
    interval?: any,
    mediaduration?: number,
    bandwidth?: number
  ): HttpRequestMetrics => {
    const vo = this.shiftMetrics<HttpRequestMetrics>(this.HttpList);

    vo.stream = streamType;
    vo.tcpid = tcpid;
    vo.type = type;
    vo.url = url;
    vo.baseURL = baseURL;
    vo.range = range;
    vo.trequest = trequest;
    vo.tresponse = tresponse;
    vo.tfinish = tfinish;
    vo.responsecode = responsecode;
    vo.interval = interval;
    vo.mediaduration = mediaduration;
    vo.bandwidth = bandwidth;
    vo.trace = [];
    vo.size = 0;

    this.HttpList.push(vo);

    return vo;
  };

  addReportHttpRequest = (httpRequest: HttpRequestMetrics, ctime: number) => {
    const rvo: ReportHttpRequestMetrics = {};
    rvo.type = httpRequest.stream;
    rvo.url = httpRequest.url;
    rvo.baseURL = httpRequest.baseURL;
    rvo.treq = httpRequest.trequest;
    rvo.tres = httpRequest.tresponse;
    rvo.tfin = httpRequest.tfinish;
    rvo.code = httpRequest.responsecode;
    rvo.dur = httpRequest.mediaduration;
    rvo.bw = httpRequest.bandwidth;
    rvo.size = httpRequest.size;
    rvo.index = httpRequest.index;

    rvo.c = ctime.toFixed(3);
    this.ReportHttpList.push(rvo);

    return rvo;
  };

  addRevisedHttpRequest = (
    httpRequest: RevisedHttpRequests
  ): RevisedHttpRequestMetrics => {
    const rvo = this.shiftMetrics<RevisedHttpRequestMetrics>(this.revHttpList);
    rvo.stream = httpRequest.stream;
    rvo.trequest = httpRequest.trequest;
    rvo.tresponse = httpRequest.tresponse;
    rvo.tfinish = httpRequest.tfinish;
    rvo.mediaduration = httpRequest.mediaduration;
    rvo.bandwidth = httpRequest.bandwidth;
    rvo.size = httpRequest.size;
    rvo.code = httpRequest.responsecode;
    rvo.index = httpRequest.index;

    this.revHttpList.push(rvo);

    return rvo;
  };

  appendHttpTrace = (
    httpRequest: HttpRequestMetrics,
    s: number,
    d: number,
    b: Array<number>
  ): TraceMetrics => {
    const vo = this.shiftMetrics(httpRequest.trace);

    vo.s = s;
    vo.d = d;
    vo.b = b;

    httpRequest.trace!.push(vo);

    return vo;
  };

  addRepresentationSwitch = (
    _streamType: string,
    t: Date,
    mt: number,
    to: string,
    lto: any
  ): RepresentationSwitchMetircs => {
    const vo = this.shiftMetrics<RepresentationSwitchMetircs>(
      this.RepSwitchList
    );

    vo.t = t;
    vo.mt = mt;
    vo.to = to;
    vo.lto = lto;

    this.RepSwitchList.push(vo);

    return vo;
  };

  addBufferLevel = (
    _streamType: string,
    t: number,
    level: number,
    qlv: number,
    ctime: number
  ): BufferLevelMetrics => {
    const vo = this.shiftMetrics<BufferLevelMetrics>(this.BufferLevel);

    vo.t = t;
    vo.level = level;
    vo.totalLevel = level + qlv;

    this.BufferLevel.push(vo);

    if (this.storeMeasuredData) {
      const rvo: ReportBufferLevelMetrics = {};
      rvo.t = t;
      rvo.l = new Number(level).toFixed(3);
      rvo.ql = new Number(qlv).toFixed(3);
      rvo.c = ctime.toFixed(3);
      this.ReportBufferLevel.push(rvo);
    }

    return vo;
  };

  addBufferingEvent = (
    t: number,
    onOff: number,
    ctime: number
  ): BufferingEventMetrics => {
    const vo: BufferingEventMetrics = {};
    vo.t = t;
    vo.e = onOff;
    vo.c = ctime.toFixed(3);

    this.ReportBufferingEvent.push(vo);
    return vo;
  };

  // addDroppedFrames = (_streamType: string, quality: any) => {
  //   const list = this.DroppedFrames;
  //   const vo = this.shiftMetrics<DroppedFramesMetrics>(list);
  //   vo.time = quality.creationTime;
  //   vo.droppedFrames = quality.droppedVideoFrames;
  //   if (list.length > 0 && list[list.length - 1] == vo) {
  //     return list[list.length - 1];
  //   }
  //   list.push(vo);
  //   return vo;
  // };

  addPlayList = (
    streamType: string,
    start: Date,
    mstart: number,
    starttype: string
  ): PlayListMetrics => {
    const vo = this.shiftMetrics<PlayListMetrics>(this.PlayList);

    vo.stream = streamType;
    vo.start = start;
    vo.mstart = mstart;
    vo.starttype = starttype;
    vo.trace = [];

    this.PlayList.push(vo);

    return vo;
  };

  appendPlayListTrace = (
    playList: PlayListMetrics,
    representationid: string,
    subreplevel: any,
    start: Date,
    mstart: number,
    duration: any,
    playbackspeed: number,
    stopreason: any
  ): PlayListTraceMetrics => {
    const vo = this.shiftMetrics(playList.trace);
    vo.representationid = representationid;
    vo.subreplevel = subreplevel;
    vo.start = start;
    vo.mstart = mstart;
    vo.duration = duration;
    vo.playbackspeed = playbackspeed;
    vo.stopreason = stopreason;

    playList.trace!.push(vo);

    return vo;
  };
}

/**
 * MetricsModel
 * @constructor
 */

class MetricsModel {
  streamMetrics: MetricsList = {};

  constructor() {}

  // clearCurrentMetricsForType = (type: string): void => {
  //   delete this.streamMetrics[type];
  // };

  // clearAllCurrentMetrics = (): void => {
  //   this.streamMetrics = {};
  // };

  getReadOnlyMetricsFor = (type: string): Nullable<Metrics> => {
    if (hasProperty(this.streamMetrics, type)) {
      return this.streamMetrics[type];
    }

    return null;
  };

  getMetricsFor = (type: string): Metrics => {
    let metrics: Metrics;

    if (hasProperty(this.streamMetrics, type)) {
      metrics = this.streamMetrics[type];
    } else {
      metrics = new Metrics();
      this.streamMetrics[type] = metrics;
    }

    return metrics;
  };
}

export default MetricsModel;
