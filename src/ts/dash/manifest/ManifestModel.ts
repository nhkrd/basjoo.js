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

import { BASE64 } from '../core/Base64';
import Debug from '../core/Debug';
import ErrorHandler from '../core/ErrorHandler';
import { EventBus } from '../core/EventBus';
import LogHandler from '../core/LogHandler';
import { Mpd } from './Mpd';
import { Period } from './Period';
import { Representation } from './Representation';
import TimelineConverter from './TimelineConverter';
import { hasProperty } from '../core/Utils';

export const SECONDS_IN_YEAR: number = 365 * 24 * 60 * 60;
export const SECONDS_IN_MONTH: number = 30 * 24 * 60 * 60;

export const SECONDS_IN_DAY: number = 24 * 60 * 60;
export const SECONDS_IN_HOUR: number = 60 * 60;
export const SECONDS_IN_MIN: number = 60;
export const MINUTES_IN_HOUR: number = 60;
export const MILLISECONDS_IN_SECONDS: number = 1000;

const durationRegex: RegExp =
  /^P(([\d.]*)Y)?(([\d.]*)M)?(([\d.]*)D)?T?(([\d.]*)H)?(([\d.]*)M)?(([\d.]*)S)?/;
const datetimeRegex: RegExp =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]*)(\.[0-9]*)?)?(?:([+-])([0-9]{2})([0-9]{2}))?/;
// NSV-a const numericRegex: RegExp = /^[-+]?[0-9]+[.]?[0-9]*([eE][-+]?[0-9]+)?$/;
const frameRateRegex: RegExp = /^([0-9]+[.]?[0-9]*)\/?([0-9]*)/;

/**
 * ManifestModel
 *
 * @module ManifestModel（ManifestModelモジュール）
 */

/**
 * BaseURL
 * @constructor
 */
export class BaseURL {
  url: Nullable<string>;
  availabilityTimeOffset: Nullable<number>;
  constructor() {
    this.url = null;
    this.availabilityTimeOffset = null;
  }

  copy(): BaseURL {
    const b: BaseURL = new BaseURL();
    b.url = this.url;
    b.availabilityTimeOffset = this.availabilityTimeOffset;
    return b;
  }
}

/**
 * ServiceDescription
 * @constructor
 */
export class ServiceDescription {
  id: number;

  constructor() {
    'use strict';
    this.id = NaN;
  }
}

/**
 * AdaptationSet
 * @constructor
 */
export class AdaptationSet {
  period: Nullable<Period>;
  id: Nullable<number>;
  index: number;
  representations: Nullable<Array<Representation>>;
  contentProtections: Nullable<Array<ContentProtection>>;
  hasMpdPssh: boolean;
  BaseURL: Array<Partial<BaseURL>>;
  Role: Nullable<string>;
  lang: Nullable<string>;
  transferCharacteristics: number;
  colourPrimaries: number;
  availabilityTimeOffset: number;
  hasMpdData: boolean;
  type?: string;
  SegmentTemplate?: SegmentTemplate;
  attrs?: Object;
  mimeType?: Nullable<string>;
  childNodes?: any;

  constructor() {
    this.period = null;
    this.id = null;
    this.index = -1;
    this.representations = null;
    this.contentProtections = null;
    this.hasMpdPssh = false;
    this.BaseURL = [];
    this.Role = null;
    this.lang = null;
    this.transferCharacteristics = 1;
    this.colourPrimaries = 1;
    this.availabilityTimeOffset = 0;
    this.hasMpdData = false;
  }

  getCodec(): string {
    const representation: Representation =
      this.representations![this.representations!.length - 1];

    const codec: string =
      representation.mimeType + ';codecs="' + representation.codecs + '"';

    return codec;
  }

  getFrameRate(): number {
    return this.representations![0].frameRate!;
  }

  getAudioSamplingRate(): number {
    return this.representations![0].audioSamplingRate!;
  }

  getMimeType(): Nullable<string> {
    return this.representations![0].mimeType;
  }

  getIsMain(): boolean /*adaptation*/ {
    return this.Role === 'main';
  }

  getRole(): string {
    return this.Role ? this.Role : 'none';
  }

  getContentProtectionData(): Nullable<Array<ContentProtection>> {
    if (
      this.contentProtections != null &&
      this.contentProtections.length !== 0
    ) {
      return this.contentProtections;
    } else {
      return null;
    }
  }

  getRepresentations(): Array<Representation> {
    return this.representations!;
  }
}

/**
 * DashEvent
 * @constructor
 */
//export class DashEvent {
//  duration: number;
//  presentationTime: number;
//  id: number;
//  messageData: string;
//  eventStream: Nullable<NXEventStream>;
//  presentationTimeDelta: number;
//
//  constructor() {
//    this.duration = NaN;
//    this.presentationTime = NaN;
//    this.id = NaN;
//    this.messageData = '';
//    this.eventStream = null;
//    this.presentationTimeDelta = NaN; // Specific EMSG Box paramater
//  }
//}

/**
 * EventStream
 * @constructor
 */
//export class EventStream {
//  adaptionSet: Nullable<AdaptationSet>;
//  representation: Nullable<Representation>;
//  period: Nullable<Period>;
//  timescale: number;
//  value: string;
//  schemeIdUri: string;
//
//  constructor() {
//    this.adaptionSet = null;
//    this.representation = null;
//    this.period = null;
//    this.timescale = 1;
//    this.value = '';
//    this.schemeIdUri = '';
//  }
//}

/**
 * ManifestModel
 * @constructor
 */
export class ManifestModel {
  manifest: Nullable<ManifestModel>;
  DEFAULT_MANIFEST_REFRESH_DELAY: number;
  DEFAULT_PRESENTATION_DELAY: number;
  DEFAULT_BASEURL_IDX: number;
  SET_1STSEG_TIME_ZERO: boolean;
  supported_colour_primaries: Array<number>;
  supported_transfer_characteristics: Array<number>;
  unuseAudio: boolean;
  useFetch: boolean;
  manifestRefreshDelay: number;
  manifestRefreshTimer: Nullable<ReturnType<typeof setTimeout>>;
  manifestUpdateIsStopped: boolean;
  manifestUpdating: boolean;
  lastMpdLoadedTime: number;
  manifestText: Nullable<string>;
  clientServerTimeShift: number;
  timestampOffsetFor32bitVE: number;
  minBandwidth: {
    video: number;
    audio: number;
  };
  //liveMulti
  mpdCommonQrys: Array<CommonQuery>;
  mpdCommonHdrs: Array<CommonHeader>;
  mpdOnPrepare: (data: {
    status?: number;
    req: ExXMLHttpRequest;
    xhr: ExXMLHttpRequest;
    qrys?: Array<CommonQuery>;
    hdrs?: Array<CommonHeader>;
  }) => void;
  mpdOnSuccess: (data: {
    status: number;
    req: ExXMLHttpRequest;
    xhr: ExXMLHttpRequest;
  }) => void;
  mpdOnError: (data: {
    status: number;
    req: ExXMLHttpRequest;
    xhr: ExXMLHttpRequest;
  }) => void;
  xlinkCommonQrys: Array<CommonQuery>;
  xlinkCommonHdrs: Array<CommonHeader>;
  xlinkOnPrepare: (data: {
    status?: number;
    req: ExXMLHttpRequest;
    xhr: ExXMLHttpRequest;
    qrys?: Array<CommonQuery>;
    hdrs?: Array<CommonHeader>;
  }) => void;
  xlinkOnSuccess: (data: {
    status: number;
    req: ExXMLHttpRequest;
    xhr: ExXMLHttpRequest;
  }) => void;
  xlinkOnError: (data: {
    status: number;
    req: ExXMLHttpRequest;
    xhr: ExXMLHttpRequest;
  }) => void;
  maxBandwidth: {
    video: number;
    audio: number;
  };
  xlinks: Xlinks;
  xPeriods: XPeriods;
  RETRY_ATTEMPTS: number;

  RETRY_INTERVAL: number;
  NXDebug: Debug;
  eventBus: EventBus;
  mpdLoadedTime?: Date;
  Location?: string;
  errHandler = ErrorHandler;
  logHandler = LogHandler;
  timelineConverter = TimelineConverter;
  mpd?: Mpd;
  mpdUrl?: string;

  constructor(params: Paramstype, eventBus: EventBus, xhrCustom: XHRCustom) {
    this.manifest = null;

    this.DEFAULT_MANIFEST_REFRESH_DELAY =
      params.DEFAULT_MANIFEST_REFRESH_DELAY || 10;

    this.DEFAULT_PRESENTATION_DELAY = params.DEFAULT_PRESENTATION_DELAY || NaN;
    this.DEFAULT_BASEURL_IDX = params.DEFAULT_BASEURL_IDX || 0;

    this.SET_1STSEG_TIME_ZERO =
      params.SET_1STSEG_TIME_ZERO !== undefined
        ? params.SET_1STSEG_TIME_ZERO
        : true;

    this.supported_colour_primaries = params.SUPPORTED_COLOUR_PRIMARIES || [
      1, 9,
    ];

    this.supported_transfer_characteristics =
      params.SUPPORTED_TRANSFER_CHARACTERISTICS || [1, 16, 18];

    this.unuseAudio = params.UNUSE_AUDIO || false;
    this.useFetch = params.USE_FETCH && 'fetch' in window ? true : false;
    this.manifestRefreshDelay = NaN;
    this.manifestRefreshTimer = null;
    this.manifestUpdateIsStopped = false;
    this.manifestUpdating = false;
    this.lastMpdLoadedTime = 0;
    this.manifestText = null;
    this.clientServerTimeShift = NaN;
    this.timestampOffsetFor32bitVE = -1;

    this.minBandwidth = {
      video: NaN,
      audio: NaN,
    };

    this.mpdCommonQrys =
      hasProperty(xhrCustom, 'mpd') && hasProperty(xhrCustom['mpd'], 'query')
        ? xhrCustom['mpd']['query']
        : [];

    this.mpdCommonHdrs =
      hasProperty(xhrCustom, 'mpd') && hasProperty(xhrCustom['mpd'], 'header')
        ? xhrCustom['mpd']['header']
        : [];

    this.mpdOnPrepare =
      hasProperty(xhrCustom, 'mpd') &&
      hasProperty(xhrCustom['mpd'], 'onPrepare')
        ? xhrCustom['mpd']['onPrepare']
        : () => {};

    this.mpdOnSuccess =
      hasProperty(xhrCustom, 'mpd') &&
      hasProperty(xhrCustom['mpd'], 'onSuccess')
        ? xhrCustom['mpd']['onSuccess']
        : () => {};

    this.mpdOnError =
      hasProperty(xhrCustom, 'mpd') && hasProperty(xhrCustom['mpd'], 'onError')
        ? xhrCustom['mpd']['onError']
        : () => {};

    this.xlinkCommonQrys =
      hasProperty(xhrCustom, 'xlink') &&
      hasProperty(xhrCustom['xlink'], 'query')
        ? xhrCustom['xlink']['query']
        : [];

    this.xlinkCommonHdrs =
      hasProperty(xhrCustom, 'xlink') &&
      hasProperty(xhrCustom['xlink'], 'header')
        ? xhrCustom['xlink']['header']
        : [];

    this.xlinkOnPrepare =
      hasProperty(xhrCustom, 'xlink') &&
      hasProperty(xhrCustom['xlink'], 'onPrepare')
        ? xhrCustom['xlink']['onPrepare']
        : () => {};

    this.xlinkOnSuccess =
      hasProperty(xhrCustom, 'xlink') &&
      hasProperty(xhrCustom['xlink'], 'onSuccess')
        ? xhrCustom['xlink']['onSuccess']
        : () => {};

    this.xlinkOnError =
      hasProperty(xhrCustom, 'xlink') &&
      hasProperty(xhrCustom['xlink'], 'onError')
        ? xhrCustom['xlink']['onError']
        : () => {};
    this.maxBandwidth = {
      video: NaN,
      audio: NaN,
    };
    this.xlinks = {};
    this.xPeriods = {};
    this.RETRY_ATTEMPTS = 3;
    this.RETRY_INTERVAL = 500;
    this.NXDebug = new Debug();
    this.eventBus = eventBus;
  }

  parseBaseUrl = (url: string): Nullable<string> => {
    let base: Nullable<string> = null;

    if (url != null && url.indexOf('/') !== -1) {
      if (url.indexOf('?') !== -1) {
        url = url.substring(0, url.indexOf('?'));
      }
      base = url.substring(0, url.lastIndexOf('/') + 1);
    }

    return base;
  };

  parseDuration = (pt: string): Nullable<number> => {
    const match: Nullable<RegExpExecArray> = durationRegex.exec(pt);
    if (!match) {
      return null;
    }
    return (
      parseFloat(match[2] || '0') * SECONDS_IN_YEAR +
      parseFloat(match[4] || '0') * SECONDS_IN_MONTH +
      parseFloat(match[6] || '0') * SECONDS_IN_DAY +
      parseFloat(match[8] || '0') * SECONDS_IN_HOUR +
      parseFloat(match[10] || '0') * SECONDS_IN_MIN +
      parseFloat(match[12] || '0')
    );
  };

  parseDateTime = (dt: string): Nullable<Date> => {
    const match: Nullable<RegExpExecArray> = datetimeRegex.exec(dt);
    if (!match) {
      return null;
    }
    // If the string does not contain a timezone offset different browsers can interpret it either
    // as UTC or as a local time so we have to parse the string manually to normalize the given date value for
    // all browsers
    let utcDate: number = Date.UTC(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1, // months start from zero
      parseInt(match[3], 10),
      parseInt(match[4], 10),
      parseInt(match[5], 10),
      (match[6] && parseInt(match[6], 10)) || 0,
      (match[7] && parseFloat(match[7]) * MILLISECONDS_IN_SECONDS) || 0
    );
    // If the date has timezone offset take it into account as well
    if (match[9] && match[10]) {
      const timezoneOffset: number =
        parseInt(match[9], 10) * MINUTES_IN_HOUR + parseInt(match[10], 10);
      utcDate +=
        (match[8] === '+' ? -1 : +1) *
        timezoneOffset *
        SECONDS_IN_MIN *
        MILLISECONDS_IN_SECONDS;
    }

    return new Date(utcDate);
  };

  parseFrameRate = (fr: string): Nullable<number> => {
    const match: Nullable<RegExpExecArray> = frameRateRegex.exec(fr);
    if (!match) {
      return null;
    }

    return parseFloat(match[1]) / (parseFloat(match[2]) || 1);
  };

  //NSV-a const parseNumeric = (str) => {
  //NSV-a   const match = numericRegex.exec(str);
  //NSV-a   if (!match) {
  //NSV-a     return null;
  //NSV-a   }
  //NSV-a   return parseFloat(str);
  //NSV-a };

  parseString = (str: string): string => str;

  float3 = (num: number): number => Math.round(num * 1000) / 1000;

  abortWrapper = (
    f: Promise<any>,
    c: Nullable<ExXMLHttpRequest>
  ): Promise<Response> =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        c!.aborted = true;
        reject(new Error('abort'));
      }, 3000);
      f.then(resolve, reject);
    });

  parseSegmentTimeline = (
    sNode: HTMLCollectionOf<Element>
  ): SegmentTimeline => {
    const SegmentTimeline: SegmentTimeline = {};
    const S: Array<Fragment> = [];

    for (let i = 0; i < sNode.length; i++) {
      const t: Nullable<number> = sNode[i].getAttribute('t')
        ? parseInt(sNode[i].getAttribute('t')!)
        : null;
      const d: Nullable<number> = sNode[i].getAttribute('d')
        ? parseInt(sNode[i].getAttribute('d')!)
        : null;
      const r: Nullable<number> = sNode[i].getAttribute('r')
        ? parseInt(sNode[i].getAttribute('r')!)
        : null;
      S.push({
        t,
        d,
        r,
      });
    }
    SegmentTimeline.S = S;
    return SegmentTimeline;
  };

  parseSegmentTemplate = (
    aset: AdaptationSet,
    templateNode: Element,
    isRepresentation: boolean
  ): SegmentTemplate => {
    const templateParseAttrs = {
      timescale: parseFloat,
      duration: parseFloat,
      startNumber: parseInt,
      media: this.parseString,
      initialization: this.parseString,
      presentationTimeOffset: parseInt,
      availabilityTimeOffset: parseFloat,
    };
    const template: SegmentTemplate = {};
    for (const attr in templateParseAttrs) {
      if (templateNode.getAttribute(attr)) {
        template[attr] = templateParseAttrs[attr](
          templateNode.getAttribute(attr)
        );
      } else if (
        isRepresentation &&
        hasProperty(aset, 'SegmentTemplate') &&
        hasProperty(aset.SegmentTemplate!, attr)
      ) {
        template[attr] = aset.SegmentTemplate![attr];
      }
      //NXDebug.debug("attr:::"+attr+","+template[attr]);
    }
    const timelineNode: Element =
      templateNode.getElementsByTagName('SegmentTimeline')[0];
    if (timelineNode) {
      template.SegmentTimeline = this.parseSegmentTimeline(
        timelineNode.getElementsByTagName('S')
      );
    }
    if (
      isRepresentation &&
      hasProperty(aset, 'SegmentTemplate') &&
      hasProperty(aset.SegmentTemplate!, 'SegmentTimeline')
    ) {
      template.SegmentTimeline = aset.SegmentTemplate!.SegmentTimeline;
    }
    return template;
  };

  parseSegmentList = (aset: AdaptationSet, listNode: Element): SegmentList => {
    const listParseAttrs = {
      timescale: parseFloat,
      duration: parseFloat,
      startNumber: parseInt,
      presentationTimeOffset: parseInt,
    };
    const list: SegmentList = {};
    for (const attr in listParseAttrs) {
      if (listNode.getAttribute(attr)) {
        list[attr] = listParseAttrs[attr](listNode.getAttribute(attr));
      } else if (hasProperty(aset, attr)) {
        list[attr] = aset[attr];
      }
      //NXDebug.debug("attr:::"+attr+","+list[attr]);
    }

    const initialization: Nullable<Element> =
      listNode.getElementsByTagName('Initialization')[0];

    if (initialization) {
      if (initialization.getAttribute('sourceURL')) {
        list.Initialization = {};
        list.Initialization.sourceURL =
          initialization.getAttribute('sourceURL')!;
        this.NXDebug.info(list.Initialization.sourceURL!);
      }
    }
    const urlNode: HTMLCollectionOf<Element> =
      listNode.getElementsByTagName('SegmentURL');

    //tmplate.SegmentTimeline = [];
    const SegmentURLs: Array<SegmentURL> = [];

    for (let i = 0; i < urlNode.length; i++) {
      const media: Nullable<string> = urlNode[i].getAttribute('media')
        ? urlNode[i].getAttribute('media')
        : null;
      const mediaRange: Nullable<string> = urlNode[i].getAttribute('mediaRange')
        ? urlNode[i].getAttribute('mediaRange')
        : null;
      const index: Nullable<number> = urlNode[i].getAttribute('index')
        ? parseInt(urlNode[i].getAttribute('index')!)
        : null;
      const indexRange: Nullable<number> = urlNode[i].getAttribute('indexRange')
        ? parseInt(urlNode[i].getAttribute('indexRange')!)
        : null;
      SegmentURLs.push({
        media,
        mediaRange,
        index,
        indexRange,
      });
    }
    list.SegmentURLs = SegmentURLs;

    const timelineNode: Nullable<Element> =
      listNode.getElementsByTagName('SegmentTimeline')[0];
    if (timelineNode) {
      list.SegmentTimeline = this.parseSegmentTimeline(
        timelineNode.getElementsByTagName('S')
      );
    }

    return list;
  };

  parseContentProtection = (
    contentProtectionNode: Element
  ): ContentProtection => {
    const contentProtectionParseAttrs = {
      schemeIdUri: this.parseString,
      value: this.parseString,
      'cenc:default_KID': this.parseString,
    };

    const contentProtection: ContentProtection = {};
    //let msprNode: Element;
    let mspr_pro: string;
    let nodes: NodeListOf<ChildNode>;
    //let psshNode: Element;
    let pssh: string;
    for (const attr in contentProtectionParseAttrs) {
      if (contentProtectionNode.getAttribute(attr)) {
        contentProtection[attr] = contentProtectionParseAttrs[attr](
          contentProtectionNode.getAttribute(attr)
        );
        //NXDebug.debug("attr:::"+attr+","+contentProtection[attr]);
      }
    }

    nodes = contentProtectionNode.childNodes;

    for (let i = 0; i < nodes.length; i++) {
      //if (nodes[i].nodeName == 'cenc:pssh') {
      if (
        nodes[i].nodeName == 'cenc:pssh' ||
        nodes[i].nodeName == 'CENC:PSSH'
      ) {
        pssh = nodes[i].textContent!.replace(/\s+/g, '');
        contentProtection.pssh = BASE64.decodeArray(pssh);
        //} else if (nodes[i].nodeName == 'mspr:pro') {
      } else if (
        nodes[i].nodeName == 'mspr:pro' ||
        nodes[i].nodeName == 'MSPR:PRO'
      ) {
        mspr_pro = nodes[i].textContent!.replace(/\s+/g, '');
        contentProtection.pro = mspr_pro;
        //} else if (nodes[i].nodeName == 'pro') {
      } else if (nodes[i].nodeName == 'pro' || nodes[i].nodeName == 'PRO') {
        mspr_pro = nodes[i].textContent!.replace(/\s+/g, '');
        contentProtection.pro = mspr_pro;
      }
    }

    return contentProtection;
  };

  /* istanbul ignore next */
  parseRepresentation = (
    rep: Element,
    aset: AdaptationSet,
    commonParseAttrs: CommonParseAttributes,
    _offset: number
  ): Nullable<Representation> => {
    const representationParseAttributes: RepresentationParseAttributes = {
      id: this.parseString, //s
      bandwidth: parseFloat,
      height: parseInt,
      width: parseInt,
      availabilityTimeOffset: parseFloat,
    };

    const representation: Representation = new Representation();
    let attr: Nullable<string>;

    representation.adaptation = aset;

    for (attr in commonParseAttrs) {
      if (rep.hasAttribute(attr) && rep.getAttribute(attr)) {
        representation[attr] = commonParseAttrs[attr](rep.getAttribute(attr));
      } else if (hasProperty(aset.attrs!, attr)) {
        representation[attr] = aset.attrs![attr];
      }
    }
    for (attr in representationParseAttributes) {
      if (rep.hasAttribute(attr) && rep.getAttribute(attr)) {
        representation[attr] = representationParseAttributes[attr](
          rep.getAttribute(attr)
        );
      }
    }

    if (!hasProperty(aset, 'type')) {
      aset.mimeType = representation.mimeType;
      if (aset.mimeType!.indexOf('video') !== -1) {
        aset.type = 'video';
      } else if (aset.mimeType!.indexOf('audio') !== -1) {
        aset.type = 'audio';
      } else if (aset.mimeType!.indexOf('text') !== -1) {
        aset.type = 'audio';
      } else if (
        aset.mimeType!.indexOf('vtt') !== -1 ||
        aset.mimeType!.indexOf('ttml') !== -1
      ) {
        aset.type = 'text';
      } else {
        aset.type = '???';
      }
    }

    const segmentNode: NodeListOf<ChildNode> = rep.childNodes;
    let segmentTypeIsNotDefined: boolean = true;
    let segmentInfo:
      | undefined
      | (Partial<BaseURL> & Partial<SegmentTemplate> & Partial<SegmentList>);

    for (let i = 0; i < segmentNode.length; i++) {
      if (segmentNode[i].nodeName == 'BaseURL') {
        const url: string = segmentNode[i].textContent!;
        let baseURL: BaseURL = new BaseURL();

        if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
          baseURL.url = url;
          attr = (segmentNode[i] as Element).getAttribute(
            'availabilityTimeOffset'
          );
          if (attr) {
            baseURL.availabilityTimeOffset = parseFloat(attr);
          }
          representation.BaseURL.push(baseURL);
        } else {
          for (let bb = 0; bb < aset.BaseURL.length; bb++) {
            baseURL = aset.BaseURL[bb].copy!();
            baseURL.url = baseURL.url + url;
            attr = (segmentNode[i] as Element).getAttribute(
              'availabilityTimeOffset'
            );
            if (attr) {
              baseURL.availabilityTimeOffset = parseFloat(attr);
            }
            representation.BaseURL.push(baseURL);
          }
        }
      } else if (segmentNode[i].nodeName == 'SegmentBase') {
        representation.segmentInfoType = 'SegmentBase';
        segmentInfo = {};
        segmentInfo.indexRange = (segmentNode[i] as Element).getAttribute(
          'indexRange'
        );
        if (
          (segmentNode[i] as Element).getAttribute('presentationTimeOffset')
        ) {
          segmentInfo.presentationTimeOffset = parseInt(
            (segmentNode[i] as Element).getAttribute('presentationTimeOffset')!
          );
        }
        if (
          (segmentNode[i] as Element).getElementsByTagName('Initialization')
            .length > 0
        ) {
          let initialization: Initialization = {};
          initialization.range = (segmentNode[i] as Element)
            .getElementsByTagName('Initialization')[0]
            .getAttribute('range');
          segmentInfo.Initialization = initialization;
        }
        segmentTypeIsNotDefined = false;
      } else if (segmentNode[i].nodeName == 'SegmentTemplate') {
        segmentInfo = this.parseSegmentTemplate(
          aset,
          segmentNode[i] as Element,
          true
        );
        representation.SegmentTemplate = segmentInfo;
        if (hasProperty(segmentInfo, 'SegmentTimeline')) {
          representation.segmentInfoType = 'SegmentTimeline';
        } else {
          representation.segmentInfoType = 'SegmentTemplate';
        }

        if (hasProperty(segmentInfo, 'initialization')) {
          representation.initialization = segmentInfo
            .initialization!.split('$Bandwidth$')
            .join(String(representation.bandwidth))
            .split('$RepresentationID$')
            .join(representation.id!);
        }

        segmentTypeIsNotDefined = false;
      } else if (segmentNode[i].nodeName == 'SegmentList') {
        representation.segmentInfoType = 'SegmentList';
        segmentInfo = this.parseSegmentList(aset, segmentNode[i] as Element);
        representation.SegmentList = segmentInfo;
        if (hasProperty(segmentInfo, 'startNumber')) {
          representation.startNumber = (segmentInfo as SegmentList).startNumber;
        }
        segmentTypeIsNotDefined = false;
        if (hasProperty(segmentInfo, 'SegmentTimeline')) {
          representation.segmentInfoType = 'SegmentTimeline';
        } else {
          representation.segmentInfoType = 'SegmentList';
        }
      } else if (segmentNode[i].nodeName == 'ContentProtection') {
        const contentProtection: ContentProtection =
          this.parseContentProtection(segmentNode[i] as Element);
        aset.contentProtections!.push(contentProtection);
        if (contentProtection.pssh) {
          aset.hasMpdData = true;
        }
      } else if (segmentNode[i].nodeName == 'EssentialProperty') {
        if (
          (segmentNode[i] as Element).getAttribute('schemeIdUri') ==
          'urn:mpeg:mpegB:cicp:ColourPrimaries'
        ) {
          representation.colourPrimaries = parseInt(
            (segmentNode[i] as Element).getAttribute('value')!
          );
        }
        if (
          (segmentNode[i] as Element).getAttribute('schemeIdUri') ==
          'urn:mpeg:mpegB:cicp:TransferCharacteristics'
        ) {
          representation.transferCharacteristics = parseInt(
            (segmentNode[i] as Element).getAttribute('value')!
          );
        }
      } else if (segmentNode[i].nodeName == 'ProducerReferenceTime') {
        if ((segmentNode[i] as Element).getAttribute('id')) {
          representation.producerReferenceTime.id = (
            segmentNode[i] as Element
          ).getAttribute('id');
        }
        if ((segmentNode[i] as Element).getAttribute('inband')) {
          representation.producerReferenceTime.inband = Boolean(
            (segmentNode[i] as Element).getAttribute('inband')
          );
        }
        if ((segmentNode[i] as Element).getAttribute('type')) {
          representation.producerReferenceTime.type = (
            segmentNode[i] as Element
          ).getAttribute('type');
        }
        if ((segmentNode[i] as Element).getAttribute('wallClockTime')) {
          representation.producerReferenceTime.wallClockTime = new Date(
            this!
              .parseDateTime(
                (segmentNode[i] as Element).getAttribute('wallClockTime')!
              )!
              .getTime()
          );
        }
        if ((segmentNode[i] as Element).getAttribute('presentationTime')) {
          representation.producerReferenceTime.presentationTime = parseFloat(
            (segmentNode[i] as Element).getAttribute('presentationTime')!
          );
        }
      }
    }

    if (
      this.supported_colour_primaries.indexOf(representation.colourPrimaries) <
        0 ||
      this.supported_transfer_characteristics.indexOf(
        representation.transferCharacteristics
      ) < 0
    ) {
      return null;
    }

    if (representation.BaseURL.length === 0) {
      aset.BaseURL.forEach((b) => {
        representation.BaseURL.push(b.copy!());
      });
    }

    for (let i = 0; i < representation.BaseURL.length; i++) {
      representation.BaseURL[i].url = representation.BaseURL[i]
        .url!.split('$Bandwidth$')
        .join(String(representation.bandwidth))
        .split('$RepresentationID$')
        .join(representation.id!);
    }

    if (segmentTypeIsNotDefined) {
      if (hasProperty(aset, 'SegmentTemplate')) {
        segmentInfo = aset.SegmentTemplate!;
        representation.SegmentTemplate = segmentInfo;
        if (hasProperty(segmentInfo!, 'SegmentTimeline')) {
          representation.segmentInfoType = 'SegmentTimeline';
        } else {
          representation.segmentInfoType = 'SegmentTemplate';
        }

        if (hasProperty(segmentInfo!, 'initialization')) {
          representation.initialization = segmentInfo
            .initialization!.split('$Bandwidth$')
            .join(String(representation.bandwidth))
            .split('$RepresentationID$')
            .join(representation.id!);
        }
      } else {
        this.NXDebug.debug('can not decide Segment Type');

        if (!isNaN(aset.period!.selectedBaseURLIdx)) {
          segmentInfo = representation.BaseURL[aset.period!.selectedBaseURLIdx];
        } else {
          segmentInfo = representation.BaseURL[0];
        }

        representation.segmentInfoType = 'BaseURL';
      }
    }

    if (hasProperty(segmentInfo!, 'Initialization')) {
      const initialization = segmentInfo!.Initialization!;
      if (hasProperty(initialization, 'sourceURL')) {
        representation.initialization = initialization.sourceURL!;
      } else if (hasProperty(initialization, 'range')) {
        if (!isNaN(aset.period!.selectedBaseURLIdx)) {
          representation.initialization =
            representation.BaseURL[aset.period!.selectedBaseURLIdx].url;
        } else {
          representation.initialization = representation.BaseURL[0].url;
        }
        representation.range = initialization.range!;
      }
    } else if (
      hasProperty(representation, 'mimeType') &&
      (representation.mimeType === 'text/vtt' ||
        representation.mimeType === 'application/ttml+xml')
    ) {
      if (!isNaN(aset.period!.selectedBaseURLIdx)) {
        representation.initialization =
          representation.BaseURL[aset.period!.selectedBaseURLIdx].url;
      } else {
        representation.initialization = representation.BaseURL[0].url;
      }

      representation.range = '0'; //representation.range = 0;
    }

    if (hasProperty(segmentInfo!, 'timescale')) {
      representation.timescale = segmentInfo!.timescale!;
    }

    if (hasProperty(segmentInfo!, 'duration')) {
      // TODO according to the spec @maxSegmentDuration specifies the maximum duration of any Segment in any Representation in the Media Presentation
      // It is also said that for a SegmentTimeline any @d value shall not exceed the value of MPD@maxSegmentDuration, but nothing is said about
      // SegmentTemplate @duration attribute. We need to find out if @maxSegmentDuration should be used instead of calculated duration if the the duration
      // exceeds @maxSegmentDuration
      representation.segmentDuration =
        segmentInfo!.duration! / representation.timescale;
    }
    if (hasProperty(segmentInfo!, 'startNumber')) {
      representation!.startNumber! = segmentInfo!.startNumber!;
    }
    if (hasProperty(segmentInfo!, 'indexRange')) {
      representation.indexRange = segmentInfo!.indexRange!;
    }
    if (hasProperty(segmentInfo!, 'presentationTimeOffset')) {
      representation.presentationTimeOffset =
        segmentInfo!.presentationTimeOffset! / representation.timescale;
    } else {
      representation.presentationTimeOffset = _offset;
    }
    if (hasProperty(segmentInfo!, 'availabilityTimeOffset')) {
      representation.availabilityTimeOffset =
        segmentInfo!.availabilityTimeOffset!;
    } else if (
      representation.BaseURL[aset.period!.selectedBaseURLIdx]
        .availabilityTimeOffset
    ) {
      representation.availabilityTimeOffset =
        representation.BaseURL[
          aset.period!.selectedBaseURLIdx
        ].availabilityTimeOffset!;
    } else if (representation.adaptation.availabilityTimeOffset) {
      representation.availabilityTimeOffset =
        representation.adaptation.availabilityTimeOffset;
    }

    if (
      representation.adaptation.period!.mpd!.type === 'dynamic' &&
      representation.presentationTimeOffset != 0
    ) {
      representation.timestampOffsetFor32bitVE = _offset;
    } else {
      if (representation.segmentInfoType === 'SegmentTemplate') {
        representation.timestampOffsetFor32bitVE = _offset;
      } else if (representation.segmentInfoType === 'SegmentTimeline') {
        const S =
          representation.SegmentTemplate != null
            ? representation.SegmentTemplate.SegmentTimeline!.S
            : representation.SegmentList!.SegmentTimeline!.S;
        if (
          (representation.adaptation.period!.mpd!.type === 'dynamic' &&
            this.SET_1STSEG_TIME_ZERO) ||
          representation.adaptation.period!.mpd!.type === 'static'
        ) {
          representation.timestampOffsetFor32bitVE =
            S![0].t! / representation.timescale;
        } else {
          representation.timestampOffsetFor32bitVE = 0;
        }
        if (representation.presentationTimeOffset != 0) {
          representation.timestampOffsetFor32bitVE = _offset;
        }
      } else {
        representation.timestampOffsetFor32bitVE = _offset;
      }
    }
    return representation;
  };

  /* istanbul ignore next */
  parseEventStream = (eventNode: Element, eventList: Array<any>): void => {
    let schemeIdUri: string;
    let timescale: number = 1;
    let value: string | undefined;

    const getEvent = (
      list: Array<Nullable<any>>,
      id: Nullable<string>
    ): boolean => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id != null && list[i].id == id) return true;
      }

      return false;
    };

    if (eventNode.getAttribute('schemeIdUri')) {
      schemeIdUri = eventNode.getAttribute('schemeIdUri')!;
    } else {
      throw 'Invalid EventStream. SchemeIdUri has to be set';
    }
    if (eventNode.getAttribute('timescale')) {
      timescale = parseInt(eventNode.getAttribute('timescale')!);
    }
    if (eventNode.getAttribute('value')) {
      value = eventNode.getAttribute('value')!;
    }
    const eNodes: NodeListOf<ChildNode> = eventNode.childNodes;

    for (let i = 0; i < eNodes.length; i++) {
      if (eNodes[i].nodeName == 'Event') {
        const de: DashEvent = {};
        de.schemeIdUri = schemeIdUri;
        de.timescale = timescale;
        de.value = value;
        de.presentationTime = 0;
        de.duration = NaN;
        de.messageData = null;

        if ((eNodes[i] as Element).getAttribute('presentationTime')) {
          de.presentationTime =
            parseFloat(
              (eNodes[i] as Element).getAttribute('presentationTime')!
            ) / timescale;
        }
        if ((eNodes[i] as Element).getAttribute('duration')) {
          de.duration =
            parseFloat((eNodes[i] as Element).getAttribute('duration')!) /
            timescale;
        }
        if ((eNodes[i] as Element).getAttribute('id')) {
          de.id = (eNodes[i] as Element).getAttribute('id');
        }

        de.messageData = (eNodes[i] as Element).childNodes;

        if (hasProperty(eventList, schemeIdUri)) {
          if (getEvent(eventList[schemeIdUri], de.id as string) == false) {
            eventList[schemeIdUri].push(de);
          }
        } else {
          eventList[schemeIdUri] = [];
          eventList[schemeIdUri].push(de);
        }
      }
    }
  };

  /* istanbul ignore next */
  parsePeriod(
    mpd: Mpd,
    periodNodes: HTMLCollectionOf<Element>,
    _callback: (d: { data: Array<Period> }) => void
  ): void {
    let periods: Array<Period> = [];
    const self = this;
    const callback: (d: { data: Array<Period> }) => void =
      _callback || (() => {});

    const periodCheck = (
      periodNodes: HTMLCollectionOf<Element>
    ): Array<Period> => {
      const pp: Array<Period> = [];
      let p: Nullable<Element> = null;
      let vo: Nullable<Period> = null;
      let p1: Nullable<Element> = null;
      let vo1: Nullable<Period> = null;
      let attr: Nullable<string>;

      for (let i = 0; i < periodNodes.length; i++) {
        p = periodNodes[i];
        // If the attribute @start is present in the Period, then the
        // Period is a regular Period and the PeriodStart is equal
        // to the value of this attribute.
        if (p.getAttribute('start')) {
          vo = new Period();
          vo.start = this.parseDuration(p.getAttribute('start')!)!;
        }
        // If the @start attribute is absent, but the previous Period
        // element contains a @duration attribute then then this new
        // Period is also a regular Period. The start time of the new
        // Period PeriodStart is the sum of the start time of the previous
        // Period PeriodStart and the value of the attribute @duration
        // of the previous Period.
        else if (p1 !== null && p.getAttribute('duration')) {
          vo = new Period();
          vo.start = this.float3(vo1!.start + vo1!.duration);
          vo.duration = this.parseDuration(p.getAttribute('duration')!)!;
          vo.end = this.float3(vo.start + vo.duration);
        }
        // If (i) @start attribute is absent, and (ii) the Period element
        // is the first in the MPD, and (iii) the MPD@type is 'static',
        // then the PeriodStart time shall be set to zero.
        else if (i === 0) {
          vo = new Period();
          vo.start = 0;
          //vo.duration = mpd.mediaPresentationDuration;
        }
        // The Period extends until the PeriodStart of the next Period.
        // The difference between the PeriodStart time of a Period and
        // the PeriodStart time of the following Period.
        if (vo1 !== null && isNaN(vo1.duration)) {
          vo1.duration = this.float3(vo!.start - vo1.start);
          vo1.end = this.float3(vo1.start + vo1.duration);
        }

        if (vo !== null) {
          if (p.getAttribute('id')) {
            vo.id = p.getAttribute('id');
          } else {
            vo.id = 'pid:' + i;
          }
        }

        if (vo !== null && p.getAttribute('duration')) {
          vo.duration = this.parseDuration(p.getAttribute('duration')!)!;
          vo.end = this.float3(vo.start + vo.duration);
        }

        if (vo !== null && p.getAttribute('xlink:href')) {
          if (
            !hasProperty(this.xlinks, vo.id!) &&
            !hasProperty(this.xPeriods, vo.id!)
          ) {
            this.xlinks[vo.id!] = p.getAttribute('xlink:href');
          }
        }

        if (vo !== null) {
          vo.index = i;
          vo.mpd = mpd;
          vo.childNodes = [];
          const childNodes: NodeListOf<ChildNode> = periodNodes[i].childNodes;
          for (let ii = 0; ii < childNodes.length; ii++) {
            if (childNodes[ii].nodeName === 'AdaptationSet') {
              vo.childNodes.push(childNodes[ii]);
            } else if (childNodes[ii].nodeName === 'BaseURL') {
              const url: string = childNodes[ii].textContent!;
              let baseURL: BaseURL = new BaseURL();

              if (
                url.indexOf('http://') === 0 ||
                url.indexOf('https://') === 0
              ) {
                baseURL.url = url;
                attr = (childNodes[ii] as Element).getAttribute(
                  'availabilityTimeOffset'
                );
                if (attr) {
                  baseURL.availabilityTimeOffset = parseFloat(attr);
                }
                vo.BaseURL.push(baseURL);
              } else {
                for (let bb = 0; bb < mpd.BaseURL.length; bb++) {
                  baseURL = mpd.BaseURL[bb].copy();
                  baseURL.url = baseURL.url + url;
                  attr = (childNodes[ii] as Element).getAttribute(
                    'availabilityTimeOffset'
                  );
                  if (attr) {
                    baseURL.availabilityTimeOffset = parseFloat(attr);
                  }
                  vo.BaseURL.push(baseURL);
                }
              }
            } else if (childNodes[ii].nodeName === 'AssetIdentifier') {
              vo.assetId = (childNodes[ii] as Element).getAttribute('value');
            } else if (childNodes[ii].nodeName === 'EventStream') {
              this.parseEventStream(childNodes[ii] as Element, vo.outEventList);
            }
          }
          if (vo.BaseURL.length === 0) {
            mpd.BaseURL.forEach((b) => {
              vo!.BaseURL!.push(b!.copy());
            });
          }
          pp.push(vo);
        }

        p1 = p;
        p = null;
        vo1 = vo;
        vo = null;
      }
      p1 = null;
      vo1 = null;

      let checkTime: number = NaN;
      if (hasProperty(mpd, 'minimumUpdatePeriod')) {
        //checkTime = timelineConverter.calcPresentationTimeFromWallTime(new Date(mpd.manifest.mpdLoadedTime.getTime()+clientServerTimeShift), pp[0]) + mpd.minimumUpdatePeriod;
        checkTime = this.timelineConverter.calcPresentationTimeFromWallTime(
          new Date(
            mpd.manifest!.mpdLoadedTime!.getTime() + this.clientServerTimeShift
          ),
          pp[0]
        );
      }
      mpd.checkTime = checkTime;
      if (pp[pp.length - 1].end == Infinity) {
        let periodEndTime = 0;
        if (mpd.mediaPresentationDuration) {
          periodEndTime = mpd.mediaPresentationDuration;
        } else if (!isNaN(mpd.checkTime)) {
          // in this case the Period End Time should match CheckTime
          periodEndTime = mpd.checkTime;
        } else {
          this.NXDebug.log(
            'Must have @mediaPresentationDuration or @minimumUpdatePeriod on MPD or an explicit @duration on the last period.'
          );
        }
        if (pp[pp.length - 1].start < periodEndTime) {
          pp[pp.length - 1].end = this.float3(periodEndTime);
          pp[pp.length - 1].duration = this.float3(
            pp[pp.length - 1].end - pp[pp.length - 1].start
          );
        } else {
          pp.pop();
        }
      }

      return pp;
    };

    const processXlinks = (_callback: () => void): void => {
      const callback: () => void = _callback;
      if (Object.keys(this.xlinks).length > 0) {
        let rpCount: number = 0;

        const loadRPeriodsEndListener = (evt: ExEvent): void => {
          rpCount--;
          if (evt.data.success) {
            this.xPeriods[evt.data.pid] = periodCheck(evt.data.result);
            this.NXDebug.info(String(this.xPeriods[evt.data.pid]));
          }

          delete this.xlinks[evt.data.pid];

          if (rpCount == 0) {
            this.eventBus.removeEventListener(
              'LOAD_RPERIODS_END',
              loadRPeriodsEndListener
            );

            callback();
          }
        };

        this.eventBus.addEventListener(
          'LOAD_RPERIODS_END',
          loadRPeriodsEndListener
        );
        for (const x in this.xlinks) {
          this.getRemotePeriods(this.xlinks[x]!, x, 1);
          rpCount++;
        }
      } else {
        callback();
      }
    };

    const replaceByExt = (periods: Array<Period>): Array<Period> => {
      const pids: Array<string> = [];
      let tlen: number = periods.length;
      let i: number = 0;

      for (i = 0; i < tlen; i++) {
        pids.push(periods[i].id!);
      }
      i = 0;

      while (i < tlen) {
        if (hasProperty(this.xPeriods, periods[i].id!)) {
          const xperiods: Array<{
            start?: number;
            duration?: number;
          }> = this.xPeriods[periods[i].id!];
          const start: number = periods[i].start;
          const duration: number = periods[i].duration;
          const end: number = periods[i].end;
          const dstart: number = this.float3(start - xperiods[0].start!);
          const len: number = xperiods.length;
          const rperiods: Array<Period> = [];
          let p: Period;
          let cdur: number = 0;
          for (let jj = 0; jj < len; jj++) {
            p = new Period();
            Object.keys(xperiods[jj]).forEach((k) => {
              p[k] = xperiods[jj][k];
            });
            p.id = periods[i].id + ' #' + jj;
            p.start = this.float3(xperiods[jj].start! + dstart);
            p.offset = p.start;
            p.duration = xperiods[jj].duration!;
            p.end = this.float3(p.start + xperiods[jj].duration!);
            p.mpd = mpd;
            cdur += p.duration;
            if (jj == len - 1 || cdur >= duration) {
              p.end = end;
              p.duration = this.float3(p.end - p.start);
              jj = len - 1;
            }
            rperiods.push(p);
          }

          if (rperiods.length == 1) {
            periods[i] = rperiods[0];
            i++;
          } else {
            periods.splice(i, 1);
            tlen -= 1;
            for (let jj = 0; jj < rperiods.length; jj++) {
              this.NXDebug.log('i=' + i);
              periods.splice(i, 0, rperiods[jj]);
              tlen++;
              i++;
            }
          }
        } else {
          i++;
        }
      }

      for (i = 0; i < periods.length; i++) {
        periods[i].index = i;
      }

      for (const x in this.xPeriods) {
        if (pids.indexOf(x) < 0) {
          delete this.xPeriods[x];
        }
      }

      return periods;
    };

    periods = periodCheck(periodNodes);
    for (let i = 0; i < periods.length; i++) {
      //liveMulti
      if (periods[i].assetId) {
        let offset = 0;
        for (let j = 0; j < i; j++) {
          if (periods[i].assetId !== periods[j].assetId) {
            offset = this.float3(offset + periods[j].duration);
          }
        }
        periods[i].offset = offset;
      } else {
        periods[i].offset = periods[i].start;
      }

      //liveMulti
    }

    processXlinks.call(self, () => {
      periods = replaceByExt(periods);

      for (let i = 0; i < periods.length; i++) {
        if (periods[i].BaseURL.length > 0) {
          periods[i].selectedBaseURLIdx =
            this.DEFAULT_BASEURL_IDX < periods[i].BaseURL.length
              ? this.DEFAULT_BASEURL_IDX
              : 0;
        }
        periods[i].clientServerTimeShift = this.clientServerTimeShift;
        periods[i].isClientServerTimeSyncCompleted = true;
        periods[i].isClientServerTimeSyncCompletedForTC = true;
      }

      callback({
        data: periods,
      });
    });
  }

  //NSV-a const parseRole = (node) => {
  //NSV-a   const role = {};
  //NSV-a   const roleAttributes = {
  //NSV-a     schemeIdUri: parseString,
  //NSV-a     value: parseString,
  //NSV-a   };
  //NSV-a
  //NSV-a   for (const attr in roleAttributes) {
  //NSV-a     if (node.hasAttribute(attr) && node.getAttribute(attr)) {
  //NSV-a       role[attr] = roleAttributes[attr](node.getAttribute(attr));
  //NSV-a     }
  //NSV-a   }
  //NSV-a   return role;
  //NSV-a };

  /* istanbul ignore next */
  MpdParser = (
    data: string,
    manifest: Partial<ManifestModel>,
    baseUrl: string,
    _offset: number,
    _callback: (d: { data: Mpd }) => void
  ): void => {
    const parser: DOMParser = new DOMParser();
    const callback: (d: { data: Mpd }) => void = _callback || (() => {});
    const dom: Document = parser.parseFromString(data, 'text/xml');
    ///// MPD START /////
    const mpd: Mpd = new Mpd();
    const mpdNode: Element = dom.getElementsByTagName('MPD')[0];
    const mpdParseAttributes: MpdParseAttributes = {
      'xmlns:xsi': this.parseString,
      xmlns: this.parseString,
      'xsi:schemaLocation': this.parseString,
      type: this.parseString,
      minBufferTime: this.parseDuration,
      profiles: this.parseString,
      minimumUpdatePeriod: this.parseDuration,
    };
    let attr: Nullable<string>;
    let baseURL: BaseURL;

    for (attr in mpdParseAttributes) {
      if (mpdNode.getAttribute(attr)) {
        mpd[attr] = mpdParseAttributes[attr](mpdNode.getAttribute(attr));
        this.NXDebug.log('mpd: ' + attr + ':' + mpd[attr]);
      }
    }

    attr = mpdNode.getAttribute('availabilityStartTime');
    mpd.availabilityStartTime = attr
      ? new Date(this.parseDateTime(attr)!.getTime())
      : new Date(manifest.mpdLoadedTime!.getTime());

    attr = mpdNode.getAttribute('publishTime');
    if (attr) {
      mpd.publishTime = new Date(this.parseDateTime(attr)!.getTime());
      this.NXDebug.info('publishTime:::' + mpd.publishTime);
    }
    attr = mpdNode.getAttribute('availabilityEndTime');
    if (attr) {
      mpd.availabilityEndTime = new Date(this.parseDateTime(attr)!.getTime());
    }
    attr = mpdNode.getAttribute('suggestedPresentationDelay');
    if (attr) {
      mpd.suggestedPresentationDelay = this.parseDuration(attr);
    }
    /*
    if (!isNaN(this.DEFAULT_PRESENTATION_DELAY)) {
      mpd.suggestedPresentationDelay = this.DEFAULT_PRESENTATION_DELAY;
    } else if (attr) {
      mpd.suggestedPresentationDelay = this.parseDuration(attr)!;
    }
    */
    attr = mpdNode.getAttribute('timeShiftBufferDepth');
    if (attr) {
      mpd.timeShiftBufferDepth = this.parseDuration(attr)!;
    }
    attr = mpdNode.getAttribute('maxSegmentDuration');
    if (attr) {
      mpd.maxSegmentDuration = this.parseDuration(attr)!;
    }
    attr = mpdNode.getAttribute('mediaPresentationDuration');
    if (attr) {
      mpd.mediaPresentationDuration = this.parseDuration(attr)!;
    }
    mpd.checkTime = NaN;

    mpd.BaseURL = [];
    ///Location
    if (mpdNode.getElementsByTagName('Location').length > 0) {
      const locationNode = mpdNode.getElementsByTagName('Location')[0];
      manifest.Location = locationNode.textContent!;
    }

    ///BaseURL
    const baseUrlCand: NodeList = mpdNode.childNodes;
    for (let i = 0; i < baseUrlCand.length; i++) {
      if (baseUrlCand[i].nodeName === 'BaseURL') {
        const url: string = baseUrlCand[i].textContent!;

        const burl: string =
          url.indexOf('http://') === 0 || url.indexOf('https://') === 0
            ? url
            : baseUrl + url;

        baseURL = new BaseURL();
        baseURL.url = burl;
        attr = (baseUrlCand[i] as Element).getAttribute(
          'availabilityTimeOffset'
        );
        if (attr) {
          baseURL.availabilityTimeOffset = parseFloat(attr);
        }
        mpd.BaseURL.push(baseURL);
      }
    }
    if (mpd.BaseURL.length === 0) {
      baseURL = new BaseURL();
      baseURL.url = baseUrl;
      baseURL.availabilityTimeOffset = 0;
      mpd.BaseURL.push(baseURL);
    }

    ///ServiceDescription

    var sdNode = mpdNode.getElementsByTagName('ServiceDescription');
    if (sdNode) {
      var latencyNode, rateNode; //var sd;
      for (let i = 0; i < sdNode.length; i++) {
        if (sdNode[i].getElementsByTagName('Latency').length > 0) {
          latencyNode = sdNode[i].getElementsByTagName('Latency')[0];
          mpd.targetLatency = latencyNode.getAttribute('target') || NaN;
          mpd.targetLatencyMin = latencyNode.getAttribute('min') || NaN;
          mpd.targetLatencyMax = latencyNode.getAttribute('max') || NaN;
          mpd.referenceIdPRT = latencyNode.getAttribute('referenceId') || NaN;
        }
        if (sdNode[i].getElementsByTagName('PlaybackRate').length > 0) {
          rateNode = sdNode[i].getElementsByTagName('PlaybackRate')[0];
          mpd.playbackRateMin = rateNode.getAttribute('min') || NaN;
          mpd.playbackRateMax = rateNode.getAttribute('max') || NaN;
        }
      }
    }
    //
    if (!isNaN(this.DEFAULT_PRESENTATION_DELAY)) {
      mpd.suggestedPresentationDelay = this.DEFAULT_PRESENTATION_DELAY;
    } else if (!isNaN(mpd.targetLatency)) {
      mpd.suggestedPresentationDelay = mpd.targetLatency / 1000;
    }
    if (mpd.type == 'dynamic') {
      if (mpd!.suggestedPresentationDelay! < mpd!.minBufferTime!) {
        mpd.minBufferTime = mpd.suggestedPresentationDelay;
      }
    }

    mpd.manifest = manifest as ManifestModel;
    ///// MPD END /////

    this.parsePeriod(mpd, mpdNode.getElementsByTagName('Period'), (d) => {
      mpd.periods = d.data;
      const commonParseAttributes: CommonParseAttributes = {
        profiles: this.parseString,
        width: parseInt,
        height: parseInt,
        sar: this.parseString,
        frameRate: this.parseFrameRate,
        audioSamplingRate: parseFloat,
        mimeType: this.parseString,
        lang: this.parseString,
        segmentProfiles: this.parseString,
        codecs: this.parseString,
        maximumSAPPeriod: parseFloat,
        startsWithSap: parseInt,
        maxPlayoutRate: parseFloat,
        codingDependency: this.parseString,
        scanType: this.parseString,
        FramePacking: this.parseString,
        AudioChannelConfiguration: this.parseString,
        availabilityTimeOffset: parseFloat,
      };

      for (let i = 0; i < mpd.periods.length; i++) {
        mpd.periods[i].adaptationSets = [];
        const asetsCandidateNode: Array<any> = mpd.periods[i].childNodes!;
        let hasAudio: boolean = false;
        let hasVideo: boolean = false;
        for (let j = 0; j < asetsCandidateNode.length; j++) {
          const adaptationNode = asetsCandidateNode[j];
          let aset: Nullable<AdaptationSet> = new AdaptationSet();
          aset.period = mpd.periods[i];
          aset.index = j;
          aset.attrs = {};
          aset.id = adaptationNode.getAttribute('id')
            ? adaptationNode.getAttribute('id')
            : aset.index;
          aset.lang = adaptationNode.getAttribute('lang')
            ? adaptationNode.getAttribute('lang')
            : null;

          aset.childNodes = adaptationNode.childNodes;
          for (const attr in commonParseAttributes) {
            if (adaptationNode.getAttribute(attr)) {
              aset.attrs[attr] = commonParseAttributes[attr](
                adaptationNode.getAttribute(attr)
              );
            }
          }
          aset.representations = [];
          aset.contentProtections = [];

          for (let k = 0; k < aset.childNodes.length; k++) {
            if (aset.childNodes[k].nodeName == 'BaseURL') {
              const url: string = aset.childNodes[k].textContent;
              let baseURL: Partial<BaseURL> = {};
              if (
                url.indexOf('http://') === 0 ||
                url.indexOf('https://') === 0
              ) {
                baseURL['url'] = url;
                attr = aset.childNodes[k].getAttribute(
                  'availabilityTimeOffset'
                );
                if (attr == typeof String) {
                  baseURL['availabilityTimeOffset'] = parseFloat(attr);
                }
                aset.BaseURL.push(baseURL);
              } else {
                for (let bb = 0; bb < mpd.periods[i].BaseURL.length; bb++) {
                  baseURL = mpd.periods[i].BaseURL[bb].copy();
                  baseURL.url = baseURL.url + url;
                  attr = aset.childNodes[k].getAttribute(
                    'availabilityTimeOffset'
                  );
                  if (attr == typeof String) {
                    baseURL['availabilityTimeOffset'] = parseFloat(attr);
                  }
                  aset.BaseURL.push(baseURL);
                }
              }
            }
          }
          if (aset.BaseURL.length === 0) {
            mpd.periods[i].BaseURL.forEach((b) => {
              aset!.BaseURL.push(b.copy());
            });
          }
          for (let k = 0; k < aset.childNodes.length; k++) {
            if (aset.childNodes[k].nodeName == 'Representation') {
              const representation: Nullable<Representation> =
                this.parseRepresentation(
                  aset.childNodes[k],
                  aset,
                  commonParseAttributes,
                  _offset
                );
              if (representation != null)
                aset.representations.push(representation);
            } else if (aset.childNodes[k].nodeName == 'ContentProtection') {
              let contentProtection = aset.childNodes[k];
              contentProtection =
                this.parseContentProtection(contentProtection);
              aset.contentProtections.push(contentProtection);
              if (contentProtection.pssh) {
                aset.hasMpdPssh = true;
              }
            } else if (aset.childNodes[k].nodeName == 'SegmentTemplate') {
              aset.SegmentTemplate = this.parseSegmentTemplate(
                aset,
                aset.childNodes[k],
                false
              );
            } else if (aset.childNodes[k].nodeName == 'Role') {
              aset.Role = aset.childNodes[k].getAttribute('value');
            } else if (aset.childNodes[k].nodeName == 'EssentialProperty') {
              if (
                aset.childNodes[k].getAttribute('schemeIdUri') ==
                'urn:mpeg:mpegB:cicp:ColourPrimaries'
              ) {
                aset.colourPrimaries = parseInt(
                  aset.childNodes[k].getAttribute('value')
                );
              }
              if (
                aset.childNodes[k].getAttribute('schemeIdUri') ==
                'urn:mpeg:mpegB:cicp:TransferCharacteristics'
              ) {
                aset.transferCharacteristics = parseInt(
                  aset.childNodes[k].getAttribute('value')
                );
              }
            } else {
              // eslint-disable-line no-empty
            }
          }
          if (
            aset.type == 'video' &&
            (this.supported_colour_primaries.indexOf(aset.colourPrimaries) <
              0 ||
              this.supported_transfer_characteristics.indexOf(
                aset.transferCharacteristics
              ) < 0)
          ) {
            this.logHandler.log(
              'ColourPrimaries=' +
                aset.colourPrimaries +
                ' and/or TransferCharacteristics=' +
                aset.transferCharacteristics +
                'are not supported'
            );
            continue;
          } else if (aset.type == 'audio' && this.unuseAudio == true) {
            continue;
          } else if (aset.representations.length === 0) {
            this.logHandler.log('!!!!!!!!!!no representations found!!!!!');
            this.NXDebug.log('no representations found!!!');
            continue;
          } else {
            // eslint-disable-line no-empty
          }
          this.setIndexForRepresentation.call(this, aset);
          mpd.periods[i].adaptationSets.push(aset);

          if (aset.type === 'video') hasVideo = true;
          if (aset.type === 'audio') hasAudio = true;

          aset = null;
        }
        if (hasVideo && hasAudio) {
          mpd.periods[i].type = 'video/audio';
        } else if (hasVideo) {
          mpd.periods[i].type = 'video';
        } else if (hasAudio) {
          mpd.periods[i].type = 'audio';
        }
      }
      mpd.timestampOffsetFor32bitVE = this.setTimestampOffsetFor32bitVE(
        mpd.periods
      );
      this.NXDebug.log(String(mpd.timestampOffsetFor32bitVE));
      callback({
        data: mpd,
      });
    });
  };

  setTimestampOffsetFor32bitVE = (ps: Array<Period>): number => {
    const period: Period = ps[0];
    let j: number;
    let s: any;
    let de: DashEvent;
    if (this.timestampOffsetFor32bitVE == -1) {
      const asets: Array<AdaptationSet> = period.adaptationSets;
      let m: number = 0xffffffffffffffff;
      for (let i = 0; i < asets.length; i++) {
        const reps: Array<Representation> = asets[i].representations!;
        for (j = 0; j < reps.length; j++) {
          if (m > reps[j].timestampOffsetFor32bitVE!) {
            m = reps[j].timestampOffsetFor32bitVE!;
          }
        }
      }
      this.timestampOffsetFor32bitVE = m + period.start;
    }

    if (this.timestampOffsetFor32bitVE != 0) {
      for (let i = 0; i < ps.length; i++) {
        ps[i].start = this.float3(ps[i].start - this.timestampOffsetFor32bitVE);
        ps[i].offset = this.float3(
          ps[i].offset - this.timestampOffsetFor32bitVE
        );
        ps[i].end = this.float3(ps[i].end - this.timestampOffsetFor32bitVE);

        for (s in ps[i].outEventList) {
          for (j = 0; j < ps[i].outEventList[s].length; j++) {
            de = ps[i].outEventList[s][j];
            de.presentationTime! += ps[i].start;
          }
        }
      }
    }

    for (let i = 0; i < ps.length; i++) {
      for (s in ps[i].outEventList) {
        const list: Array<any> = ps[i].outEventList[s];
        let length: number = list.length;
        j = 0;

        while (j < length) {
          de = list[j];
          this.eventBus.dispatchEvent({
            type: 'DASHEVENT_RECEIVED',
            data: {
              type: 'outband',
              event: de,
              eventList: list,
              index: i,
            },
          });

          if (list.length < length) {
            length = list.length;
          } else {
            j++;
          }
        }
      }
    }

    return this.timestampOffsetFor32bitVE;
  };

  processAdaptation = (adaptation: AdaptationSet): AdaptationSet => {
    if (
      adaptation.representations !== undefined &&
      adaptation.representations !== null
    ) {
      adaptation.representations.sort((a, b) => a.bandwidth! - b.bandwidth!);
    }

    return adaptation;
  };

  setIndexForRepresentation = (adaptation: AdaptationSet): void => {
    const a: AdaptationSet = this.processAdaptation(adaptation);
    const min: number = this.minBandwidth[a.type!];
    const max: number = this.maxBandwidth[a.type!];
    let minIdx: number = -1;
    let maxIdx: number = -1;

    if (!isNaN(min)) {
      for (let i = 0; i < a.representations!.length; i++) {
        if (min <= a.representations![i].bandwidth!) {
          minIdx = i;
          break;
        }
      }
      if (minIdx == -1) {
        minIdx = a.representations!.length - 1;
      }
      if (minIdx > 0) {
        a.representations!.splice(0, minIdx);
      }
    }
    if (!isNaN(max)) {
      for (let i = a.representations!.length - 1; i >= 0; i--) {
        if (a.representations![i].bandwidth! < max) {
          maxIdx = i;
          break;
        }
      }
      if (maxIdx == -1) {
        maxIdx = 0;
      }
      if (maxIdx < a.representations!.length - 1) {
        a.representations!.splice(maxIdx + 1);
      }
    }
    for (let i = 0; i < a.representations!.length; i++) {
      a.representations![i].index = i;
    }
  };

  getRefreshDelay = (manifest: ManifestModel): number => {
    let delay: number = 2;
    const minDelay: number = 2;
    if (hasProperty(manifest.mpd!, 'minimumUpdatePeriod')) {
      //delay = Math.min(manifest.mpd.minimumUpdatePeriod,minDelay);
      delay = manifest.mpd!.minimumUpdatePeriod || minDelay;
    }

    return delay;
  };

  internalParse = (
    data: string,
    baseUrl: Nullable<string>,
    _callback: (d: Nullable<Partial<ManifestModel>>) => void
  ) => {
    let manifest: Nullable<Partial<ManifestModel>> = null;
    const callback: (d: Nullable<Partial<ManifestModel>>) => void =
      _callback || (() => {});
    try {
      manifest = {};
      manifest!.mpdLoadedTime = new Date();
      this.getServerTime.call(this, (_: boolean) => {
        this.MpdParser.call(
          this,
          data,
          manifest!,
          baseUrl!,
          0,
          (d: { data: Mpd }) => {
            manifest!.mpd = d.data;
            this.NXDebug.log('MPD');

            this.NXDebug.log('Parsing complete: ');

            callback(manifest);
          }
        );
      });
    } catch (_err: any) {
      this.errHandler.manifestError(
        this.eventBus,
        'parsing the manifest failed',
        'parse',
        data
      );
      manifest = null;
      callback(null);
    }
  };

  setManifestData = (url: string, data: string): void => {
    const baseUrl: Nullable<string> = this.parseBaseUrl(url);
    const self = this;
    let manifest: Nullable<Partial<ManifestModel>> = null;

    this.manifestText = data;

    this.internalParse.call(
      self,
      data,
      baseUrl,
      (d: Nullable<Partial<ManifestModel>>) => {
        if (d != null) {
          manifest = d;
          manifest!.mpdUrl = url;
          self.setValue(manifest as ManifestModel);
        } else {
          self.setValue(null);
        }
      }
    );
  };

  /* istanbul ignore next */
  getRemotePeriodsX = (url: string, pid: string, remainingAttempts: number) => {
    const request: ExXMLHttpRequest = new XMLHttpRequest();
    let needFailureReport: boolean = true;
    const self = this;
    let aborted: boolean = false;
    const qrys: Array<CommonQuery> = this.xlinkCommonQrys.concat();
    const hdrs: Array<CommonHeader> = this.xlinkCommonHdrs.concat();
    let rPeriodsTxt: Nullable<string> = null;

    const timeoutTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
      this.logHandler.log('RemotePeriod request aborted!!!');
      this.NXDebug.debug('RemotePeriod request aborted!!!');
      aborted = true;
      request.abort!();
    }, 1000);

    const onload = (): void => {
      if (request.status! < 200 || request.status! > 299) {
        return;
      }
      if (request.responseText!.length === 0) {
        this.logHandler.log(
          '!!! Load mpd size : ' +
            request.responseText!.length +
            ' !!!! remainingAttempts:' +
            remainingAttempts
        );
        return;
      }

      this.xlinkOnSuccess({
        status: request.status!,
        req: request,
        xhr: request,
      });

      needFailureReport = false;
      rPeriodsTxt = request.responseText!;

      rPeriodsTxt = '<root>' + rPeriodsTxt + '</root>';

      try {
        const parser: DOMParser = new DOMParser();
        const dom = parser.parseFromString(rPeriodsTxt, 'text/xml');
        const rperiods: HTMLCollectionOf<Element> =
          dom.getElementsByTagName('Period');
        this.NXDebug.info(String(rperiods));

        if (rperiods) {
          //
        }

        this.eventBus.dispatchEvent({
          type: 'LOAD_RPERIODS_END',
          data: {
            success: true,
            pid,
            result: rperiods,
          },
        });
        return;
      } catch (e: any) {
        this.eventBus.dispatchEvent({
          type: 'LOAD_RPERIODS_END',
          data: {
            success: false,
            pid,
            result: null,
          },
        });
        return;
      }
    };

    const report = (): void => {
      if (aborted) {
        this.logHandler.log(
          'remoteperiods request is aborted.' + needFailureReport
        );
      }
      if (timeoutTimer != null) {
        clearTimeout(timeoutTimer);
      }

      if (!needFailureReport) {
        // eslint-disable-line no-empty
      } else {
        this.xlinkOnError({
          status: request.status!,
          req: request,
          xhr: request,
        });

        needFailureReport = false;

        if (remainingAttempts > 0) {
          this.NXDebug.log(
            'Failed loading remoteperiods: ' +
              url +
              ', retry in ' +
              this.RETRY_INTERVAL +
              'ms' +
              ' attempts: ' +
              remainingAttempts
          );
          remainingAttempts--;
          setTimeout(() => {
            this.getRemotePeriods.call(self, url, pid, remainingAttempts);
          }, this.RETRY_INTERVAL);
        } else {
          this.NXDebug.log(
            'Failed loading remoteperiods: ' + url + ' no retry attempts left'
          );

          this.errHandler.downloadError(
            this.eventBus,
            'manifest',
            url,
            request
          );
          this.eventBus.dispatchEvent({
            type: 'LOAD_RPERIODS_END',
            data: {
              success: false,
              pid,
              result: null,
            },
          });
        }
      }
    };

    request.url = url;
    this.xlinkOnPrepare({
      req: request,
      qrys,
      hdrs,
      xhr: request,
    });

    if (qrys.length > 0) {
      qrys.forEach((qry) => {
        request.url += request.url!.indexOf('?') > 0 ? '&' : '?';
        request.url += qry.name + '=' + qry.value;
      });
    }

    try {
      request.onload = onload;
      request.onloadend = report;
      request.onerror = report;
      request.open!('GET', request.url, true);

      if (hdrs.length > 0) {
        hdrs.forEach((hdr) => {
          request.setRequestHeader!(hdr.name, hdr.value);
        });
      }

      request.send!();
    } catch (e: any) {
      (request as XMLHttpRequest).onerror!(e);
    }
  };

  /* istanbul ignore next */
  getRemotePeriodsF = (
    url: string,
    pid: string,
    remainingAttempts: number
  ): void => {
    const request: {
      url?: string;
      status?: number;
    } = {};

    const init: RequestInit = {
      method: 'GET',
      headers: {},
      credentials: 'same-origin',
    };

    const self = this;

    const acon: ExXMLHttpRequest = {
      aborted: false,
    };

    const qrys: Array<CommonQuery> = this.xlinkCommonQrys.concat();
    const hdrs: Array<CommonHeader> = this.xlinkCommonHdrs.concat();
    let rPeriodsTxt: Nullable<string> = null;

    request.url = url;
    this.xlinkOnPrepare({
      req: request,
      qrys,
      hdrs,
      xhr: request,
    });

    if (qrys.length > 0) {
      qrys.forEach((qry) => {
        request.url += request.url!.indexOf('?') > 0 ? '&' : '?';
        request.url += qry.name + '=' + qry.value;
      });
    }
    if (hdrs.length > 0) {
      hdrs.forEach((hdr) => {
        init.headers![hdr.name] = hdr.value;
      });
    }

    this.abortWrapper(fetch(request.url, init), acon)
      .then((res: Response) => {
        request.status = res.status;

        if (res.ok == true) {
          return res.text();
        } else {
          return Promise.reject(new Error('res.false'));
        }
      })
      .then((responseText) => {
        if (responseText.length == 0) {
          this.logHandler.log(
            '!!! Load mpd size : ' +
              responseText.length +
              ' !!!! remainingAttempts:' +
              remainingAttempts
          );
          return Promise.reject(new Error('size0'));
        }

        this.xlinkOnSuccess({
          status: request.status!,
          req: request,
          xhr: request,
        });

        rPeriodsTxt = responseText;
        rPeriodsTxt = '<root>' + rPeriodsTxt + '</root>';

        try {
          const parser: DOMParser = new DOMParser();
          const dom: Document = parser.parseFromString(rPeriodsTxt, 'text/xml');
          const rperiods: HTMLCollectionOf<Element> =
            dom.getElementsByTagName('Period');
          this.NXDebug.info(String(rperiods));

          if (rperiods) {
            //
          }

          this.eventBus.dispatchEvent({
            type: 'LOAD_RPERIODS_END',
            data: {
              success: true,
              pid,
              result: rperiods,
            },
          });
          return;
        } catch (e: any) {
          this.eventBus.dispatchEvent({
            type: 'LOAD_RPERIODS_END',
            data: {
              success: false,
              pid,
              result: null,
            },
          });
          return;
        }
      })
      // eslint-disable-next-line no-unused-vars
      .catch((_err: any) => {
        if (acon.aborted) {
          this.logHandler.log('remoteperiods request is aborted.');
          request.status = -1;
        }

        this.xlinkOnError({
          status: request.status!,
          req: request,
          xhr: request,
        });

        if (remainingAttempts > 0) {
          this.NXDebug.log(
            'Failed loading remoteperiods: ' +
              url +
              ', retry in ' +
              this.RETRY_INTERVAL +
              'ms' +
              ' attempts: ' +
              remainingAttempts
          );
          remainingAttempts--;
          setTimeout(() => {
            this.getRemotePeriods.call(self, url, pid, remainingAttempts);
          }, this.RETRY_INTERVAL);
        } else {
          this.NXDebug.log(
            'Failed loading remoteperiods: ' + url + ' no retry attempts left'
          );

          this.errHandler.downloadError(
            this.eventBus,
            'manifest',
            url,
            request
          );
          this.eventBus.dispatchEvent({
            type: 'LOAD_RPERIODS_END',
            data: {
              success: false,
              pid,
              result: null,
            },
          });
        }

        return;
      });
  };

  getRemotePeriods = (
    url: string,
    pid: string,
    remainingAttempts: number
  ): void =>
    this.useFetch
      ? this.getRemotePeriodsF(url, pid, remainingAttempts)
      : this.getRemotePeriodsX(url, pid, remainingAttempts);

  getServerTimeX = (_callback: (val: boolean) => void): void => {
    const callback: (val: boolean) => void = _callback || (() => {});
    if (isNaN(this.clientServerTimeShift)) {
      const req: XMLHttpRequest = new XMLHttpRequest();
      let isSuccessful: boolean = false;
      const st: number = new Date().getTime();
      let url: string = window.location.href;

      url = url.indexOf('?') > -1 ? url + '&_t=' + st : url + '?_t=' + st;
      req.open('HEAD', url, true);

      req.onload = () => {
        isSuccessful = true;

        const sDate: Nullable<string> = req.getResponseHeader('Date');
        const cur: number = new Date().getTime();
        const rtt: number = cur - st;
        let t: number = 0;
        if (sDate != null) {
          t =
            Math.ceil(
              (new Date(sDate).getTime() + rtt / 2 - new Date().getTime()) /
                1000
            ) * 1000;
          if (t > Math.abs(2)) {
            this.clientServerTimeShift = t;
          } else {
            this.clientServerTimeShift = 0;
          }
        } else {
          this.clientServerTimeShift = 0;
        }
        callback(true);
      };

      req.onloadend = req.onerror = () => {
        if (!isSuccessful) {
          this.clientServerTimeShift = 0;
          callback(true);
        }
      };

      req.send();
    } else {
      callback(true);
    }
  };

  getServerTimeF = (_callback: (val: boolean) => void) => {
    const callback: (val: boolean) => void = _callback || (() => {});
    if (isNaN(this.clientServerTimeShift)) {
      const st: number = new Date().getTime();
      let url: string = window.location.href;

      const init: RequestInit = {
        method: 'HEAD',
        credentials: 'same-origin',
        //signal: signal
      };

      url = url.indexOf('?') > -1 ? url + '&_t=' + st : url + '?_t=' + st;
      fetch(url, init)
        .then((res) => {
          const sDate: Nullable<string> = res.headers.get('Date');
          const cur: number = new Date().getTime();
          const rtt: number = cur - st;
          let t: number = 0;
          if (sDate != null) {
            t =
              Math.ceil(
                (new Date(sDate).getTime() + rtt / 2 - new Date().getTime()) /
                  1000
              ) * 1000;
            if (t > Math.abs(2)) {
              this.clientServerTimeShift = t;
            } else {
              this.clientServerTimeShift = 0;
            }
          } else {
            this.clientServerTimeShift = 0;
          }
          callback(true);
        })
        // eslint-disable-next-line no-unused-vars
        .catch((_err: any) => {
          this.clientServerTimeShift = 0;
          callback(true);
        });
    } else {
      callback(true);
    }
  };

  getServerTime = (_callback: (val: boolean) => void): void =>
    this.useFetch
      ? this.getServerTimeF(_callback)
      : this.getServerTimeX(_callback);

  /* istanbul ignore next */
  doLoadX = (url: string, remainingAttempts: number) => {
    const baseUrl: Nullable<string> = this.parseBaseUrl(url);
    const request: ExXMLHttpRequest = new XMLHttpRequest();
    let needFailureReport: boolean = true;
    const self = this;
    let mnfst: Nullable<Partial<ManifestModel>> = null;
    let aborted: boolean = false;
    let success: boolean = false;
    const qrys: Array<CommonQuery> = this.mpdCommonQrys.concat();
    const hdrs: Array<CommonHeader> = this.mpdCommonHdrs.concat();

    const timeoutTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
      this.logHandler.log('MPD request aborted!!!');
      this.NXDebug.debug('MPD request aborted!!!');
      aborted = true;
      request.abort!();
    }, 1000);

    const onload = (): void => {
      this.lastMpdLoadedTime = new Date().getTime();

      if (request.status! < 200 || request.status! > 299) {
        return;
      }
      if (request.responseText!.length === 0) {
        this.logHandler.log(
          '!!! Load mpd size : ' +
            request.responseText!.length +
            ' !!!! remainingAttempts:' +
            remainingAttempts
        );
        return;
      }
      if (this.manifestText == request.responseText) {
        return;
      }

      this.mpdOnSuccess({
        status: request.status!,
        req: request,
        xhr: request,
      });

      needFailureReport = false;
      this.manifestText = request.responseText!;

      this.internalParse.call(
        self,
        request.responseText!,
        baseUrl,
        (d: Nullable<Partial<ManifestModel>>) => {
          if (d != null) {
            mnfst = d;
            mnfst.mpdUrl = url;
            success = true;

            this.eventBus.dispatchEvent({
              type: 'LOAD_MANIFEST_END',
              data: {
                success,
                result: mnfst,
              },
            });
            return;
          } else {
            success = false;
          }
        }
      );
    };

    const report = () => {
      if (aborted) {
        this.logHandler.log('manifest request is aborted.' + needFailureReport);
      }
      if (timeoutTimer != null) {
        clearTimeout(timeoutTimer);
      }

      if (!needFailureReport) {
        // eslint-disable-line no-empty
      } else {
        this.mpdOnError({
          status: request.status!,
          req: request,
          xhr: request,
        });

        needFailureReport = false;

        if (remainingAttempts > 0) {
          this.NXDebug.log(
            'Failed loading manifest: ' +
              url +
              ', retry in ' +
              this.RETRY_INTERVAL +
              'ms' +
              ' attempts: ' +
              remainingAttempts
          );
          remainingAttempts--;
          setTimeout(() => {
            this.doLoad.call(self, url, remainingAttempts);
          }, this.RETRY_INTERVAL);
        } else {
          this.NXDebug.log(
            'Failed loading manifest: ' + url + ' no retry attempts left'
          );

          this.errHandler.downloadError(
            this.eventBus,
            'manifest',
            url,
            request
          );
          this.eventBus.dispatchEvent({
            type: 'LOAD_MANIFEST_END',
            data: {
              success: false,
              result: null,
            },
          });
        }
      }
    };

    request.url = url;
    this.mpdOnPrepare({
      req: request,
      qrys,
      hdrs,
      xhr: request,
    });
    if (qrys.length > 0) {
      qrys.forEach((qry) => {
        request.url += request.url!.indexOf('?') > 0 ? '&' : '?';
        request.url += qry.name + '=' + qry.value;
      });
    }

    try {
      request.onload = onload;
      request.onloadend = report;
      request.onerror = report;
      request.open!('GET', request.url!, true);

      if (hdrs.length > 0) {
        hdrs.forEach((hdr) => {
          request.setRequestHeader!(hdr.name, hdr.value);
        });
      }

      request.send!();
    } catch (e: any) {
      (request as XMLHttpRequest).onerror!(e);
    }
  };

  /* istanbul ignore next */
  doLoadF = (url: string, remainingAttempts: number) => {
    const baseUrl: Nullable<string> = this.parseBaseUrl(url);
    const request: ExXMLHttpRequest = {};

    const acon: ExXMLHttpRequest = {
      aborted: false,
    };

    const init: RequestInit = {
      method: 'GET',
      headers: {},
      credentials: 'same-origin',
    };

    const self = this;
    let mnfst: Nullable<Partial<ManifestModel>> = null;
    let success: boolean = false;
    const qrys: Array<CommonQuery> = this.mpdCommonQrys.concat();
    const hdrs: Array<CommonHeader> = this.mpdCommonHdrs.concat();

    request.url = url;

    this.mpdOnPrepare({
      req: request,
      qrys,
      hdrs,
      xhr: request,
    });

    if (qrys.length > 0) {
      qrys.forEach((qry) => {
        request.url += request.url!.indexOf('?') > 0 ? '&' : '?';
        request.url += qry.name + '=' + qry.value;
      });
    }
    if (hdrs.length > 0) {
      hdrs.forEach((hdr) => {
        init.headers![hdr.name] = hdr.value;
      });
    }

    this.abortWrapper(fetch(request.url!, init), acon)
      .then((res) => {
        this.lastMpdLoadedTime = new Date().getTime();
        request.status = res.status;
        if (res.ok == true) {
          return res.text();
        } else {
          return Promise.reject(new Error('res.false'));
        }
      })
      .then((responseText) => {
        if (responseText.length == 0) {
          this.logHandler.log(
            '!!! Load mpd size : ' +
              responseText.length +
              ' !!!! remainingAttempts:' +
              remainingAttempts
          );
          return Promise.reject(new Error('size0'));
        }

        if (this.manifestText == responseText) {
          return Promise.reject(new Error('same'));
        }
        this.mpdOnSuccess({
          status: request.status!,
          req: request,
          xhr: request,
        });

        //manifestText = responseText;
        const code0: number = responseText.charCodeAt(0);

        const code1: number = responseText.charCodeAt(1);
        const code2: number = responseText.charCodeAt(2);
        if (code0 == 239 && code1 == 187 && code2 == 191) {
          //remove BOM
          this.manifestText = responseText.substring(3);
        } else {
          this.manifestText = responseText;
        }
        this.internalParse.call(self, this.manifestText, baseUrl, (d) => {
          if (d != null) {
            mnfst = d;
            mnfst!.mpdUrl = url;
            success = true;

            this.eventBus.dispatchEvent({
              type: 'LOAD_MANIFEST_END',
              data: {
                success,
                result: mnfst,
              },
            });
          } else {
            success = false;
          }
        });
        return;
      })
      .catch((_err: any) => {
        if (acon.aborted) {
          this.logHandler.log('manifest request is aborted.');
          request.status = -1;
        }

        this.mpdOnError({
          status: request.status!,
          req: request,
          xhr: request,
        });

        if (remainingAttempts > 0) {
          this.NXDebug.log(
            'Failed loading manifest: ' +
              url +
              ', retry in ' +
              this.RETRY_INTERVAL +
              'ms' +
              ' attempts: ' +
              remainingAttempts
          );
          remainingAttempts--;
          setTimeout(() => {
            this.doLoad.call(self, url, remainingAttempts);
          }, this.RETRY_INTERVAL);
        } else {
          this.NXDebug.log(
            'Failed loading manifest: ' + url + ' no retry attempts left'
          );

          this.errHandler.downloadError(
            this.eventBus,
            'manifest',
            url,
            request
          );
          this.eventBus.dispatchEvent({
            type: 'LOAD_MANIFEST_END',
            data: {
              success: false,
              result: null,
            },
          });
        }

        return;
      });
  };

  doLoad = (url: string, remainingAttempts: number): void =>
    this.useFetch
      ? this.doLoadF(url, remainingAttempts)
      : this.doLoadX(url, remainingAttempts);

  //NSV-a const replaceByExt = (mnfst) => {
  //NSV-a   const periods = mnfst.mpd.periods;
  //NSV-a   const pids = [];
  //NSV-a
  //NSV-a   for (let i = 0; i < periods.length; i++) {
  //NSV-a     pids.push(periods[i].id);
  //NSV-a     if (hasProperty(xPeriods, periods[i].id)) {
  //NSV-a       const xmnfst = xPeriods[periods[i].id];
  //NSV-a       const xperiod = xmnfst.mpd.periods[0];
  //NSV-a       xperiod.index = periods[i].index;
  //NSV-a       xperiod.id = periods[i].id;
  //NSV-a       xperiod.start = periods[i].start;
  //NSV-a       xperiod.duration = periods[i].duration;
  //NSV-a       xperiod.offset = periods[i].offset;
  //NSV-a       xperiod.end = periods[i].end;
  //NSV-a       xperiod.mpd = periods[i].mpd;
  //NSV-a
  //NSV-a       mnfst.mpd.periods[i] = xperiod;
  //NSV-a     }
  //NSV-a   }
  //NSV-a
  //NSV-a   for (const x in xPeriods) {
  //NSV-a     if (pids.indexOf(x) < 0) {
  //NSV-a       delete xPeriods[x];
  //NSV-a     }
  //NSV-a   }
  //NSV-a
  //NSV-a   return mnfst;
  //NSV-a };

  manifestUpdateClear = (): void => {
    if (this.manifestRefreshTimer !== null) {
      this.NXDebug.log(
        'Refresh manifest in ... clearTimeout id : ' + this.manifestRefreshTimer
      );
      this.manifestUpdating = false;
      clearTimeout(this.manifestRefreshTimer);
      this.manifestRefreshTimer = null;
    } else {
      // eslint-disable-line no-empty
    }
  };

  setManifestUpdateStart = (): void => {
    this.manifestUpdateClear.call(this);

    if (!isNaN(this.manifestRefreshDelay)) {
      this.NXDebug.log(
        'Refresh manifest in ' + this.manifestRefreshDelay + ' seconds.'
      );

      // @ts-ignore
      this.manifestRefreshTimer = setTimeout(
        this.onManifestRefreshTimer.bind(this),
        Math.min(this.manifestRefreshDelay * 1000, 2 ** 31 - 1),
        this
      );
    }
  };

  manifestUpdateRun = (): void => {
    const self = this;
    let timeSinceLastUpdate: number;
    if (this.manifest !== undefined && this.manifest !== null) {
      if (!self.getIsDynamic.call(self, this.manifest)) return;

      timeSinceLastUpdate =
        (new Date().getTime() - this.lastMpdLoadedTime) / 1000;
      this.manifestRefreshDelay = Math.max(
        this.DEFAULT_MANIFEST_REFRESH_DELAY - timeSinceLastUpdate,
        0
      );
      this.NXDebug.debug(
        'Refresh manifest in timeSince:' +
          timeSinceLastUpdate +
          ', delay:' +
          this.manifestRefreshDelay
      );
    } else {
      this.manifestRefreshDelay = 0;
    }
    this.setManifestUpdateStart.call(self);
  };

  manifestUpdateStartPoll(): void {
    const self = this;
    let timeSinceLastUpdate: number;

    if (this.manifest !== undefined && this.manifest !== null) {
      if (!self.getIsDynamic.call(self, this.manifest)) return;

      timeSinceLastUpdate =
        (new Date().getTime() - this.lastMpdLoadedTime) / 1000;
      this.manifestRefreshDelay = Math.max(
        this.getRefreshDelay.call(self, this.manifest) - timeSinceLastUpdate,
        0
      );
      if (this.manifestRefreshDelay == 0) {
        this.manifestUpdateIsStopped = false;
        this.onManifestRefreshTimer.call(self);
      }
    }
  }

  /* istanbul ignore next */
  onManifestRefreshTimer(): void {
    const self = this;
    let url: string;

    const manifestUpdate = (): void => {
      this.eventBus.removeEventListener('REFRESH_MANIFEST_END', manifestUpdate);

      if (this.manifestUpdating === false) {
        this.manifestUpdating = true;
      } else {
        this.NXDebug.log('### MPD Refresh Skip ###');
        //eventBus.removeEventListener("REFRESH_MANIFEST_END",manifestUpdate);
        return;
      }
      this.NXDebug.debug(
        '######################## Refresh Start ######################### Refresh manifest in '
      );
      this.manifestUpdateClear.call(self);
      url = this.manifest!.mpdUrl!;

      if (hasProperty(this.manifest, 'Location')) {
        url = this.manifest!.Location!;
      }

      const loadManifestListener = (evt): void => {
        if (evt.data.success) {
          this.NXDebug.log('Manifest has been refreshed. Refresh manifest in');
          if (this.manifestUpdateIsStopped) return;
        } else {
          this.NXDebug.log('Failed to refresh Manifest. Refresh manifest in');
        }
        self.setValue(evt.data.result);
        this.manifestUpdateRun.call(self);

        this.eventBus.removeEventListener(
          'LOAD_MANIFEST_END',
          loadManifestListener
        );
      };
      this.eventBus.addEventListener('LOAD_MANIFEST_END', loadManifestListener);
      self.loadManifest.call(self, url);
    };

    if (this.manifestUpdating) {
      this.NXDebug.debug('refresh updating...');
    } else {
      manifestUpdate();
    }
  }

  loadManifest(url: string) {
    this.doLoad.call(this, url, this.RETRY_ATTEMPTS);
  }
  setManifestFromExt(url: string, data: string) {
    this.setManifestData.call(this, url, data);
  }

  getIsDynamic(manifest: ManifestModel): boolean {
    let isDynamic: boolean = false;
    const LIVE_TYPE: string = 'dynamic';
    if (hasProperty(manifest.mpd!, 'type')) {
      isDynamic = manifest.mpd!.type === LIVE_TYPE;
    }
    return isDynamic;
  }

  // getEventsForPeriod(
  //   manifest: ManifestModel,
  //   period: Period
  // ): Array<DashEvent> {
  //   const periodArray: Array<Period> = manifest.mpd!.periods;
  //   const eventStreams: Array<NXEventStream> | undefined =
  //     periodArray[period.index].eventStreams;
  //   const events: Array<DashEvent> = [];
  //   if (eventStreams) {
  //     for (let i = 0; i < eventStreams.length; i += 1) {
  //       const eventStream: EventStream = new EventStream();
  //       eventStream.period = period;
  //       eventStream.timescale = 1;
  //       if (hasProperty(eventStreams[i], 'schemeIdUri')) {
  //         eventStream.schemeIdUri = eventStreams[i].schemeIdUri!;
  //       } else {
  //         throw 'Invalid EventStream. SchemeIdUri has to be set';
  //       }
  //       if (hasProperty(eventStreams[i], 'timescale')) {
  //         eventStream.timescale = eventStreams[i].timescale!;
  //       }
  //       if (hasProperty(eventStreams[i], 'value')) {
  //         eventStream.value = eventStreams[i].value!;
  //       }
  //       for (let j = 0; j < eventStreams[i].events!.length; j += 1) {
  //         const event: DashEvent = new DashEvent();
  //         event.presentationTime = 0;
  //         event.eventStream = eventStream;
  //         if (hasProperty(eventStreams[i].events![j], 'presentationTime')) {
  //           event.presentationTime = eventStreams[i].events![
  //             j
  //           ].presentationTime;
  //         }
  //         if (hasProperty(eventStreams[i].events![j], 'duration')) {
  //           event.duration = eventStreams[i].events![j].duration;
  //         }
  //         if (hasProperty(eventStreams[i].events![j], 'id')) {
  //           event.id = eventStreams[i].events![j].id;
  //         }
  //         events.push(event);
  //       }
  //     }
  //   }
  //   return events;
  // }

  // getEventStreamForAdaptationSet(data: Representation): Array<NXEventStream> {
  //   const eventStreams: Array<NXEventStream> = [];
  //   const inbandStreams: undefined | Array<NXEventStream> =
  //     data.inbandEventStreams;
  //   if (inbandStreams) {
  //     for (let i = 0; i < inbandStreams.length; i += 1) {
  //       const eventStream: NXEventStream = new EventStream();
  //       eventStream.timescale = 1;
  //       if (hasProperty(inbandStreams[i], 'schemeIdUri')) {
  //         eventStream.schemeIdUri = inbandStreams[i].schemeIdUri;
  //       } else {
  //         throw 'Invalid EventStream. SchemeIdUri has to be set';
  //       }
  //       if (hasProperty(inbandStreams[i], 'timescale')) {
  //         eventStream.timescale = inbandStreams[i].timescale;
  //       }
  //       if (hasProperty(inbandStreams[i], 'value')) {
  //         eventStream.value = inbandStreams[i].value;
  //       }
  //       eventStreams.push(eventStream);
  //     }
  //   }
  //   return eventStreams;
  // }

  // getEventStreamForRepresentation(
  //   data,
  //   representation: Representation
  // ): Array<NXEventStream> {
  //   const eventStreams: Array<NXEventStream> = [];
  //   const inbandStreams: undefined | Array<NXEventStream> =
  //     data.representations[representation.index].inbandEventStreams;
  //   if (inbandStreams) {
  //     for (let i = 0; i < inbandStreams.length; i++) {
  //       const eventStream = new EventStream();
  //       eventStream.timescale = 1;
  //       eventStream.representation = representation;
  //       if (hasProperty(inbandStreams[i], 'schemeIdUri')) {
  //         eventStream.schemeIdUri = inbandStreams[i].schemeIdUri!;
  //       } else {
  //         throw 'Invalid EventStream. SchemeIdUri has to be set';
  //       }
  //       if (hasProperty(inbandStreams[i], 'timescale')) {
  //         eventStream.timescale = inbandStreams[i].timescale!;
  //       }
  //       if (hasProperty(inbandStreams[i], 'value')) {
  //         eventStream.value = inbandStreams[i].value!;
  //       }
  //       eventStreams.push(eventStream);
  //     }
  //   }
  //   return eventStreams;
  // }

  getValue(): Nullable<ManifestModel> {
    return this.manifest;
  }

  setValue(value: Nullable<ManifestModel>): void {
    if (value != null) {
      this.manifest = value;
      this.eventBus.dispatchEvent({
        type: 'manifestUpdated',
        data: {},
      });
    } else {
      this.NXDebug.debug('manifest load failed ...');
      this.onManifestRefreshEnd();
    }
  }

  setBandwidthLimit(
    min: {
      video: number;
      audio: number;
    },
    max: {
      video: number;
      audio: number;
    }
  ) {
    this.minBandwidth = min;
    this.maxBandwidth = max;
  }

  manifestUpdateStart(): void {
    this.manifestUpdateIsStopped = false;
    this.manifestUpdateRun.call(this);
  }

  manifestUpdateStop(): void {
    this.manifestUpdateIsStopped = true;
    this.manifestUpdateClear.call(this);
  }

  onManifestRefreshEnd(): void {
    // When streams are ready we can consider manifest update completed. Resolve the update promise.
    if (this.manifestUpdating) {
      this.manifestUpdating = false;
      this.eventBus.dispatchEvent({
        type: 'REFRESH_MANIFEST_END',
        data: {},
      });
    }
  }
}
