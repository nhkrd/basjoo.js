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

import { AdaptationSet, BaseURL } from './ManifestModel';
import { Segment } from './DashHandler';

/**
 * Representation
 * @constructor
 */

export class Representation {
  id: Nullable<string>;
  index: number;
  BaseURL: Array<BaseURL>;
  adaptation: Nullable<AdaptationSet>;
  segmentInfoType: Nullable<string>;
  initialization: Nullable<string>;
  Initialization?: Nullable<Initialization>;
  SegmentTemplate?: Nullable<SegmentTemplate>;
  SegmentList?: SegmentList;
  bandwidth?: number;
  segmentDuration: number;
  timescale: number;
  startNumber?: number;
  indexRange: Nullable<string>;
  range: Nullable<string>; //range: Nullable<number | string>;
  presentationTimeOffset: Nullable<number>;
  MSETimeOffset: number;
  segmentAvailabilityRange: Nullable<TimeRange>;
  availableSegmentsNumber: number;
  codecs: Nullable<string>;
  mimeType: Nullable<string>;
  segments: Nullable<Array<Segment>>;
  indexOffset: number;
  availabilityTimeOffset: number;
  lastRequestIndex: number;
  transferCharacteristics: number;
  colourPrimaries: number;
  producerReferenceTime: ProducerReferenceTime;
  frameRate?: number;
  audioSamplingRate?: number;
  timestampOffsetFor32bitVE?: number;
  // inbandEventStreams?: Array<NXEventStream>;
  startTime?: number;
  width?: number;
  height?: number;

  constructor() {
    this.id = null;
    this.index = -1;
    this.BaseURL = [];
    this.adaptation = null;
    this.segmentInfoType = null;
    this.initialization = null;
    this.segmentDuration = NaN;
    this.timescale = 1;
    this.startNumber = 1;
    this.indexRange = null;
    this.range = null;
    this.presentationTimeOffset = 0;
    this.MSETimeOffset = NaN;
    this.segmentAvailabilityRange = null;
    this.availableSegmentsNumber = 0;
    this.codecs = null;
    this.mimeType = null;
    this.segments = null;
    this.indexOffset = 0;
    this.availabilityTimeOffset = 0;
    this.lastRequestIndex = -1;
    this.transferCharacteristics = 1;
    this.colourPrimaries = 1;
    this.producerReferenceTime = {
      id: null,
      inband: false,
      type: null,
      wallClockTime: null,
      presentationTime: NaN,
    };
  }
}
