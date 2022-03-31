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

interface ExMediaKeys extends MediaKeys {
  keysTypeString: string;
  schemeIdUri: string;
}

interface ExMSMediaKeys extends MSMediaKeys {
  keysTypeString: string;
  schemeIdUri: string;
}

interface ExWebKitMediaKeys extends WebKitMediaKeys {
  keysTypeString: string;
  schemeIdUri: string;
}

//type NXMediaKeys = ExMSMediaKeys | ExMediaKeys | ExWebKitMediaKeys;
type NXMediaKeys = ExMediaKeys | ExWebKitMediaKeys;

interface ExMediaKeySession extends MediaKeySession {
  sessionIdIsAvailable?: boolean;
  tmpSessionId?: number;
  laURL?: string;
  error?: {
    code: number;
    systemCode: number;
  };
  keysTypeString?: string;
}

interface ExMSMediaKeySession extends MSMediaKeySession {
  sessionIdIsAvailable?: boolean;
  tmpSessionId?: number;
  laURL?: string;
  keysTypeString?: string;
}

//type NXMediaKeySession = ExMediaKeySession | ExMSMediaKeySession;
type NXMediaKeySession = ExMediaKeySession;
