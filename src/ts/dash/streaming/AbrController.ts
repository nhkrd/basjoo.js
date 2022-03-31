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
import { AdaptationSet } from '../manifest/ManifestModel';
import { Metrics } from './MetricsModel';
import { hasProperty } from '../core/Utils';

/**
 * AbrController
 *
 * @module AbrController（AbrControllerモジュール）
 */

const NO_CHANGE: number = 0;
const SWITCH_DOWN: number = 1;
const SWITCH_UP: number = 2;
const NXDebug = new Debug();

export const getInternalQuality = (
  qualityDict: QualityDict,
  type: string
): number => {
  let quality: number;

  if (!hasProperty(qualityDict, type)) {
    qualityDict[type] = 0;
  }

  quality = qualityDict[type];

  return quality;
};

export const getInternalConfidence = (
  confidenceDict: ConfidenceDict,
  type: string
): number => {
  let confidence: number;

  if (!hasProperty(confidenceDict, type)) {
    confidenceDict[type] = 0;
  }

  confidence = confidenceDict[type];

  return confidence;
};

//NSV-a const getAverageDownloadRatio = (averageDownloadRatio, type, value) => {
//NSV-a   if (!utils.hasProperty(averageDownloadRatio, type)) {
//NSV-a     averageDownloadRatio[type] = value;
//NSV-a   } else {
//NSV-a     averageDownloadRatio[type] =
//NSV-a       0.75 * averageDownloadRatio[type] + 0.25 * value;
//NSV-a   }
//NSV-a   return averageDownloadRatio[type];
//NSV-a };

export const getAverageDownloadRate = (
  averageDownloadRate: DownloadRate,
  type: string,
  value: number
): number => {
  if (!hasProperty(averageDownloadRate, type)) {
    averageDownloadRate[type] = value;
  } else {
    averageDownloadRate[type] = 0.75 * averageDownloadRate[type] + 0.25 * value;
  }
  return averageDownloadRate[type];
};

/* istanbul ignore next */
const checkDownloadRatio = (
  current: number,
  metrics: Metrics,
  data: AdaptationSet,
  level: number,
  lastRequest: Nullable<RevisedHttpRequestMetrics>,
  lastCheckedRequest: CheckedRequestList,
  downloadRateList: DownloadList,
  downloadDiffList: DownloadList,
  _averageDownloadRatio: Object,
  averageDownloadRate: DownloadRate,
  minBufferTime: number,
  aborted: boolean,
  _stalled: boolean
): Nullable<DownloadRatioResult> => {
  // eslint-disable-line no-unused-vars
  let totalTime: number;

  let downloadRatio: number;
  let totalRatio: number;
  const DOWNLOAD_RATIO_SAFETY_FACTOR: number = 0.9;

  let decideTarget: boolean = false;
  let c: number;

  if (!metrics) {
    return {
      idx: current,
      switchTo: NO_CHANGE,
    };
  }

  if (lastRequest === null) {
    NXDebug.log('No requests made for this stream yet, bailing.');
    return {
      idx: current,
      switchTo: NO_CHANGE,
    };
  } else if (lastRequest === lastCheckedRequest[data.type!]) {
    return {
      idx: current,
      switchTo: NO_CHANGE,
    };
  } else {
    lastCheckedRequest[data.type!] = lastRequest;
  }

  totalTime = (lastRequest.tfinish! - lastRequest.trequest!) / 1000;

  if (totalTime <= 0) {
    return {
      idx: current,
      switchTo: NO_CHANGE,
    };
  }

  const dlrate: number =
    ((8 * lastRequest.size!) / totalTime) * DOWNLOAD_RATIO_SAFETY_FACTOR;
  getAverageDownloadRate(averageDownloadRate, data.type!, dlrate);
  if (downloadRateList[data.type!].length > 2) {
    downloadRateList[data.type!].shift();
  }
  downloadRateList[data.type!].push(dlrate);

  if (downloadDiffList[data.type!].length > 2) {
    downloadDiffList[data.type!].shift();
  }

  if (lastRequest.code == 408) {
    downloadDiffList[data.type!].push(-totalTime);
  } else {
    downloadDiffList[data.type!].push(lastRequest.mediaduration! - totalTime);
  }

  if (level === undefined) {
    return {
      idx: current,
      switchTo: NO_CHANGE,
    };
  }

  if (
    lastRequest.mediaduration === null ||
    lastRequest.mediaduration === undefined ||
    lastRequest.mediaduration <= 0 ||
    isNaN(lastRequest.mediaduration)
  ) {
    return {
      idx: current,
      switchTo: NO_CHANGE,
    };
  }

  totalRatio =
    lastRequest.code != 408 ? lastRequest.mediaduration / totalTime : 0.1;

  downloadRatio = totalRatio * DOWNLOAD_RATIO_SAFETY_FACTOR;
  if (isNaN(downloadRatio) || isNaN(totalRatio)) {
    NXDebug.log('The ratios are NaN, bailing.');
    return {
      idx: current,
      switchTo: NO_CHANGE,
    };
  }

  const r: number =
    level < lastRequest.mediaduration * 1.5 || downloadRatio < 1.0 ? 1.5 : 1.0;

  if (isNaN(downloadRatio)) {
    return {
      idx: current,
      switchTo: NO_CHANGE,
    };
  } else if (downloadRatio < 1.0) {
    if (level < lastRequest.mediaduration) {
      return {
        idx: 0,
        switchTo: SWITCH_DOWN,
      };
    }
    if (dlrate < data.representations![current].bandwidth! * r) {
      if (current > 0) {
        decideTarget = false;
        for (c = current - 1; c >= 0; c--) {
          if (dlrate >= data.representations![c].bandwidth! * r) {
            decideTarget = true;
            return {
              idx: c,
              switchTo: SWITCH_DOWN,
            };
          }
        }
        if (!decideTarget) {
          return {
            idx: 0,
            switchTo: SWITCH_DOWN,
          };
        }
      } else {
        return {
          idx: 0,
          switchTo: NO_CHANGE,
        };
      }
    } else {
      let diff = 0;
      for (let i = 0; i < downloadDiffList[data.type!].length; i++) {
        diff += downloadDiffList[data.type!][i];
      }

      if (aborted) {
        return {
          idx: Math.max(current - 2, 0),
          switchTo: SWITCH_DOWN,
        };
      } else if (diff < 0 && level < lastRequest.mediaduration * 2) {
        return {
          idx: Math.max(current - 1, 0),
          switchTo: SWITCH_DOWN,
        };
      } else {
        return {
          idx: current,
          switchTo: NO_CHANGE,
        };
      }
    }
  } else {
    let noChange: boolean = false;
    if (level < minBufferTime) {
      const bw: number = data.representations![current].bandwidth! * r;
      for (let i = 0; i < downloadRateList[data.type!].length; i++) {
        if (downloadRateList[data.type!][i] < bw) {
          noChange = true;
          break;
        }
      }
    }
    const max: number = data.representations!.length;
    if (noChange) {
      return {
        idx: current,
        switchTo: NO_CHANGE,
      };
    } else if (current < max) {
      decideTarget = false;
      for (c = current; c < max; c++) {
        if (dlrate < data.representations![c].bandwidth! * r) {
          decideTarget = true;
          if (c == current + 1) {
            return {
              idx: c - 1,
              switchTo: NO_CHANGE,
            };
          } else {
            return {
              idx: c - 1,
              switchTo: SWITCH_UP,
            };
          }
        }
      }

      if (!decideTarget) {
        return {
          idx: max - 1,
          switchTo: SWITCH_UP,
        };
      }
    } else {
      return {
        idx: current,
        switchTo: NO_CHANGE,
      };
    }
  }

  return null;
};

export class AbrController {
  autoSwitchBitrate: boolean;
  qualityDict: QualityDict;
  defaultQualityDict: QualityDict;
  averageDownloadRatio: { [type: string]: number };
  averageDownloadRate: DownloadRate;
  confidenceDict: ConfidenceDict;
  maxQualityIndexDict: IndexDict;
  minBufferTime: number;
  lastCheckedRequest: CheckedRequestList;
  downloadRateList: DownloadList;
  downloadDiffList: DownloadList;
  NXDebug: Debug;

  constructor() {
    this.autoSwitchBitrate = true;
    this.qualityDict = {};
    this.defaultQualityDict = {
      video: 0,
      audio: 0,
    };
    this.averageDownloadRatio = {};
    this.averageDownloadRate = {};
    this.confidenceDict = {};
    this.maxQualityIndexDict = {};
    this.minBufferTime = 4;
    this.lastCheckedRequest = {
      video: null,
      audio: null,
    };
    this.downloadRateList = {
      video: [],
      audio: [],
    };
    this.downloadDiffList = {
      video: [],
      audio: [],
    };
    this.NXDebug = new Debug();
  }

  getAutoSwitchBitrate(): boolean {
    return this.autoSwitchBitrate;
  }

  setAutoSwitchBitrate(value: boolean): void {
    this.autoSwitchBitrate = value;
  }

  /* istanbul ignore next */
  getPlaybackQuality(
    type: string,
    data: AdaptationSet,
    metrics: Metrics,
    level: number,
    aborted: boolean,
    stalled: boolean
  ): PlaybackQuality {
    let values: Nullable<DownloadRatioResult>;
    let quality: number;
    let confidence: number;

    quality = getInternalQuality(this.qualityDict, type);
    confidence = getInternalConfidence(this.confidenceDict, type);

    if (this.autoSwitchBitrate) {
      values = checkDownloadRatio(
        quality,
        metrics,
        data,
        level,
        metrics.getCurrentRevisedHttpRequest(),
        this.lastCheckedRequest,
        this.downloadRateList,
        this.downloadDiffList,
        this.averageDownloadRatio,
        this.averageDownloadRate,
        this.minBufferTime,
        aborted,
        stalled
      );
      if (values != null) {
        if (values.idx < 0) values.idx = 0;
        this.qualityDict[type] = values.idx;
        this.confidenceDict[type] = values.switchTo;
        return {
          quality: values.idx,
          confidence: values.switchTo,
        };
      } else {
        return {
          quality,
          confidence,
        };
      }
    } else {
      //NXDebug.debug(type + " Unchanged quality of " + quality);
      return {
        quality,
        confidence,
      };
    }
  }

  /* istanbul ignore next */
  setPlaybackQuality(type: string, newPlaybackQuality: number): void {
    const quality: number = getInternalQuality(this.qualityDict, type);

    if (newPlaybackQuality !== quality) {
      this.qualityDict[type] = newPlaybackQuality;
    }
  }

  /* istanbul ignore next */
  getQualityFor(type: string): number {
    return getInternalQuality(this.qualityDict, type);
  }

  setDefaultPlaybackQuality(type: string, quality: number): void {
    this.defaultQualityDict[type] = quality;
  }

  getDefaultQualityFor(type: string): number {
    return this.defaultQualityDict[type];
  }

  setMaxQualityIndex(type: string, max: number): void {
    this.maxQualityIndexDict[type] = max - 1;
    if (hasProperty(this.qualityDict, type)) {
      if (this.qualityDict[type] > max - 1) {
        this.qualityDict[type] = max - 1;
      }
    }
  }

  // getDownloadDiffFor(type: string): number {
  //   let ret: number = 0;
  //   const len: number = this.downloadDiffList[type].length;
  //   if (len == 0) {
  //     return NaN;
  //   } else {
  //     for (let i = 0; i < len; i++) {
  //       ret += this.downloadDiffList[type][i];
  //     }
  //     return ret;
  //   }
  // }

  getMaxQualityIndexFor(type: string): number {
    return hasProperty(this.maxQualityIndexDict, type)
      ? this.maxQualityIndexDict[type]
      : 0;
  }

  setMinBufferTime(time: number): void {
    this.minBufferTime = time;
  }

  // getAverageDownloadRatio(type: string): number {
  //   return hasProperty(this.averageDownloadRatio, type)
  //     ? this.averageDownloadRatio[type]
  //     : 0;
  // }

  getAverageDownloadRate(type: string): number {
    return hasProperty(this.averageDownloadRate, type)
      ? this.averageDownloadRate[type]
      : 0;
  }

  matchingQualityBetweenDifferentAdaptation(
    from: AdaptationSet,
    to: AdaptationSet
  ): void {
    if (from === to) return;

    NXDebug.debug(
      '********* matchingQualityBetweenDifferentAdaptation *********'
    );
    const current: number = getInternalQuality(this.qualityDict, from.type!);
    let next: number = 0;
    const bandwidth: number = from.representations![current].bandwidth!;
    const dlrate: number = this.getAverageDownloadRate(from.type!);
    const th: number = Math.max(dlrate, bandwidth * 1.1);

    this.setMaxQualityIndex(to.type!, to.representations!.length);

    for (let i = to.representations!.length - 1; i >= 0; i--) {
      if (to.representations![i].bandwidth! <= th) {
        next = i;
        break;
      }
    }
    NXDebug.debug(
      '[' +
        from.type +
        '] from:[' +
        current +
        ']:' +
        bandwidth +
        ',' +
        'to:[' +
        next +
        ']:' +
        to.representations![next].bandwidth +
        ', averageDownloadRate:' +
        dlrate
    );
    this.setPlaybackQuality(from.type!, next);
  }
}
