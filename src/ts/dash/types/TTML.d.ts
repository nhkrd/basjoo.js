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

// TTMLParser
interface TTMLDictionary {
  [key: string]: string;
}

interface TTMLRange {
  begin_time: number;
  end_time: number;
}

interface TTMLStringRange {
  begin: Nullable<string>;
  end: Nullable<string>;
}

interface TTMLCaption {
  begin_time: number;
  end_time: number;
  id: Nullable<string>;
  caption: Element;
}

interface TTMLFontFace extends TTMLDictionary {}

interface TTMLPosition {
  position: string;
  styles: string;
}

interface TTMLKeyFrame {
  name: string;
  positions: Array<TTMLPosition>;
}

interface TTML {
  captions: Array<TTMLCaption>;
  fontfaces: Array<TTMLFontFace>;
  keyframes: Array<TTMLKeyFrame>;
}

interface TTMLAttribute {
  htmlAttrs: TTMLDictionary;
  htmlCss: TTMLDictionary;
}

interface TTMLRegion {
  id: string;
  begin: Nullable<string>;
  end: Nullable<string>;
  styles: TTMLStyle;
}

interface TTMLStyle extends TTMLDictionary {}
