/*
 * The copyright in this software is being made available under the BSD License, included below.
 *
 * Copyright (c) 2022, NHK(Japan Broadcasting Corporation).
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * - Neither the name of the NHK nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// Common
type Nullable<T> = T | null;

// Requests
interface RevisedHttpRequests {
  [key: string]: any;
}

// EventBus
interface EventRegistrations {
  [captype: string]: Array<NXEventListener>;
}

interface NXEventListener {
  (evt: ExEvent): void;
}

interface ExEvent extends Partial<Event> {
  type: string;
  defaultPrevented?: boolean;
  error?: string;
  event?: NXCustomEvent | string;
  data?: any;
  initData?: Uint8Array;
  initDataType?: string;
  target?: any;
  message?: any;
  destinationURL?: string;
  srcElement?: Nullable<ExEventTarget>;
}

interface NXCustomEvent {
  id: string;
  url?: string;
  request?: { url: string } | CustomXMLHttpRequest;
  _request?: SegmentRequest;
  message?: string;
  manifest?: ManifestModel | string;
}

interface ExEventTarget extends EventTarget {
  laURL?: string;
  error?: any;
}

// Debug
interface DebugMode {
  log: boolean;
  debug: boolean;
  info: boolean;
  warn: boolean;
  error: boolean;
}

// Metrics
// defined in ./Metrics.d.ts

// MetricsModel
interface MetricsList {
  [type: string]: Metrics;
}

// TimelineConverter
interface TimeRange {
  start: number;
  end: number;
  now?: number;
}

//VideoModel
interface VideoStatus {
  autoPlay: boolean;
  selfPaused: boolean;
  manualPause: boolean;
  startTime: number;
  startOffset: number;
  stalledStreams: Array<string>;
  epsilonVal: { video: number; audio: number };
  adjusting: boolean;
  playbackStarted: boolean;
}

interface ExHTMLEvent extends Event {
  visibility?: boolean;
}

// AbrController
interface DownloadRatioResult {
  idx: number;
  switchTo: number;
}

interface PlaybackQuality {
  quality: number;
  confidence: number;
}

interface QualityDict {
  video?: number;
  audio?: number;
}

interface ConfidenceDict {
  video?: number;
  audio?: number;
}

interface DownloadRate {
  video?: number;
  audio?: number;
}

interface IndexDict {
  video?: number;
  audio?: number;
}

interface CheckedRequestList {
  video: array<RevisedHttpRequestMetrics>;
  audio: array<RevisedHttpRequestMetrics>;
}

interface DownloadList {
  video: Array<number>;
  audio: Array<number>;
}

// FragmentModel
interface Paramstype {
  LOADING_REQUEST_THRESHOLD?: number;
  STORE_MEASURED_DATA?: boolean;
  USE_FETCH?: boolean;
  DEFAULT_MANIFEST_REFRESH_DELAY?: number;
  DEFAULT_PRESENTATION_DELAY?: number;
  DEFAULT_BASEURL_IDX?: number;
  SET_1STSEG_TIME_ZERO?: boolean;
  SUPPORTED_COLOUR_PRIMARIES?: Array<number>;
  SUPPORTED_TRANSFER_CHARACTERISTICS?: Array<number>;
  UNUSE_AUDIO?: boolean;
  BDAT_INSERT_MODE?: boolean;
  BUFFER_PREFETCH_THRESHOLD?: number;
  DEFAULT_MIN_BUFFER_TIME?: number;
  DELETE_UNNECESSARY_BOX?: boolean;
  FORCE_DEFAULT_MBT?: boolean;
  MSE_APPEND_ENABLE_THRESHOLD?: number;
  MIN_SEGSIZE_FORBASE?: number;
  START_FROM_MPDTOP_FORLIVE?: boolean;
  SKIP_GAP_AT_HOB?: boolean;
  EXTRACT_ALL_IDR_IN_MOOF?: boolean;
  DEV_TYPE?: string;
  LISTEN_TO_CANPLAY_AFTER_SEEK?: boolean;
  SILA_INSERT_MODE?: boolean;
  SKIP_PERIOD_BOUNDARY?: boolean;
  DEFAULT_ROLE_FOR_VIDEO?: string;
  DEFAULT_ROLE_FOR_AUDIO?: string;
  BUFFER_PREFETCH_THRESHOLD_V?: number;
  BUFFER_PREFETCH_THRESHOLD_A?: number;
  MSE_APPEND_ENABLE_THRESHOLD_V?: number;
  MSE_APPEND_ENABLE_THRESHOLD_A?: number;
  DELETE_PAST_DASHEVENT?: boolean;
}

// ManifestModel
interface RoleType {
  index: number;
  id: Nullable<number>;
  role: string | RoleType;
}

interface SegmentTemplate {
  timescale?: number;
  duration?: number;
  startNumber?: number;
  media?: string;
  initialization?: string;
  presentationTimeOffset?: number;
  availabilityTimeOffset?: Nullable<number>;
  SegmentTimeline?: SegmentTimeline;
  SegmentURLs?: Array<SegmentURL>;
  indexRange?: Nullable<string>;
  Initialization?: Initialization;
}

interface SegmentURL {
  media: Nullable<string>;
  mediaRange: Nullable<string>;
  index: Nullable<number>;
  indexRange: Nullable<number>;
}

interface SegmentTimeline {
  S?: Array<Fragment>;
}

interface SegmentList {
  Initialization?: {
    sourceURL?: string;
  };
  SegmentURLs?: Array<SegmentURL>;
  SegmentTimeline?: SegmentTimeline;
  startNumber?: number;
}

interface ContentProtection {
  pro?:
    | {
        __text: string;
      }
    | string;
  schemeIdUri?: string;
  'cenc:default_KID'?: string;
  value?: string;
  prheader?: { __text: string };
  pssh?: Uint8Array;
}

interface CommonParseAttributes {
  profiles: (str: string) => string;
  width: (s: string) => number;
  height: (s: string) => number;
  sar: (str: string) => string;
  frameRate: (fr: string) => Nullable<number>;
  audioSamplingRate: (s: string) => number;
  mimeType: (str: string) => string;
  lang: (str: string) => string;
  segmentProfiles: (str: string) => string;
  codecs: (str: string) => string;
  maximumSAPPeriod: (s: string) => number;
  startsWithSap: (s: string) => number;
  maxPlayoutRate: (s: string) => number;
  codingDependency: (s: string) => string;
  scanType: (str: string) => string;
  FramePacking: (str: string) => string;
  AudioChannelConfiguration: (str: string) => string;
  availabilityTimeOffset: (s: string) => number;
}

interface RepresentationParseAttributes {
  id: (str: string) => string;
  bandwidth: (s: string) => number;
  height: (s: string) => number;
  width: (s: string) => number;
  availabilityTimeOffset: (s: string) => number;
}

interface MpdParseAttributes {
  'xmlns:xsi': (str: string) => string;
  xmlns: (str: string) => string;
  'xsi:schemaLocation': (str: string) => string;
  type: (str: string) => string;
  minBufferTime: (pt: string) => Nullable<number>;
  profiles: (str: string) => string;
  minimumUpdatePeriod: (pt: string) => Nullable<number>;
}

interface Initialization {
  range?: Nullable<string>;
  sourceURL?: string;
}

interface CommonQuery {
  name: string;
  value: Nullable<string>;
}

interface CommonHeader {
  name: string;
  value: string;
}

// DashHandler
interface ExXMLHttpRequest extends Partial<XMLHttpRequest> {
  startTime?: Nullable<number>;
  aborted?: boolean;
  listener?: Nullable<NXEventListener>;
  lid?: Nullable<string>;
  startTime?: Nullable<number>;
  listen?: () => void;
  unlisten?: () => void;
  abort?: () => void;
  ok?: boolean;
  status?: number;
  url?: string;
  keySession?: Nullable<NXMediaKeySession>; //keySession?: Nullable<EventTarget>;
  keysTypeString?: string;
}

interface ExResponse extends Response {
  done?: boolean;
  value?: Uint8Array;
  url?: string;
}

interface ResponseData {
  status: string;
  data?: Nullable<any>;
  type?: string;
  msg?: string;
  time?: Nullable<number>;
}

interface ChunkQ {
  chunks?: Array<ChunkQ>;
  start?: number;
  appending?: boolean;
  asetIdx: number;
  chunkDur?: number;
  chunkEnd?: number;
  chunkStartTime?: number;
  data: Nullable<Uint8Array>;
  divNum: number;
  done?: boolean;
  dur: number;
  offset: number;
  params?: {
    timescale: number;
    dsd: number;
  };
  progress?: Array<Uint8Array>;
  pStart: number;
  quality: number;
  ridx: number;
  rstime: number;
  time: number;
  type: string;
  action?: string;
  MSETimeOffset?: number;
  startTime?: number;
}
interface XHRCustom {
  header?: Array<CommonHeader>;
  onPrepare?: (data: {
    req: SegmentRequest;
    qrys: Array<CommonQuery>;
    hdrs: Array<CommonHeader>;
    xhr: CustomXMLHttpRequest;
  }) => void;
  onSuccess?: (data: {
    status: number;
    req: SegmentRequest;
    xhr: CustomXMLHttpRequest;
  }) => void;
  onError?: (data: {
    status: number;
    req: SegmentRequest;
    xhr: CustomXMLHttpRequest;
  }) => void;
  query?: Array<CommonQuery>;
  data?: Nullable<any>;
  type?: string;
  msg?: string;
  time?: number;
  mpd?: Mpd;
}

interface Fragment {
  d: Nullable<number>;
  r: Nullable<number>;
  t: Nullable<number>;
  mediaRange?: Nullable<string>;
}

interface startDuration {
  startTime: number;
  duration: number;
}

interface DIdx {}

interface SIdx {
  reference_count?: number;
  version?: number;
  timescale?: number;
  earliest_presentation_time?: number;
  earliest_presentation_time?: number;
  first_offset?: number;
  references?: Array<Reference>;
  typePos?: number;
}

interface Reference {
  size: number;
  type: number;
  offset: number;
  duration: number;
  time: number;
  timescale: number;
}
interface Info {
  url: string;
  range: {
    start?: number;
    end?: number;
  };
  bytesLoaded: number;
  bytesToLoad: number;
  searching: boolean;
  request?: CustomXMLHttpRequest;
}

interface ExtractChunk {
  curChunkEnd: number;
  nextChunkEnd: number;
  curChunkDur: number;
  nextChunkDur: number;
  curChunkStartTime: number;
  nextChunkStartTime: number;
}

//interface De {
//  id?: Nullable<string> | number;
//  schemeIdUri?: string;
//  timescale?: number;
//  value?: string;
//  presentationTime?: number;
//  duration?: number;
//  messageData?: Nullable<any>;
//  presentationTimeDelta?: number;
//}

interface DashEvent {
  id?: Nullable<string> | number;
  schemeIdUri?: string;
  timescale?: number;
  value?: string;
  presentationTime?: number;
  duration?: number;
  messageData?: Nullable<any>;
  presentationTimeDelta?: number;
}

interface Moof {
  checkSaio?: boolean;
  dur?: number;
  offset: number;
  moofPos?: number;
  moofSize?: number;
  modTrun?: Uint8Array;
  trafPos?: number;
  trafSize?: number;
  defaultSampleDuration?: number;
  defaultSampleSize?: number;
  defaultSampleFlags?: number;
  saioPos?: number;
  saioSize?: number;
  saioOffsetPos?: number;
  saioVersion?: number;
  sencPos?: number;
  sencSize?: number;
  size?: number;
  time?: number;
  trunPos?: number;
  trunSize?: number;
  trunExp?: number;
  trunEnd?: number;
  mdatPos?: number;
  mdatSize?: number;
}

interface EMSG {
  typePos?: number;
  data?: Nullable<Uint8Array>;
  startTime?: number;
  sizePos?: number;
  size?: number;
}

//interface NXEventStream extends EventStream {
//  events?: Array<DashEvent>;
//  schemeIdUri?: string;
//  timescale?: number;
//  value?: string;
//}

interface Xlinks {
  [key: string]: Nullable<string>;
}

interface XPeriods {
  [key: string]: Array<
    | {
        start?: number;
        duration?: number;
      }
    | Period
  >;
}

interface UrlType {
  type: string;
  source: string | ManifestModel;
  params: Paramstype;
  baseUrl?: string;
  xhrCustom?: XHRCustom;
}

interface Bandwidth {
  video: number;
  audio: number;
}
interface ExSourceBuffer extends Partial<SourceBuffer> {
  asetIdx?: number;
  appendStart?: boolean;
  lastAppendtime?: number;
  preDur?: number;
  updatingRange?: TimeRange;
  initQ?: {
    [key: number]: Array<Array<InitData>>;
  };
  queue?: Array<ChunkQ>;
  waiting?: boolean;
  startTimeAfterSeek?: number;
  type: 'audio' | 'video' | '';
  laData?: Nullable<ChunkQ>;
  pStart?: number;
  quality?: number;
  playbackStarted?: boolean;
  ready?: boolean;
  tmpData?: {
    diff: number;
    start: number;
    offset: number;
  };
  underThreshold?: boolean;
  timerId?: Nullable<ReturnType<typeof setInterval>>;
  offset?: number;
  level?: number;
  append?: (val: Uint8Array) => void;
  convertCodecType?: boolean;
  buffered: TimeRanges;
}

interface InitData {
  data: Uint8Array;
  params: {
    timescale: number;
    dsd: number;
  };
}

interface UpdateDataReason {
  INITIAL_UPDATE: string;
  PERIOD_CHANGE: string;
  MPD_UPDATE: string;
  ADAPTATION_CHANGE: string;
}

interface UpdateInfo {
  reason: string;
  period: Period;
  time: number;
  callback: (d: ResponseData) => void;
}

interface BufferThreshold {
  video: number;
  audio: number;
}

interface ProducerReferenceTime {
  id: Nullable<string>;
  inband: boolean;
  type: Nullable<string>;
  wallClockTime: Nullable<Date>;
  presentationTime: number;
}

interface CheckGapQue {
  curStart: number;
  nextIdx: number;
  nextStart: number;
}

interface DispatchDashEvent {
  index: number;
  de: DashEvent;
  timerId: Nullable<ReturnType<typeof setTimeout>>;
  delta: number;
}

interface OnPrepareArgs {
  req: any;
  qrys: Array<CommonQuery>;
  hdrs: Array<CommonHeader>;
  xhr: any;
}
interface OnSuccessArgs {
  req: any;
  qrys: Array<CommonQuery>;
  hdrs: Array<CommonHeader>;
  xhr: any;
}
interface OnErrorArgs {
  req: any;
  qrys: Array<CommonQuery>;
  hdrs: Array<CommonHeader>;
  xhr: any;
}
