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

/**
 * BASE64
 *
 * @module BASE64（BASE64モジュール）
 */

/* istanbul ignore next*/
const utf8_decode = (enc_input: Array<number>): string => {
  let decode_out: string = '';
  let chr: Nullable<number> = null;
  for (let i = 0; i < enc_input.length; ) {
    chr = enc_input[i++];
    if (chr < 0x80) {
      //asis
    } else if (chr < 0xe0) {
      chr = ((0x1f & chr) << 6) | (0x3f & enc_input[i++]);
    } else if (chr < 0xf0) {
      chr =
        ((0xf & chr) << 12) |
        ((0x3f & enc_input[i++]) << 6) |
        (0x3f & enc_input[i++]);
    } else if (chr < 0xf8) {
      chr =
        ((0x7 & chr) << 18) |
        ((0x3f & enc_input[i++]) << 12) |
        ((0x3f & enc_input[i++]) << 6) |
        (0x3f & enc_input[i++]);
    } else if (chr < 0xfc) {
      chr =
        ((0x3 & chr) << 24) |
        ((0x3f & enc_input[i++]) << 18) |
        ((0x3f & enc_input[i++]) << 12) |
        ((0x3f & enc_input[i++]) << 6) |
        (0x3f & enc_input[i++]);
    } else {
      chr =
        ((0x1 & chr) << 30) |
        ((0x3f & enc_input[i++]) << 24) |
        ((0x3f & enc_input[i++]) << 18) |
        ((0x3f & enc_input[i++]) << 12) |
        ((0x3f & enc_input[i++]) << 6) |
        (0x3f & enc_input[i++]);
    }
    decode_out = decode_out + String.fromCharCode(chr);
  }
  return decode_out;
};

/* istanbul ignore next*/
const decodeArray = (enc_input: string): Array<number> => {
  const strtbl: string =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const decode_out: Array<number> = [];
  let c1: number;
  let c2: number;
  let c3: number;
  let c4: number;
  let b1: number;
  let b2: number;
  let b3: number;
  for (let i = 0; i < enc_input.length; ) {
    c1 = strtbl.indexOf(enc_input.charAt(i++));
    c2 = strtbl.indexOf(enc_input.charAt(i++));
    c3 = strtbl.indexOf(enc_input.charAt(i++));
    c4 = strtbl.indexOf(enc_input.charAt(i++));

    if (c4 != 64) {
      b1 = (c1 << 2) | (c2 >> 4);
      b2 = ((c2 & 0xf) << 4) | (c3 >> 2);
      b3 = ((c3 & 0x3) << 6) | c4;
      decode_out.push(0xff & b1);
      decode_out.push(0xff & b2);
      decode_out.push(0xff & b3);
    } else if (c3 != 64) {
      b1 = (c1 << 2) | (c2 >> 4);
      b2 = ((c2 & 0xf) << 4) | (c3 >> 2);
      decode_out.push(0xff & b1);
      decode_out.push(0xff & b2);
    } else {
      b1 = (c1 << 2) | (c2 >> 4);
      decode_out.push(0xff & b1);
    }
  }

  return decode_out;
};

/**
 * BASE64
 * @constructor
 */
/* istanbul ignore next*/
export const BASE64 = {
  decodeArray(s: string): Uint8Array {
    return new Uint8Array(decodeArray(s));
  },
  decode(s: string): string {
    return utf8_decode(decodeArray(s));
  },
};
