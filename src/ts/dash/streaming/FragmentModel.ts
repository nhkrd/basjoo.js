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

import Debug from '../core/Debug';
import ErrorHandler from '../core/ErrorHandler';
import { EventBus } from '../core/EventBus';
import { hasProperty } from '../core/Utils';
import LogHandler from '../core/LogHandler';
import { Metrics } from './MetricsModel';
import { BufferController } from './BufferController';
import { SegmentRequest } from '../manifest/DashHandler';

/**
 * FragmentModel
 *
 * @module FragmentModel（FragmentModelモジュール）
 */

/**
 * FragmentModel
 * @constructor
 */

const abortWrapper = (
  f: Promise<any>,
  c: Nullable<ExXMLHttpRequest>
): Promise<Response> =>
  new Promise((resolve, reject) => {
    c!.listener = (evt) => {
      if (evt.data.lid == c!.lid) {
        c!.unlisten!();
        reject(new Error('abort'));
      }
    };
    c!.listen!();
    f.then(resolve, reject);
  });

const getRequestUrl = (relative: string, baseURL: string): string => {
  let url: string;
  if (relative === baseURL) {
    url = relative;
  } else if (
    relative.indexOf('http://') !== -1 ||
    relative.indexOf('https://') !== -1
  ) {
    url = relative;
  } else {
    url = baseURL + relative;
  }
  return url;
};

export class FragmentModel {
  context?: BufferController;
  executedRequests: Array<SegmentRequest>;
  pendingRequests: Array<SegmentRequest>;
  loadingRequests: Array<SegmentRequest>;
  startLoadingCallback: (request: SegmentRequest) => void;
  successLoadingCallback: (
    request: SegmentRequest,
    response: Uint8Array
  ) => void;
  firstChunkLoadingCallback?: (request: SegmentRequest) => number | ChunkQ;
  chunkLoadingCallback: (done: boolean, q: ChunkQ, _in: Uint8Array) => void;
  errorChunkLoadingCallback: (chunkQ: Nullable<ChunkQ>) => void;
  errorLoadingCallback: (type: string, request: SegmentRequest) => void;
  streamEndCallback: (request: SegmentRequest) => void;
  NXDebug: Debug;
  LOADING_REQUEST_THRESHOLD: number;
  STORE_MEASURED_DATA: boolean;
  useFetch: boolean;
  RETRY_ATTEMPTS: number;
  RETRY_INTERVAL: number;
  xhrs: Array<ExXMLHttpRequest>;
  restrictMultiLoad: boolean;
  commonQrys: Array<CommonQuery>;
  commonHdrs: Array<CommonHeader>;
  onPrepare: (data: {
    req: SegmentRequest;
    qrys: Array<CommonQuery>;
    hdrs: Array<CommonHeader>;
    xhr: ExXMLHttpRequest;
  }) => void;
  onSuccess: (data: {
    status: number;
    req: SegmentRequest;
    xhr: ExXMLHttpRequest;
  }) => void;
  onError: (data: {
    status: number;
    req: SegmentRequest;
    xhr: ExXMLHttpRequest;
  }) => void;
  params: Paramstype;
  eventBus: EventBus;
  metrics: Metrics;
  xhrCustom: XHRCustom;

  constructor(
    params: Paramstype,
    eventBus: EventBus,
    metrics: Metrics,
    xhrCustom: XHRCustom
  ) {
    this.context = undefined;
    this.executedRequests = [];
    this.pendingRequests = [];
    this.loadingRequests = [];
    this.startLoadingCallback = () => {};
    this.successLoadingCallback = () => {};
    this.chunkLoadingCallback = () => {};
    this.errorChunkLoadingCallback = () => {};
    this.errorLoadingCallback = () => {};
    this.streamEndCallback = () => {};
    this.NXDebug = new Debug();
    this.LOADING_REQUEST_THRESHOLD = params.LOADING_REQUEST_THRESHOLD || 2;
    this.STORE_MEASURED_DATA = params.STORE_MEASURED_DATA || false;
    this.useFetch = params.USE_FETCH && 'fetch' in window ? true : false;
    this.RETRY_ATTEMPTS = 0;
    this.RETRY_INTERVAL = 500;
    this.xhrs = [];
    this.restrictMultiLoad = false;
    this.commonQrys = hasProperty(xhrCustom, 'query')
      ? xhrCustom['query']!
      : [];
    this.commonHdrs = hasProperty(xhrCustom, 'header')
      ? xhrCustom['header']!
      : [];
    this.onPrepare = hasProperty(xhrCustom, 'onPrepare')
      ? xhrCustom['onPrepare']!
      : () => {};
    this.onSuccess = hasProperty(xhrCustom, 'onSuccess')
      ? xhrCustom['onSuccess']!
      : () => {};
    this.onError = hasProperty(xhrCustom, 'onError')
      ? xhrCustom['onError']!
      : () => {};
    this.params = params;
    this.eventBus = eventBus;
    this.metrics = metrics;
    this.xhrCustom = xhrCustom;
  }

  /* istanbul ignore next */
  doLoadX = (
    request: SegmentRequest,
    remainingAttempts: number,
    _callback: (ExXMLHttpRequest) => void
  ): void => {
    const callback = _callback;
    const req: ExXMLHttpRequest = new XMLHttpRequest();
    let httpRequestMetrics: Nullable<HttpRequestMetrics> = null;
    let firstProgress: boolean = true;
    let waitingForNext: boolean = true;
    let needFailureReport: boolean = true;
    let lastTraceTime: Nullable<number> = null;
    const qrys: Array<CommonQuery> = this.commonQrys.concat();
    const hdrs: Array<CommonHeader> = this.commonHdrs.concat();
    const self = this;

    this.xhrs.push(req);
    request.requestStartTime = new Date().getTime();
    req.startTime = request.requestStartTime;

    if (request.range) {
      request.url += '?range=' + request.range;
      qrys.push({
        name: 'range',
        value: request.range as string,
      });
    }

    request.url = getRequestUrl.call(
      self,
      request.relativeURL!,
      request.baseURL[request.baseURLIdx].url!
    );

    this.onPrepare({
      req: request,
      qrys,
      hdrs,
      xhr: req,
    });

    if (qrys.length > 0) {
      qrys.forEach((qry) => {
        request.url += request.url!.indexOf('?') > 0 ? '&' : '?';
        request.url += qry.name + '=' + qry.value;
      });
    }

    httpRequestMetrics = this.metrics.addHttpRequest(
      request.streamType!,
      null,
      request.type!,
      request.url,
      request.baseURL[request.baseURLIdx].url!,
      request.range,
      request.requestStartTime,
      null,
      null,
      null,
      null,
      request.duration,
      request.bandwidth!
    );

    this.metrics.appendHttpTrace(
      httpRequestMetrics,
      request.requestStartTime,
      request.requestStartTime - request.requestStartTime,
      [0]
    );

    lastTraceTime = request.requestStartTime;

    if (req.open) req.open('GET', request.url, true);
    req.responseType = 'arraybuffer';
    const path: Array<string> = request.url.split('/');

    if (request.range) {
      if (req.setRequestHeader)
        req.setRequestHeader('Range', 'bytes=' + request.range);
    }

    if (hdrs.length > 0) {
      hdrs.forEach((hdr) => {
        if (req.setRequestHeader) req.setRequestHeader(hdr.name, hdr.value);
      });
    }

    req.onprogress = (event: ProgressEvent<EventTarget>): void => {
      const currentTime: number = new Date().getTime();
      if (firstProgress) {
        firstProgress = false;
        if (
          !event.lengthComputable ||
          (event.lengthComputable && event.total != event.loaded)
        ) {
          request.firstByteTime = currentTime;
        }
        if (event.lengthComputable) {
          request.total = event.total;
        } else {
          if (request.range) {
            const r: Array<string> = (request.range as string).split('-');
            if (r.length > 1) {
              request.total = parseInt(r[1]) - parseInt(r[0]) + 1;
            }
          } else {
            request.total = 0;
          }
        }
      }
      request.loaded = event.loaded;
      if (waitingForNext && this.pendingRequests.length > 0) {
        if (request.loaded > 0 && request.total! > 0) {
          const remainingTime: number =
            ((currentTime - request.requestStartTime) / request.loaded) *
            (request.total! - request.loaded);
          if (
            remainingTime <
            request.firstByteTime - request.requestStartTime
          ) {
            waitingForNext = false;
            self.executeCurrentRequest();
          }
        }
      }
    };

    req.onload = (): void => {
      if (request.timeouttimerId) {
        clearTimeout(request.timeouttimerId);
        request.timeouttimerId = null;
      }
      if (waitingForNext && this.pendingRequests.length > 0) {
        waitingForNext = false;
        self.executeCurrentRequest();
      }
      if (req.status! < 200 || req.status! > 299) {
        LogHandler.log_d(
          req.status + ': ' + path[path.length - 1] + ' , ' + request.range
        );
      } else {
        needFailureReport = false;

        const currentTime: number = new Date().getTime();
        let bytes: ArrayBuffer;
        let latency: number;
        let download: number;
        if (!request.firstByteTime) {
          request.firstByteTime = request.requestStartTime;
        }
        request.requestEndTime = currentTime;

        latency = request.firstByteTime - request.requestStartTime;
        download = request.requestEndTime - request.firstByteTime;
        LogHandler.log_d(
          'X' +
            req.status +
            ': ' +
            path[path.length - 1] +
            ', i=' +
            request.index +
            ' ,t=' +
            Math.floor(request.startTime) +
            ', ' +
            latency +
            'ms, ' +
            download +
            'ms, '
        );
        this.NXDebug.debug(
          '[' +
            request.streamType +
            '] loaded : ' +
            request.type +
            ':' +
            request.startTime +
            ' (' +
            req.status +
            ', ' +
            latency +
            'ms, ' +
            download +
            'ms)'
        );
        this.NXDebug.info(
          '[' +
            request.streamType +
            '] loaded : ' +
            request.type +
            ':' +
            request.startTime +
            ' (' +
            req.status +
            ', ' +
            latency +
            'ms, ' +
            download +
            'ms)'
        );

        request.size = req.response.byteLength;
        httpRequestMetrics!.tresponse = request.firstByteTime;
        httpRequestMetrics!.tfinish = request.requestEndTime;
        httpRequestMetrics!.responsecode = req.status;

        request.code = 200;

        httpRequestMetrics!.size = req.response.byteLength;

        this.onSuccess({
          status: req.status!,
          req: request,
          xhr: req,
        });

        bytes = req.response;
        this.metrics.appendHttpTrace(
          httpRequestMetrics!,
          currentTime,
          currentTime - lastTraceTime!,
          [bytes ? bytes.byteLength : 0]
        );

        lastTraceTime = currentTime;

        callback({
          status: 'ok',
          data: new Uint8Array(bytes),
        });
      }
    };

    // eslint-disable-next-line no-unused-vars
    req.onabort = (_evt): void => {
      request.requestEndTime = new Date().getTime();
      if (!isNaN(request.firstByteTime)) {
        request.firstByteTime = request.requestEndTime;
      }
      if (request.canceled || isNaN(request.loaded)) {
        request.code = 400;
      } else {
        request.size = request.loaded;
        request.code = 408;
      }
      callback({
        status: 'error',
        type: 'onabort',
        msg:
          'aborted: ' +
          request.streamType +
          ':' +
          request.type +
          ':' +
          request.startTime,
        data: req,
      });
    };

    req.onloadend = req.onerror = (): void => {
      if (request.timeouttimerId) {
        clearTimeout(request.timeouttimerId);
        request.timeouttimerId = null;
      }
      if (this.xhrs.indexOf(req) === -1) {
        return;
      } else {
        this.xhrs.splice(this.xhrs.indexOf(req), 1);
      }

      if (!needFailureReport) {
        return;
      }

      this.onError({
        status: req.status!,
        req: request,
        xhr: req,
      });

      needFailureReport = false;
      const currentTime: number = new Date().getTime();
      const bytes: ArrayBuffer = req.response;
      let latency: number;
      let download: number;

      if (!request.firstByteTime) {
        request.firstByteTime = request.requestStartTime;
      }
      request.requestEndTime = currentTime;

      latency = request.firstByteTime - request.requestStartTime;
      download = request.requestEndTime - request.firstByteTime;

      this.NXDebug.log(
        'failed ' +
          request.streamType +
          ':' +
          request.type +
          ':' +
          request.startTime +
          ' (' +
          req.status +
          ', ' +
          latency +
          'ms, ' +
          download +
          'ms)'
      );

      httpRequestMetrics!.tresponse = request.firstByteTime;
      httpRequestMetrics!.tfinish = request.requestEndTime;
      httpRequestMetrics!.responsecode = req.status;

      this.metrics.appendHttpTrace(
        httpRequestMetrics!,
        currentTime,
        currentTime - lastTraceTime!,
        [bytes ? bytes.byteLength : 0]
      );

      if (this.STORE_MEASURED_DATA) {
        this.metrics.addReportHttpRequest(
          httpRequestMetrics!,
          this.context!.getVideoModel().getCurrentTime()
        );
        this.eventBus.dispatchEvent({
          type: 'httpRequestReceived',
          data: httpRequestMetrics,
        });
      }

      lastTraceTime = currentTime;

      if (remainingAttempts > 0 && req.status! < 399) {
        this.NXDebug.log(
          'Failed loading segment: ' +
            request.streamType +
            ':' +
            request.type +
            ':' +
            request.startTime +
            ', retry in ' +
            this.RETRY_INTERVAL +
            'ms' +
            ' attempts: ' +
            remainingAttempts
        );
        remainingAttempts--;
        ErrorHandler.downloadError(
          this.eventBus,
          'content',
          request.url!,
          req,
          request
        );
        setTimeout(() => {
          this.doLoadX.call(self, request, remainingAttempts, callback);
        }, this.RETRY_INTERVAL);
      } else {
        this.NXDebug.log(
          'Failed loading segment: ' +
            request.streamType +
            ':' +
            request.type +
            ':' +
            request.startTime +
            ' no retry attempts left'
        );

        request.code = 400;
        callback({
          status: 'error',
          type: 'onloadend',
          msg:
            'Failed loading segment: ' +
            request.streamType +
            ':' +
            request.type +
            ':' +
            request.startTime +
            ' no retry attempts left',
          data: req,
        });
      }
    };

    this.NXDebug.info(
      'str: [' +
        request.streamType +
        '] ' +
        path[path.length - 1] +
        ', i=' +
        request.index +
        ' ,t=' +
        Math.floor(request.startTime)
    );
    if (req.send) req.send();
    this.startLoadingCallback.call(this.context, request);
  };

  /* istanbul ignore next */
  doLoadF = (
    request: SegmentRequest,
    remainingAttempts: number,
    _callback: (ExXMLHttpRequest) => void
  ): void => {
    const callback = _callback || (() => {});
    const eventBus = this.eventBus;

    let acon: Nullable<ExXMLHttpRequest> = {
      aborted: false,
      listener: null,
      lid: null,
      startTime: null,
      listen() {
        eventBus.addEventListener('abortFetch', this.listener!);
      },
      unlisten() {
        eventBus.removeEventListener('abortFetch', this.listener!);
      },
      abort() {
        this.aborted = true;
        eventBus.dispatchEvent({
          type: 'abortFetch',
          data: {
            lid: this.lid,
          },
        });
      },
    };

    const req: Nullable<ExXMLHttpRequest> = {};

    const init: RequestInit = {
      method: 'GET',
      headers: {},
      credentials: 'same-origin',
    };

    let chunkQ: Nullable<ChunkQ>;
    let httpRequestMetrics: Nullable<HttpRequestMetrics> = null;
    let firstProgress: boolean = true;
    let waitingForNext: boolean = true;
    let lastTraceTime: Nullable<number> = null;
    const qrys: Array<CommonQuery> = this.commonQrys.concat();
    const hdrs: Array<CommonHeader> = this.commonHdrs.concat();
    const self = this;

    // eslint-disable-next-line no-unused-vars
    const onerror = (_err): void => {
      if (this.xhrs.indexOf(acon!) > -1) {
        this.xhrs.splice(this.xhrs.indexOf(acon!), 1);
      }
      if (chunkQ) {
        this.errorChunkLoadingCallback(chunkQ);
        chunkQ = null;
      }
      if (acon!.aborted || req.ok == true) {
        request.requestEndTime = new Date().getTime();
        if (!isNaN(request.firstByteTime)) {
          request.firstByteTime = request.requestEndTime;
        }
        if (request.canceled || isNaN(request.loaded)) {
          request.code = 400;
          req.status = 400;
        } else {
          request.size = request.loaded;
          request.code = 408;
          req.status = 408;
        }
        callback({
          status: 'error',
          type: 'onabort',
          msg:
            'aborted: ' +
            request.streamType +
            ':' +
            request.type +
            ':' +
            request.startTime,
          data: req,
        });
      } else {
        if (!req.status) req.status = -1;
        this.onError({
          status: req.status,
          req: request,
          xhr: req,
        });

        const currentTime: number = new Date().getTime();
        //const bytes: Nullable<ArrayBuffer> = null;
        let latency: number;
        let download: number;

        if (!request.firstByteTime) {
          request.firstByteTime = request.requestStartTime;
        }
        request.requestEndTime = currentTime;

        latency = request.firstByteTime - request.requestStartTime;
        download = request.requestEndTime - request.firstByteTime;

        this.NXDebug.log(
          'failed ' +
            request.streamType +
            ':' +
            request.type +
            ':' +
            request.startTime +
            ' (' +
            req.status +
            ', ' +
            latency +
            'ms, ' +
            download +
            'ms)'
        );

        if (httpRequestMetrics) {
          httpRequestMetrics.tresponse = request.firstByteTime;
          httpRequestMetrics.tfinish = request.requestEndTime;
          httpRequestMetrics.responsecode = req.status;
        }

        this.metrics.appendHttpTrace(
          httpRequestMetrics!,
          currentTime,
          currentTime - lastTraceTime!,
          [0] //eslint Error ==> [bytes ? bytes!.byteLength : 0]
        );

        if (this.STORE_MEASURED_DATA) {
          this.metrics.addReportHttpRequest(
            httpRequestMetrics!,
            this.context!.getVideoModel().getCurrentTime()
          );
          eventBus.dispatchEvent({
            type: 'httpRequestReceived',
            data: httpRequestMetrics,
          });
        }

        lastTraceTime = currentTime;

        if (remainingAttempts > 0 && req.status < 399) {
          this.NXDebug.log(
            'Failed loading segment: ' +
              request.streamType +
              ':' +
              request.type +
              ':' +
              request.startTime +
              ', retry in ' +
              this.RETRY_INTERVAL +
              'ms' +
              ' attempts: ' +
              remainingAttempts
          );
          remainingAttempts--;
          ErrorHandler.downloadError(
            eventBus,
            'content',
            request.url!,
            req,
            request
          );
          setTimeout(() => {
            this.doLoadF.call(self, request, remainingAttempts, callback);
          }, this.RETRY_INTERVAL);
        } else {
          this.NXDebug.log(
            'Failed loading segment: ' +
              request.streamType +
              ':' +
              request.type +
              ':' +
              request.startTime +
              ' no retry attempts left'
          );

          request.code = 400;
          callback({
            status: 'error',
            type: 'onloadend',
            msg:
              'Failed loading segment: ' +
              request.streamType +
              ':' +
              request.type +
              ':' +
              request.startTime +
              ' no retry attempts left',
            data: req,
          });
        }
      }
      acon = null;
    };

    request.requestStartTime = new Date().getTime();
    req.startTime = request.requestStartTime;
    acon!.startTime = request.startTime;
    acon!.lid = request.startTime + ',' + request.requestStartTime;
    this.xhrs.push(acon!);

    if (request.range) {
      request.url += '?range=' + request.range;
      qrys.push({
        name: 'range',
        value: request.range as string,
      });
    }

    request.url = getRequestUrl.call(
      self,
      request.relativeURL!,
      request.baseURL[request.baseURLIdx].url!
    );

    this.onPrepare({
      req: request,
      qrys,
      hdrs,
      xhr: req,
    });

    if (qrys.length > 0) {
      qrys.forEach((qry) => {
        request.url += request.url!.indexOf('?') > 0 ? '&' : '?';
        request.url += qry.name + '=' + qry.value;
      });
    }

    httpRequestMetrics = this.metrics.addHttpRequest(
      request.streamType!,
      null,
      request.type!,
      request.url,
      request.baseURL[request.baseURLIdx].url!,
      request.range,
      request.requestStartTime,
      null,
      null,
      null,
      null,
      request.duration,
      request.bandwidth!
    );
    this.metrics.appendHttpTrace(
      httpRequestMetrics,
      request.requestStartTime,
      request.requestStartTime - request.requestStartTime,
      [0]
    );
    lastTraceTime = request.requestStartTime;

    const path: Array<string> = request.url.split('/');

    if (request.range) {
      init.headers!['Range'] = 'bytes=' + request.range;
    }

    if (hdrs.length > 0) {
      hdrs.forEach((hdr) => {
        init.headers![hdr.name] = hdr.value;
      });
    }

    const progress = (
      result: ExResponse,
      total: Nullable<number>,
      reader: ReadableStreamDefaultReader
    ) => {
      let currentTime: number;
      acon!.unlisten!();
      if (acon!.aborted) {
        onerror(new Error('AbortError'));
        return;
      }
      if (result.done) {
        let latency: number;
        let download: number;
        currentTime = new Date().getTime();
        if (this.xhrs.indexOf(acon!) > -1) {
          this.xhrs.splice(this.xhrs.indexOf(acon!), 1);
        }
        this.chunkLoadingCallback(result.done, chunkQ!, new Uint8Array());
        if (waitingForNext && this.pendingRequests.length > 0) {
          waitingForNext = false;
          self.executeCurrentRequest();
        }

        if (!request.firstByteTime) {
          request.firstByteTime = request.requestStartTime;
        }
        request.requestEndTime = currentTime;

        latency = request.firstByteTime - request.requestStartTime;
        download = request.requestEndTime - request.firstByteTime;
        LogHandler.log_d(
          'F' +
            req.status +
            ': ' +
            path[path.length - 1] +
            ', i=' +
            request.index +
            ' ,t=' +
            Math.floor(request.startTime) +
            ', ' +
            latency +
            'ms, ' +
            download +
            'ms, '
        );
        this.NXDebug.debug(
          '[' +
            request.streamType +
            '] loaded : ' +
            request.type +
            ':' +
            request.startTime +
            ' (' +
            req.status +
            ', ' +
            latency +
            'ms, ' +
            download +
            'ms)'
        );
        this.NXDebug.info(
          '[' +
            request.streamType +
            '] loaded : ' +
            request.type +
            ':' +
            request.startTime +
            ' (' +
            req.status +
            ', ' +
            latency +
            'ms, ' +
            download +
            'ms)'
        );

        request.size = request.loaded;
        httpRequestMetrics!.tresponse = request.firstByteTime;
        httpRequestMetrics!.tfinish = request.requestEndTime;
        httpRequestMetrics!.responsecode = req.status;

        request.code = 200;

        httpRequestMetrics!.size = request.loaded;

        this.onSuccess({
          status: req.status!,
          req: request,
          xhr: req,
        });

        this.metrics.appendHttpTrace(
          httpRequestMetrics!,
          currentTime,
          currentTime - lastTraceTime!,
          [request.loaded]
        );
        lastTraceTime = currentTime;

        //callback({status:"ok", data: bytes});
        callback({
          status: 'ok',
          data: new Uint8Array(0),
        });

        return;
      }

      currentTime = new Date().getTime();
      if (firstProgress) {
        firstProgress = false;
        request.firstByteTime = currentTime;
        request.total = total!;

        request.loaded = result.value!.length;
        chunkQ = this.firstChunkLoadingCallback!(request)! as ChunkQ;
      } else {
        request.loaded += result.value!.length;
      }
      this.chunkLoadingCallback(result.done!, chunkQ!, result.value!);

      if (waitingForNext && this.pendingRequests.length > 0) {
        let remainingTime: number = Number.MAX_VALUE;
        if (total != null && total > 0) {
          if (request.loaded > 0) {
            remainingTime =
              ((currentTime - request.requestStartTime) / request.loaded) *
              (request.total! - request.loaded);
          }
        } else {
          if (chunkQ) {
            if (chunkQ.chunks!.length > 0) {
              const dur: number = chunkQ.dur;

              const cdur: number =
                chunkQ.chunks![chunkQ.chunks!.length - 1].start! +
                chunkQ.chunks![chunkQ.chunks!.length - 1].dur -
                chunkQ.time;

              remainingTime = dur - cdur;
            }
          }
        }

        if (remainingTime < request.firstByteTime - request.requestStartTime) {
          waitingForNext = false;
          self.executeCurrentRequest();
        }
      }

      return abortWrapper(reader.read(), acon)
        .then((res) => progress(res, total, reader))
        .catch((err: any) => {
          acon!.unlisten!();
          onerror(err);
          return;
        });
    };

    abortWrapper(fetch(request.url, init), acon)
      .then((res) => {
        acon!.unlisten!();
        req.status = res.status;
        req.ok = res.ok;
        if (res.ok == true) {
          const contentLength: Nullable<string> =
            res.headers.get('content-length');
          let total: Nullable<number> = contentLength
            ? parseInt(contentLength, 10)
            : null;
          const reader: ReadableStreamDefaultReader = res.body!.getReader();

          if (!total && request.range) {
            const r = (request.range as string).split('-');
            if (r.length > 1) {
              total = parseInt(r[1]) - parseInt(r[0]) + 1;
            }
          }
          return abortWrapper(reader.read(), acon)
            .then((result) => progress(result, total, reader))
            .catch((err: any) => {
              onerror(err);
              return;
            });
        } else {
          this.NXDebug.debug('404 Not Found');
          return Promise.reject(new Error('res.false'));
        }
      })
      .catch((err: any) => {
        onerror(err);
        return;
      });

    this.NXDebug.info(
      'str: [' +
        request.streamType +
        '] ' +
        path[path.length - 1] +
        ', i=' +
        request.index +
        ' ,t=' +
        Math.floor(request.startTime) +
        ', rst:' +
        request.requestStartTime
    );
    //logHandler.log("str: ["+request.streamType+"] " + path[(path.length-1)]  + ", i=" + request.index + " ,t=" + Math.floor(request.startTime)+", rst:"+request.requestStartTime);
    this.startLoadingCallback.call(this.context, request);
  };

  fragmentLoad = (
    req: SegmentRequest,
    _callback: (d: ResponseData) => void
  ): void => {
    const callback = _callback;
    if (!req) {
      callback({
        status: 'ok',
        data: null,
      });
    }

    req.loading = true;
    if (this.useFetch) {
      this.doLoadF(req, this.RETRY_ATTEMPTS, callback);
    } else {
      this.doLoadX(req, this.RETRY_ATTEMPTS, callback);
    }
  };

  abort = (): void => {
    let req: ExXMLHttpRequest;
    const ln: number = this.xhrs.length;

    for (let i = 0; i < ln; i += 1) {
      req = this.xhrs[i];
      //xhrs[i] = null;
      if (req.abort) req.abort();
      //req = null;
    }

    this.xhrs = [];
  };

  getRecent2ExecutedDownloadRequestIndex = (): Array<number> => {
    const rqsts: Array<number> = [];

    for (let i = this.executedRequests.length - 1; i >= 0; i--) {
      if (this.executedRequests[i].action === 'download') {
        rqsts.push(i);
        if (rqsts.length >= 2) {
          break;
        }
      }
    }
    return rqsts;
  };

  reviseRequestStatus = (request: SegmentRequest): void => {
    const rqsts: Array<number> =
      this.getRecent2ExecutedDownloadRequestIndex.call(this);
    const revRequest: HttpRequestMetrics = {};
    let prOlBytes: number = 0;
    let lrOlBytes: number = 0;

    if (rqsts.length > 0) {
      const pr: SegmentRequest = this.executedRequests[rqsts.shift()!];
      const prTime: number = pr.requestEndTime - pr.requestStartTime;

      const prOlTime: number =
        pr.requestEndTime > request.requestStartTime
          ? pr.requestEndTime - request.requestStartTime
          : 0;

      const prOlRate: number = prTime > prOlTime ? prOlTime / prTime : 1;

      prOlBytes = pr.size * prOlRate;
    }

    if (this.loadingRequests.length > 0) {
      const lr: SegmentRequest = this.loadingRequests[0];

      lrOlBytes = isNaN(lr.loaded) ? 0 : lr.loaded;
    }

    revRequest.stream = request.streamType!;
    revRequest.trequest = request.requestStartTime;
    revRequest.tresponse = request.firstByteTime;
    revRequest.tfinish = request.requestEndTime;
    revRequest.mediaduration = request.duration;
    revRequest.size = Math.round(request.size + prOlBytes + lrOlBytes);
    revRequest.bandwidth = request.bandwidth!;

    revRequest.url = request.url!;
    revRequest.baseURL = request.baseURL[0].url!;
    revRequest.responsecode = request.code;
    revRequest.index = request.index;

    this.metrics.addRevisedHttpRequest(revRequest);

    if (this.STORE_MEASURED_DATA) {
      const r = this.metrics.addReportHttpRequest(
        revRequest,
        this.context!.getVideoModel().getCurrentTime()
      );
      this.eventBus.dispatchEvent({
        type: 'httpRequestReceived',
        data: r,
      });
    }

    if (
      revRequest.responsecode != 408 &&
      revRequest.tfinish - revRequest.trequest < revRequest.mediaduration * 1000
    ) {
      this.restrictMultiLoad = false;
    }
  };

  loadCurrentFragment = (request: SegmentRequest): void => {
    const self = this;

    const _onSuccess = (
      request: SegmentRequest,
      response: Nullable<Uint8Array>
    ): void => {
      const idx: number = this.loadingRequests.indexOf(request);
      if (idx > -1) {
        this.loadingRequests.splice(idx, 1);
      }
      this.reviseRequestStatus.call(self, request);

      this.executedRequests.push(request);
      if (this.executedRequests.length > 20) this.executedRequests.shift();
      this.successLoadingCallback.call(this.context, request, response!);
      request.loading = false;
    };

    const _onError = (type: string, request: SegmentRequest): void => {
      const idx: number = this.loadingRequests.indexOf(request);
      if (idx > -1) {
        this.loadingRequests.splice(idx, 1);
      }
      if (request.code != 400) {
        this.reviseRequestStatus.call(self, request);
        this.executedRequests.push(request);
      }
      this.errorLoadingCallback.call(this.context, type, request);
      request.loading = false;
    };

    this.fragmentLoad.call(self, request, (d: ResponseData): void => {
      if (d.status === 'ok') {
        _onSuccess(request, d.data!);
      } else {
        _onError(d.type!, request);
      }
    });
  };

  /*
    const sortRequestsByProperty = (requestsArray, sortProp) => {
      const compare = (req1, req2) => {
          if (req1[sortProp] < req2[sortProp]) return -1;
          if (req1[sortProp] > req2[sortProp]) return 1;
          return 0;
      };

      requestsArray.sort(compare);
    };
  */

  sortRequestsByProperty = (requestsArray: Array<SegmentRequest>): void => {
    const compare = (req1: SegmentRequest, req2: SegmentRequest): number => {
      if (req1.pStart < req2.pStart) return -1;
      if (req1.pStart == req2.pStart) {
        if (req1.index < req2.index) return -1;
        if (req1.index > req2.index) return 1;
        return 0;
      }
      if (req1.pStart > req2.pStart) return 1;
      return 0;
    };

    requestsArray.sort(compare);
  };

  checkLoaded = (
    r1: SegmentRequest,
    r2: SegmentRequest | ChunkQ,
    tol: number
  ): boolean => {
    const o1: number = r1.MSETimeOffset;
    const o2: number = r2.action ? r2.MSETimeOffset! : r2.offset!;
    const q1: number = r1.quality;
    const q2: number = r2.quality;
    const s1: number = r1.startTime;
    const s2: number = r2.action ? r2.startTime! : r2.rstime!;

    if (o1 != o2) return false;

    if (q1 == q2) {
      if (s1 == s2) return true;
    } else {
      if (Math.abs(s1 - s2) <= tol) return true;
    }
    return false;
  };

  removeExecutedRequest = (request: SegmentRequest): void => {
    const idx: number = this.executedRequests.indexOf(request);

    if (idx !== -1) {
      this.executedRequests.splice(idx, 1);
    }
  };

  setContext = (value: BufferController): void => {
    this.context = value;
  };

  getContext = (): Nullable<BufferController> => {
    return this.context!;
  };

  /*
    addRequest = (value) => {
      if (value) {
          if (!agressive && this.isFragmentLoadedOrPending(value)) return;

          pendingRequests.push(value);
          sortRequestsByProperty.call(this, pendingRequests, "index");
      }
    };
  */

  addRequest = (value: SegmentRequest): void => {
    if (value) {
      this.pendingRequests.push(value);
      //sortRequestsByProperty.call(this, pendingRequests, "index");
      this.sortRequestsByProperty.call(this, this.pendingRequests);
    }
  };

  setCallbacks = (
    onLoadingStart: (request: SegmentRequest) => void,
    onLoadingSuccess: (request: SegmentRequest, response: Uint8Array) => void,
    onLoadingError: (type: string, request: SegmentRequest) => void,
    onStreamEnd: (request: SegmentRequest) => void,
    onFirstChunkLoadingSuccess: (request: SegmentRequest) => number | ChunkQ,
    onChunkLoadingSuccess: (done: boolean, q: ChunkQ, _in: Uint8Array) => void,
    onChunkLoadingError: (chunkQ: Nullable<ChunkQ>) => void
  ) => {
    this.startLoadingCallback = onLoadingStart;
    this.streamEndCallback = onStreamEnd;
    this.errorLoadingCallback = onLoadingError;
    this.successLoadingCallback = onLoadingSuccess;
    this.firstChunkLoadingCallback = onFirstChunkLoadingSuccess;
    this.chunkLoadingCallback = onChunkLoadingSuccess;
    this.errorChunkLoadingCallback = onChunkLoadingError;
  };

  isFragmentLoadedOrPending = (
    request: SegmentRequest,
    _q: Array<ChunkQ>,
    _tol: number
  ): boolean => {
    const q: Array<ChunkQ> = _q || [];
    const tol: number = _tol || 0;

    if (
      this.isFragmentQueued(request, q, tol) ||
      this.isFragmentLoaded(request, tol) ||
      this.isFragmentPending(request, tol) ||
      this.isFragmentLoading(request, tol)
    ) {
      return true;
    } else {
      return false;
    }
  };

  isFragmentLoadingOrPending = (
    request: SegmentRequest,
    _q: Array<ChunkQ>,
    _tol: number
  ): boolean => {
    const q: Array<ChunkQ> = _q || [];
    const tol: number = _tol || 0;

    if (
      this.isFragmentQueued(request, q, tol) ||
      this.isFragmentPending(request, tol) ||
      this.isFragmentLoading(request, tol)
    ) {
      return true;
    } else {
      return false;
    }
  };

  isFragmentQueued(
    request: SegmentRequest,
    _q: Array<ChunkQ>,
    _tol: number
  ): boolean {
    let isLoaded: boolean = false;
    const q: Array<ChunkQ> = _q || [];
    const tol: number = _tol || 0;
    const ln: number = q.length;

    for (let i = 0; i < ln; i++) {
      if (this.checkLoaded(request, q[i], tol)) {
        isLoaded = true;
        break;
      }
    }
    return isLoaded;
  }

  isFragmentLoaded = (request: SegmentRequest, _tol: number): boolean => {
    let isLoaded: boolean = false;
    const tol: number = _tol || 0;
    const ln: number = this.executedRequests.length;
    let req: SegmentRequest;

    if (!isLoaded) {
      for (let i = 0; i < ln; i++) {
        req = this.executedRequests[i];
        if (req.code != 200) continue;
        if (
          this.checkLoaded(request, req, tol) ||
          (req.action === 'complete' && request.action === req.action)
        ) {
          isLoaded = true;
          break;
        }
      }
    }
    return isLoaded;
  };

  isFragmentPending = (request: SegmentRequest, _tol: number): boolean => {
    let isLoaded: boolean = false;
    const tol: number = _tol || 0;
    const ln: number = this.pendingRequests.length;
    let req: SegmentRequest;

    for (let i = 0; i < ln; i++) {
      req = this.pendingRequests[i];
      if (this.checkLoaded(request, req, tol)) {
        isLoaded = true;
      }
    }
    return isLoaded;
  };

  isFragmentLoading = (request: SegmentRequest, _tol: number): boolean => {
    let isLoaded: boolean = false;
    const tol: number = _tol || 0;
    const ln: number = this.loadingRequests.length;
    let req: SegmentRequest;

    for (let i = 0; i < ln; i++) {
      req = this.loadingRequests[i];
      if (this.checkLoaded(request, req, tol)) {
        isLoaded = true;
      }
    }
    return isLoaded;
  };

  isReady = (): boolean => {
    return this.context!.isReady();
  };

  getExecutedRequests = (): Array<SegmentRequest> => {
    return this.executedRequests;
  };

  getPendingRequests = (): Array<SegmentRequest> => {
    return this.pendingRequests;
  };

  getLoadingRequests = (): Array<SegmentRequest> => {
    return this.loadingRequests;
  };

  // getLoadingRequestThreshold = (): number => {
  //   return this.LOADING_REQUEST_THRESHOLD;
  // };

  needToPrepareNewRequest = (): boolean => {
    return this.loadingRequests.length < this.LOADING_REQUEST_THRESHOLD
      ? true
      : false;
  };

  // getLoadingTime = (): number => {
  //   let loadingTime: number = 0;
  //   let req: RequestType;
  //   for (let i = this.executedRequests.length - 1; i >= 0; i -= 1) {
  //     req = this.executedRequests[i];
  //     if (!isNaN(req.requestEndTime) && !isNaN(req.firstByteTime)) {
  //       loadingTime = req.requestEndTime - req.firstByteTime;
  //       break;
  //     }
  //   }
  //   return loadingTime;
  // };

  getExecutedRequestForTime = (time: number): Nullable<SegmentRequest> => {
    const lastIdx: number = this.executedRequests.length - 1;
    let start: number = NaN;
    let end: number = NaN;
    let req: Nullable<SegmentRequest> = null;

    // loop through the executed requests and pick the one for which the playback interval matches the given time
    for (let i = lastIdx; i >= 0; i -= 1) {
      req = this.executedRequests[i];
      start = req.startTime;
      end = start + req.duration;
      if (!isNaN(start) && !isNaN(end) && time > start && time < end) {
        return req;
      }
    }

    return null;
  };

  // getExecutedRequestForQualityAndIndex = (
  //   quality: number,
  //   index: number
  // ): Nullable<RequestType> => {
  //   const lastIdx: number = this.executedRequests.length - 1;
  //   let req: Nullable<RequestType> = null;
  //   for (let i = lastIdx; i >= 0; i -= 1) {
  //     req = this.executedRequests[i];
  //     if (req.quality === quality && req.index === index) {
  //       return req;
  //     }
  //   }
  //   return null;
  // };

  removeAllExecutedRequests = (): void => {
    this.executedRequests = [];
  };

  removeExecutedRequestsBeforeTime = (time: number): void => {
    const lastIdx = this.executedRequests.length - 1;
    let start: number = NaN;
    let req: Nullable<SegmentRequest> = null;

    // loop through the executed requests and remove the ones for which startTime is less than the given time
    for (let i = lastIdx; i >= 0; i -= 1) {
      req = this.executedRequests[i];
      start = req.startTime;
      if (!isNaN(start) && start < time) {
        this.removeExecutedRequest.call(this, req);
      }
    }
  };

  cancelPendingRequests = (): void => {
    if (this.pendingRequests.length) {
      for (let i = this.pendingRequests.length - 1; i >= 0; i--) {
        if (!this.pendingRequests[i].keep) {
          this.pendingRequests.splice(i, 1);
        }
      }
    }
  };

  clearAllRequests = (): void => {
    this.pendingRequests = [];
    this.abort.call(this);
    this.loadingRequests = [];
    this.executedRequests = [];
  };

  abortRequests = (_cancel: boolean = false): void => {
    const cancel: boolean = _cancel;

    if (cancel) {
      for (let i = 0; i < this.loadingRequests.length; i++) {
        this.loadingRequests[i].canceled = true;
      }
    }
    this.abort.call(this);
    this.loadingRequests = [];
  };

  abortRequestForTime = (time: number): void => {
    for (let i = 0; i < this.xhrs.length; i++) {
      if (this.xhrs[i].startTime == time) {
        let req: ExXMLHttpRequest | undefined = this.xhrs.splice(i, 1)[0];
        if (req.abort) req.abort();
        //req.abort();
        req = undefined;
        break;
      }
    }
  };

  setRestrictMultiLoad = (value: boolean): void => {
    this.restrictMultiLoad = value;
  };

  executeCurrentRequest = (): void => {
    const self = this;
    let currentRequest: SegmentRequest;
    if (this.pendingRequests.length === 0) return;

    if (this.loadingRequests.length >= this.LOADING_REQUEST_THRESHOLD) {
      // too many requests have been loading, do nothing until some of them are loaded or aborted
      return;
    }

    if (this.loadingRequests.length > 0 && this.restrictMultiLoad) {
      return;
    }

    // take the next request to execute and remove it from the list of pending requests
    currentRequest = this.pendingRequests.shift()!;

    switch (currentRequest.action) {
      case 'complete':
        // Stream has completed, execute the correspoinding callback
        this.executedRequests.push(currentRequest);
        this.streamEndCallback.call(this.context, currentRequest);
        break;
      case 'download':
        const level: Nullable<BufferLevelMetrics> =
          this.metrics.getCurrentBufferLevel();
        if (level) {
          currentRequest.bufferLevelAtStartDate = level.totalLevel!;
        }
        this.loadingRequests.push(currentRequest);
        this.loadCurrentFragment.call(self, currentRequest);
        break;
      default:
        this.NXDebug.log('Unknown request action.');
        if (currentRequest.loading) {
          currentRequest.loading = false;
        } else {
          this.errorLoadingCallback.call(this.context, '', currentRequest);
        }
    }
  };

  checkForExistence = (
    request: SegmentRequest,
    _callback: (d: ResponseData) => void
  ): void => {
    const callback = _callback;
    if (!request) {
      callback({
        status: 'ok',
        data: null,
      });
      return;
    }

    request.url = getRequestUrl.call(
      this,
      request.relativeURL!,
      request.baseURL[request.baseURLIdx].url!
    );
    const req: XMLHttpRequest = new XMLHttpRequest();
    let isSuccessful: boolean = false;

    req.open('HEAD', request.url, true);

    req.onload = () => {
      if (req.status < 200 || req.status > 299) {
        // eslint-disable-line no-empty
      } else {
        isSuccessful = true;

        callback({
          status: 'ok',
          data: request,
        });
      }
    };

    req.onloadend = req.onerror = () => {
      if (!isSuccessful) {
        callback({
          status: 'error',
          msg: 'checkForExistence error',
        });
      }
    };

    req.send();
  };
}
