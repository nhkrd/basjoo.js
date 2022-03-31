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

// ProtectionExtensions

interface KeySystem extends Partial<KID> {
  schemeIdUri: string;
  keysTypeString: string;
  isSupported: (data: ContentProtection) => boolean;
  needToAddKeySession?: (
    initData?: Uint8Array,
    keySessions?: Array<NXMediaKeySession>
  ) => boolean;
  getInitData?:
    | (() => null)
    | ((data: ContentProtection) => Nullable<Uint8Array>);
  getUpdate?: (
    bytes: Nullable<Uint16Array>, //msg: string,
    laURL: string,
    xhrCustom: XHRCustom,
    callback: (d: ResponseData) => void
  ) => void;
  getKeyEME01b?:
    | (() => null)
    | ((
        msg: string,
        laURL: string,
        xhrCustom: XHRCustom,
        callback: (val: ResponseData) => void
      ) => void);
  initData?: Nullable<Uint8Array>;
  keySessions?: Array<NXMediaKeySession>;
  keySystem?: KeySystem;
}

interface KID {
  kID: string;
  contentProtection: ContentProtection;
  keySystem: KeySystem;
  keys: Nullable<NXMediaKeys>;
  initData: Nullable<Uint8Array>;
  keySessions: Array<NXMediaKeySession>;
}

// ProtectionModelRMKSA.ts
interface OptionType {
  initDataTypes?: Array<string>;
  videoCapabilities?: Array<{
    contentType: string;
    robustness: string;
  }>;
  audioCapabilities?: Array<{
    contentType: string;
    robustness: string;
  }>;
}

interface NeedsKey {
  type: string;
  initData?: Uint8Array;
  codec?: string;
  contentProtection: Array<ContentProtection>;
}

interface KeySystemString {
  schemeIdUri: string;
  keysTypeString: string;
}

// ProtectionModel.ts
interface KeySystemType {
  kid: Nullable<string>;
  keysTypeString: string;
}

// ProtectionModelEME01b.ts
interface KeySystemTypeEME01b {
  kid: Nullable<string>;
  initData: Uint8Array;
  keysTypeString: string;
}
