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

import { _debug } from '../core/Debug';
import { AdaptationSet, BaseURL } from './ManifestModel';
import { Mpd } from './Mpd';
import { hasProperty } from '../core/Utils';

/**
 * Period
 * @constructor
 */

export class Period {
  id: Nullable<string>;
  index: number;
  duration: number;
  start: number;
  end: number;
  mpd: Nullable<Mpd>;
  type: Nullable<string>;
  BaseURL: Array<BaseURL>;
  selectedBaseURLIdx: number;
  liveEdge: number;
  liveEdgeS: number;
  liveEdgeE: number;
  liveEdgeC: number;
  temporalLiveEdgeDecided: {
    video: boolean;
    audio: boolean;
  };
  isClientServerTimeSyncCompleted: boolean;
  isClientServerTimeSyncCompletedForTC: boolean;
  clientServerTimeShift: number;
  timestampOffsetFor32bitVE: number;
  assetId: Nullable<string>;
  offset: number;
  liveEdgeFromRequest: number;
  outEventList: Array<Array<DashEvent>>;
  inEventList: Array<Array<DashEvent>>;
  adaptationSets: Array<AdaptationSet>;
  childNodes?: Array<any>;
  //  eventStreams?: Array<NXEventStream>;

  constructor() {
    this.id = null;
    this.index = -1;
    this.duration = NaN;
    this.start = NaN;
    this.end = Infinity;
    this.mpd = null;
    this.type = null;
    this.BaseURL = [];
    this.selectedBaseURLIdx = NaN;
    this.liveEdge = NaN;
    this.liveEdgeS = NaN;
    this.liveEdgeE = NaN;
    this.liveEdgeC = NaN;
    this.temporalLiveEdgeDecided = {
      video: false,
      audio: false,
    };
    this.isClientServerTimeSyncCompleted = false;
    this.isClientServerTimeSyncCompletedForTC = false;
    this.clientServerTimeShift = 0;
    this.timestampOffsetFor32bitVE = 0;
    this.assetId = null;
    this.offset = NaN;
    this.liveEdgeFromRequest = 0;
    this.outEventList = [];
    this.inEventList = [];
    this.adaptationSets = [];
  }

  getPrimaryMediaData(type: string): Nullable<AdaptationSet> {
    const adaptations = this.adaptationSets;

    const medias: Array<AdaptationSet> = [];

    for (let i = 0; i < adaptations.length; i++) {
      if (adaptations[i].type === type) {
        if (adaptations[i].getIsMain()) {
          return adaptations[i];
        } else {
          medias.push(adaptations[i]);
        }
      }
    }
    if (medias.length == 0) {
      return null;
    } else {
      return medias[0];
    }
  }

  getRolesFor(type: string): Array<RoleType> {
    const roles: Array<RoleType> = [];
    const asets: Array<AdaptationSet> = this.adaptationSets;
    for (let i = 0; i < asets.length; i++) {
      if (asets[i].type === type) {
        const role: RoleType = {
          index: i,
          id: asets[i].id,
          role: asets[i].getRole(),
        };
        roles.push(role);
      }
    }

    return roles;
  }

  getDataForId(id: number): Nullable<AdaptationSet> {
    const adaptations: Array<AdaptationSet> = this.adaptationSets;
    const len: number = adaptations.length;

    for (let i = 0; i < len; i++) {
      if (hasProperty(adaptations[i], 'id') && adaptations[i].id === id) {
        return adaptations[i];
      }
    }
    return null;
  }

  getDataForIndex = (index: number): AdaptationSet => {
    return this.adaptationSets[index];
  };

  getDataForRole = (
    type: string,
    value: RoleType | string
  ): Nullable<AdaptationSet> => {
    const asets: Array<AdaptationSet> = this.adaptationSets;

    for (let i = 0; i < asets.length; i++) {
      if (asets[i].type == type) {
        if (asets[i].getRole() == value) {
          return asets[i];
        }
      }
    }
    return this.getPrimaryMediaData(type);
  };
}
