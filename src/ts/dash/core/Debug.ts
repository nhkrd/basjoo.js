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
 * Debug
 *
 * @module Debug（Debugモジュール）
 */

export const _log = (msg: string): void => {
  console.log(msg);
};

export const _debug = (msg: string): void => {
  console.debug(msg);
};

export const _info = (msg: string): void => {
  console.info(msg);
};

export const _warn = (msg: string): void => {
  console.warn(msg);
};

export const _error = (msg: string): void => {
  console.error(msg);
};

export const _nullfunc = (): void => {};

/**
 * Debug
 * @constructor
 */

class Debug {
  mode: DebugMode = {
    log: true,
    debug: true,
    info: true,
    warn: true,
    error: true,
  };

  log: (msg: string) => void = _log;

  debug: (msg: string) => void = _debug;

  info: (msg: string) => void = _info;

  warn: (msg: string) => void = _warn;

  error: (msg: string) => void = _error;

  constructor() {}

  nullfunc: () => void = _nullfunc;

  setMode(mode: DebugMode): void {
    //            var that = this;
    for (const key in mode) {
      //            Object.keys(mode).forEach(function(key) {
      if (key == 'log') {
        if (mode[key]) {
          this.log = _log;
        } else {
          this.log = _nullfunc;
        }
        this.mode[key] = mode[key];
      } else if (key == 'debug') {
        if (mode[key]) {
          this.debug = _debug;
        } else {
          this.debug = _nullfunc;
        }
        this.mode[key] = mode[key];
      } else if (key == 'info') {
        if (mode[key]) {
          this.info = _info;
        } else {
          this.info = _nullfunc;
        }
        this.mode[key] = mode[key];
      } else if (key == 'warn') {
        if (mode[key]) {
          this.warn = _warn;
        } else {
          this.warn = _nullfunc;
        }
        this.mode[key] = mode[key];
      } else if (key == 'error') {
        if (mode[key]) {
          this.error = _error;
        } else {
          this.error = _nullfunc;
        }
        this.mode[key] = mode[key];
      }
    }
  }

  getMode(): DebugMode {
    return this.mode;
  }
}

export default Debug;
