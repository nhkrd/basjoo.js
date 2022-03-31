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
import { hasProperty } from '../core/Utils';
import { EventBus } from '../core/EventBus';
import ErrorHandler from '../core/ErrorHandler';
import LogHandler from '../core/LogHandler';
import TimelineConverter from './TimelineConverter';
import { Representation } from './Representation';
import { Period } from './Period';
import { BaseURL } from './ManifestModel';

/**
 * DashHandler
 *
 * @module DashHandler（DashHandlerモジュール）
 */

/**
 * Segment
 * @constructor
 */
export class Segment {
  indexRange: Nullable<number>;
  index: Nullable<number>;
  mediaRange: Nullable<string>;
  media: Nullable<string>;
  duration: number;
  replacementTime: Nullable<number>;
  replacementNumber: number;
  mediaStartTime: number;
  presentationStartTime: number;
  availabilityStartTime: Date | number;
  availabilityEndTime: Date | number;
  availabilityIdx: number;
  wallStartTime: Date | number;
  representation: Nullable<Representation>;
  timescale?: number;
  startTime?: number;

  constructor() {
    this.indexRange = null;
    this.index = null;
    this.mediaRange = null;
    this.media = null;
    this.duration = NaN;
    // this is the time that should be inserted into the media url
    this.replacementTime = null;
    // this is the number that should be inserted into the media url
    this.replacementNumber = NaN;
    // This is supposed to match the time encoded in the media Segment
    this.mediaStartTime = NaN;
    // When the source buffer timeOffset is set to MSETimeOffset this is the
    // time that will match the seekTarget and video.currentTime
    this.presentationStartTime = NaN;
    // Do not schedule this segment until
    this.availabilityStartTime = NaN;
    // Ignore and  discard this segment after
    this.availabilityEndTime = NaN;
    // The index of the segment inside the availability window
    this.availabilityIdx = NaN;
    // For dynamic mpd's, this is the wall clock time that the video
    // element currentTime should be presentationStartTime
    this.wallStartTime = NaN;
    this.representation = null;
  }
}

/**
 * SegmentRequest
 * @constructor
 */
export class SegmentRequest {
  action: string;
  startTime: number;
  streamType: Nullable<string>;
  type: Nullable<string>;
  duration: number;
  timescale: number;
  range: Nullable<string | number>;
  url: Nullable<string>;
  baseURL: Array<BaseURL>;
  baseURLIdx: number;
  relativeURL: Nullable<string>;
  requestStartTime: number;
  firstByteTime: number;
  requestEndTime: number;
  total: number;
  loaded: number;
  loading: boolean;
  keep: boolean;
  quality: number;
  index: number;
  size: number;
  code: Nullable<number>;
  bufferLevelAtStartDate: number;
  availabilityStartTime: Nullable<Date | number>;
  availabilityEndTime: Nullable<Date | number>;
  wallStartTime: Nullable<Date | number>;
  bandwidth: Nullable<number>;
  MSETimeOffset: number;
  periodIdx: number;
  pStart: number;
  adaptationIdx: number;
  representation?: Nullable<Representation>;
  canceled?: boolean;
  timeouttimerId?: Nullable<ReturnType<typeof setTimeout>>;
  offset?: number;
  rstime?: number;
  las?: boolean;
  aborted?: boolean;
  failedList?: Array<Array<number>>;

  constructor() {
    this.action = 'download';
    this.startTime = NaN;
    this.streamType = null;
    this.type = null;
    this.duration = NaN;
    this.timescale = NaN;
    this.range = null;
    this.url = null;
    this.baseURL = [];
    this.baseURLIdx = NaN;
    this.relativeURL = null;
    this.requestStartTime = NaN;
    this.firstByteTime = NaN;
    this.requestEndTime = NaN;
    this.total = NaN;
    this.loaded = NaN;
    this.loading = false;
    this.keep = false;
    this.quality = NaN;
    this.index = NaN;
    this.size = 0;
    this.code = null;
    this.bufferLevelAtStartDate = NaN;
    this.availabilityStartTime = null;
    this.availabilityEndTime = null;
    this.wallStartTime = null;
    this.bandwidth = null;
    this.MSETimeOffset = NaN;
    this.periodIdx = NaN;
    this.pStart = NaN;
    this.adaptationIdx = NaN;
  }
  ACTION_DOWNLOAD: string = 'download';
  ACTION_COMPLETE: string = 'complete';
}

const zeroPadToLength = (numStr: string, minStrLength: number): string => {
  while (numStr.length < minStrLength) {
    numStr = '0' + numStr;
  }

  return numStr;
};

const tmp64BitNumber = (high: number, low: number): number =>
  high * 4294967296 + low;

// const tmp64to32Bit = (num: number): { high: number; low: number } => {
//   const high: number = num / 4294967296;
//   const low = num & 0xffffffff;
//   return {
//     high,
//     low,
//   };
// };

const abortWrapper = (
  f: Promise<any>,
  c: ExXMLHttpRequest
): Promise<Response> =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      c.aborted = true;
      reject(new Error('abort'));
    }, 3000);
    f.then(resolve, reject);
  });

const getNumberForSegment = (
  segment: Segment,
  segmentIndex: number
): number => {
  return segment.representation!.startNumber! + segmentIndex;
};

const baseUrlIndex = (representation: Representation): number => {
  //const rnd= Math.floor(Math.random()*representation.BaseURL.length);
  //return rnd;
  const idx: number = representation.adaptation!!.period!.selectedBaseURLIdx;
  return isNaN(idx) ? 0 : idx;
};

/**
 * DashHandler
 * @constructor
 */
export class DashHandler {
  EPSILON: number;
  MIN_SEGSIZE_FORBASE: number;
  deleteUnnecessaryBox: boolean;
  epsilonVal: {
    video?: number;
    audio?: number;
  };
  requestStatus: {
    [type: string]: {
      requestedTime: Nullable<number>;
      index: number;
    };
  };
  isDynamic?: boolean;
  useFetch: boolean;
  commonQrys: Array<CommonQuery>;
  commonHdrs: Array<CommonHeader>;
  onPrepare: (data: {
    req: ExXMLHttpRequest;
    qrys: Array<CommonQuery>;
    hdrs: Array<CommonHeader>;
    xhr: ExXMLHttpRequest;
  }) => void;
  onSuccess: (data: {
    status: number;
    req: ExXMLHttpRequest;
    xhr: ExXMLHttpRequest;
  }) => void;
  onError: (data: {
    status: number;
    req: ExXMLHttpRequest;
    xhr: ExXMLHttpRequest;
  }) => void;
  NXDebug: Debug;
  eventBus: EventBus;
  errHandler = ErrorHandler;
  timelineConverter = TimelineConverter;
  logHandler = LogHandler;

  constructor(params: Paramstype, eventBus: EventBus, xhrCustom: XHRCustom) {
    //const EPSILON = 0.003,
    this.EPSILON = 0.2;
    this.MIN_SEGSIZE_FORBASE = params.MIN_SEGSIZE_FORBASE || NaN;
    this.deleteUnnecessaryBox = params.DELETE_UNNECESSARY_BOX || false;
    this.epsilonVal = {};
    this.requestStatus = {};
    this.useFetch = params.USE_FETCH && 'fetch' in window ? true : false;
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
    this.NXDebug = new Debug();
    this.eventBus = eventBus;
  }

  replaceTokenForTemplate = (
    url: string,
    token: string,
    value: string | number
  ): string => {
    let startPos: number = 0;
    let endPos: number = 0;
    const tokenLen: number = token.length;
    const formatTag: string = '%0';
    const formatTagLen: number = formatTag.length;
    let formatTagPos: number;
    let specifier: string;
    let width: number;
    let paddedValue: string | number;

    // keep looping round until all instances of <token> have been
    // replaced. once that has happened, startPos below will be -1
    // and the completed url will be returned.
    while (true) {
      // eslint-disable-line no-constant-condition

      // check if there is a valid $<token>...$ identifier
      // if not, return the url as is.
      startPos = url.indexOf('$' + token);
      if (startPos < 0) {
        return url;
      }

      // the next '$' must be the end of the identifer
      // if there isn't one, return the url as is.
      endPos = url.indexOf('$', startPos + tokenLen);
      if (endPos < 0) {
        return url;
      }

      // now see if there is an additional format tag suffixed to
      // the identifier within the enclosing '$' characters
      formatTagPos = url.indexOf(formatTag, startPos + tokenLen);
      if (formatTagPos > startPos && formatTagPos < endPos) {
        specifier = url.charAt(endPos - 1);
        width = parseInt(
          url.substring(formatTagPos + formatTagLen, endPos - 1),
          10
        );

        // support the minimum specifiers required by IEEE 1003.1
        // (d, i , o, u, x, and X) for completeness
        switch (specifier) {
          // treat all int types as uint,
          // hence deliberate fallthrough
          case 'd':
          case 'i':
          case 'u':
            paddedValue = zeroPadToLength(value.toString(), width);
            break;
          case 'x':
            paddedValue = zeroPadToLength(value.toString(16), width);
            break;
          case 'X':
            paddedValue = zeroPadToLength(
              value.toString(16),
              width
            ).toUpperCase();
            break;
          case 'o':
            paddedValue = zeroPadToLength(value.toString(8), width);
            break;
          default:
            this.NXDebug.log(
              'Unsupported/invalid IEEE 1003.1 format identifier string in URL'
            );
            return url;
        }
      } else {
        paddedValue = value;
      }

      url =
        url.substring(0, startPos) + paddedValue + url.substring(endPos + 1);
    }
  };

  //NSV-a const replaceNumberForTemplate = (url, value) => {
  //NSV-a   const v = value.toString();
  //NSV-a   return url.split('$Number$').join(v);
  //NSV-a };
  //NSV-a
  //NSV-a const replaceTimeForTemplate = (url, value) => {
  //NSV-a   const v = value.toString();
  //NSV-a   return url.split('$Time$').join(v);
  //NSV-a };
  //NSV-a
  //NSV-a const replaceBandwidthForTemplate = (url, value) => {
  //NSV-a   const v = value.toString();
  //NSV-a   return url.split('$Bandwidth$').join(v);
  //NSV-a };
  //NSV-a
  //NSV-a const replaceIDForTemplate = (url, value) => {
  //NSV-a   if (value === null || url.indexOf('$RepresentationID$') === -1) {
  //NSV-a     return url;
  //NSV-a   }
  //NSV-a   const v = value.toString();
  //NSV-a   return url.split('$RepresentationID$').join(v);
  //NSV-a };

  //NSV-a const getRequestUrl = (destination, baseURL) => {
  //NSV-a   let url;
  //NSV-a   if (destination === baseURL) {
  //NSV-a     url = destination;
  //NSV-a   } else if (
  //NSV-a     destination.indexOf('http://') !== -1 ||
  //NSV-a     destination.indexOf('https://') !== -1
  //NSV-a   ) {
  //NSV-a     url = destination;
  //NSV-a   } else {
  //NSV-a     url = baseURL + destination;
  //NSV-a   }
  //NSV-a   return url;
  //NSV-a };

  getInitRequestUrl = (
    destination: Nullable<string>,
    representation: Representation,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (d: ResponseData) => void = _callback || (() => {});

    const baseURL: string =
      representation.BaseURL[baseUrlIndex.call(this, representation)].url!;

    let url: string;

    if (destination !== null) {
      if (destination === baseURL) {
        url = destination;
      } else if (
        destination.indexOf('http://') !== -1 ||
        destination.indexOf('https://') !== -1
      ) {
        url = destination;
      } else {
        url = baseURL + destination;
      }
      callback({
        status: 'ok',
        data: url,
      });
    } else {
      this.loadInitialization.call(self, baseURL, (d) => {
        if (d.status === 'ok') {
          representation.range = d.data;
          representation.initialization = baseURL;
          callback({
            status: 'ok',
            data: baseURL,
          });
        } else {
          callback({
            status: 'error',
            msg: 'loadInitialization error',
          });
        }
      });
    }
  };

  generateInitRequest = (
    representation: Representation,
    streamType: string
  ): SegmentRequest => {
    let period: Period;
    const request: SegmentRequest = new SegmentRequest();
    let presentationStartTime: number;

    period = representation.adaptation!.period!;

    request.streamType = streamType;
    request.type = 'Initialization Segment';
    request.baseURLIdx = baseUrlIndex.call(this, representation);
    request.baseURL = representation.BaseURL;
    request.relativeURL = representation.initialization;
    request.range = representation.range;
    request.MSETimeOffset =
      period.offset - representation.presentationTimeOffset!;
    presentationStartTime = period.start;
    request.availabilityStartTime =
      this.timelineConverter.calcAvailabilityStartTimeFromPresentationTime(
        presentationStartTime,
        representation.adaptation!.period!.mpd!,
        this.isDynamic!
      );
    request.availabilityEndTime =
      this.timelineConverter.calcAvailabilityEndTimeFromPresentationTime(
        presentationStartTime + period.duration,
        period.mpd!,
        this.isDynamic!
      );
    request.quality = representation.index;

    request.periodIdx = period.index;
    request.pStart = period.start;
    request.adaptationIdx = representation.adaptation!.index;
    request.representation = representation;

    return request;
  };

  getInit = (
    representation: Representation,
    type: string,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    let request: Nullable<SegmentRequest> = null;
    let url: Nullable<string> = null;
    const self = this;

    if (!representation) {
      callback({
        status: 'error',
        msg: ' no representation',
      });
    }

    if (representation.initialization) {
      request = this.generateInitRequest.call(self, representation, type);
      callback({
        status: 'ok',
        data: request,
      });
    } else {
      url = representation.BaseURL[baseUrlIndex.call(this, representation)].url;
      this.loadInitialization.call(self, url!, (d) => {
        if (d.status === 'ok') {
          representation.range = d.data;
          representation.initialization = url;
          request = this.generateInitRequest.call(self, representation, type);
          callback({
            status: 'ok',
            data: request,
          });
        } else {
          callback({
            status: 'error',
            msg: d.msg,
          });
        }
      });
    }
  };

  isMediaFinished = (
    representation: Representation,
    index: number
  ): boolean => {
    let sDuration: number;
    const period: Period = representation.adaptation!.period!;
    const periodLen: number =
      representation.adaptation!.period!.mpd!.periods.length;
    let isFinished: boolean = false;
    let seg: Nullable<Segment>;
    let fTime: number;
    if (this.isDynamic && period.index == periodLen - 1) {
      isFinished = false;
    } else {
      if (index < 0) {
        isFinished = false;
      } else if (index < representation.availableSegmentsNumber) {
        seg = this.getSegmentByIndex(index, representation);
        if (seg) {
          fTime =
            seg.presentationStartTime -
            (period.start + period.mpd!.timestampOffsetFor32bitVE);
          sDuration = representation.adaptation!.period!.duration;
          this.NXDebug.debug(
            '[' +
              representation.adaptation!.type +
              '] ' +
              representation.segmentInfoType +
              ': ' +
              fTime +
              ' / ' +
              sDuration
          );
          isFinished = fTime >= sDuration;
        }
      } else {
        isFinished = true;
      }
    }
    return isFinished;
  };

  getIndexBasedSegment = (
    representation: Representation,
    index: number
  ): Segment => {
    const seg: Segment = new Segment();
    const duration: number = representation.segmentDuration;
    let presentationStartTime: number =
      representation.adaptation!.period!.start + index * duration;
    let presentationEndTime: number = presentationStartTime + duration;

    seg.representation = representation;
    seg.duration = duration;

    seg.presentationStartTime =
      presentationStartTime > 0 ? presentationStartTime : 0;

    seg.mediaStartTime =
      this.timelineConverter.calcMediaTimeFromPresentationTime(
        seg.presentationStartTime,
        representation
      );

    seg.availabilityStartTime =
      this.timelineConverter.calcAvailabilityStartTimeFromPresentationTime(
        seg.presentationStartTime,
        representation.adaptation!.period!.mpd!,
        this.isDynamic!
      );
    seg.availabilityEndTime =
      this.timelineConverter.calcAvailabilityEndTimeFromPresentationTime(
        presentationEndTime,
        representation.adaptation!.period!.mpd!,
        this.isDynamic!
      );

    seg.wallStartTime = this.timelineConverter.calcWallTimeForSegment(
      seg,
      this.isDynamic!
    );

    seg.replacementNumber = getNumberForSegment(seg, index);
    seg.availabilityIdx = index;

    return seg;
  };

  /* istanbul ignore next */
  getSegmentsFromTimeline = (
    representation: Representation,
    _callback: (res: ResponseData) => void
  ): void => {
    const self = this;
    const callback: (res: ResponseData) => void = _callback || (() => {});
    const isTemplate: boolean = representation.SegmentTemplate != null;
    let timeline: SegmentTimeline;
    let tmedia: string;
    let list: Array<SegmentURL>;

    const isAvailableSegmentNumberCalculated: boolean =
      representation.availableSegmentsNumber > 0;

    const segments: Array<Segment> = [];
    let fragments: Array<Fragment>;
    let frag: Fragment | undefined;
    let j: number;
    let repeat: number;
    let repeatEndTime: number;
    let nextFrag: Fragment;
    let time: number = 0;
    let availabilityIdx: number = -1;
    let calculatedRange: Nullable<TimeRange>;
    let hasEnoughSegments: boolean | undefined;
    let startIdx: number | undefined;
    let endIdx: number | undefined;
    let fTimescale: number;

    const createSegment = (s: Fragment): Segment => {
      const media: string = isTemplate ? tmedia : list[availabilityIdx].media!;
      return this.getTimeBasedSegment.call(
        self,
        representation,
        time,
        s.d!,
        fTimescale,
        media,
        s.mediaRange!,
        availabilityIdx
      );
    };

    if (isTemplate) {
      timeline = representation.SegmentTemplate!.SegmentTimeline!;
      tmedia = representation.SegmentTemplate!.media!;
    } else {
      timeline = representation.SegmentList!.SegmentTimeline!;
      list = representation.SegmentList!.SegmentURLs!;
    }

    fTimescale = representation.timescale;

    fragments = timeline.S!;
    calculatedRange = this.decideSegmentListRangeForTimeline.call(
      self,
      representation
    );
    if (calculatedRange) {
      startIdx = calculatedRange.start;
      endIdx = calculatedRange.end;
    } else {
      //
    }

    for (let i = 0, len = fragments.length; i < len; i += 1) {
      frag = fragments[i];
      if (frag.d === 0) {
        continue;
      }
      repeat = 0;
      if (frag.r != null) {
        repeat = frag.r;
      }

      //For a repeated S element, t belongs only to the first segment
      if (frag.t != null) {
        time = frag.t;
      }

      //This is a special case: "A negative value of the @r attribute of the S element indicates that the duration indicated in @d attribute repeats until the start of the next S element, the end of the Period or until the
      // next MPD update."
      if (repeat < 0) {
        nextFrag = fragments[i + 1];
        repeatEndTime =
          nextFrag && nextFrag.t != null
            ? nextFrag.t / fTimescale
            : representation.adaptation!.period!.duration;
        repeat =
          Math.ceil(
            (repeatEndTime - time / fTimescale) / (frag.d! / fTimescale)
          ) - 1;
      }

      // if we have enough segments in the list, but we have not calculated the total number of the segments yet we
      // should continue the loop and calc the number. Once it is calculated, we can break the loop.
      if (hasEnoughSegments) {
        if (isAvailableSegmentNumberCalculated) break;
        availabilityIdx += repeat + 1;
        continue;
      }

      for (j = 0; j <= repeat; j += 1) {
        availabilityIdx += 1;

        if (calculatedRange) {
          if (availabilityIdx > endIdx!) {
            hasEnoughSegments = true;
            if (isAvailableSegmentNumberCalculated) break;
            continue;
          }

          if (availabilityIdx >= startIdx!) {
            segments.push(createSegment.call(self, frag));
          }
        } else {
          segments.push(createSegment.call(self, frag));
        }

        time += frag.d!;
      }
    }

    if (!isAvailableSegmentNumberCalculated) {
      const f: Fragment = fragments[0];
      const availabilityStartTime: number =
        this.timelineConverter.calcPresentationTimeFromMediaTime(
          f.t! / fTimescale,
          representation
        );
      const availabilityEndTime: number =
        this.timelineConverter.calcPresentationTimeFromMediaTime(
          (time - frag!.d!) / fTimescale,
          representation
        );

      representation.segmentAvailabilityRange = {
        start: availabilityStartTime,
        end: availabilityEndTime,
      };
      representation.availableSegmentsNumber = availabilityIdx + 1;
    }

    callback({
      status: 'ok',
      data: segments,
    });
  };

  getSegmentsFromTemplate = (
    representation: Representation,
    _callback: (res: ResponseData) => void
  ): void => {
    let segments: Array<Segment> = [];
    const self = this;
    const callback: (res: ResponseData) => void = _callback || (() => {});
    const template: SegmentTemplate = representation.SegmentTemplate!;
    let segmentRange: Nullable<TimeRange> = null;
    const curSegments: Nullable<Array<Segment>> = representation.segments;
    let startIdx: number;
    let endIdx: number;
    let seg: Nullable<Segment> = null;
    let start: number;
    let url: Nullable<string> = null;

    start = representation.startNumber!;
    this.waitForAvailabilityWindow.call(
      self,
      representation,
      (availabilityWindow) => {
        representation.segmentAvailabilityRange = availabilityWindow;
        segmentRange = this.decideSegmentListRangeForTemplate.call(
          self,
          representation
        );

        startIdx = segmentRange.start;
        endIdx = segmentRange.end;
        if (curSegments != null) {
          let rmIdx: number = 0;
          for (let i = 0; i < curSegments.length; i++) {
            if (startIdx <= curSegments[i].availabilityIdx) {
              rmIdx = i;
              break;
            }
          }
          if (rmIdx > 0) {
            for (let i = 0; i < rmIdx; i++) {
              curSegments.splice(0, rmIdx - 1);
            }
          }

          segments = curSegments;
          if (segments.length > 0) {
            startIdx = segments[segments.length - 1].availabilityIdx + 1;
          }
        }

        for (let i = startIdx; i < endIdx; i += 1) {
          seg = this.getIndexBasedSegment.call(self, representation, i);
          seg.replacementTime =
            (start + i - 1) * representation.segmentDuration;
          url = template.media!;
          //url = replaceTokenForTemplate(url, "Number", seg.replacementNumber);
          //url = replaceTokenForTemplate(url, "Time", seg.replacementTime);
          seg.media = url;
          segments.push(seg);
          seg = null;
        }

        representation.availableSegmentsNumber = endIdx;
        callback({
          status: 'ok',
          data: segments,
        });
      }
    );
  };

  decideSegmentListRangeForTemplate = (
    representation: Representation
  ): TimeRange => {
    const duration: number = representation.segmentDuration;
    const availabilityWindow: Nullable<TimeRange> =
      representation.segmentAvailabilityRange;
    const currentSegmentList = representation.segments;
    let period: Nullable<Period> = representation!.adaptation!.period!;
    let start: number;
    let end: number;
    let range: TimeRange;
    if (this.isDynamic) {
      start = Math.floor(
        (availabilityWindow!.start - period!.start) / duration
      );
      end = Math.ceil((availabilityWindow!.end - period!.start) / duration);
      range = {
        start,
        end,
      };
      return range;
    }

    //NSV-a Check This part should be reviewed .
    if (currentSegmentList) {
      //
    } else {
      //
    }

    start = Math.floor((availabilityWindow!.start - period!.start) / duration);
    end = Math.ceil((availabilityWindow!.end - period!.start) / duration);

    range = {
      start,
      end,
    };

    return range;
  };

  decideSegmentListRangeForTimeline = (
    representation: Representation
  ): Nullable<TimeRange> => {
    let originAvailabilityIdx: number = NaN;
    const currentSegmentList: Nullable<Array<Segment>> =
      representation.segments;
    const availabilityLowerLimit: number = 10;
    const availabilityUpperLimit: number = 10;
    const firstIdx: number = 0;
    const lastIdx: number = Number.POSITIVE_INFINITY;
    let start: number;
    let end: number;
    let range: TimeRange;
    const index = this.requestStatus[representation.adaptation!.type!]!.index;
    if (this.isDynamic) {
      range = {
        start: firstIdx,
        end: lastIdx,
      };
      return range;
    }
    if (
      !this.isDynamic &&
      this.requestStatus[representation.adaptation!.type!]!.requestedTime
    )
      return null;

    if (currentSegmentList) {
      if (index < 0) return null;
      originAvailabilityIdx = index;
    } else {
      originAvailabilityIdx =
        index >= 0 ? index : this.isDynamic ? lastIdx : firstIdx;
    }

    // この if は通らない。
    /* istanbul ignore if */
    if (this.isDynamic) {
      start = Math.max(
        originAvailabilityIdx - availabilityLowerLimit,
        firstIdx
      );
      end = Math.min(originAvailabilityIdx + availabilityUpperLimit, lastIdx);
    } else {
      start = firstIdx;
      end = lastIdx;
    }

    range = {
      start,
      end,
    };

    return range;
  };

  waitForAvailabilityWindow = (
    representation: Representation,
    _callback: (range: TimeRange) => void
  ): void => {
    const callback: (range: TimeRange) => void = _callback || (() => {});
    let range: TimeRange;
    let waitingTime: number;

    const getRange = (): void => {
      range = this.timelineConverter.calcSegmentAvailabilityRange(
        representation,
        this.isDynamic!
      );
      if (range.end > 0) {
        callback(range);
      } else {
        waitingTime = Math.abs(range.end) * 1000;
        setTimeout(getRange, waitingTime);
      }
    };

    getRange();
  };

  getTimeBasedSegment = (
    representation: Representation,
    time: number,
    duration: number,
    fTimescale: number,
    url: string,
    range: Nullable<string>,
    index: number
  ): Segment => {
    const scaledTime: number = time / fTimescale;

    //const scaledDuration = Math.min(duration / fTimescale, representation.adaptation.period.mpd.maxSegmentDuration);
    const scaledDuration: number = duration / fTimescale;

    const presentationStartTime: number =
      this.timelineConverter.calcPresentationTimeFromMediaTime(
        scaledTime,
        representation
      );
    const presentationEndTime: number = presentationStartTime + scaledDuration;
    const seg: Segment = new Segment();

    seg.representation = representation;
    seg.duration = scaledDuration;
    seg.mediaStartTime = scaledTime;
    seg.presentationStartTime = presentationStartTime;

    // For SegmentTimeline every segment is available at mpdLoadedTime
    seg.availabilityStartTime =
      representation.adaptation!.period!.mpd!.manifest!.mpdLoadedTime!;
    //seg.availabilityEndTime = self.timelineConverter.calcAvailabilityEndTimeFromPresentationTime(presentationEndTime, representation.adaptation.period.mpd, isDynamic);
    seg.availabilityEndTime =
      this.timelineConverter.calcAvailabilityEndTimeFromPresentationTime(
        presentationEndTime,
        representation.adaptation!.period!.mpd!,
        this.isDynamic!
      );

    // at this wall clock time, the video element currentTime should be seg.presentationStartTime
    seg.wallStartTime = this.timelineConverter.calcWallTimeForSegment(
      seg,
      this.isDynamic!
    );

    seg.replacementTime = time;

    seg.replacementNumber = getNumberForSegment(seg, index);

    seg.timescale = fTimescale;
    //url = replaceTokenForTemplate(url, "Number", seg.replacementNumber);
    //url = replaceTokenForTemplate(url, "Time", seg.replacementTime);

    seg.media = url;
    seg.mediaRange = range;
    seg.availabilityIdx = index;

    return seg;
  };

  getSegmentsFromList = (
    representation: Representation,
    _callback: (res: ResponseData) => void
  ): void => {
    const self = this;
    const segments: Array<Segment> = [];
    const callback: (res: ResponseData) => void = _callback || (() => {});
    const list: SegmentList = representation.SegmentList!;
    const len: number = list.SegmentURLs!.length;
    let seg: Nullable<Segment>;
    let s: SegmentURL;
    let range: TimeRange;
    let startIdx: number;
    //let endIdx: number;
    let start: number;

    start = representation.startNumber!;

    this.waitForAvailabilityWindow.call(
      self,
      representation,
      (availabilityWindow) => {
        representation.segmentAvailabilityRange = availabilityWindow;
        range = this.decideSegmentListRangeForTemplate.call(
          self,
          representation
        );
        startIdx = range.start;
        //endIdx = range.end;

        for (let i = 0; i < len; i += 1) {
          s = list.SegmentURLs![i];

          seg = this.getIndexBasedSegment.call(
            self,
            representation,
            start + i - 1
          );

          seg.replacementTime =
            (start + i - 1) * representation.segmentDuration;
          seg.media = s.media;
          seg.mediaRange = s.mediaRange;
          seg.index = s.index;
          seg.indexRange = s.indexRange;

          segments.push(seg);
          seg = null;
        }
        representation.availableSegmentsNumber = len - startIdx;
        callback({
          status: 'ok',
          data: segments,
        });
      }
    );
  };

  getSegmentsFromSource = (
    representation: Representation,
    _callback: (res: ResponseData) => void
  ): void => {
    const self = this;

    const baseURL: string =
      representation.BaseURL[baseUrlIndex.call(this, representation)].url!;

    const callback: (res: ResponseData) => void = _callback || (() => {});
    const segments: Array<Segment> = [];
    let count: number = 0;
    let range: Nullable<string> = null;
    let s: Segment;
    let len: number;
    let seg: Nullable<Segment>;
    if (representation.indexRange) {
      range = representation.indexRange;
    }

    this.loadSegments.call(self, baseURL, range, (d: ResponseData) => {
      if (d.status === 'ok') {
        const fragments: Array<Segment> = d.data;
        for (let i = 0, len = fragments.length; i < len; i += 1) {
          s = fragments[i];

          seg = this.getTimeBasedSegment.call(
            self,
            representation,
            s.startTime!,
            s.duration,
            s.timescale!,
            s.media!,
            s.mediaRange,
            count
          );

          if (seg.presentationStartTime >= 0) {
            segments.push(seg);
          } else {
            // eslint-disable-line no-empty
          }
          seg = null;
          count += 1;
        }
        len = segments.length;
        representation.segmentAvailabilityRange = {
          start: segments[0].presentationStartTime,
          end: segments[len - 1].presentationStartTime,
        };
        representation.availableSegmentsNumber = len;
        callback({
          status: 'ok',
          data: segments,
        });
      } else {
        callback({
          status: 'error',
          msg: d.msg,
        });
      }
    });
  };

  /* istanbul ignore next */
  getSegments = (
    representation: Representation,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    const self = this;
    // Already figure out the segments.
    if (!this.isSegmentListUpdateRequired.call(self, representation)) {
      callback({
        status: 'ok',
        data: representation.segments,
      });
    } else {
      const segmentsCallback = (d: ResponseData): void => {
        if (d.status === 'ok') {
          const segments: Array<Segment> = d.data;

          representation.segments = segments;
          if (segments.length > 0) {
            representation.indexOffset = segments[0].availabilityIdx;
          }

          if (!this.isDynamic) {
            representation.lastRequestIndex = segments.length - 1;
          } else {
            const period: Period = representation.adaptation!.period!;
            const periods: Array<Period> = period.mpd!.periods;
            let liveEdgeS: number = NaN;
            let liveEdge: number = NaN;
            let updateRequired: boolean = false;
            if (period.start == periods[0].start) {
              if (segments.length > 0) {
                if (isNaN(period.mpd!.liveEdgeS)) {
                  liveEdgeS = segments[0].presentationStartTime;
                  updateRequired = true;
                } else {
                  if (
                    period.mpd!.liveEdgeS < segments[0].presentationStartTime
                  ) {
                    liveEdgeS = segments[0].presentationStartTime;
                    updateRequired = true;
                  }
                }
              } else {
                updateRequired = false;
              }
            }
            if (period.start == periods[periods.length - 1].start) {
              let edge: number;
              if (segments.length > 0) {
                edge =
                  segments[segments.length - 1].presentationStartTime +
                  segments[segments.length - 1].duration;
              } else {
                edge = period.start;
              }
              if (representation.segmentInfoType == 'SegmentTemplate') {
                edge = representation!.segmentAvailabilityRange!.now!;
              }
              if (isNaN(period.mpd!.liveEdge)) {
                liveEdge = edge;
                updateRequired = true;
              } else {
                if (period.mpd!.liveEdge < edge) {
                  liveEdge = edge;
                  updateRequired = true;
                }
              }
            }
            if (updateRequired)
              this.updateLiveEdge.call(self, period, liveEdgeS, liveEdge);
          }
          callback({
            status: 'ok',
            data: segments,
          });
        } else {
          callback({
            status: 'error',
            msg: 'getSegments null',
          });
        }
      };
      if (representation.segmentInfoType === 'SegmentTimeline') {
        this.getSegmentsFromTimeline.call(
          self,
          representation,
          segmentsCallback
        );
      } else if (representation.segmentInfoType === 'SegmentTemplate') {
        this.getSegmentsFromTemplate.call(
          self,
          representation,
          segmentsCallback
        );
      } else if (representation.segmentInfoType === 'SegmentList') {
        this.getSegmentsFromList.call(self, representation, segmentsCallback);
      } else {
        this.getSegmentsFromSource.call(self, representation, segmentsCallback);
      }
    }
  };

  //liveMulti
  updateLiveEdge = (period: Period, s: number, e: number): void => {
    let liveEdgeSUpdated: boolean = false;
    let liveEdgeEUpdated: boolean = false;
    if (!isNaN(s)) {
      period.mpd!.liveEdgeS = s;
      liveEdgeSUpdated = true;
    }
    if (!isNaN(e)) {
      period.mpd!.liveEdge = e;
      liveEdgeEUpdated = true;
      period.mpd!.liveEdgeE = Math.max(
        period.mpd!.liveEdge - period.mpd!.suggestedPresentationDelay!,
        !isNaN(period.mpd!.liveEdgeS) ? period.mpd!.liveEdgeS : 0
      );
    }

    this.eventBus.dispatchEvent({
      type: 'liveEdgeUpdated',
      data: {
        liveEdgeS: period.mpd!.liveEdgeS,
        liveEdgeE: period.mpd!.liveEdgeE,
        liveEdge: period.mpd!.liveEdge,
        liveEdgeSUpdated,
        liveEdgeEUpdated,
        targetLatency: period.mpd!.suggestedPresentationDelay,
      },
    });
  };

  /* istanbul ignore next */
  updateForLiveEdgeMPD = (type: string, period): void => {
    const self = this;
    const periods: Array<Period> = period.mpd.periods;
    const sp: Period = periods[0];
    const ep: Period = periods[periods.length - 1];
    const sr: Representation = sp
      .getPrimaryMediaData(type)!
      .getRepresentations()[0];
    const er: Representation = ep
      .getPrimaryMediaData(type)!
      .getRepresentations()[0];
    this.getSegments.call(self, sr, (d: ResponseData) => {
      d; //dummy
      if (sp.start != ep.start) {
        this.getSegments.call(self, er, (f: ResponseData) => {
          f;
        });
      }
    });
  };

  //NSV-a //liveMulti
  //NSV-a const updateLiveEdgeForPeriod = representation => {
  //NSV-a     const lastIdx = representation.segments.length - 1;
  //NSV-a
  //NSV-a     let edge =
  //NSV-a       representation.segments[lastIdx].presentationStartTime +
  //NSV-a       representation.segments[lastIdx].duration;
  //NSV-a
  //NSV-a     const start = representation.segments[0].presentationStartTime;
  //NSV-a
  //NSV-a     if (!isNaN(representation.adaptation.period.end)) {
  //NSV-a       edge = Math.min(representation.adaptation.period.end, edge);
  //NSV-a     }
  //NSV-a
  //NSV-a     if (isDynamic) {
  //NSV-a       if (isNaN(representation.adaptation.period.liveEdge)) {
  //NSV-a         representation.adaptation.period.liveEdge = edge;
  //NSV-a       } else {
  //NSV-a         if (edge < representation.adaptation.period.liveEdge) {
  //NSV-a           representation.adaptation.period.liveEdge = edge;
  //NSV-a         }
  //NSV-a       }
  //NSV-a       if (isNaN(representation.adaptation.period.liveEdgeS)) {
  //NSV-a         representation.adaptation.period.liveEdgeS = start;
  //NSV-a       } else {
  //NSV-a         if (representation.adaptation.period.liveEdgeS < start) {
  //NSV-a           representation.adaptation.period.liveEdgeS = start;
  //NSV-a         }
  //NSV-a       }
  //NSV-a     }
  //NSV-a   };

  updateSegmentList = (
    representation: Representation,
    _callback: (res: ResponseData) => void
  ): void => {
    const self = this;
    let segment: Nullable<Segment>;
    let ctime: number = -1;
    let currentIdx: number =
      this.requestStatus[representation.adaptation!.type!]!.index;
    const periods: Array<Period> =
      representation.adaptation!.period!.mpd!.periods;
    const periodIdx: number = representation.adaptation!.period!.index;
    const callback: (res: ResponseData) => void = _callback || (() => {});

    if (this.isDynamic && periodIdx == periods.length - 1) {
      if (
        representation.segments != null &&
        representation.segments.length > 0 &&
        currentIdx >= 0
      ) {
        representation.indexOffset = representation.segments[0].availabilityIdx;
        while (currentIdx > 0) {
          segment = this.getSegmentByIndex(currentIdx, representation);
          if (segment != null) {
            ctime = segment.presentationStartTime;
            break;
          } else {
            currentIdx--;
          }
        }
      } else {
        ctime = -1;
      }
    }
    representation.segments = null;

    if (this.isDynamic && ctime >= 0) {
      this.getSegments.call(self, representation, (d) => {
        if (d.status === 'ok') {
          representation.segments = d.data;
          this.requestStatus[representation.adaptation!.type!]!.index =
            this.getIndexForSegments.call(self, ctime, representation);
          this.requestStatus[representation.adaptation!.type!]!.requestedTime =
            ctime;
          this.NXDebug.debug(
            '[' +
              representation.adaptation!.type +
              '] index:' +
              this.requestStatus[representation.adaptation!.type!].index +
              ', ' +
              this.requestStatus[representation.adaptation!.type!]
                .requestedTime +
              '  ***** update index *****'
          );

          callback({
            status: 'ok',
            data: ctime,
          });
        } else {
          this.NXDebug.debug('ERROR:' + d.msg);
          ctime = -1;
          this.requestStatus[representation.adaptation!.type!] = {
            index: -1,
            requestedTime: null,
          };
          callback({
            status: 'error',
            msg: d.msg,
          });
        }
      });
    } else {
      this.getSegments.call(self, representation, (d) => {
        if (d.status === 'ok') {
          representation.segments = d.data;
          this.requestStatus[representation.adaptation!.type!] = {
            index: -1,
            requestedTime: null,
          };
          callback({
            status: 'ok',
            data: ctime,
          });
        } else {
          this.NXDebug.debug('ERROR:' + d.msg);
          ctime = -1;
          callback({
            status: 'error',
            msg: d.msg,
          });
        }
      });
    }
  };

  getIndexForSegments = (
    time: number,
    representation: Representation
  ): number => {
    const segments: Nullable<Array<Segment>> = representation.segments;
    const segmentLastIdx: number = segments!.length - 1;
    let idx: number = -1;
    let frag: Segment;
    let ft: number;
    let fd: number;
    const epsilon: number = this.epsilonVal[representation.adaptation!.type!];

    if (segments && segments.length > 0) {
      for (let i = segmentLastIdx; i >= 0; i--) {
        frag = segments[i];
        ft = frag.presentationStartTime;
        fd = frag.duration;

        if (time + epsilon >= ft && time - epsilon <= ft + fd) {
          idx = frag.availabilityIdx;
          break;
        }
      }

      if (idx === -1) {
        for (let i = segmentLastIdx; i >= 0; i--) {
          frag = segments[i];
          ft = frag.presentationStartTime;
          fd = frag.duration;
          if (time + this.EPSILON >= ft && time - this.EPSILON <= ft + fd) {
            idx = frag.availabilityIdx;
            break;
          } else if (i == segmentLastIdx && time - this.EPSILON > ft + fd) {
            idx = segmentLastIdx;
          }
        }
      }
    }

    if (idx === -1) {
      if (!isNaN(representation.segmentDuration)) {
        idx = Math.floor(time / representation.segmentDuration);
        this.NXDebug.debug(
          '#?#?#? idx: ' +
            idx +
            ' : ' +
            time +
            '/' +
            representation.segmentDuration
        );
        /*
          for(let i=0;i<segments.length;i++){
              NXDebug.debug("["+i+"] st:"+segments[i].presentationStartTime+"dur:"+segments[i].duration);
          }
        */
      } else {
        this.NXDebug.debug(
          "Couldn't figure out a time! " + representation.adaptation!.type
        );
        this.NXDebug.debug('Time: ' + time);
      }
    }
    return idx;
  };

  getSegmentByIndex = (
    index: number,
    representation: Representation
  ): Nullable<Segment> => {
    if (!representation || !representation.segments) return null;

    const ln: number = representation.segments.length;
    let seg: Segment;
    const targetIdx: number =
      index - representation.segments[0].availabilityIdx;
    if (targetIdx > -1 && targetIdx < ln) {
      if (representation.segments[targetIdx].availabilityIdx === index) {
        return representation.segments[targetIdx];
      } else {
        // eslint-disable-line no-empty
      }
    } else {
      return null;
    }

    for (let i = 0; i < ln; i += 1) {
      seg = representation.segments[i];

      if (seg.availabilityIdx === index) {
        return seg;
      }
    }

    return null;
  };

  isSegmentListUpdateRequired = (representation: Representation): boolean => {
    let updateRequired: boolean = false;
    const segments: Nullable<Array<Segment>> = representation.segments;
    const index: number =
      this.requestStatus[representation.adaptation!.type!].index;
    if (!segments) {
      updateRequired = true;
    } else if (
      this.isDynamic &&
      representation.segmentInfoType === 'SegmentTemplate'
    ) {
      updateRequired = true;
    } else if (index === -1) {
      updateRequired = false;
    } else {
      updateRequired = false;
    }

    return updateRequired;
  };

  getRequestForSegment = (
    segment: Nullable<Segment>,
    type: string
  ): Nullable<SegmentRequest> => {
    if (segment === null || segment === undefined) {
      return null;
    }

    const request: SegmentRequest = new SegmentRequest();
    const representation: Nullable<Representation> = segment.representation;
    const bandwidth: number = representation!.bandwidth!;
    const baseURLIdx: number = baseUrlIndex.call(this, representation!);
    let relativeURL: Nullable<string> = segment.media;

    const tokens: Array<{
      name: string;
      value: Nullable<number | string>;
    }> = [
      {
        name: 'Number',
        value: segment.replacementNumber,
      },
      {
        name: 'Time',
        value: segment.replacementTime,
      },
      {
        name: 'Bandwidth',
        value: bandwidth,
      },
      {
        name: 'RepresentationID',
        value: representation!.id,
      },
    ];

    tokens.forEach((token) => {
      relativeURL = this.replaceTokenForTemplate(
        relativeURL!,
        token.name,
        token.value!
      );
    });
    request.streamType = type;
    request.type = 'Media Segment';
    request.relativeURL = relativeURL;
    request.baseURL = representation!.BaseURL;
    request.baseURLIdx = baseURLIdx;
    request.range = segment.mediaRange;
    request.startTime = segment.presentationStartTime;
    request.duration = segment.duration;
    request.timescale = segment.timescale || representation!.timescale;
    request.availabilityStartTime = segment.availabilityStartTime;
    request.availabilityEndTime = segment.availabilityEndTime;
    request.wallStartTime = segment.wallStartTime;
    request.quality = representation!.index;
    request.index = segment.availabilityIdx;
    request.bandwidth = representation!.bandwidth!;

    request.periodIdx = representation!.adaptation!.period!.index;
    request.pStart = representation!.adaptation!.period!.start;
    request.adaptationIdx = representation!.adaptation!.index;
    request.representation = representation;

    request.MSETimeOffset =
      representation!.adaptation!.period!.offset -
      representation!.presentationTimeOffset!;
    return request;
  };

  getForTime = (
    representation: Nullable<Representation> | undefined,
    time: number,
    type: string,
    _loc: any,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    let request: Nullable<SegmentRequest>;
    let segment: Nullable<Segment>;
    const dIdx: DIdx = {};
    const self = this;
    if (!representation) {
      callback({
        status: 'error',
        msg: 'no representation',
      });
      return;
    }

    this.requestStatus[type].requestedTime = time;

    this.NXDebug.debug('[' + type + '] Getting the request for time: ' + time);
    this.getSegments.call(self, representation, (d) => {
      if (d.status === 'ok') {
        this.requestStatus[type].index = this.getIndexForSegments.call(
          self,
          time,
          representation
        );
        dIdx[type] = this.requestStatus[type].index;
        if (this.isMediaFinished.call(self, representation, dIdx[type])) {
          request = new SegmentRequest();
          request.action = request.ACTION_COMPLETE;
          request.index = dIdx[type];
          request.MSETimeOffset =
            representation.adaptation!.period!.offset -
            representation.presentationTimeOffset!;

          request.periodIdx = representation.adaptation!.period!.index;
          request.pStart = representation.adaptation!.period!.start;
          request.adaptationIdx = representation.adaptation!.index;
          request.representation = representation;

          this.NXDebug.log(
            '[' + type + '] Signal complete. period:' + request.periodIdx
          );
          callback({
            status: 'ok',
            data: request,
          });
        } else {
          segment = this.getSegmentByIndex(dIdx[type], representation);
          request = this.getRequestForSegment.call(self, segment, type);
          callback({
            status: 'ok',
            data: request,
            time,
          });
        }
      } else {
        this.NXDebug.debug('ERROR:' + d.msg);
        callback({
          status: 'error',
          msg: d.msg,
        });
      }
    });
  };

  // setIndexForTime = (
  //   representation: Representation,
  //   time: number,
  //   type: string
  // ): void => {
  //   let newIndex: number = -1;
  //   const self = this;

  //   this.requestStatus[type].requestedTime = time;

  //   newIndex = this.getIndexForSegments.call(self, time, representation);
  //   if (newIndex != -1) {
  //     this.requestStatus[type].index = newIndex;
  //   } else {
  //     if (time < representation.segmentAvailabilityRange!.start) {
  //       this.requestStatus[type].index = 0;
  //     } else {
  //       this.requestStatus[type].index = representation.segments!.length - 1;
  //     }
  //   }
  //   this.NXDebug.debug(
  //     '[' +
  //       type +
  //       '] set index for time: ' +
  //       time +
  //       ', index=' +
  //       this.requestStatus[type].index
  //   );
  // };

  // getSegmentStartTimeAndDuration = (
  //   representation: Representation,
  //   time: number,
  //   _type: string
  // ): startDuration => {
  //   let segment: Nullable<Segment>;

  //   let idx: number;
  //   const self = this;

  //   if (!representation) {
  //     this.NXDebug.debug('no representation!!!');
  //     return {
  //       startTime: NaN,
  //       duration: NaN,
  //     };
  //   }

  //   idx = this.getIndexForSegments.call(self, time, representation);
  //   segment = this.getSegmentByIndex(idx, representation);

  //   if (segment) {
  //     return {
  //       startTime: segment.presentationStartTime,
  //       duration: segment.duration,
  //     };
  //   } else {
  //     return {
  //       startTime: time,
  //       duration: 0,
  //     };
  //   }
  // };

  isInitialIndex = (type: string): boolean => {
    return this.requestStatus[type].index === -1;
  };

  // getRequestStatus = (
  //   type: string
  // ): {
  //   requestedTime: Nullable<number>;
  //   index: number;
  // } => {
  //   return this.requestStatus[type];
  // };

  getNext = (
    representation: Representation,
    type: string,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    let request: Nullable<SegmentRequest>;
    let segment: Nullable<Segment> = null;
    const dIdx: DIdx = {};
    const self = this;
    if (!representation) {
      callback({
        status: 'error',
        msg: 'no representation',
      });
    }

    if (this.requestStatus[type].index === -1) {
      throw 'You must call getSegmentRequestForTime first.';
    }

    this.requestStatus[type].requestedTime = null;
    this.requestStatus[type].index += 1;
    dIdx[type] = this.requestStatus[type].index;
    this.getSegments.call(self, representation, (d) => {
      if (d.status === 'ok') {
        if (this.isMediaFinished.call(self, representation, dIdx[type])) {
          request = new SegmentRequest();
          request.action = request.ACTION_COMPLETE;
          request.index = dIdx[type];
          request.MSETimeOffset =
            representation.adaptation!.period!.offset -
            representation.presentationTimeOffset!;
          request.periodIdx = representation.adaptation!.period!.index;
          request.pStart = representation.adaptation!.period!.start;
          request.adaptationIdx = representation.adaptation!.index;
          request.representation = representation;
          this.NXDebug.log(
            '[' + type + '] Signal complete. period:' + request.periodIdx
          );
        } else {
          segment = this.getSegmentByIndex(dIdx[type], representation);
          this.requestStatus[type].requestedTime =
            segment != null ? segment.presentationStartTime : null;
          request = this.getRequestForSegment.call(self, segment!, type);
          if (!segment) {
            this.requestStatus[type].index -= 1;
          }
        }
        callback({
          status: 'ok',
          data: request,
          time: this.requestStatus[type].requestedTime,
        });
      } else {
        this.NXDebug.debug('ERROR:' + d.msg);

        callback({
          status: 'error',
          msg: d.msg,
        });
      }
    });
  };

  getSegmentCountForDuration = (
    representation: Nullable<Representation> | undefined,
    requiredDuration: number,
    bufferedDuration: number,
    _callback: (res: ResponseData) => void
  ): void => {
    const self = this;
    const callback: (res: ResponseData) => void = _callback || (() => {});
    let remainingDuration: number;
    let segmentDuration: number;
    let segmentCount: number = 0;

    if (!representation) {
      callback({
        status: 'error',
        msg: 'no representation',
      });
    }

    this.getSegments.call(self, representation!, (d) => {
      if (d.status === 'ok') {
        const segments: Array<Segment> = d.data;
        segmentDuration = segments[0].duration;

        if (bufferedDuration > requiredDuration + segmentDuration * 1.5) {
          callback({
            status: 'ok',
            data: -1,
          });
        } else {
          (remainingDuration = Math.max(
            requiredDuration - bufferedDuration,
            0
          )),
            (segmentCount = Math.ceil(remainingDuration / segmentDuration));
          callback({
            status: 'ok',
            data: segmentCount,
          });
        }
      } else {
        this.NXDebug.debug('ERROR:' + d.msg);
        callback({
          status: 'error',
          msg: d.msg,
        });
      }
    });
  };

  // getSegmentFirstStartTime = (
  //   representation: Representation,
  //   _callback: (res: ResponseData) => void
  // ): void => {
  //   const self = this;
  //   const callback: (res: ResponseData) => void = _callback || (() => {});
  //   let segmentStartTime: number;

  //   if (!representation) {
  //     callback({
  //       status: 'error',
  //       msg: 'no representation',
  //     });
  //   }
  //   this.getSegments.call(self, representation, (d) => {
  //     if (d.status === 'ok') {
  //       segmentStartTime = d.data[0].presentationStartTime;
  //       callback({
  //         status: 'ok',
  //         data: segmentStartTime,
  //       });
  //     } else {
  //       this.NXDebug.debug('ERROR:' + d.msg);
  //       callback({
  //         status: 'error',
  //         msg: d.msg,
  //       });
  //     }
  //   });
  // };

  getCurrentTime = (
    representation: Representation,
    curTime: number,
    _callback: (res: ResponseData) => void
  ): void => {
    const self = this;
    let time: number;
    let bufferedIndex: number;
    const callback: (res: ResponseData) => void = _callback || (() => {});
    if (!representation) {
      callback({
        status: 'error',
        msg: 'no representation',
      });
    }
    bufferedIndex = this.requestStatus[representation.adaptation!.type!].index;
    this.getSegments.call(self, representation, (d) => {
      if (d.status === 'ok') {
        const segments: Array<Segment> = d.data;
        if (bufferedIndex < 0) {
          if (!this.isDynamic) {
            time = curTime;
          } else {
            time = curTime;
          }
        } else {
          bufferedIndex =
            bufferedIndex < segments[0].availabilityIdx
              ? segments[0].availabilityIdx
              : Math.min(
                  segments[segments.length - 1].availabilityIdx,
                  bufferedIndex
                );
          time = this.getSegmentByIndex(
            bufferedIndex,
            representation
          )!.presentationStartTime;
        }
        callback({
          status: 'ok',
          data: time,
        });
      } else {
        this.NXDebug.debug('ERROR:' + d.msg);
        callback({
          status: 'error',
          msg: d.msg,
        });
      }
    });
  };

  parseSIDX = (ab: ArrayBuffer, ab_first_byte_offset: number): SIdx => {
    const d: DataView = new DataView(ab);
    const sidx: SIdx = {};
    let pos: number = 0;
    let offset: number;
    let time: number;
    let sidxEnd: number;
    let ref_type: number;
    let ref_size: number;
    let ref_dur: number;
    let type: string;
    let size: number;
    let charCode: number;
    let firstOffset: number = -1;
    let sidxPos: number = -1;

    while ((sidxPos < 0 || firstOffset < 0) && pos < d.byteLength) {
      size = d.getUint32(pos); // subtract 8 for including the size and type
      pos += 4;

      type = '';
      for (let i = 0; i < 4; i += 1) {
        charCode = d.getInt8(pos);
        type += String.fromCharCode(charCode);
        pos += 1;
      }

      if (type !== 'moof' && type !== 'traf' && type !== 'sidx') {
        // eslint-disable-line no-empty
      } else if (type === 'sidx') {
        // reset the position to the beginning of the box...
        // if we do not reset the position, the evaluation
        // of sidxEnd to ab.byteLength will fail.
        sidxPos = pos - 8;
      } else if (type === 'moof') {
        firstOffset = pos - 8;
      }
      pos += size - 8;
    }

    if (sidxPos < 0) {
      sidx.reference_count = 0;
      return sidx;
    }
    pos = sidxPos;
    sidxEnd = d.getUint32(pos, false) + pos;
    if (sidxEnd > ab.byteLength) {
      throw 'sidx terminates after array buffer';
    }

    sidx.version = d.getUint8(pos + 8);
    pos += 12;

    // skipped reference_ID(32)
    sidx.timescale = d.getUint32(pos + 4, false);
    pos += 8;

    if (sidx.version === 0) {
      sidx.earliest_presentation_time = d.getUint32(pos, false);
      sidx.first_offset = d.getUint32(pos + 4, false);
      pos += 8;
    } else {
      sidx.earliest_presentation_time = tmp64BitNumber(
        d.getUint32(pos, false),
        d.getUint32(pos + 4, false)
      );
      sidx.first_offset = tmp64BitNumber(
        d.getUint32(pos + 8, false),
        d.getUint32(pos + 12, false)
      );
      pos += 16;
    }

    sidx.first_offset! +=
      (firstOffset >= 0 ? firstOffset : sidxEnd) + (ab_first_byte_offset || 0);

    // skipped reserved(16)
    sidx.reference_count = d.getUint16(pos + 2, false);
    pos += 4;

    sidx.references = [];
    offset = sidx.first_offset!;
    time = sidx.earliest_presentation_time;

    for (let i = 0; i < sidx.reference_count; i += 1) {
      ref_size = d.getUint32(pos, false);
      ref_type = ref_size >>> 31;
      ref_size = ref_size & 0x7fffffff;
      ref_dur = d.getUint32(pos + 4, false);
      pos += 12;
      sidx.references.push({
        size: ref_size,
        type: ref_type,
        offset,
        duration: ref_dur,
        time,
        timescale: sidx.timescale,
      });
      offset += ref_size;
      time += ref_dur;
    }

    if (pos !== sidxEnd) {
      throw 'Error: final pos ' + pos + ' differs from SIDX end ' + sidxEnd;
    }

    return sidx;
  };

  parseSegments = (data: ArrayBuffer, media, offset): Array<Segment> => {
    let parsed: SIdx;
    let ref: Array<Reference> | undefined;
    let segments: Nullable<Array<Segment>>;
    let segment: Segment;
    let start: number;
    let end: number;

    parsed = this.parseSIDX.call(this, data, offset);
    ref = parsed.references!;
    segments = [];

    let t_time: number = 0;
    let t_dur: number = 0;
    let t_size: number = 0;
    let t_offset: number = 0;
    let t_timescale: number = 0;
    if (isNaN(this.MIN_SEGSIZE_FORBASE)) {
      for (let i = 0, len = ref.length; i < len; i += 1) {
        segment = new Segment();
        segment.duration = ref[i].duration;
        segment.media = media;
        segment.startTime = ref[i].time;
        segment.timescale = ref[i].timescale;

        start = ref[i].offset;
        end = ref[i].offset + ref[i].size - 1;
        segment.mediaRange = start + '-' + end;

        segments.push(segment);
      }
    } else {
      for (let i = 0, len = ref.length; i < len; i += 1) {
        if (t_dur == 0) {
          t_time = ref[i].time;
          t_dur = ref[i].duration;
          t_size = ref[i].size;
          t_offset = ref[i].offset;
          t_timescale = ref[i].timescale;
        } else {
          t_dur += ref[i].duration;
          t_size += ref[i].size;
        }
        if (
          t_dur / ref[i].timescale >= this.MIN_SEGSIZE_FORBASE ||
          i == ref.length - 1
        ) {
          segment = new Segment();
          segment.duration = t_dur;
          segment.media = media;
          segment.startTime = t_time;
          segment.timescale = t_timescale;

          start = t_offset;
          end = t_offset + t_size - 1;
          segment.mediaRange = start + '-' + end;

          segments.push(segment);
          t_dur = 0;
        }
      }
    }

    this.NXDebug.debug('Parsed SIDX box: ' + segments.length + ' segments.');
    return segments;
  };

  requestWithRange = (
    request: ExXMLHttpRequest,
    url: string,
    range: Nullable<string>,
    init
  ): void => {
    var qrys = this.commonQrys.concat();
    var hdrs = this.commonHdrs.concat();

    if (range != null) {
      qrys.push({
        name: 'range',
        value: range,
      });
      hdrs.push({
        name: 'Range',
        value: 'bytes=' + range,
      });
    }
    request.url = url;

    this.onPrepare({
      req: request,
      qrys: qrys,
      hdrs: hdrs,
      xhr: request,
    });

    if (qrys.length > 0) {
      qrys.forEach(function (qry) {
        request!.url += request!.url!.indexOf('?') > 0 ? '&' : '?';
        request!.url += qry.name + '=' + qry.value;
      });
    }

    if (!this.useFetch) {
      request!.open!('GET', request!.url!, true);
      request!.responseType = 'arraybuffer';

      if (hdrs.length > 0) {
        hdrs.forEach(function (hdr) {
          request!.setRequestHeader!(hdr!.name, hdr!.value);
        });
      }

      request!.send!(null);
    } else {
      if (hdrs.length > 0) {
        hdrs.forEach(function (hdr) {
          init.headers[hdr.name] = hdr.value;
        });
      }
    }
  };

  findInit = (
    data: ArrayBuffer,
    info: Info,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    let start: number;
    let end: number;
    const d: DataView = new DataView(data);
    let pos: number = 0;
    let type: string = '';
    let size: number = 0;
    let c: number;
    let request: ExXMLHttpRequest;
    let loaded: boolean = false;
    let irange: string;
    const self = this;

    this.NXDebug.log('Searching for initialization.');

    while (type !== 'moov' && pos < d.byteLength) {
      size = d.getUint32(pos); // subtract 8 for including the size and type
      pos += 4;

      type = '';
      for (let i = 0; i < 4; i += 1) {
        c = d.getInt8(pos);
        type += String.fromCharCode(c);
        pos += 1;
      }

      if (type !== 'moov') {
        pos += size - 8;
      }
    }

    if (type !== 'moov') {
      // Case 1
      // We didn't download enough bytes to find the moov.
      // TODO : Load more bytes.
      //        Be sure to detect EOF.
      //        Throw error is no moov is found in the entire file.
      //        Protection from loading the entire file?
      this.NXDebug.log('Loading more bytes to find initialization.');
      info.range.start = 0;
      info.range.end = info.bytesLoaded + info.bytesToLoad;

      if (!this.useFetch) {
        request = new XMLHttpRequest();

        request.onloadend = () => {
          if (!loaded) {
            callback({
              status: 'error',
              msg: 'Error loading initialization',
            });
          }
        };

        request.onload = (): void => {
          loaded = true;
          info.bytesLoaded = info.range.end!;
          this.onSuccess({
            status: request!.status!,
            req: request!,
            xhr: request!,
          });
          this.findInit.call(
            self,
            request.response,
            info,
            (d: ResponseData) => {
              if (d.status === 'ok') {
                callback({
                  status: 'ok',
                  data: d.data,
                });
              } else {
                callback({
                  status: 'error',
                  msg: 'Error loading initialization',
                });
              }
            }
          );
        };

        request.onerror = (): void => {
          this.onError({
            status: request!.status!,
            req: request!,
            xhr: request!,
          });
          callback({
            status: 'error',
            msg: 'Error loading initialization',
          });
        };

        this.requestWithRange(
          request,
          info.url,
          info.range.start + '-' + info.range.end,
          null
        );
      } else {
        const acon: Nullable<ExXMLHttpRequest> = {
          aborted: false,
        };

        const init: RequestInit = {
          method: 'GET',
          headers: {},
          credentials: 'same-origin',
        };

        request = {};
        this.requestWithRange(
          request,
          info.url,
          info.range.start + '-' + info.range.end,
          init
        );

        abortWrapper(fetch(request.url as RequestInfo, init), acon)
          .then((res: Response) => {
            info.bytesLoaded = info.range.end!;
            if (res.ok == true) {
              return res.arrayBuffer();
            } else {
              return Promise.reject(new Error('res.false'));
            }
          })
          .then((ab) => {
            info.bytesLoaded = info.range.end!;
            this.onSuccess({
              status: request!.status!,
              req: request!,
              xhr: request!,
            });
            this.findInit.call(self, ab, info, (d) => {
              if (d.status === 'ok') {
                callback({
                  status: 'ok',
                  data: d.data,
                });
              } else {
                callback({
                  status: 'error',
                  msg: 'Error loading initialization',
                });
              }
            });
          })
          .catch((_err) => {
            this.onError({
              status: request!.status!,
              req: request!,
              xhr: request!,
            });
            callback({
              status: 'error',
              msg: 'Error loading initialization',
            });
          });
      }
    } else {
      // Case 2
      // We have the entire range, so continue.
      start = pos - 8;
      end = start + size - 1;
      irange = start + '-' + end;

      this.NXDebug.log('Found the initialization.  Range: ' + irange);
      callback({
        status: 'ok',
        data: irange,
      });
    }
  };

  loadInitializationX = (
    media: string,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    const request: ExXMLHttpRequest = new XMLHttpRequest();
    let needFailureReport: boolean = true;
    const self = this;

    const info: Info = {
      url: media,
      range: {},
      searching: false,
      bytesLoaded: 0,
      bytesToLoad: 1500,
      request,
    };

    this.NXDebug.log('Start searching for initialization.');
    info.range.start = 0;
    info.range.end = info.bytesToLoad;

    request.onload = () => {
      if (request.status! < 200 || request.status! > 299) {
        return;
      }
      needFailureReport = false;

      info.bytesLoaded = info.range.end!;

      this.onSuccess({
        status: request!.status!,
        req: request!,
        xhr: request!,
      });
      this.findInit.call(self, request.response, info, (d: ResponseData) => {
        if (d.status === 'ok') {
          callback({
            status: 'ok',
            data: d.data,
          });
        } else {
          callback({
            status: 'error',
            msg: 'findInit error',
          });
        }
      });
    };

    request.onloadend = request.onerror = () => {
      if (!needFailureReport) {
        return;
      }
      needFailureReport = false;

      this.onError({
        status: request!.status!,
        req: request!,
        xhr: request!,
      });
      this.errHandler.downloadError(
        this.eventBus,
        'initialization',
        info.url,
        request
      );
      callback({
        status: 'error',
        msg: 'initialization load error',
      });
    };
    this.requestWithRange(
      request,
      info.url,
      info.range.start + '-' + info.range.end,
      null
    );
    this.NXDebug.log('Perform init search: ' + info.url);
  };

  loadInitializationF = (
    media: string,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});

    const acon: ExXMLHttpRequest = {
      aborted: false,
    };

    const request: ExXMLHttpRequest = {};

    const init: RequestInit = {
      method: 'GET',
      headers: {},
      credentials: 'same-origin',
    };

    const self = this;

    const info: Info = {
      url: media,
      range: {},
      searching: false,
      bytesLoaded: 0,
      bytesToLoad: 1500,
      request,
    };

    this.NXDebug.log('Start searching for initialization.');
    info.range.start = 0;
    info.range.end = info.bytesToLoad;

    this.requestWithRange(
      request,
      info.url,
      info.range.start + '-' + info.range.end,
      init
    );
    this.NXDebug.log('Perform init search: ' + info.url);

    abortWrapper(fetch(request.url as RequestInfo, init), acon)
      .then((res) => {
        if (res.ok == true) {
          return res.arrayBuffer();
        } else {
          return Promise.reject(new Error('res.false'));
        }
      })
      .then((ab) => {
        info.bytesLoaded = info.range.end!;

        this.onSuccess({
          status: request!.status!,
          req: request!,
          xhr: request!,
        });
        this.findInit.call(self, ab, info, (d) => {
          if (d.status === 'ok') {
            callback({
              status: 'ok',
              data: d.data,
            });
          } else {
            callback({
              status: 'error',
              msg: 'findInit error',
            });
          }
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .catch((_err) => {
        this.onError({
          status: request!.status!,
          req: request!,
          xhr: request!,
        });
        this.errHandler.downloadError(
          this.eventBus,
          'initialization',
          info.url,
          request
        );
        callback({
          status: 'error',
          msg: 'initialization load error',
        });
      });
  };

  loadInitialization = (
    media: string,
    _callback: (d: ResponseData) => void
  ): void => {
    return this.useFetch
      ? this.loadInitializationF(media, _callback)
      : this.loadInitializationX(media, _callback);
  };

  /* istanbul ignore next */
  extractChunk = (
    q: ChunkQ,
    tlen: number,
    inEventList: Array<DashEvent>,
    avtype: string
  ): ExtractChunk => {
    let sidxs: Array<SIdx> = [];
    const u8s: Array<Uint8Array> = q.progress!;
    const offset: number = q.chunkEnd!;
    let pos: number = offset;
    let type: string;
    let size: number;
    let charCode: number;
    let emsgs: Array<EMSG> = [];
    let curChunkEnd: number = offset;
    let nextChunkEnd: number = 0;
    let curChunkDur: number = q.chunkDur!;
    let nextChunkDur: number = 0;
    let chunkDur: number = 0;
    let chunkStartTime: number = 0;
    let curChunkStartTime: number = q.chunkStartTime!;
    let nextChunkStartTime: number = -1;
    let defaultSampleDuration: number = 0;

    const d = (pos: number): Nullable<number> => {
      let len: number = 0;
      for (let i = 0; i < u8s.length; i++) {
        len += u8s[i].length;
        if (pos < len) {
          return u8s[i][u8s[i].length - (len - pos)];
        }
      }
      return null;
    };

    const set = (data: number, pos: number): void => {
      let len: number = 0;
      let clen: number = 0;
      for (let i = 0; i < u8s.length; i++) {
        clen = u8s[i].length;
        if (pos < len + clen) {
          u8s[i][pos - len] = data;
          return;
        }
        len += clen;
      }
    };

    const getBytes = (
      u8s: Array<Uint8Array>,
      offset: number,
      size: number
    ): Nullable<Uint8Array> => {
      let len: number = 0;
      let pos: number = offset;
      let out: Uint8Array;
      let clen: number = 0;
      let osize: number = 0;

      if (tlen - offset < size) {
        return null;
      }

      out = new Uint8Array(size);
      for (let i = 0; i < u8s.length; i++) {
        clen = u8s[i].length;

        while (pos < len + clen) {
          out[osize] = u8s[i][pos - len];
          osize++;
          if (osize == size) {
            return out;
          }
          pos++;
        }
        len += clen;
      }

      return null;
    };

    const getUint32 = (
      b: (pos: number) => Nullable<number>,
      pos: number
    ): number => {
      return (
        (b(pos)! & 0xff) * 2 ** 24 +
        (((b(pos + 1)! & 0xff) << 16) |
          ((b(pos + 2)! & 0xff) << 8) |
          (b(pos + 3)! & 0xff))
      );
    };

    const getUint16 = (
      b: (pos: number) => Nullable<number>,
      pos: number
    ): number => {
      return ((b(pos)! & 0xff) << 8) | (b(pos + 1)! & 0xff);
    };

    const getInt32 = (
      b: (pos: number) => Nullable<number>,
      pos: number
    ): number => {
      let tdv = new DataView(new ArrayBuffer(4));
      tdv!.setUint8(0, b(pos)!);
      tdv!.setUint8(1, b(pos + 1)!);
      tdv!.setUint8(2, b(pos + 2)!);
      tdv!.setUint8(3, b(pos + 3)!);
      return tdv!.getInt32(0);
    };
    let version: number;
    let end: number;

    while (pos + 8 < tlen) {
      size = getUint32(d, pos); // subtract 8 for including the size and type
      pos += 4;

      type = '';
      for (let i = 0; i < 4; i += 1) {
        charCode = d(pos)!;
        type += String.fromCharCode(charCode);
        pos += 1;
      }
      if (
        type !== 'emsg' &&
        type !== 'moof' &&
        type !== 'traf' &&
        type !== 'tfdt' &&
        type !== 'tfhd' &&
        type !== 'trun' &&
        type !== 'mdat' &&
        type !== 'sidx'
      ) {
        pos += size - 8;
      } else if (type === 'emsg') {
        const e: EMSG = {};
        version = d(pos)!;
        e.typePos = pos - 4;
        e.data = getBytes(u8s, pos - 8, size);

        if (version == 1) {
          this.parseEmsg(e.data!, 0, e.data!.length, NaN, inEventList);
          set(0x66, e.typePos);
          set(0x72, e.typePos + 1);
          set(0x65, e.typePos + 2);
          set(0x65, e.typePos + 3);
        } else {
          emsgs.push(e);
        }
        pos += size - 8;
      } else if (type === 'sidx') {
        if (this.deleteUnnecessaryBox == true) {
          const s: SIdx = {};
          s.typePos = pos - 4;
          sidxs.push(s);
        }
        pos += size - 8;
      } else if (type === 'moof') {
        // eslint-disable-line no-empty
      } else if (type === 'traf') {
        // eslint-disable-line no-empty
      } else if (type == 'tfdt') {
        let baseMediaDecodeTime = 0;
        end = pos + size - 8;
        version = d(pos)!;
        pos += 1;
        pos += 3; // skip flag (24)

        if (version == 0) {
          baseMediaDecodeTime = getUint32(d, pos);
        } else {
          baseMediaDecodeTime = tmp64BitNumber(
            getUint32(d, pos),
            getUint32(d, pos + 4)
          );
        }
        const ttime: number =
          baseMediaDecodeTime / q.params!.timescale + q.offset;
        chunkStartTime += ttime;
        emsgs.forEach((e) => {
          e.startTime = ttime;
          this.parseEmsg(e.data!, 0, e.data!.length, e.startTime, inEventList);
          set(0x66, e.typePos!);
          set(0x72, e.typePos! + 1);
          set(0x65, e.typePos! + 2);
          set(0x65, e.typePos! + 3);
        });
        emsgs = [];

        pos = end;
      } else if (type === 'tfhd') {
        let flags_l: number;
        end = pos + size - 8;
        pos += 1; //version
        pos += 2; //flags_h
        flags_l = d(pos)!;
        pos++;
        pos += 4; // trackID

        if (flags_l & 0x01) {
          pos += 8; //base_data_offset;
        }
        if (flags_l & 0x02) {
          pos += 4; //sample_description_index;
        }
        if (flags_l & 0x08) {
          defaultSampleDuration = getUint32(d, pos);
          pos += 4; //default_sample_duration
        } else {
          defaultSampleDuration = q.params!.dsd;
        }
        if (flags_l & 0x10) {
          pos += 4; //default_sample_size
        }
        if (flags_l & 0x20) {
          if (avtype == 'audio') {
            if ((d(pos)! & 0x01) == 1) {
              //sample_depends_on
              set(d(pos)! + 1, pos);
            }
            if ((d(pos + 1)! & 0x01) == 1) {
              //sample_is_non_sync_sample;
              set(d(pos + 1)! - 1, pos + 1);
            }
          }

          pos += 4; //default_sample_flag
        }
        pos = end;
      } else if (type === 'trun') {
        let sampleCount: number;
        let dflags: number;
        let sflags: number;
        let fflags: number;
        let cflags: number;
        end = pos + size - 8;
        version = d(pos)!;
        pos += 1; //version
        let flags_h: number = getUint16(d, pos);
        pos += 2;
        let flags_l: number = d(pos)!;
        pos += 1;
        dflags = flags_h & 0x01;
        sflags = flags_h & 0x02;
        fflags = flags_h & 0x04;
        cflags = flags_h & 0x08;
        sampleCount = getUint32(d, pos);
        pos += 4;
        if (flags_l & 0x01) {
          pos += 4; //data_offset
        }
        if (flags_l & 0x04) {
          pos += 4; //first_sample_flags
        }
        if (!dflags) {
          chunkDur =
            (defaultSampleDuration * sampleCount) / q.params!.timescale;
          if (cflags) {
            //composition_time_offset of first sample
            //pos += 4 * ((sflags != 0) + (fflags != 0));
            if (sflags) {
              pos += 4; //sample_size
            }
            if (fflags) {
              pos += 4; //sample_flags
            }
            chunkStartTime +=
              (version
                ? getInt32(d, pos) / q.params!.timescale
                : getUint32(d, pos)) / q.params!.timescale;
          }
        } else {
          let tdur: number = 0;
          for (let i = 0; i < sampleCount; i++) {
            tdur += getUint32(d, pos);
            pos += 4;
            if (sflags) {
              pos += 4; //sample_size
            }
            if (fflags) {
              pos += 4; //sample_flags
            }
            if (cflags) {
              if (i == 0) {
                chunkStartTime +=
                  (version
                    ? getInt32(d, pos) / q.params!.timescale
                    : getUint32(d, pos)) / q.params!.timescale;
              }
              pos += 4; //sample_composition_time_offset
            }
          }
          chunkDur = tdur / q.params!.timescale;
        }
        pos = end;
      } else if (type === 'mdat') {
        end = pos + size - 8;

        if (end <= tlen) {
          curChunkEnd = end;
          curChunkDur += chunkDur;
          if (curChunkStartTime < 0) curChunkStartTime = chunkStartTime;
        } else {
          nextChunkEnd = end;
          nextChunkDur = chunkDur;
          nextChunkStartTime = chunkStartTime;
        }
        pos = end;
        if (this.deleteUnnecessaryBox == true) {
          sidxs.forEach((s) => {
            set(0x66, s.typePos!);
            set(0x72, s.typePos! + 1);
            set(0x65, s.typePos! + 2);
            set(0x65, s.typePos! + 3);
          });
          sidxs = [];
        }
      }
    }
    return {
      curChunkEnd,
      nextChunkEnd,
      curChunkDur,
      nextChunkDur,
      curChunkStartTime,
      nextChunkStartTime,
    };
  };

  parseEmsg = (
    data: Uint8Array,
    offset: number,
    size: number,
    startTime: number,
    inEventList: Array<DashEvent>
  ): void => {
    const i: number = offset;
    const expTwo: number = 256 ** 2;
    const expThree: number = 256 ** 3;
    const segmentStarttime: number = Math.max(
      isNaN(startTime) ? 0 : startTime,
      0
    );
    const version: number = data[i + 8];

    const getEvent = (list: Array<{ id: number }>, id: number): boolean => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id != null && list[i].id == id) return true;
      }

      return false;
    };

    // emsg-box: http://standards.iso.org/ittf/PubliclyAvailableStandards/c068960_ISO_IEC_14496-12_2015.zip

    let schemeIdUri: string | undefined = undefined;

    let value: string | undefined = undefined;
    let timescale: number = 1;
    let presentationTimeDelta: number = 0;
    let duration: number = 0;
    let id: number = 0;
    let messageData: Uint8Array | undefined = undefined;
    let presentationTime: number = 0;
    const de: DashEvent = {};
    let ne: boolean = false;
    let _eventList: Array<DashEvent> | undefined;
    let eventBox: Array<string | number | Uint8Array> = [];
    let arrIndex: number = 0;
    let j: number;

    if (version == 0) {
      eventBox = ['', '', 0, 0, 0, 0];
      arrIndex = 0;
      j = i + 12; //fullbox header is 12 bytes, thats why we start at 12

      while (j < size + i) {
        // == string terminates with 0, this indicates end of attribute == //
        if (arrIndex === 0 || arrIndex == 1) {
          if (data[j] !== 0) {
            eventBox[arrIndex] += String.fromCharCode(data[j]);
          } else {
            arrIndex += 1;
          }
          j += 1;
        } else if (arrIndex == 6) {
          eventBox[arrIndex] = data.subarray(j, size);
          j = size + i;
        } else {
          eventBox[arrIndex] =
            data[j] * expThree +
            data[j + 1] * expTwo +
            data[j + 2] * 256 +
            data[j + 3] * 1;
          j += 4;
          arrIndex += 1;
        }
      }
      // MpegDashEvent in W3C MediaTimedEvent: https://w3c.github.io/me-media-timed-events/#mpeg-dash
      schemeIdUri = eventBox[0] as string;
      value = eventBox[1] as string;
      timescale = eventBox[2] as number;
      presentationTimeDelta = eventBox[3] as number;
      duration = eventBox[4] as number;
      id = eventBox[5] as number;
      messageData = eventBox[6] as Uint8Array;
      presentationTime =
        (segmentStarttime * timescale + presentationTimeDelta) / timescale;
      //de = {},
      //ne=false,
      //_eventList;
    } else {
      eventBox = [0, 0, 0, 0, '', ''];
      arrIndex = 0;
      j = i + 12; //fullbox header is 12 bytes, thats why we start at 12

      while (j < size + i) {
        // == string terminates with 0, this indicates end of attribute == //
        if (arrIndex === 4 || arrIndex == 5) {
          if (data[j] !== 0) {
            eventBox[arrIndex] += String.fromCharCode(data[j]);
          } else {
            arrIndex += 1;
          }
          j += 1;
        } else if (arrIndex == 6) {
          eventBox[arrIndex] = data.subarray(j, size);
          j = size + i;
        } else if (arrIndex == 1) {
          const h: number =
            data[j] * expThree +
            data[j + 1] * expTwo +
            data[j + 2] * 256 +
            data[j + 3] * 1;

          const l: number =
            data[j + 4] * expThree +
            data[j + 5] * expTwo +
            data[j + 6] * 256 +
            data[j + 7] * 1;

          eventBox[arrIndex] = tmp64BitNumber(h, l);
          j += 8;
          arrIndex += 1;
        } else {
          eventBox[arrIndex] =
            data[j] * expThree +
            data[j + 1] * expTwo +
            data[j + 2] * 256 +
            data[j + 3] * 1;
          j += 4;
          arrIndex += 1;
        }
      }
      schemeIdUri = eventBox[4] as string;
      value = eventBox[5] as string;
      timescale = eventBox[0] as number;
      presentationTime = (eventBox[1] as number) / timescale;
      duration = eventBox[2] as number;
      id = eventBox[3] as number;
      messageData = eventBox[6] as Uint8Array;
      presentationTimeDelta = 0;
    }

    de.schemeIdUri = schemeIdUri;
    de.value = value;
    de.timescale = timescale;
    de.duration = duration;
    de.id = id;
    de.presentationTime = presentationTime;
    de.messageData = messageData;
    de.presentationTimeDelta = presentationTimeDelta;

    if (hasProperty(inEventList, schemeIdUri!)) {
      if (getEvent(inEventList[schemeIdUri!], de.id) == false) {
        inEventList[schemeIdUri!].push(de);
        _eventList = inEventList[schemeIdUri!];
        ne = true;
      }
    } else {
      inEventList[schemeIdUri!] = [];
      inEventList[schemeIdUri!].push(de);
      _eventList = inEventList[schemeIdUri!];
      ne = true;
    }

    if (ne) {
      this.eventBus.dispatchEvent({
        type: 'DASHEVENT_RECEIVED',
        data: {
          type: 'inband',
          event: de,
          eventList: _eventList,
          index: _eventList!.length - 1,
        },
      });
    }
    data[i + 4] = 0x66;
    data[i + 5] = 0x72;
    data[i + 6] = 0x65;
    data[i + 7] = 0x65; //convert to free
  };

  /* istanbul ignore next */
  extractIDRinMOOF = (
    u8: Uint8Array | undefined,
    _timescale: number,
    codecs: string
  ): Uint8Array => {
    const d: Uint8Array = u8!;
    let pos: number = 0;
    const timescale: number = _timescale || 1;
    let type: string;
    let size: number;
    let charCode: number;
    const moofs: Array<Moof> = [];
    let moofCnt: number = 0;

    const getUint32 = (_b: Uint8Array, pos: number): number =>
      (d[pos] & 0xff) * 2 ** 24 +
      (((d[pos + 1] & 0xff) << 16) |
        ((d[pos + 2] & 0xff) << 8) |
        (d[pos + 3] & 0xff));

    const getUint16 = (b: Uint8Array, pos: number): number =>
      ((b[pos] & 0xff) << 8) | (b[pos + 1] & 0xff);

    const setUint32 = (b: Uint8Array, pos: number, v: number): void => {
      //b[pos] = (v>>24)&0xFF;
      b[pos] = (v / 2 ** 24) & 0xff;
      b[pos + 1] = (v >> 16) & 0xff;
      b[pos + 2] = (v >> 8) & 0xff;
      b[pos + 3] = v & 0xff;
    };

    const setUint16 = (b: Uint8Array, pos: number, v: number): void => {
      b[pos] = (v >> 8) & 0xff;
      b[pos + 1] = v & 0xff;
    };

    let end: number;
    let version: number;
    let flags_h: number;
    let flags_l: number;
    let cp: number;

    while (pos < d.length) {
      size = getUint32(d, pos); // subtract 8 for including the size and type
      pos += 4;

      type = '';
      for (let i = 0; i < 4; i += 1) {
        charCode = d[pos];
        type += String.fromCharCode(charCode);
        pos += 1;
      }
      if (
        type !== 'moof' &&
        type !== 'traf' &&
        type !== 'tfhd' &&
        type !== 'tfdt' &&
        type !== 'trun' &&
        type !== 'mdat' &&
        type != 'senc' &&
        type != 'saio'
      ) {
        pos += size - 8;
      } else if (type === 'moof') {
        const offset: number = pos - 8;
        moofs.push({
          offset,
        });
        moofs[moofCnt].moofPos = offset;
        moofs[moofCnt].moofSize = size;
        moofCnt++;
      } else if (type === 'traf') {
        moofs[moofCnt - 1].trafPos = pos - 8;
        moofs[moofCnt - 1].trafSize = size;
      } else if (type === 'tfhd') {
        end = pos + size - 8;
        pos += 1; //version
        flags_h = getUint16(d, pos);
        pos += 2;
        flags_l = d[pos];
        pos++;

        pos += 4; // trackID

        if (flags_l & 0x01) {
          pos += 8; //base_data_offset;
        }
        if (flags_l & 0x02) {
          pos += 4; //sample_description_index;
        }
        if (flags_l & 0x08) {
          moofs[moofCnt - 1].defaultSampleDuration = getUint32(d, pos);
          pos += 4; //default_sample_duration
        }
        if (flags_l & 0x10) {
          moofs[moofCnt - 1].defaultSampleSize = getUint32(d, pos);
          pos += 4; //default_sample_size
        }
        if (flags_l & 0x20) {
          moofs[moofCnt - 1].defaultSampleFlags = getUint32(d, pos);
          pos += 4;
        }
        pos = end;
      } else if (type === 'tfdt') {
        let baseMediaDecodeTime = 0;
        end = pos + size - 8;
        version = d[pos];
        pos += 1;
        pos += 3; // skip flag (24)

        if (version == 0) {
          baseMediaDecodeTime = getUint32(d, pos);
        } else {
          baseMediaDecodeTime = tmp64BitNumber(
            getUint32(d, pos),
            getUint32(d, pos + 4)
          );
        }
        const ttime = baseMediaDecodeTime / timescale;
        moofs[moofCnt - 1].time = ttime;
        pos = end;
      } else if (type === 'trun') {
        moofs[moofCnt - 1].trunPos = pos - 8;
        moofs[moofCnt - 1].trunSize = size;
        end = pos + size - 8;
        version = d[pos];

        pos += 1;
        flags_h = getUint16(d, pos);
        flags_l = d[pos + 2];

        pos += 3;

        const sampleCount: number = getUint32(d, pos);
        let dataOffset: number = 0;
        let firstSampleFlags: number = 0;
        const dflags: number = flags_h & 0x01;
        const sflags: number = flags_h & 0x02;
        const fflags: number = flags_h & 0x04;
        const cflags: number = flags_h & 0x08;
        let poffset: number;

        if (!fflags) {
          const nTrunArray = new ArrayBuffer(size + sampleCount * 4);
          const nTrun = new Uint8Array(nTrunArray);
          let raps = 0;
          cp = 0;
          setUint32(nTrun, cp, size + sampleCount * 4);
          cp += 4;
          setUint32(nTrun, cp, 0x7472756e);
          cp += 4;
          nTrun[cp] = version;
          cp += 1;
          setUint16(nTrun, cp, flags_h + 0x4);
          cp += 2;
          nTrun[cp] = flags_l - 0x4;
          cp++;
          setUint32(nTrun, cp, sampleCount);
          cp += 4;

          pos += 4;
          if (flags_l & 0x01) {
            dataOffset = getUint32(d, pos);
            pos += 4;

            setUint32(nTrun, cp, dataOffset + sampleCount * 4);
            cp += 4;
          }
          if (flags_l & 0x04) {
            firstSampleFlags = getUint32(d, pos);
            pos += 4;
          }

          poffset = dataOffset + moofs[moofCnt - 1].moofPos!;
          for (let i = 0; i < sampleCount; i++) {
            let sz = 0;
            if (dflags) {
              setUint32(nTrun, cp, getUint32(d, pos));
              pos += 4;
              cp += 4;
            }
            if (sflags) {
              sz = getUint32(d, pos);
              pos += 4;
              setUint32(nTrun, cp, sz);
              cp += 4;
            }

            //mdat
            let mp: number = poffset;

            let nsize: number;
            let nal_unit_type: number;
            while (mp < poffset + sz) {
              nsize = getUint32(d, mp);
              mp += 4;

              if (codecs.indexOf('avc') > -1) {
                nal_unit_type = d[mp] & 0x1f;

                if (nal_unit_type == 5) {
                  setUint32(nTrun, cp, firstSampleFlags);
                  cp += 4;
                  raps++;
                  break;
                } else if (nal_unit_type == 1) {
                  if (i == 0) {
                    setUint32(nTrun, cp, firstSampleFlags);
                    raps++;
                  } else if (moofs[moofCnt - 1].defaultSampleFlags) {
                    setUint32(
                      nTrun,
                      cp,
                      moofs[moofCnt - 1].defaultSampleFlags!
                    );
                  } else {
                    setUint32(nTrun, cp, 65536);
                  }
                  cp += 4;
                  break;
                } else {
                  // eslint-disable-line no-empty
                }
              } else {
                nal_unit_type = (d[mp] >> 1) & 0x3f;

                if (nal_unit_type == 19 || nal_unit_type == 20) {
                  setUint32(nTrun, cp, firstSampleFlags);
                  cp += 4;
                  raps++;
                  break;
                } else if (nal_unit_type < 19) {
                  if (i == 0) {
                    setUint32(nTrun, cp, firstSampleFlags);
                    raps++;
                  } else if (moofs[moofCnt - 1].defaultSampleFlags) {
                    setUint32(
                      nTrun,
                      cp,
                      moofs[moofCnt - 1].defaultSampleFlags!
                    );
                  } else {
                    setUint32(nTrun, cp, 65536);
                  }
                  cp += 4;
                  break;
                } else {
                  // eslint-disable-line no-empty
                }
              }
              mp += nsize;
            }
            poffset += sz;

            if (cflags) {
              setUint32(nTrun, cp, getUint32(d, pos));
              pos += 4;
              cp += 4;
            }
          }

          if (raps < 2) {
            return u8!;
          }

          // pad (NULL);
          setUint32(nTrun, cp, 0);
          pos += 4;

          moofs[moofCnt - 1].trunExp = fflags ? 0 : sampleCount * 4;
          moofs[moofCnt - 1].modTrun = nTrun;
          pos = end;
          moofs[moofCnt - 1].trunEnd = pos;
        } else {
          return u8!;
        }
      } else if (type === 'senc') {
        moofs[moofCnt - 1].sencPos = pos - 8;
        moofs[moofCnt - 1].sencSize = size;
        pos = pos - 8 + size;
      } else if (type === 'saio') {
        end = pos - 8 + size;
        moofs[moofCnt - 1].checkSaio = true;
        moofs[moofCnt - 1].saioPos = pos - 8;
        moofs[moofCnt - 1].saioSize = size;

        let entryCount;
        version = d[pos];
        pos++;
        flags_h = getUint16(d, pos);
        pos += 2;
        flags_l = d[pos];
        pos++;
        if (flags_l & 0x01) {
          pos += 8;
        }
        entryCount = getUint32(d, pos);
        pos += 4;
        if (entryCount > 1) {
          return u8!;
        }
        moofs[moofCnt - 1].saioOffsetPos = pos;
        moofs[moofCnt - 1].saioVersion = version;

        pos = end;
      } else if (type === 'mdat') {
        moofs[moofCnt - 1].mdatPos = pos - 8;
        moofs[moofCnt - 1].mdatSize = size;
        pos = pos - 8 + size;
      }
    }

    let modSize: number = 0;
    for (let i = 0; i < moofs.length; i++) {
      modSize += moofs[i].moofSize! + moofs[i].mdatSize! + moofs[i].trunExp!;
    }
    const modArray: ArrayBuffer = new ArrayBuffer(modSize);
    const modData: Uint8Array = new Uint8Array(modArray);
    cp = 0;
    for (let i = 0; i < moofs.length; i++) {
      const m: Moof = moofs[i];
      let tmp: Uint8Array;
      const newPos = cp;
      tmp = u8!.subarray(m.moofPos, m.trunPos);
      modData.set(tmp, cp);

      setUint32(modData, newPos, m.moofSize! + m.trunExp!);
      setUint32(
        modData,
        newPos + m.trafPos! - m.moofPos!,
        m.trafSize! + m.trunExp!
      );
      cp += tmp.length;

      modData.set(m.modTrun!, cp);
      cp += m.modTrun!.length;
      if (m.trunEnd != m.mdatPos) {
        tmp = u8!.subarray(m.trunEnd, m.mdatPos);
        modData.set(tmp, cp);
        if (m.checkSaio) {
          if (m.sencPos! < m.trunPos!) {
            // eslint-disable-line no-empty
          } else {
            let tmpPos: number;
            let soffset: number = 0;
            tmpPos =
              m.trunPos! < m.saioPos!
                ? m.saioOffsetPos! - m.trunEnd! + cp
                : m.saioOffsetPos! - m.moofPos! + newPos;
            if (m.saioVersion == 0) {
              soffset = getUint32(modData, tmpPos);
              setUint32(modData, tmpPos, soffset + m.trunExp!);
            } else {
              soffset = getUint32(modData, tmpPos + 4);
              setUint32(modData, tmpPos + 4, soffset + m.trunExp!);
            }
          }
        }
        cp += m.mdatPos! - m.trunEnd!;
      }
      tmp = u8!.subarray(m.mdatPos, m.mdatPos! + m.mdatSize!);
      modData.set(tmp, cp);
      cp += m.mdatSize!;
    }

    u8 = void 0;
    return modData;
  };

  // decodeDTS = (
  //   ab: ArrayBuffer,
  //   dur: number,
  //   _timescale: number
  // ): Array<Moof> => {
  //   const d: DataView = new DataView(ab);
  //   let pos: number = 0;
  //   const timescale: number = _timescale || 1;
  //   let offset: number;
  //   let type: string;
  //   let size: number;
  //   let charCode: number;
  //   const moofs: Array<Moof> = [];
  //   let moofCnt: number = 0;

  //   while (pos < d.byteLength) {
  //     size = d.getUint32(pos); // subtract 8 for including the size and type
  //     pos += 4;

  //     type = '';
  //     for (let i = 0; i < 4; i += 1) {
  //       charCode = d.getInt8(pos);
  //       type += String.fromCharCode(charCode);
  //       pos += 1;
  //     }

  //     if (type !== 'moof' && type !== 'traf' && type !== 'tfdt') {
  //       pos += size - 8;
  //     } else if (type === 'moof') {
  //       offset = pos - 8;
  //       if (moofCnt == 0) {
  //         moofs.push({
  //           offset: 0,
  //         });
  //       } else {
  //         moofs.push({
  //           offset,
  //         });
  //       }
  //       moofCnt++;
  //     } else if (type === 'tfdt') {
  //       const end = pos + size - 8;

  //       const version = d.getUint8(pos);
  //       let baseMediaDecodeTime = 0;
  //       pos += 1;
  //       pos += 3; // skip flag (24)

  //       if (version == 0) {
  //         baseMediaDecodeTime = d.getUint32(pos, false);
  //       } else {
  //         baseMediaDecodeTime = tmp64BitNumber(
  //           d.getUint32(pos, false),
  //           d.getUint32(pos + 4, false)
  //         );
  //       }
  //       const ttime = baseMediaDecodeTime / timescale;
  //       moofs[moofCnt - 1].time = ttime;
  //       if (moofCnt > 1) {
  //         moofs[moofCnt - 2].dur = ttime - moofs[moofCnt - 2].time!;
  //         moofs[moofCnt - 2].size =
  //           moofs[moofCnt - 1].offset - moofs[moofCnt - 2].offset;
  //       }
  //       pos = end;
  //     }
  //   }

  //   if (moofCnt == 1) {
  //     moofs[0].dur = dur;
  //     moofs[0].size = d.byteLength;
  //   } else if (moofCnt > 1) {
  //     let tdur = 0;
  //     let tsize = 0;
  //     for (let i = 0; i < moofCnt - 1; i++) {
  //       tdur += moofs[i].dur!;
  //       tsize += moofs[i].size!;
  //     }
  //     moofs[moofCnt - 1].dur = dur - tdur;
  //     moofs[moofCnt - 1].size = d.byteLength - tsize;
  //   }
  //   return moofs;
  // };

  parseFragment = (
    data: Uint8Array,
    _timescale: number,
    dsd: number,
    mseTimeOffset: number,
    mtype: string,
    inEventList: Array<DashEvent>
  ): Array<Moof> => {
    let pos: number = 0;
    const timescale: number = _timescale || 1;
    let offset: number;
    let type: string;
    let size: number;
    let charCode: number;
    const moofs: Array<Moof> = [];
    let emsgs: Array<EMSG> = [];
    let moofCnt: number = 0;
    let startTime: number = 0;
    let defaultSampleDuration: number = 0;

    const getUint32 = (b: Uint8Array, pos: number): number =>
      (b[pos] & 0xff) * 2 ** 24 +
      (((b[pos + 1] & 0xff) << 16) |
        ((b[pos + 2] & 0xff) << 8) |
        (b[pos + 3] & 0xff));

    const getUint16 = (b: Uint8Array, pos: number): number =>
      ((b[pos] & 0xff) << 8) | (b[pos + 1] & 0xff);

    const getInt32 = (b: Uint8Array, pos: number): number => {
      var tdv = new DataView(new ArrayBuffer(4));
      tdv.setUint8(0, b[pos]);
      tdv.setUint8(1, b[pos + 1]);
      tdv.setUint8(2, b[pos + 2]);
      tdv.setUint8(3, b[pos + 3]);
      return tdv.getInt32(0);
    };

    let version: number;
    let end: number;

    while (pos < data.length) {
      size = getUint32(data, pos); // subtract 8 for including the size and type
      pos += 4;

      type = '';
      for (let i = 0; i < 4; i += 1) {
        charCode = data[pos];
        type += String.fromCharCode(charCode);
        pos += 1;
      }

      if (
        type !== 'emsg' &&
        type !== 'moof' &&
        type !== 'traf' &&
        type !== 'tfdt' &&
        type !== 'tfhd' &&
        type !== 'trun' &&
        type !== 'sidx'
      ) {
        pos += size - 8;
      } else if (type === 'emsg') {
        const e: EMSG = {};
        e.sizePos = pos - 8;
        e.size = size;
        emsgs.push(e);
        pos += size - 8;
      } else if (type === 'sidx') {
        if (this.deleteUnnecessaryBox == true) {
          data[pos - 4] = 0x66;
          data[pos - 3] = 0x72;
          data[pos - 2] = 0x65;
          data[pos - 1] = 0x65;
        }
        pos += size - 8;
      } else if (type === 'moof') {
        offset = pos - 8;
        if (moofCnt == 0) {
          moofs.push({
            time: 0,
            offset: 0,
          });
        } else {
          moofs.push({
            time: 0,
            offset,
          });
        }
        moofCnt++;
      } else if (type === 'tfdt') {
        const version: number = data[pos];
        let baseMediaDecodeTime = 0;

        end = pos + size - 8;
        pos += 1;
        pos += 3; // skip flag (24)

        if (version == 0) {
          baseMediaDecodeTime = getUint32(data, pos);
        } else {
          baseMediaDecodeTime = tmp64BitNumber(
            getUint32(data, pos),
            getUint32(data, pos + 4)
          );
        }
        startTime += baseMediaDecodeTime / timescale + mseTimeOffset;
        moofs![moofCnt - 1]!.time! += startTime;
        if (moofCnt > 1) {
          moofs[moofCnt - 2].size =
            moofs[moofCnt - 1].offset - moofs[moofCnt - 2].offset;
        }

        if (emsgs.length > 0) {
          emsgs.forEach((e) => {
            this.parseEmsg(data, e.sizePos!, e.size!, startTime, inEventList);
          });
          emsgs = [];
        }

        pos = end;
      } else if (type === 'tfhd') {
        let flags_l: number;
        end = pos + size - 8;
        pos += 1; //version
        pos += 2; //flags_h
        flags_l = data[pos];
        pos++;
        pos += 4; // trackID

        if (flags_l & 0x01) {
          pos += 8; //base_data_offset;
        }
        if (flags_l & 0x02) {
          pos += 4; //sample_description_index;
        }
        if (flags_l & 0x08) {
          defaultSampleDuration = getUint32(data, pos);
          pos += 4; //default_sample_duration
        } else {
          defaultSampleDuration = dsd;
        }
        if (flags_l & 0x10) {
          pos += 4; //default_sample_size
        }
        if (flags_l & 0x20) {
          if (mtype == 'audio') {
            if ((data[pos] & 0x01) == 1) {
              //sample_depends_on
              data[pos] += 1;
            }
            if ((data[pos + 1] & 0x01) == 1) {
              //sample_is_non_sync_sample
              data[pos + 1] -= 1;
            }
          }

          pos += 4; //default_sample_flag
        }
        moofs[moofCnt - 1].defaultSampleDuration = defaultSampleDuration;

        pos = end;
      } else if (type === 'trun') {
        let sampleCount: number;
        let dflags: number;
        let sflags: number;
        let fflags: number;
        let cflags: number;
        let chunkDur: number = 0;
        let cto: number = 0;
        end = pos + size - 8;

        version = data[pos];
        pos += 1; //version
        let flags_h = getUint16(data, pos);
        pos += 2;
        let flags_l = data[pos];
        pos += 1;
        dflags = flags_h & 0x01;
        sflags = flags_h & 0x02;
        fflags = flags_h & 0x04;
        cflags = flags_h & 0x08;

        sampleCount = getUint32(data, pos);
        pos += 4;
        if (flags_l & 0x01) {
          pos += 4; //data_offset
        }
        if (flags_l & 0x04) {
          pos += 4; //first_sample_flags
        }
        if (!dflags) {
          chunkDur =
            (moofs[moofCnt - 1].defaultSampleDuration! * sampleCount) /
            timescale;
          //composition_time_offset of first sample
          if (cflags) {
            //pos += 4 * ((sflags != 0) + (fflags != 0));
            if (sflags) {
              pos += 4; //sample_size
            }
            if (fflags) {
              pos += 4; //sample_flags
            }
            cto =
              (version
                ? getInt32(data, pos) / timescale
                : getUint32(data, pos)) / timescale;
            startTime += cto;
            moofs![moofCnt - 1]!.time! += cto;
          }
          //
        } else {
          let tdur: number = 0;
          for (let i = 0; i < sampleCount; i++) {
            tdur += getUint32(data, pos);
            pos += 4;
            if (sflags) {
              pos += 4; //sample_size
            }
            if (fflags) {
              pos += 4; //sample_flags
            }
            if (cflags) {
              if (i == 0) {
                cto =
                  (version
                    ? getInt32(data, pos) / timescale
                    : getUint32(data, pos)) / timescale;
                startTime += cto;
                moofs![moofCnt - 1]!.time! += cto;
              }
              pos += 4; //sample_composition_time_offset
            }
          }
          chunkDur = tdur / timescale;
        }
        moofs[moofCnt - 1].dur = chunkDur;
        pos = end;
      }
    }

    if (moofCnt == 1) {
      //moofs[0].dur = dur;
      moofs[0].size = data.length;
    } else if (moofCnt > 1) {
      moofs[moofCnt - 1].size = data.length - moofs[moofCnt - 1].offset;
    }

    return moofs;
  };

  // shiftDTS = (
  //   data: Uint8Array,
  //   MSETimeOffset: number,
  //   _timescale: number,
  //   tolerance: number
  // ): Uint8Array => {
  //   const ab: ArrayBuffer = new ArrayBuffer(data.length);
  //   const ab8: Uint8Array = new Uint8Array(ab);
  //   const d: DataView = new DataView(ab);
  //   const sidx: SIdx = {};
  //   let pos: number = 0;
  //   let timescale: number = _timescale || 1;
  //   let sidxEnd: number;
  //   let type: string;
  //   let size: number;
  //   let charCode: number;
  //   let end: number;

  //   ab8.set(data);

  //   while (pos < d.byteLength) {
  //     size = d.getUint32(pos); // subtract 8 for including the size and type
  //     pos += 4;

  //     type = '';
  //     for (let i = 0; i < 4; i += 1) {
  //       charCode = d.getInt8(pos);
  //       type += String.fromCharCode(charCode);
  //       pos += 1;
  //     }

  //     if (
  //       type !== 'moof' &&
  //       type !== 'traf' &&
  //       type !== 'sidx' &&
  //       type !== 'tfdt'
  //     ) {
  //       pos += size - 8;
  //     } else if (type === 'sidx') {
  //       end = pos + size - 8;
  //       pos -= 8;
  //       //pos += size - 8;

  //       sidxEnd = d.getUint32(pos, false) + pos;
  //       if (sidxEnd > ab.byteLength) {
  //         throw 'sidx terminates after array buffer';
  //       }

  //       sidx.version = d.getUint8(pos + 8);
  //       pos += 12;

  //       // skipped reference_ID(32)
  //       sidx.timescale = d.getUint32(pos + 4, false);
  //       timescale = sidx.timescale;
  //       pos += 8;

  //       if (sidx.version === 0) {
  //         sidx.earliest_presentation_time = d.getUint32(pos, false);
  //         sidx.first_offset = d.getUint32(pos + 4, false);
  //         pos += 8;
  //       } else {
  //         sidx.earliest_presentation_time = tmp64BitNumber(
  //           d.getUint32(pos, false),
  //           d.getUint32(pos + 4, false)
  //         );

  //         sidx.first_offset = tmp64BitNumber(
  //           d.getUint32(pos + 8, false),
  //           d.getUint32(pos + 12, false)
  //         );
  //         pos += 16;
  //       }

  //       pos = end;
  //     } else if (type === 'tfdt') {
  //       end = pos + size - 8;

  //       const version = d.getUint8(pos);
  //       let baseMediaDecodeTime = 0;
  //       pos += 1;
  //       pos += 3; // skip flag (24)

  //       if (version == 0) {
  //         baseMediaDecodeTime = d.getUint32(pos, false);
  //       } else {
  //         baseMediaDecodeTime = tmp64BitNumber(
  //           d.getUint32(pos, false),
  //           d.getUint32(pos + 4, false)
  //         );
  //         const modTime = baseMediaDecodeTime + timescale * MSETimeOffset;
  //         const tmp32bit = tmp64to32Bit(modTime);

  //         d.setUint32(pos, tmp32bit.high);
  //         d.setUint32(pos + 4, tmp32bit.low);

  //         this.NXDebug.log(
  //           'TFDT: version:' +
  //             version +
  //             ', scale:' +
  //             timescale +
  //             ', dts:' +
  //             baseMediaDecodeTime +
  //             ', modi:' +
  //             modTime
  //         );
  //         this.logHandler.log(
  //           'TFDT: version:' +
  //             version +
  //             ', scale:' +
  //             timescale +
  //             ', dts:' +
  //             baseMediaDecodeTime +
  //             ', modi:' +
  //             modTime
  //         );
  //       }

  //       this.NXDebug.log(
  //         'TFDT: version:' +
  //           version +
  //           ', scale:' +
  //           timescale +
  //           ', dts:' +
  //           baseMediaDecodeTime +
  //           ', tolerance:' +
  //           timescale * tolerance
  //       );
  //       this.logHandler.log(
  //         'TFDT: version:' +
  //           version +
  //           ', scale:' +
  //           timescale +
  //           ', dts:' +
  //           baseMediaDecodeTime +
  //           ', tolerance:' +
  //           timescale * tolerance
  //       );
  //       pos = end;
  //     }
  //   }
  //   return new Uint8Array(ab);
  // };

  checkAndConvertCodecType = (d: Uint8Array): Uint8Array => {
    const getUint32 = (pos: number): number =>
      ((d[pos] & 0xff) << 24) |
      ((d[pos + 1] & 0xff) << 16) |
      ((d[pos + 2] & 0xff) << 8) |
      (d[pos + 3] & 0xff);

    for (let i = 0; i < d.length - 4; i++) {
      if (getUint32(i) === 0x68657631) {
        d[i] = 0x68;
        d[i + 1] = 0x76;
        d[i + 2] = 0x63;
        d[i + 3] = 0x31;
        this.logHandler.log('#### convert HEV1 to  HVC1 #####');
        break;
      }
    }

    return d;
  };

  getMoovParams = (
    d: Uint8Array,
    mtype: string
  ): {
    timescale: number;
    dsd: number;
  } => {
    let type: string;
    let size: number;
    let charCode: number;
    let pos: number = 0;
    let end: number;
    let timescale: number = 0;
    let defaultSampleDuration: number = 0;
    let version: number;

    const getUint32 = (pos: number): number =>
      (d[pos] & 0xff) * 2 ** 24 +
      (((d[pos + 1] & 0xff) << 16) |
        ((d[pos + 2] & 0xff) << 8) |
        (d[pos + 3] & 0xff));

    while (pos < d.length) {
      size = getUint32(pos);
      pos += 4;

      type = '';

      for (let i = 0; i < 4; i += 1) {
        charCode = d[pos];
        type += String.fromCharCode(charCode);
        pos += 1;
      }
      if (
        type !== 'moov' &&
        type !== 'trak' &&
        type !== 'mdia' &&
        type !== 'mdhd' &&
        type !== 'mvex' &&
        type !== 'trex' &&
        type !== 'edts'
      ) {
        pos += size - 8;
      } else if (type == 'edts') {
        if (this.deleteUnnecessaryBox == true) {
          d[pos - 4] = 0x66;
          d[pos - 3] = 0x72;
          d[pos - 2] = 0x65;
          d[pos - 1] = 0x65;
        }
        pos += size - 8;
      } else if (type == 'mdhd') {
        end = pos + size - 8;
        version = d[pos];
        pos++;
        pos += 3; // flags

        if (version == 1) {
          pos += 8; //creation_time
          pos += 8; //modification_time
        } else {
          pos += 4; //creation_time
          pos += 4; //modification_time
        }
        timescale = getUint32(pos);
        if (defaultSampleDuration != 0) break;
        pos = end;
      } else if (type == 'trex') {
        end = pos + size - 8;
        version = d[pos];
        pos++;
        pos += 11; // flags(24), track_ID(32), default_sample_description_index(32)
        defaultSampleDuration = getUint32(pos);
        pos += 4;

        //// default_sample_flags
        if (mtype == 'audio') {
          if ((d[pos] & 0x01) == 1) {
            //sample_depends_on
            d[pos] += 1;
          }
          pos++;
          if ((d[pos] & 0x01) == 1) {
            //sample_is_non_sync_sample
            d[pos] -= 1;
          }
        }
        if (timescale != 0) break;
        pos = end;
      }
    }
    return {
      timescale,
      dsd: defaultSampleDuration,
    };
  };

  //NSV-a const getTimescale = d => {
  //NSV-a   let i;
  //NSV-a   let type;
  //NSV-a   let size;
  //NSV-a   let charCode;
  //NSV-a   let pos = 0;
  //NSV-a
  //NSV-a   const getUint32 = pos => (d[pos] & 0xff) * 2 ** 24 +
  //NSV-a   (((d[pos + 1] & 0xff) << 16) |
  //NSV-a     ((d[pos + 2] & 0xff) << 8) |
  //NSV-a     (d[pos + 3] & 0xff));
  //NSV-a
  //NSV-a   while (pos < d.length) {
  //NSV-a     size = getUint32(pos);
  //NSV-a     pos += 4;
  //NSV-a
  //NSV-a     type = '';
  //NSV-a
  //NSV-a     for (i = 0; i < 4; i += 1) {
  //NSV-a       charCode = d[pos];
  //NSV-a       type += String.fromCharCode(charCode);
  //NSV-a       pos += 1;
  //NSV-a     }
  //NSV-a
  //NSV-a     if (
  //NSV-a       type !== 'moov' &&
  //NSV-a       type !== 'trak' &&
  //NSV-a       type !== 'mdia' &&
  //NSV-a       type !== 'mdhd'
  //NSV-a     ) {
  //NSV-a       pos += size - 8;
  //NSV-a     } else if (type == 'mdhd') {
  //NSV-a       let version;
  //NSV-a       let timescale;
  //NSV-a
  //NSV-a       version = d[pos];
  //NSV-a       pos++;
  //NSV-a       pos += 3; // flags
  //NSV-a
  //NSV-a       if (version == 1) {
  //NSV-a         pos += 8; //creation_time
  //NSV-a         pos += 8; //modification_time
  //NSV-a       } else {
  //NSV-a         pos += 4; //creation_time
  //NSV-a         pos += 4; //modification_time
  //NSV-a       }
  //NSV-a       timescale = getUint32(pos);
  //NSV-a       return timescale;
  //NSV-a     }
  //NSV-a   }
  //NSV-a };
  //NSV-a const getDefaultSampleDuration = d => {
  //NSV-a   let i;
  //NSV-a   let type;
  //NSV-a   let size;
  //NSV-a   let charCode;
  //NSV-a   let pos = 0;
  //NSV-a
  //NSV-a   const getUint32 = pos => (d[pos] & 0xff) * 2 ** 24 +
  //NSV-a   (((d[pos + 1] & 0xff) << 16) |
  //NSV-a     ((d[pos + 2] & 0xff) << 8) |
  //NSV-a     (d[pos + 3] & 0xff));
  //NSV-a
  //NSV-a   while (pos < d.length) {
  //NSV-a     size = getUint32(pos);
  //NSV-a     pos += 4;
  //NSV-a
  //NSV-a     type = '';
  //NSV-a
  //NSV-a     for (i = 0; i < 4; i += 1) {
  //NSV-a       charCode = d[pos];
  //NSV-a       type += String.fromCharCode(charCode);
  //NSV-a       pos += 1;
  //NSV-a     }
  //NSV-a
  //NSV-a     if (type !== 'moov' && type !== 'mvex' && type !== 'trex') {
  //NSV-a       pos += size - 8;
  //NSV-a     } else if (type == 'trex') {
  //NSV-a       let defaultSampleDuration;
  //NSV-a
  //NSV-a       pos++;
  //NSV-a       pos += 11; // flags(24), track_ID(32), default_sample_description_index(32)
  //NSV-a       defaultSampleDuration = getUint32(pos);
  //NSV-a       return defaultSampleDuration;
  //NSV-a     }
  //NSV-a   }
  //NSV-a
  //NSV-a   return 0;
  //NSV-a };

  getInitializationDataX = (
    representation: Representation,
    convertCodecType: undefined | boolean,
    initData: Array<{
      data?: Uint8Array;
      params?: {
        timescale: number;
        dsd: number;
      };
    }>,
    _callback: (d: ResponseData) => void
  ): void => {
    const callback: (d: ResponseData) => void = _callback || (() => {});
    const self = this;
    const request: XMLHttpRequest = new XMLHttpRequest();
    let needFailureReport: boolean = true;
    let initURL: string;

    this.getInitRequestUrl(
      representation.initialization,
      representation,
      (d) => {
        if (d.status === 'ok') {
          initURL = d.data;
          request.onload = () => {
            if (request.status < 200 || request.status > 299) {
              return;
            }
            needFailureReport = false;
            initData[representation.index] = {};
            if (convertCodecType === undefined) {
              initData[representation.index].data = new Uint8Array(
                request.response
              );
            } else {
              initData[representation.index].data =
                this.checkAndConvertCodecType.call(
                  self,
                  new Uint8Array(request.response)
                );
            }
            initData[representation.index].params = this.getMoovParams.call(
              self,
              initData[representation.index].data!,
              representation.adaptation!.type!
            );
            callback({
              status: 'ok',
              data: initData[representation.index],
            });
          };
          request.onloadend = request.onerror = () => {
            if (!needFailureReport) {
              return;
            }
            this.onError({
              status: request!.status!,
              req: request!,
              xhr: request!,
            });
            needFailureReport = false;
            callback({
              status: 'error',
              msg: 'getInitializationData failed',
            });
          };

          this.requestWithRange(
            request,
            initURL,
            representation.range != null ? representation.range : null,
            null
          );
        } else {
          callback({
            status: 'error',
            msg: d.msg,
          });
        }
      }
    );
  };

  getInitializationDataF = (
    representation: Representation,
    convertCodecType: boolean | undefined,
    initData: Array<{
      data?: Uint8Array;
      params?: {
        timescale: number;
        dsd: number;
      };
    }>,
    _callback: (d: ResponseData) => void
  ): void => {
    const callback: (d: ResponseData) => void = _callback || (() => {});
    const self = this;
    const request: ExXMLHttpRequest = {};

    const init: RequestInit = {
      method: 'GET',
      headers: {},
      credentials: 'same-origin',
    };

    let initURL: string;
    this.getInitRequestUrl(
      representation.initialization,
      representation,
      (d) => {
        if (d.status === 'ok') {
          initURL = d.data;

          this.requestWithRange(
            request,
            initURL,
            representation.range != null ? representation.range : null,
            init
          );
          fetch(request.url as RequestInfo, init)
            .then((res) => {
              if (res.ok == true) {
                return res.arrayBuffer();
              } else {
                return Promise.reject(new Error('res.false'));
              }
            })
            .then((ab) => {
              this.onSuccess({
                status: request!.status!,
                req: request!,
                xhr: request!,
              });
              initData[representation.index] = {};
              if (convertCodecType === undefined) {
                initData[representation.index].data = new Uint8Array(ab);
              } else {
                initData[representation.index].data =
                  this.checkAndConvertCodecType.call(self, new Uint8Array(ab));
              }
              initData[representation.index].params = this.getMoovParams.call(
                self,
                initData[representation.index].data!,
                representation.adaptation!.type!
              );
              callback({
                status: 'ok',
                data: initData[representation.index],
              });
            })
            .catch((_err) => {
              this.onError({
                status: request!.status!,
                req: request!,
                xhr: request!,
              });
              callback({
                status: 'error',
                msg: 'getInitializationData failed',
              });
            });
        } else {
          callback({
            status: 'error',
            msg: d.msg,
          });
        }
      }
    );
  };

  getInitializationData = (
    representation: Representation,
    convertCodecType: boolean | undefined,
    initData: Array<InitData>,
    _callback: (d: ResponseData) => void
  ): void => {
    this.useFetch
      ? this.getInitializationDataF(
          representation,
          convertCodecType,
          initData,
          _callback
        )
      : this.getInitializationDataX(
          representation,
          convertCodecType,
          initData,
          _callback
        );
  };

  getFillerData = (
    protection: boolean,
    type: string,
    codec: string,
    mode: string,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    let request: ExXMLHttpRequest;
    let needFailureReport: boolean = true;
    let fillerURL: string = '';

    if (mode == 'SILA_INSERT_MODE') {
      if (type === 'video') {
        if (codec.indexOf('avc') > 0) {
          if (protection) {
            fillerURL = 'asset/b2k_ff_i05.dat';
          } else {
            fillerURL = 'asset/b2k_no_i05.dat';
          }
        } else if (codec.indexOf('hvc') > 0) {
          if (protection) {
            fillerURL = 'asset/b4k_ff_v_vc_i05.dat';
          } else {
            fillerURL = 'asset/b4k_no_v_vc_i05.dat';
          }
        } else if (codec.indexOf('hev') > 0) {
          if (protection) {
            fillerURL = 'asset/b4k_ff_v_ev_i05.dat';
          } else {
            fillerURL = 'asset/b4k_no_v_ev_i05.dat';
          }
        }
      } else {
        if (protection) {
          fillerURL = 'asset/si_ff_a.dat';
        } else {
          fillerURL = 'asset/si_no_a.dat';
        }
      }
    } else if (mode == 'FILL_UP_THE_HEAD') {
      if (type === 'video') {
        if (codec.indexOf('avc') > 0) {
          if (protection) {
            fillerURL = 'asset/b2k_ff_v_i10.dat';
          } else {
            fillerURL = 'asset/b2k_no_v_i10.dat';
          }
        } else if (codec.indexOf('hvc') > 0) {
          if (protection) {
            fillerURL = 'asset/b4k_ff_v_vc_i10.dat';
          } else {
            fillerURL = 'asset/b4k_no_v_vc_i10.dat';
          }
        } else if (codec.indexOf('hev') > 0) {
          if (protection) {
            fillerURL = 'asset/b4k_ff_v_ev_i10.dat';
          } else {
            fillerURL = 'asset/b4k_no_v_ev_i10.dat';
          }
        }
      } else {
        if (protection) {
          fillerURL = 'asset/b4k_ff_a_i10.dat';
        } else {
          fillerURL = 'asset/b4k_no_a_i10.dat';
        }
      }
    }

    if (!this.useFetch) {
      request = new XMLHttpRequest();

      request.onload = () => {
        if (request.status! < 200 || request.status! > 299) {
          return;
        }
        this.onSuccess({
          status: request!.status!,
          req: request!,
          xhr: request!,
        });
        needFailureReport = false;
        callback({
          status: 'ok',
          data: request.response,
        });
      };
      request.onloadend = request.onerror = () => {
        if (!needFailureReport) {
          return;
        }
        needFailureReport = false;
        this.onError({
          status: request!.status!,
          req: request!,
          xhr: request!,
        });
        callback({
          status: 'error',
          msg: 'getFillerData failed',
        });
      };
      this.requestWithRange(request, fillerURL, null, null);
    } else {
      const init: RequestInit = {
        method: 'GET',
        headers: {},
        credentials: 'same-origin',
      };
      request = {};
      this.requestWithRange(request, fillerURL, null, init);

      fetch(request.url!, init)
        .then((res) => {
          if (res.ok == true) {
            return res.arrayBuffer();
          } else {
            return Promise.reject(new Error('res.false'));
          }
        })
        .then((ab) => {
          this.onSuccess({
            status: request!.status!,
            req: request!,
            xhr: request!,
          });
          callback({
            status: 'ok',
            data: ab,
          });
        })
        .catch((_err) => {
          // eslint-disable-line no-unused-vars
          this.onError({
            status: request!.status!,
            req: request!,
            xhr: request!,
          });
          callback({
            status: 'error',
            msg: 'getFillerData failed',
          });
        });
    }
  };

  getDummyData = (
    protection: boolean,
    type: string,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    let request: ExXMLHttpRequest;
    let needFailureReport: boolean = true;
    let dmyURL: string = '';

    if (type === 'video') {
      if (protection) {
        dmyURL = 'asset/b20_ff_v_i20_05.dat';
      } else {
        dmyURL = 'asset/b20_no_v_i20_i05.dat';
      }
    } else {
      // eslint-disable-line no-empty
    }

    if (!this.useFetch) {
      request = new XMLHttpRequest();
      request.onload = () => {
        if (request.status! < 200 || request.status! > 299) {
          return;
        }
        this.onSuccess({
          status: request!.status!,
          req: request!,
          xhr: request!,
        });
        needFailureReport = false;
        callback({
          status: 'ok',
          data: request.response,
        });
      };
      request.onloadend = request.onerror = () => {
        if (!needFailureReport) {
          return;
        }
        this.onError({
          status: request!.status!,
          req: request!,
          xhr: request!,
        });
        needFailureReport = false;
        callback({
          status: 'error',
          msg: 'getDummyData failed',
        });
      };

      this.requestWithRange(request, dmyURL, null, null);
    } else {
      const init: RequestInit = {
        method: 'GET',
        headers: {},
        credentials: 'same-origin',
      };
      request = {};
      this.requestWithRange(request, dmyURL, null, init);

      fetch(request.url!, init)
        .then((res) => {
          if (res.ok == true) {
            return res.arrayBuffer();
          } else {
            return Promise.reject(new Error('res.false'));
          }
        })
        .then((ab) => {
          this.onSuccess({
            status: request!.status!,
            req: request!,
            xhr: request!,
          });
          callback({
            status: 'ok',
            data: ab,
          });
        })
        .catch((_err) => {
          // eslint-disable-line no-unused-vars
          this.onError({
            status: request!.status!,
            req: request!,
            xhr: request!,
          });
          callback({
            status: 'error',
            msg: 'getDummyData failed',
          });
        });
    }
  };

  /* istanbul ignore next */
  findSIDX = (
    data: ArrayBuffer,
    info: Info,
    _callback: (res: ResponseData) => void
  ): void => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    const d: DataView = new DataView(data);
    let request: ExXMLHttpRequest;
    let pos: number = 0;
    let type: string = '';
    let size: number = 0;
    let bytesAvailable: number;
    let sidxBytes: ArrayBuffer;
    let sidxSlice: Uint8Array;
    let sidxOut: Uint8Array;
    let c: number;
    let needFailureReport: boolean = true;
    let parsed: SIdx;
    let ref: Nullable<Array<Reference>> | undefined;
    let loadMultiSidx: boolean = false;
    const self = this;

    this.NXDebug.log('Searching for SIDX box.');
    this.NXDebug.log(info.bytesLoaded + ' bytes loaded.');

    while (type !== 'sidx' && pos < d.byteLength) {
      size = d.getUint32(pos); // subtract 8 for including the size and type
      pos += 4;

      type = '';
      for (let i = 0; i < 4; i += 1) {
        c = d.getInt8(pos);
        type += String.fromCharCode(c);
        pos += 1;
      }

      if (type !== 'sidx') {
        pos += size - 8;
      }
    }

    bytesAvailable = d.byteLength - pos;

    if (type !== 'sidx') {
      // Case 1
      // We didn't download enough bytes to find the sidx.
      // TODO : Load more bytes.
      //        Be sure to detect EOF.
      //        Throw error is no sidx is found in the entire file.
      //        Protection from loading the entire file?

      callback({
        status: 'error',
        msg: "We didn't download enough bytes to find the sidx.",
      });
    } else if (bytesAvailable < size - 8) {
      // Case 2
      // We don't have the entire box.
      // Increase the number of bytes to read and load again.
      this.NXDebug.log("Found SIDX but we don't have all of it.");

      info.range.start = 0;
      info.range.end = info.bytesLoaded + (size - bytesAvailable);

      if (!this.useFetch) {
        request = new XMLHttpRequest();

        request.onload = () => {
          if (request.status! < 200 || request.status! > 299) {
            return;
          }
          needFailureReport = false;

          info.bytesLoaded = info.range.end!;
          this.onSuccess({
            status: request!.status!,
            req: request!,
            xhr: request!,
          });
          this.findSIDX.call(self, request.response, info, (d) => {
            if (d.status === 'ok') {
              callback({
                status: 'ok',
                data: d.data,
              });
            } else {
              callback({
                status: 'error',
                msg: 'find SIDX error',
              });
            }
          });
        };

        request.onloadend = request.onerror = () => {
          if (!needFailureReport) {
            return;
          }
          needFailureReport = false;

          this.onError({
            status: request!.status!,
            req: request!,
            xhr: request!,
          });
          this.errHandler.downloadError(
            this.eventBus,
            'SIDX',
            info.url,
            request
          );
          callback({
            status: 'error',
            msg: 'findSIDX request error',
          });
        };

        this.requestWithRange(
          request,
          info.url,
          info.range.start + '-' + info.range.end,
          null
        );
      } else {
        const init: RequestInit = {
          method: 'GET',
          headers: {},
          credentials: 'same-origin',
        };
        request = {};

        this.requestWithRange(
          request,
          info.url,
          info.range.start + '-' + info.range.end,
          init
        );

        fetch(request.url as RequestInfo, init)
          .then((res) => {
            if (res.ok == true) {
              return res.arrayBuffer();
            } else {
              return Promise.reject(new Error('res.false'));
            }
          })
          .then((ab) => {
            info.bytesLoaded = info.range.end!;
            this.onSuccess({
              status: request!.status!,
              req: request!,
              xhr: request!,
            });
            this.findSIDX.call(self, ab, info, (d) => {
              if (d.status === 'ok') {
                callback({
                  status: 'ok',
                  data: d.data,
                });
              } else {
                callback({
                  status: 'error',
                  msg: 'find SIDX error',
                });
              }
            });
          })
          .catch((_err) => {
            // eslint-disable-line no-unused-vars
            this.onError({
              status: request!.status!,
              req: request!,
              xhr: request!,
            });
            this.errHandler.downloadError(
              this.eventBus,
              'SIDX',
              info.url,
              request
            );
            callback({
              status: 'error',
              msg: 'findSIDX request error',
            });
          });
      }
    } else {
      // Case 3
      // We have the entire box, so parse it and continue.
      info.range.start = pos - 8;
      info.range.end = info.range.start + size;

      this.NXDebug.log(
        'Found the SIDX box.  Start: ' +
          info.range.start +
          ' | End: ' +
          info.range.end
      );
      sidxBytes = new ArrayBuffer(info.range.end - info.range.start);
      sidxOut = new Uint8Array(sidxBytes);
      sidxSlice = new Uint8Array(
        data,
        info.range.start,
        info.range.end - info.range.start
      );
      sidxOut.set(sidxSlice);

      parsed = this.parseSIDX.call(this, sidxBytes, info.range.start);

      // We need to check to see if we are loading multiple sidx.
      // For now just check the first reference and assume they are all the same.
      // TODO : Can the referenceTypes be mixed?
      // TODO : Load them all now, or do it as needed?

      ref = parsed.references;
      if (ref !== null && ref !== undefined && ref.length > 0) {
        loadMultiSidx = ref[0].type === 1;
      }

      if (loadMultiSidx) {
        this.NXDebug.log('Initiate multiple SIDX load.');
        let ss: number;
        let se: number;
        let r: string;
        let segs: Array<Segment>;
        const sidxs: Array<Segment> = new Array(ref!.length);
        let sidxsCount: number = ref!.length;

        for (let j = 0, len = ref!.length; j < len; j += 1) {
          ss = ref![j].offset;
          se = ref![j].offset + ref![j].size - 1;
          r = ss + '-' + se;

          this.loadSegments.call(self, info.url, r, (d) => {
            if (d.status === 'ok') {
              sidxsCount--;
              sidxs[j] = d.data;
            } else {
              sidxsCount--;
            }
            if (sidxsCount === 0) {
              segs = [];
              for (let jj = 0; jj < sidxs.length; jj++) {
                segs = segs.concat(sidxs[jj]);
              }
              callback({
                status: 'ok',
                data: segs,
              });
            }
          });
        }
      } else {
        this.NXDebug.log('Parsing segments from SIDX.');
        callback({
          status: 'ok',
          data: this.parseSegments.call(
            self,
            sidxBytes,
            info.url,
            info.range.start
          ),
        });
      }
    }
  };

  loadSegments = (
    media: string,
    theRange: Nullable<string>,
    _callback: (res: ResponseData) => void
  ) => {
    const callback: (res: ResponseData) => void = _callback || (() => {});
    let request: ExXMLHttpRequest | undefined;
    let parts: Array<string>;
    let needFailureReport: boolean = true;
    const self = this;

    const info: Info = {
      url: media,
      range: {},
      searching: false,
      bytesLoaded: 0,
      bytesToLoad: 1500,
      request,
    };

    // We might not know exactly where the sidx box is.
    // Load the first n bytes (say 1500) and look for it.
    if (theRange === null) {
      this.NXDebug.log('No known range for SIDX request.');
      info.searching = true;
      info.range.start = 0;
      info.range.end = info.bytesToLoad;
    } else {
      parts = theRange.split('-');
      info.range.start = parseFloat(parts[0]);
      info.range.end = parseFloat(parts[1]);
    }

    if (!this.useFetch) {
      request = new XMLHttpRequest();
      request.onload = () => {
        const path = info.url.split('/');
        this.logHandler.log_d(
          request!.status +
            ': ' +
            path[path.length - 1] +
            ' , ' +
            info.range.start +
            '-' +
            info.range.end +
            ' sidx'
        );
        if (request!.status! < 200 || request!.status! > 299) {
          return;
        }
        needFailureReport = false;

        this.onSuccess({
          status: request!.status!,
          req: request!,
          xhr: request!,
        });
        // If we didn't know where the SIDX box was, we have to look for it.
        // Iterate over the data checking out the boxes to find it.
        if (info.searching) {
          info.bytesLoaded = info.range.end!;
          this.findSIDX.call(self, request!.response, info, (d) => {
            callback(d);
          });
        } else {
          callback({
            status: 'ok',
            data: this.parseSegments.call(
              self,
              request!.response,
              info.url,
              info.range.start
            ),
          });
        }
      };

      request.onloadend = request.onerror = () => {
        if (!needFailureReport) {
          return;
        }
        needFailureReport = false;

        this.onError({
          status: request!.status!,
          req: request!,
          xhr: request!,
        });
        this.errHandler.downloadError(
          this.eventBus,
          'SIDX',
          info.url,
          request!
        );
        callback({
          status: 'error',
          msg: 'loadSegments error',
        });
      };

      this.requestWithRange(
        request,
        info.url,
        info.range.start + '-' + info.range.end,
        null
      );
      this.NXDebug.debug('Perform SIDX load: ' + info.url);
    } else {
      const init: RequestInit = {
        method: 'GET',
        headers: {},
        credentials: 'same-origin',
      };
      request = {};
      this.requestWithRange(
        request,
        info.url,
        info.range.start + '-' + info.range.end,
        init
      );
      this.NXDebug.debug('Perform SIDX load: ' + info.url);

      fetch(request.url as RequestInfo, init)
        .then((res) => {
          if (res.ok == true) {
            return res.arrayBuffer();
          } else {
            return Promise.reject(new Error('res.false'));
          }
        })
        .then((ab) => {
          // If we didn't know where the SIDX box was, we have to look for it.
          // Iterate over the data checking out the boxes to find it.
          if (info.searching) {
            info.bytesLoaded = info.range.end!;
            this.onSuccess({
              status: request!.status!,
              req: request!,
              xhr: request!,
            });
            this.findSIDX.call(self, ab, info, (d) => {
              callback(d);
            });
          } else {
            callback({
              status: 'ok',
              data: this.parseSegments.call(
                self,
                ab,
                info.url,
                info.range.start
              ),
            });
          }
        })
        .catch((_err) => {
          // eslint-disable-line no-unused-vars
          this.onError({
            status: request!.status!,
            req: request!,
            xhr: request!,
          });
          this.errHandler.downloadError(
            this.eventBus,
            'SIDX',
            info.url,
            request!
          );
          callback({
            status: 'error',
            msg: 'loadSegments error',
          });
        });
    }
  };

  setupRequestStatus = (type: string, _index?: number, _loc?): void => {
    const index: number = _index || -1;
    this.requestStatus[type] = {
      index,
      requestedTime: null,
    };
  };

  setIsDynamic = (value: boolean): void => {
    this.isDynamic = value;
  };

  setEpsilonFor = (type: 'video' | 'audio' | '', tolerance: number): void => {
    this.epsilonVal[type] = tolerance;
  };

  getInitRequest = this.getInit;
  getSegmentRequestForTime = this.getForTime;
  getNextSegmentRequest = this.getNext;
}
