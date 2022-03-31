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

import { BaseURL, ManifestModel } from './ManifestModel';
import { Period } from './Period';
/**
 * Mpd
 * @constructor
 */

export class Mpd {
  manifest: Nullable<ManifestModel>;
  BaseURL: Array<BaseURL>;
  targetLatency: number;
  targetLatencyMin: number;
  targetLatencyMax: number;
  referenceIdPRT: number;
  playbackRateMin: number;
  playbackRateMax: number;
  suggestedPresentationDelay: Nullable<number>;
  availabilityStartTime: Date;
  availabilityEndTime: Date;
  publishTime: Date | number;
  timeShiftBufferDepth: number;
  maxSegmentDuration: number;
  checkTime: number;
  timestampOffsetFor32bitVE: number;
  //liveMulti
  liveEdge: number;
  liveEdgeS: number;
  liveEdgeE: number;
  liveEdgeC: number;
  //liveMulti
  periods: Array<Period>;
  type?: string;
  mediaPresentationDuration?: number;
  minimumUpdatePeriod?: number;
  minBufferTime?: Nullable<number>;

  constructor() {
    this.manifest = null;
    this.BaseURL = [];
    this.targetLatency = NaN;
    this.targetLatencyMin = NaN;
    this.targetLatencyMax = NaN;
    this.referenceIdPRT = NaN; //this.referenceIdPRT = null;
    this.playbackRateMin = 1;
    this.playbackRateMax = 1;
    this.suggestedPresentationDelay = 20;
    this.availabilityStartTime = new Date(0);
    this.publishTime = NaN;
    this.availabilityEndTime = new Date(0);
    this.timeShiftBufferDepth = Number.POSITIVE_INFINITY;
    this.maxSegmentDuration = Number.POSITIVE_INFINITY;
    this.checkTime = NaN;
    this.timestampOffsetFor32bitVE = 0;
    this.liveEdge = NaN;
    this.liveEdgeS = NaN;
    this.liveEdgeE = NaN;
    this.liveEdgeC = NaN;
    this.periods = [];
  }
}
