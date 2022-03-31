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

type NXHTMLVideoElement =
  | ExHTMLVideoElement
  | ExWebkitHTMLVideoElement
  | ExMSHTMLVideoElement;

interface ExMSHTMLVideoElement extends HTMLVideoElement {
  msaddKey?: (
    keysTypeString: string,
    p_license: Uint8Array,
    p_initData: Uint8Array,
    p_session: string
  ) => void;
  msSetMediaKeys?: (mediakeys: MSMediaKeys) => Promise<void>;
  msGenerateKeyRequest?: (
    keysTypeString: string,
    data: Nullable<Uint8Array>
  ) => void;
  mediaKeysObject?: NXMediaKeys;
  pendingSessionData?: Array<{
    initDataType: string;
    initData: Uint8Array;
  }>;
  pendingContentProtectionData: Array<ContentProtection>;
}

interface ExHTMLVideoElement extends HTMLVideoElement {
  addKey?: (
    keysTypeString: string,
    p_license: Uint8Array,
    p_initData: Uint8Array,
    p_session: string
  ) => void;
  generateKeyRequest?: (
    keysTypeString: string,
    data: Nullable<Uint8Array>
  ) => void;
  mediaKeysObject?: Nullable<NXMediaKeys>;
  pendingSessionData?: Array<{
    initDataType: string;
    initData: Uint8Array;
  }>;
  mediaKeysObject?: NXMediaKeys;
  pendingSessionData?: Array<{
    initDataType: string;
    initData: Uint8Array;
  }>;
  pendingContentProtectionData: Array<ContentProtection>;
}

interface ExWebkitHTMLVideoElement extends HTMLVideoElement {
  webkitDroppedFrameCount: number;
  WebKitSetMediaKeys?: (mediakeys: WebKitMediaKeys) => Promise<void>;
  webkitGenerateKeyRequest?: (
    keysTypeString: string,
    data: Nullable<Uint8Array>
  ) => void;
  webkitAddKey?: (
    keysTypeString: string,
    p_license: Uint8Array,
    p_initData: Uint8Array,
    p_session: string
  ) => void;
  mediaKeysObject?: NXMediaKeys;
  pendingSessionData?: Array<{
    initDataType: string;
    initData: Uint8Array;
  }>;
  pendingContentProtectionData: Array<ContentProtection>;
}
