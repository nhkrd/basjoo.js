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

// Metrics
interface TcpConnectionMetrics {
  tcpid?: any;
  dest?: any;
  topen?: any;
  tclose?: any;
  tconnect?: any;
}

interface HttpRequestMetrics {
  stream?: string;
  tcpid?: any;
  type?: string;
  url?: string;
  baseURL?: string;
  range?: any;
  trequest?: Nullable<number>;
  tresponse?: Nullable<number>;
  tfinish?: Nullable<number>;
  responsecode?: any;
  interval?: any;
  mediaduration?: number;
  bandwidth?: number;
  trace?: Array<TraceMetrics>;
  size?: number;
  index?: number;
}

interface ReportHttpRequestMetrics {
  baseURL?: string;
  bw?: any;
  c?: string;
  dur?: any;
  code?: any;
  index?: any;
  size?: any;
  tfin?: any;
  treq?: Nullable<number>;
  tres?: any;
  type?: any;
  url?: any;
}

interface RevisedHttpRequestMetrics {
  stream?: string;
  trequest?: Nullable<number>;
  tresponse?: Nullable<number>;
  tfinish?: Nullable<number>;
  mediaduration?: number;
  bandwidth?: number;
  size?: number;
  code?: number;
  index?: number;
}

interface TraceMetrics {
  s?: number;
  d?: number;
  b?: Array<number>;
}

interface RepresentationSwitchMetircs {
  t?: Date;
  mt?: number;
  to?: string;
  lto?: any;
}

interface BufferLevelMetrics {
  t?: number;
  level?: number;
  totalLevel?: number;
}

interface BufferingEventMetrics {
  t?: number;
  e?: any;
  c?: string;
}

interface ReportBufferLevelMetrics {
  t?: number;
  l?: string;
  ql?: string;
  c?: string;
}

interface DroppedFramesMetrics {
  time?: any;
  droppedFrames?: any;
}

interface PlayListMetrics {
  stream?: string;
  start?: Date;
  mstart?: number;
  starttype?: string;
  trace?: Array<PlayListTraceMetrics>;
}

interface PlayListTraceMetrics {
  representationid?: string;
  subreplevel?: any;
  start?: Date;
  mstart?: number;
  duration?: any;
  playbackspeed?: number;
  stopreason?: any;
}
