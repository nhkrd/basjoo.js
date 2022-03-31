// The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
//
// Copyright (c) 2013, Microsoft Open Technologies, Inc.
// Copyright (c) 2022, NHK(Japan Broadcasting Corporation).
//
// All rights reserved.
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
// - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
// - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
// - Neither the names of the copyright holders nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { BASE64 } from '../core/Base64';
import { EventBus } from '../core/EventBus';
import Debug from '../core/Debug';
import LogHandler from '../core/LogHandler';
import { hasProperty } from '../core/Utils';
import VideoModel, { DummyVideoModel } from '../streaming/VideoModel';

/**
 * ProtectionExtensions
 *
 * @module ProtectionExtensions（ProtectionExtensionsモジュール）
 */

// const hexdump = (data: any): string => {
//   const tmp: Uint8Array = new Uint8Array(data);
//   let tmp_a: string = '';
//   tmp_a = tmp_a + data.length + '/';
//   for (let ii = 0; ii < data.length; ii++) {
//     if (tmp[ii] < 16) {
//       tmp_a = tmp_a + '0';
//     }
//     tmp_a = tmp_a + tmp[ii];
//   }
//   return tmp_a;
// };

export const stringToArray = (s: string): Uint8Array => {
  const array: Uint8Array = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    array[i] = s.charCodeAt(i);
  }
  return array;
};

const arrayToString = (a: Uint16Array | Uint8Array): string => {
  // 以下修正案
  // for (let i = 0; i < a.byteLength; i++) {
  //   returnString += String.fromCharCode(a[i]);
  // }
  // @ts-ignore
  return String.fromCharCode(...a);
};

const extractClearKeyFromMessage = (initData: Uint8Array): Uint8Array => {
  const abuf: ArrayBuffer = initData.buffer;
  const dv: DataView = new DataView(abuf);
  let pos: number = 0;

  while (pos < abuf.byteLength) {
    const box_size: number = dv.getUint32(pos, false);
    const type: number = dv.getUint32(pos + 4, false);

    if (type != 0x70737368)
      throw 'Box type ' + type.toString(16) + ' not equal to "pssh"';

    if (
      dv.getUint32(pos + 12, false) == 0x9a04f079 &&
      dv.getUint32(pos + 16, false) == 0x98404286 &&
      dv.getUint32(pos + 20, false) == 0xab92e65b &&
      dv.getUint32(pos + 24, false) == 0xe0885f95
    ) {
      return initData;
    }

    if (
      dv.getUint32(pos + 12, false) == 0x00000000 &&
      dv.getUint32(pos + 16, false) == 0x00000000 &&
      dv.getUint32(pos + 20, false) == 0x00000000 &&
      dv.getUint32(pos + 24, false) == 0x00000001
    ) {
      const size = dv.getUint32(pos + 28, false);
      return new Uint8Array(abuf.slice(pos + 32 + 3, pos + 32 + size));
    }

    if (
      dv.getUint32(pos + 12, false) == 0xedef8ba9 &&
      dv.getUint32(pos + 16, false) == 0x79d64ace &&
      dv.getUint32(pos + 20, false) == 0xa3c827dc &&
      dv.getUint32(pos + 24, false) == 0xd51d21ed
    ) {
      return new Uint8Array(abuf.slice(pos + 36, pos + 52));
    }
    pos += box_size;
  }

  return initData;
};

//NSV-a function abortWrapper(f, c) {
//NSV-a   return new Promise((resolve, reject) => {
//NSV-a     setTimeout(() => {
//NSV-a       c.aborted = true;
//NSV-a       reject(new Error('abort'));
//NSV-a     }, 1000);
//NSV-a     f.then(resolve, reject);
//NSV-a   });
//NSV-a }

/**
 * ProtectionExtensions
 * @constructor
 */
export class ProtectionExtensions {
  eventBus: EventBus;
  NXDebug: Debug;
  useFetch: boolean;
  logHandler = LogHandler;
  initDataQueue: Array<Uint8Array>;
  element: Nullable<NXHTMLVideoElement>;
  EME01b_prefix: Nullable<string>;
  // authtoken: any;

  constructor(params: Paramstype, _eventBus: EventBus) {
    this.eventBus = _eventBus;
    this.NXDebug = new Debug();
    this.useFetch = params.USE_FETCH && 'fetch' in window ? true : false;
    this.useFetch = false;
    this.initDataQueue = [];
    this.element = null;
    this.EME01b_prefix = null;
  }

  init = (
    elmnt: Nullable<NXHTMLVideoElement>,
    prefix: Nullable<string>
  ): void => {
    this.element = elmnt;
    this.EME01b_prefix = prefix;
  };

  supportsCodec = (mediaKeysString: string, codec: string): boolean => {
    const hasWebKit: boolean = 'WebKitMediaKeys' in window;
    const hasMs: boolean = 'MSMediaKeys' in window;
    const hasMediaSource: boolean = 'MediaKeys' in window;

    if (hasMediaSource) {
      // @ts-ignore
      return MediaKeys.isTypeSupported(mediaKeysString, codec);
    } else if (hasWebKit) {
      // @ts-ignore
      return WebKitMediaKeys.isTypeSupported(mediaKeysString, codec);
    } else if (hasMs) {
      // @ts-ignore
      return MSMediaKeys.isTypeSupported(mediaKeysString, codec);
    }

    return false;
  };

  createMediaKeys = (mediaKeysString: string): Nullable<NXMediaKeys> => {
    const hasWebKit: boolean = 'WebKitMediaKeys' in window;
    const hasMs: boolean = 'MSMediaKeys' in window;
    const hasMediaSource: boolean = 'MediaKeys' in window;

    if (hasMediaSource) {
      this.logHandler.log_DRM('new MediaKeys( ' + mediaKeysString + ' )', 99);
      // @ts-ignore
      return new MediaKeys(mediaKeysString);
    } else if (hasWebKit) {
      this.logHandler.log_DRM(
        'new WebKitMediaKeys( ' + mediaKeysString + ' )',
        99
      );
      // @ts-ignore
      return new WebKitMediaKeys(mediaKeysString);
    } else if (hasMs) {
      this.logHandler.log_DRM('new MSMediaKeys( ' + mediaKeysString + ' )', 99);
      // @ts-ignore
      return new MSMediaKeys!(mediaKeysString);
    }

    return null;
  };

  setMediaKey = (
    element: NXHTMLVideoElement,
    mediaKeys: NXMediaKeys
  ): Promise<void> | void => {
    const hasWebKit: boolean = 'WebKitSetMediaKeys' in element;
    const hasMs: boolean = 'msSetMediaKeys' in element;
    const hasStd: boolean = 'setMediaKeys' in element;

    if (hasStd) {
      return element!.setMediaKeys!(mediaKeys as ExMediaKeys);
    } else if (hasWebKit) {
      return (element as ExWebkitHTMLVideoElement)!.WebKitSetMediaKeys!(
        mediaKeys!
      );
    } else if (hasMs) {
      // @ts-ignore
      return (element as ExMSHTMLVideoElement)!.msSetMediaKeys!(mediaKeys!);
    } else {
      this.NXDebug.log('no setmediakeys function in element');
    }
  };

  createSession = (
    mediaKeys: NXMediaKeys, //mediaKeys: MSMediaKeys,
    mediaCodec: string,
    initData: Uint8Array
  ): NXMediaKeySession => {
    let sess: NXMediaKeySession; //let sess: ExMSMediaKeySession;
    try {
      LogHandler.log_DRM(
        'createSession()<br>&nbsp;&nbsp;codec ==> ' + mediaCodec,
        1
      );
      // @ts-ignore
      sess = mediaKeys.createSession(mediaCodec, initData);
    } catch (e: any) {
      this.logHandler.log_DRM('Error: createSession ' + String(e));
    }
    return sess!;
  };

  /* istanbul ignore next */
  getKeySystems = (): Array<KeySystem> => {
    const playreadyGetUpdate = (
      bytes: Nullable<Uint16Array>,
      laURL: string,
      xhrCustom: XHRCustom,
      callback: (d: ResponseData) => void
    ) => {
      let decodedChallenge: Nullable<string> = null;
      const headers: Array<CommonHeader> = [];
      const parser: DOMParser = new DOMParser();
      // @ts-ignore
      const msg: string = String.fromCharCode.apply(null, bytes!);
      const xmlDoc: Document = parser.parseFromString(msg, 'application/xml');
      //this.logHandler.log('getKeySystems: msg: ' + msg);

      const qrys: Array<CommonQuery> = hasProperty(xhrCustom, 'query')
        ? xhrCustom['query']!.concat()
        : [];

      const hdrs: Array<CommonHeader> = hasProperty(xhrCustom, 'header')
        ? xhrCustom['header']!.concat()
        : [];

      const onPrepare = hasProperty(xhrCustom, 'onPrepare')
        ? xhrCustom['onPrepare']
        : () => {};

      const onSuccess = hasProperty(xhrCustom, 'onSuccess')
        ? xhrCustom['onSuccess']
        : () => {};

      const onError = hasProperty(xhrCustom, 'onError')
        ? xhrCustom['onError']
        : () => {};

      if (xmlDoc.getElementsByTagName('PlayReadyKeyMessage')[0]) {
        if (xmlDoc.getElementsByTagName('Challenge')[0]) {
          const Challenge: Nullable<string> =
            xmlDoc.getElementsByTagName('Challenge')[0].childNodes[0].nodeValue;
          if (Challenge) {
            decodedChallenge = BASE64.decode(Challenge);
          }
        } else {
          callback({
            status: 'error',
            msg: 'DRM: playready update, can not find Challenge in keyMessage',
          });
          return;
        }
      } else {
        decodedChallenge = msg;
      }

      const headerNameList: HTMLCollectionOf<Element> =
        xmlDoc.getElementsByTagName('name');
      const headerValueList: HTMLCollectionOf<Element> =
        xmlDoc.getElementsByTagName('value');

      if (headerNameList.length != headerValueList.length) {
        callback({
          status: 'error',
          msg: 'DRM: playready update, invalid header name/value pair in keyMessage',
        });
        return;
      }

      for (let i = 0; i < headerNameList.length; i++) {
        headers[i] = {
          name: headerNameList[i].childNodes[0].nodeValue!,
          value: headerValueList[i].childNodes[0].nodeValue!,
        };
      }

      if (!this.useFetch) {
        const xhr: ExXMLHttpRequest = new XMLHttpRequest();
        xhr.keysTypeString = 'com.microsoft.playready';

        xhr.url = laURL;

        onPrepare!({
          req: xhr,
          qrys,
          hdrs,
          xhr,
        });

        if (qrys.length > 0) {
          qrys.forEach((qry) => {
            xhr.url += xhr.url!.indexOf('?') > 0 ? '&' : '?';
            xhr.url += qry.name + '=' + qry.value;
          });
        }
        laURL = xhr.url;

        if (hdrs.length > 0) {
          hdrs.forEach((hdr) => {
            headers.push({
              name: hdr.name,
              value: hdr.value,
            });
          });
        }

        xhr.onload = () => {
          LogHandler.log_DRM('License( xhr.status == ' + xhr.status + ' )', 3);
          if (xhr.status == 200) {
            onSuccess!({
              status: xhr.status,
              req: xhr,
              xhr,
            });
            callback({
              status: 'ok',
              data: new Uint8Array(xhr.response),
            });
          } else {
            onError!({
              status: xhr.status!,
              req: xhr,
              xhr,
            });
            callback({
              status: 'error',
              msg:
                'DRM: playready update, XHR status is "' +
                xhr.statusText +
                '" (' +
                xhr.status +
                '), expected to be 200. readyState is ' +
                xhr.readyState,
            });
          }
        };
        xhr.onabort = () => {
          onError!({
            status: xhr.status!,
            req: xhr,
            xhr,
          });
          callback({
            status: 'error',
            msg:
              'DRM: playready update, XHR aborted. status is "' +
              xhr.statusText +
              '" (' +
              xhr.status +
              '), readyState is ' +
              xhr.readyState,
          });
        };
        xhr.onerror = () => {
          onError!({
            status: xhr.status!,
            req: xhr,
            xhr,
          });
          callback({
            status: 'error',
            msg:
              'DRM: playready update, XHR error. status is "' +
              xhr.statusText +
              '" (' +
              xhr.status +
              '), readyState is ' +
              xhr.readyState,
          });
        };

        xhr.open!('POST', xhr.url);
        xhr.responseType = 'arraybuffer';
        headers.push({
          name: 'Content-Type',
          value: 'text/xml; charset=utf-8',
        });
        if (headers) {
          headers.forEach((hdr) => {
            xhr.setRequestHeader!(hdr.name, hdr.value);
          });
        }

        xhr.send!(decodedChallenge);
      } else {
        const request: ExXMLHttpRequest = {};

        const acon: ExXMLHttpRequest = {
          aborted: false,
        };

        const init: RequestInit = {
          method: 'POST',
          headers: {},
          credentials: 'same-origin',
        };

        request.url = laURL;

        onPrepare!({
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
        laURL = request.url;

        if (hdrs.length > 0) {
          hdrs.forEach((hdr) => {
            headers.push({
              name: hdr.name,
              value: hdr.value,
            });
          });
        }
        headers.push({
          name: 'Content-Type',
          value: 'text/xml; charset=utf-8',
        });
        if (headers) {
          headers.forEach((hdr) => {
            init.headers![hdr.name] = hdr.value;
          });
        }
        init.body = decodedChallenge;

        fetch(request.url, init)
          .then((res) => {
            LogHandler.log_DRM(
              'License( res.status == ' + res.status + ' )',
              3
            );
            request.status = res.status;

            if (res.ok == true) {
              return res.arrayBuffer();
            } else {
              return Promise.reject(new Error('res.false'));
            }
          })
          .then((ab) => {
            onSuccess!({
              status: request.status!,
              req: request,
              xhr: request,
            });
            callback({
              status: 'ok',
              data: new Uint8Array(ab),
            });
          })
          .catch((_err: any) => {
            if (acon.abort) {
              request.status = -1;
            }

            onError!({
              status: request.status!,
              req: request,
              xhr: request,
            });

            if (request.status! > 0) {
              callback({
                status: 'error',
                msg:
                  'DRM: playready update, XHR status code is' + request.status,
              });
            } else if (request.status == -1) {
              callback({
                status: 'error',
                msg: 'DRM: License Request is aborted.',
              });
            } else {
              callback({
                status: 'error',
                msg: 'DRM: playready update, XHR error.',
              });
            }
          });
      }

      LogHandler.log_DRM('Get License()<br>&nbsp;&nbsp;laURL ==> ' + laURL, 2);
    };

    const widevineGetUpdate = (
      bytes: Nullable<Uint16Array>,
      laURL: string,
      xhrCustom: XHRCustom,
      _callback: (d: ResponseData) => void
    ) => {
      var callback = _callback || function () {},
        self = this,
        headers: Array<CommonHeader> = [],
        //utils = new DashTVPlayer.Utils(),
        qrys = hasProperty(xhrCustom, 'query')
          ? xhrCustom['query']!.concat()
          : [],
        hdrs = hasProperty(xhrCustom, 'header')
          ? xhrCustom['header']!.concat()
          : [],
        onPrepare = hasProperty(xhrCustom, 'onPrepare')
          ? xhrCustom['onPrepare']
          : function () {},
        onSuccess = hasProperty(xhrCustom, 'onSuccess')
          ? xhrCustom['onSuccess']
          : function () {},
        onError = hasProperty(xhrCustom, 'onError')
          ? xhrCustom['onError']
          : function () {};

      var xhr = new XMLHttpRequest() as ExXMLHttpRequest;
      xhr.keysTypeString = 'com.widevine.alpha';

      xhr.url = laURL;

      onPrepare!({
        req: xhr,
        qrys: qrys,
        hdrs: hdrs,
        xhr: xhr,
      });

      if (qrys.length > 0) {
        qrys.forEach(function (qry) {
          xhr.url += xhr.url!.indexOf('?') > 0 ? '&' : '?';
          xhr.url += qry.name + '=' + qry.value;
        });
      }
      laURL = xhr.url;

      if (hdrs.length > 0) {
        hdrs.forEach(function (hdr: CommonHeader) {
          headers.push({
            name: hdr.name,
            value: hdr.value,
          });
        });
      }

      xhr.onload = function () {
        self.logHandler.log_DRM(
          'License( xhr.status == ' + xhr.status + ' )',
          3
        );
        if (xhr.status == 200) {
          onSuccess!({
            status: xhr.status!,
            req: xhr,
            xhr: xhr,
          });
          callback({
            status: 'ok',
            data: new Uint8Array(xhr.response),
          });
        } else {
          onError!({
            status: xhr.status!,
            req: xhr,
            xhr: xhr,
          });
          callback({
            status: 'error',
            msg:
              'DRM: widevine update, XHR status is "' +
              xhr.statusText +
              '" (' +
              xhr.status +
              '), expected to be 200. readyState is ' +
              xhr.readyState,
          });
        }
      };
      xhr.onabort = function () {
        onError!({
          status: xhr.status!,
          req: xhr,
          xhr: xhr,
        });
        callback({
          status: 'error',
          msg:
            'DRM: widevine update, XHR aborted. status is "' +
            xhr.statusText +
            '" (' +
            xhr.status +
            '), readyState is ' +
            xhr.readyState,
        });
      };
      xhr.onerror = function () {
        onError!({
          status: xhr.status!,
          req: xhr,
          xhr: xhr,
        });
        callback({
          status: 'error',
          msg:
            'DRM: widevine update, XHR error. status is "' +
            xhr.statusText +
            '" (' +
            xhr.status +
            '), readyState is ' +
            xhr.readyState,
        });
      };

      xhr.open!('POST', xhr.url!);
      xhr.responseType = 'arraybuffer';
      if (headers) {
        headers.forEach(function (hdr: CommonHeader) {
          xhr.setRequestHeader!(hdr.name, hdr.value);
        });
      }

      xhr.send!(bytes);

      this.logHandler.log_DRM(
        'Get License()<br>&nbsp;&nbsp;laURL ==> ' + laURL,
        2
      );
    };

    const playreadyGetKeyEME01b = (
      msg: string,
      laURL: string,
      xhrCustom: XHRCustom,
      callback: (val: ResponseData) => void
    ): void => {
      const headers: Array<CommonHeader> = [];

      const qrys: Array<CommonQuery> = hasProperty(xhrCustom, 'query')
        ? xhrCustom['query']!.concat()
        : [];

      const hdrs: Array<CommonHeader> = hasProperty(xhrCustom, 'header')
        ? xhrCustom['header']!.concat()
        : [];

      const onPrepare = hasProperty(xhrCustom, 'onPrepare')
        ? xhrCustom['onPrepare']
        : () => {};

      const onSuccess = hasProperty(xhrCustom, 'onSuccess')
        ? xhrCustom['onSuccess']
        : () => {};

      const onError = hasProperty(xhrCustom, 'onError')
        ? xhrCustom['onError']
        : () => {};

      if (!this.useFetch) {
        const xhr: ExXMLHttpRequest = new XMLHttpRequest();
        xhr.keysTypeString = 'com.microsoft.playready';

        xhr.onload = () => {
          LogHandler.log_DRM('Key( xhr.status == ' + xhr.status + ' )', 3);
          if (xhr.status == 200) {
            onSuccess!({
              status: xhr.status,
              req: xhr,
              xhr,
            });
            callback({
              status: 'ok',
              data: new Uint8Array(xhr.response),
            });
          } else {
            onError!({
              status: xhr.status!,
              req: xhr,
              xhr,
            });
            callback({
              status: 'error',
              msg:
                'DRM: playready update, XHR status is "' +
                xhr.statusText +
                '" (' +
                xhr.status +
                '), expected to be 200. readyState is ' +
                xhr.readyState,
            });
          }
        };
        xhr.onabort = () => {
          LogHandler.log_DRM(
            'playreadyGetKeyEME01b: xhr.onabort' + xhr.status,
            -1
          );
          onError!({
            status: xhr.status!,
            req: xhr,
            xhr,
          });
          callback({
            status: 'error',
            msg:
              'DRM: playready update, XHR aborted. status is "' +
              xhr.statusText +
              '" (' +
              xhr.status +
              '), readyState is ' +
              xhr.readyState,
          });
        };
        xhr.onerror = () => {
          LogHandler.log_DRM(
            'playreadyGetKeyEME01b: xhr.onerror == ' + xhr.status,
            -1
          );
          onError!({
            status: xhr.status!,
            req: xhr,
            xhr,
          });
          callback({
            status: 'error',
            msg:
              'DRM: playready update, XHR error. status is "' +
              xhr.statusText +
              '" (' +
              xhr.status +
              '), readyState is ' +
              xhr.readyState,
          });
        };

        xhr.url = laURL;
        onPrepare!({
          req: xhr,
          qrys,
          hdrs,
          xhr,
        });

        if (qrys.length > 0) {
          qrys.forEach((qry) => {
            xhr.url += xhr.url!.indexOf('?') > 0 ? '&' : '?';
            xhr.url += qry.name + '=' + qry.value;
          });
        }
        laURL = xhr.url;
        headers.push({
          name: 'Content-Type',
          value: 'text/xml; charset=utf-8',
        });
        if (hdrs.length > 0) {
          hdrs.forEach((hdr) => {
            headers.push({
              name: hdr.name,
              value: hdr.value,
            });
          });
        }
        xhr.open!('POST', xhr.url);
        xhr.responseType = 'arraybuffer';

        if (headers) {
          headers.forEach((hdr) => {
            xhr.setRequestHeader!(hdr.name, hdr.value);
          });
        }
        xhr.send!(msg);
      } else {
        const request: ExXMLHttpRequest = {};

        const acon: ExXMLHttpRequest = {
          aborted: false,
        };

        const init: RequestInit = {
          method: 'POST',
          headers: {},
          credentials: 'same-origin',
        };

        request.url = laURL;
        onPrepare!({
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
        laURL = request.url;

        headers.push({
          name: 'Content-Type',
          value: 'text/xml; charset=utf-8',
        });
        if (hdrs.length > 0) {
          hdrs.forEach((hdr) => {
            headers.push({
              name: hdr.name,
              value: hdr.value,
            });
          });
        }

        if (headers) {
          headers.forEach((hdr) => {
            init.headers![hdr.name] = hdr.value;
          });
        }
        init.body = msg;

        fetch(request.url, init)
          .then((res) => {
            LogHandler.log_DRM(
              'License( res.status == ' + res.status + ' )',
              3
            );
            request.status = res.status;
            if (res.ok == true) {
              return res.arrayBuffer();
            } else {
              return Promise.reject(new Error('res.false'));
            }
          })
          .then((ab) => {
            onSuccess!({
              status: request.status!,
              req: request,
              xhr: request,
            });
            callback({
              status: 'ok',
              data: new Uint8Array(ab),
            });
          })
          .then((_err) => {
            if (acon.abort) {
              request.status = -1;
            }

            onError!({
              status: request.status!,
              req: request,
              xhr: request,
            });

            if (request.status! > 0) {
              callback({
                status: 'error',
                msg:
                  'DRM: playready update, XHR status code is' + request.status,
              });
            } else if (request.status == -1) {
              callback({
                status: 'error',
                msg: 'DRM: License Request is aborted.',
              });
            } else {
              callback({
                status: 'error',
                msg: 'DRM: playready update, XHR error.',
              });
            }
          });
      }

      LogHandler.log_DRM('GetKey<br>&nbsp;&nbsp;laURL ==> ' + laURL, 2);
    };

    const widevineGetKeyEME01b = (
      msg: string,
      laURL: string,
      xhrCustom: XHRCustom,
      callback: (val: ResponseData) => void
    ): void => {
      const self = this;
      //var callback = _callback || function () {},
      var headers: Array<CommonHeader> = [],
        //utils = new DashTVPlayer.Utils(),
        qrys = hasProperty(xhrCustom, 'query')
          ? xhrCustom['query']!.concat()
          : [],
        hdrs = hasProperty(xhrCustom, 'header')
          ? xhrCustom['header']!.concat()
          : [],
        onPrepare = hasProperty(xhrCustom, 'onPrepare')
          ? xhrCustom['onPrepare']
          : function () {},
        onSuccess = hasProperty(xhrCustom, 'onSuccess')
          ? xhrCustom['onSuccess']
          : function () {},
        onError = hasProperty(xhrCustom, 'onError')
          ? xhrCustom['onError']
          : function () {};

      var xhr = new XMLHttpRequest() as ExXMLHttpRequest;
      xhr.keysTypeString = 'com.widevine.alpha';
      xhr.onload = function () {
        self.logHandler.log_DRM('Key( xhr.status == ' + xhr.status + ' )', 3);
        if (xhr.status == 200) {
          onSuccess!({
            status: xhr.status,
            req: xhr,
            xhr: xhr,
          });
          callback({
            status: 'ok',
            data: new Uint8Array(xhr.response),
          });
        } else {
          onError!({
            status: xhr.status!,
            req: xhr,
            xhr: xhr,
          });
          callback({
            status: 'error',
            msg:
              'DRM: widevine update, XHR status is "' +
              xhr.statusText +
              '" (' +
              xhr.status +
              '), expected to be 200. readyState is ' +
              xhr.readyState,
          });
        }
      };
      xhr.onabort = function () {
        self.logHandler.log_DRM(
          'widevineGetKeyEME01b: xhr.onabort' + xhr.status,
          -1
        );
        onError!({
          status: xhr.status!,
          req: xhr,
          xhr: xhr,
        });
        callback({
          status: 'error',
          msg:
            'DRM: widevine update, XHR aborted. status is "' +
            xhr.statusText +
            '" (' +
            xhr.status +
            '), readyState is ' +
            xhr.readyState,
        });
      };
      xhr.onerror = function () {
        self.logHandler.log_DRM(
          'widevineGetKeyEME01b: xhr.onerror == ' + xhr.status,
          -1
        );
        onError!({
          status: xhr.status!,
          req: xhr,
          xhr: xhr,
        });
        callback({
          status: 'error',
          msg:
            'DRM: widevine update, XHR error. status is "' +
            xhr.statusText +
            '" (' +
            xhr.status +
            '), readyState is ' +
            xhr.readyState,
        });
      };
      xhr.url = laURL;
      onPrepare!({
        req: xhr,
        qrys: qrys,
        hdrs: hdrs,
        xhr: xhr,
      });

      if (qrys.length > 0) {
        qrys.forEach(function (qry) {
          xhr.url += xhr.url!.indexOf('?') > 0 ? '&' : '?';
          xhr.url += qry.name + '=' + qry.value;
        });
      }
      laURL = xhr.url;

      if (hdrs.length > 0) {
        hdrs.forEach(function (hdr: CommonHeader) {
          headers.push({
            name: hdr.name,
            value: hdr.value,
          });
        });
      }
      xhr.open!('POST', xhr.url);
      xhr.responseType = 'arraybuffer';

      if (headers) {
        headers.forEach(function (hdr: CommonHeader) {
          xhr.setRequestHeader!(hdr.name, hdr.value);
        });
      }
      xhr.send!(msg);

      this.logHandler.log_DRM('GetKey<br>&nbsp;&nbsp;laURL ==> ' + laURL, 2);
    };

    const playReadyNeedToAddKeySession = (
      _initData?: any,
      _keySessions?: Array<any>
    ): boolean =>
      //return initData === null && keySessions.length === 0;
      true;

    const playreadyGetInitData = (
      data: ContentProtection
    ): Nullable<Uint8Array> => {
      // * desc@ getInitData
      // *   generate PSSH data from PROHeader defined in MPD file
      // *   PSSH format:
      // *   size (4)
      // *   box type(PSSH) (8)
      // *   Protection SystemID (16)
      // *   protection system data size (4) - length of decoded PROHeader
      // *   decoded PROHeader data from MPD file
      let byteCursor: number = 0;

      let PROSize: number = 0;
      let PSSHSize: number = 0;

      //'PSSH' 8 bytes
      const PSSHBoxType: Uint8Array = new Uint8Array([
        0x70, 0x73, 0x73, 0x68, 0x00, 0x00, 0x00, 0x00,
      ]);

      const playreadySystemID: Uint8Array = new Uint8Array([
        0x9a, 0x04, 0xf0, 0x79, 0x98, 0x40, 0x42, 0x86, 0xab, 0x92, 0xe6, 0x5b,
        0xe0, 0x88, 0x5f, 0x95,
      ]);

      let uint8arraydecodedPROHeader: Nullable<Uint8Array> = null;
      let PSSHBoxBuffer: Nullable<ArrayBuffer> = null;
      let PSSHBox: Nullable<Uint8Array> = null;
      let PSSHData: Nullable<DataView> = null;

      if ('pro' in data) {
        uint8arraydecodedPROHeader = BASE64.decodeArray(
          (data.pro! as { __text: string }).__text
        );
      } else if ('prheader' in data) {
        uint8arraydecodedPROHeader = BASE64.decodeArray(data.prheader!.__text);
      } else {
        return null;
      }

      PROSize = uint8arraydecodedPROHeader!.length;
      PSSHSize =
        0x4 + PSSHBoxType.length + playreadySystemID.length + 0x4 + PROSize;

      PSSHBoxBuffer = new ArrayBuffer(PSSHSize);

      PSSHBox = new Uint8Array(PSSHBoxBuffer);
      PSSHData = new DataView(PSSHBoxBuffer);

      PSSHData.setUint32(byteCursor, PSSHSize);
      byteCursor += 0x4;

      PSSHBox.set(PSSHBoxType, byteCursor);
      byteCursor += PSSHBoxType.length;

      PSSHBox.set(playreadySystemID, byteCursor);
      byteCursor += playreadySystemID.length;

      PSSHData.setUint32(byteCursor, PROSize);
      byteCursor += 0x4;

      PSSHBox.set(uint8arraydecodedPROHeader!, byteCursor);
      byteCursor += PROSize;

      return PSSHBox;
    };

    //
    // order by priority. if an mpd contains more than one the first match will win.
    // Entries with the same schemeIdUri can appear multiple times with different keysTypeStrings.
    //

    return [
      {
        schemeIdUri: 'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95',
        keysTypeString: 'com.microsoft.playready',
        isSupported: function (data) {
          return this.schemeIdUri === data.schemeIdUri!.toLowerCase();
        },
        needToAddKeySession: playReadyNeedToAddKeySession,
        getInitData: playreadyGetInitData,
        getUpdate: playreadyGetUpdate,
        getKeyEME01b: playreadyGetKeyEME01b, //EME01b
      },
      {
        schemeIdUri: 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
        keysTypeString: 'com.widevine.alpha',
        isSupported: function (data) {
          return this.schemeIdUri === data.schemeIdUri!.toLowerCase();
        },
        needToAddKeySession: playReadyNeedToAddKeySession,
        getInitData: playreadyGetInitData,
        getUpdate: widevineGetUpdate, //getUpdate: playreadyGetUpdate,
        getKeyEME01b: widevineGetKeyEME01b, //EME01b
      },
      {
        schemeIdUri: 'urn:mpeg:dash:mp4protection:2011',
        keysTypeString: 'com.microsoft.playready',
        isSupported: function (data) {
          return (
            this.schemeIdUri === data.schemeIdUri!.toLowerCase() &&
            data.value!.toLowerCase() === 'cenc'
          );
        },
        needToAddKeySession: playReadyNeedToAddKeySession,
        getInitData: function () /*data*/ {
          // the cenc element in mpd does not contain initdata
          return null;
        },
        getUpdate: playreadyGetUpdate,
        getKeyEME01b: playreadyGetKeyEME01b, //EME01b
      },
      {
        schemeIdUri: 'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b',
        keysTypeString: 'webkit-org.w3.clearkey',
        isSupported: function (data) {
          return this.schemeIdUri === data.schemeIdUri!.toLowerCase();
        },
        needToAddKeySession: function () /*initData, keySessions*/ {
          return true;
        },
        getInitData: function () /*data*/ {
          return null;
        },
        getUpdate: function (bytes: Nullable<Uint16Array> /*, laURL*/) {
          return bytes;
        },
        getKeyEME01b: function () /*data*/ {
          //EME01b
          return null;
        },
      },
    ];
  };

  generateKeyRequest = (
    element: Nullable<NXHTMLVideoElement>,
    data: Nullable<Uint8Array>,
    keysystem: Nullable<KID>
  ): void => {
    if (keysystem != null) {
      LogHandler.log(
        'generateKeyRequest (' + keysystem.keySystem.keysTypeString + ')',
        1
      );
    }

    let keysTypeString: string;
    if (keysystem == null) {
      keysTypeString = 'webkit-org.w3.clearkey';
    } else {
      keysTypeString = keysystem.keySystem.keysTypeString;
    }

    const self = this;
    const s_data: Nullable<Uint8Array> = data;

    if (!data || !element) {
      LogHandler.log('generateKeyRequest Called 1 data false', '#c0c0ff');
    }

    try {
      if (
        typeof (element! as ExWebkitHTMLVideoElement)
          .webkitGenerateKeyRequest == 'function' &&
        keysTypeString != null &&
        data != null
      ) {
        LogHandler.log_DRM('webkitGenerateKeyRequest()', 1);
        (element! as ExWebkitHTMLVideoElement).webkitGenerateKeyRequest!(
          keysTypeString,
          s_data
        );
        self.initDataQueue.push(s_data!);
      } else if (
        typeof (element! as ExHTMLVideoElement).generateKeyRequest == 'function'
      ) {
        if (keysTypeString !== 'webkit-org.w3.clearkey') {
          (element! as ExHTMLVideoElement).generateKeyRequest!(
            keysTypeString,
            s_data
          );
        } else {
          (element! as ExHTMLVideoElement).generateKeyRequest!(
            'org.w3.clearkey',
            s_data
          );
        }
        self.initDataQueue.push(s_data!);

        LogHandler.log_DRM('generateKeyRequest()', 1);
      } else if (
        typeof (element! as ExMSHTMLVideoElement).msGenerateKeyRequest ==
        'function'
      ) {
        if (keysTypeString !== 'webkit-org.w3.clearkey') {
          (element! as ExMSHTMLVideoElement).msGenerateKeyRequest!(
            keysTypeString,
            s_data
          );
        } else {
          (element! as ExMSHTMLVideoElement).msGenerateKeyRequest!(
            'org.w3.clearkey',
            s_data
          );
        }

        self.initDataQueue.push(data!);
        LogHandler.log_DRM('msGenerateKeyRequest()', 1);
      }
      LogHandler.log_DRM('KeyInfo ==> ' + keysTypeString, 99);
    } catch (e: any) {
      LogHandler.log_DRM('generateKeyRequest Error ' + e, -1);
    }
  };

  addKey = (
    p_license: Uint8Array,
    p_initData: Uint8Array,
    p_session: string,
    keysTypeString: string
  ): void => {
    if (
      typeof (this.element! as ExWebkitHTMLVideoElement).webkitAddKey ==
      'function'
    ) {
      (this.element! as ExWebkitHTMLVideoElement).webkitAddKey!(
        keysTypeString,
        p_license,
        p_initData,
        p_session
      );
      LogHandler.log_DRM('webkitAddKey sessionID:' + p_session, 1);
    } else if (
      typeof (this.element! as ExMSHTMLVideoElement).msaddKey == 'function'
    ) {
      (this.element! as ExMSHTMLVideoElement).msaddKey!(
        keysTypeString,
        p_license,
        p_initData,
        p_session
      );
      LogHandler.log_DRM('msaddKey sessionID:' + p_session, 1);
    } else if (
      typeof (this.element! as ExHTMLVideoElement).addKey == 'function'
    ) {
      (this.element! as ExHTMLVideoElement).addKey!(
        'com.youtube.playready',
        p_license,
        p_initData,
        p_session
      ); //Temporary
      LogHandler.log_DRM(
        'addKey sessionID:' + p_session + ' keystr: ' + keysTypeString,
        1
      );
    }
  };
  extractClearKeyKIDFromPSSHBox = (msg: Uint8Array): string => {
    const idata: Uint8Array = extractClearKeyFromMessage(msg);
    const jwk = JSON.parse(BASE64.decode(arrayToString(idata)));
    let kidString: string = jwk['keys'][0]['kid'];

    const padlen: number = 4 - (kidString.length % 4);
    for (let i = 0; i < padlen; i++) {
      kidString += '=';
    }
    const kidArray: Uint8Array = BASE64.decodeArray(kidString);
    const kid: string =
      ('0' + kidArray[0].toString(16)).slice(-2) +
      ('0' + kidArray[1].toString(16)).slice(-2) +
      ('0' + kidArray[2].toString(16)).slice(-2) +
      ('0' + kidArray[3].toString(16)).slice(-2) +
      '-' +
      ('0' + kidArray[4].toString(16)).slice(-2) +
      ('0' + kidArray[5].toString(16)).slice(-2) +
      '-' +
      ('0' + kidArray[6].toString(16)).slice(-2) +
      ('0' + kidArray[7].toString(16)).slice(-2) +
      '-' +
      ('0' + kidArray[8].toString(16)).slice(-2) +
      ('0' + kidArray[9].toString(16)).slice(-2) +
      '-' +
      ('0' + kidArray[10].toString(16)).slice(-2) +
      ('0' + kidArray[11].toString(16)).slice(-2) +
      ('0' + kidArray[12].toString(16)).slice(-2) +
      ('0' + kidArray[13].toString(16)).slice(-2) +
      ('0' + kidArray[14].toString(16)).slice(-2) +
      ('0' + kidArray[15].toString(16)).slice(-2);
    return kid;
  };
  extractClearKeyFromMessageForRMKSA(msg: Uint8Array) {
    const self = this;
    try {
      const idata: Uint8Array = extractClearKeyFromMessage(msg);
      const jwk = JSON.parse(BASE64.decode(arrayToString(idata)));

      return jwk;
    } catch (e: any) {
      self.NXDebug.debug(e);
      return;
    }
  }
  addKeyForClearKey(_kid: any, session: string, msg: Uint8Array): void {
    const self = this;
    let idata: Uint8Array;
    let kidString: string;
    let keyString: string;
    try {
      idata = extractClearKeyFromMessage(msg);
      const jwk = JSON.parse(BASE64.decode(arrayToString(idata)));
      kidString = jwk['keys'][0]['kid'];
      keyString = jwk['keys'][0]['k'];

      let padlen = 4 - (kidString.length % 4);
      for (let i = 0; i < padlen; i++) {
        kidString += '=';
      }
      var kid: Uint8Array = BASE64.decodeArray(kidString);
      padlen = 4 - (keyString.length % 4);
      for (let i = 0; i < padlen; i++) {
        keyString += '=';
      }
      var key: Uint8Array = BASE64.decodeArray(keyString);
    } catch (e: any) {
      self.NXDebug.debug(e);
      return;
    }

    this.logHandler.log(BASE64.decode(arrayToString(idata)));
    this.logHandler.log('kid:' + kidString + ', key:' + keyString);

    if (
      typeof (self.element! as ExWebkitHTMLVideoElement).webkitAddKey ==
      'function'
    ) {
      LogHandler.log('>> CK webkitAddKey sessionID:' + session, '#40ff40');
      (self.element! as ExWebkitHTMLVideoElement).webkitAddKey!(
        'webkit-org.w3.clearkey',
        key,
        kid,
        session
      );
    } else if (
      typeof (self.element! as ExMSHTMLVideoElement).msaddKey == 'function'
    ) {
      LogHandler.log('>> CK msaddKey sessionID:' + session, '#40ff40');
      (self.element! as ExMSHTMLVideoElement).msaddKey!(
        'org.w3.clearkey',
        key,
        kid,
        session
      );
    } else if (
      typeof (self.element! as ExHTMLVideoElement).addKey == 'function'
    ) {
      (self.element! as ExHTMLVideoElement).addKey!(
        'org.w3.clearkey',
        key,
        kid,
        session
      ); //Temporary
      LogHandler.log('>> CK addKey sessionID:' + session, '#40ff40');
    }
  }

  // setAuthtoken(value: any): void {
  //   this.authtoken = value;
  // }

  extractPROFromPSSHBox(initData: Uint8Array): Nullable<Document> {
    const abuf: ArrayBuffer = initData.buffer;
    const dv: DataView = new DataView(abuf);
    let pos: number = 0;
    while (pos < abuf.byteLength) {
      const box_size: number = dv.getUint32(pos, false);
      const type: number = dv.getUint32(pos + 4, false);

      if (type != 0x70737368)
        throw 'Box type ' + type.toString(16) + ' not equal to "pssh"';

      if (
        dv.getUint32(pos + 12, false) == 0x9a04f079 &&
        dv.getUint32(pos + 16, false) == 0x98404286 &&
        dv.getUint32(pos + 20, false) == 0xab92e65b &&
        dv.getUint32(pos + 24, false) == 0xe0885f95
      ) {
        const size: number = dv.getUint32(pos + 28, false);

        const pro: Uint16Array = new Uint16Array(
          abuf.slice(pos + 32 + (4 + 2 + 2 + 2), pos + 32 + size)
        );

        const xmlString: string = arrayToString(pro);
        const parser: DOMParser = new DOMParser();
        const xmlDoc: Document = parser.parseFromString(
          xmlString,
          'application/xml'
        );

        return xmlDoc;
      } else {
        pos += box_size;
      }
    }

    return null;
  }
  extractKIDFromPSSHBox(initData: Uint8Array): string {
    const abuf: ArrayBuffer = initData.buffer;
    const dv: DataView = new DataView(abuf);
    let pos: number = 0;
    while (pos < abuf.byteLength) {
      const box_size = dv.getUint32(pos, false);
      const type = dv.getUint32(pos + 4, false);
      if (type != 0x70737368)
        throw 'Box type ' + type.toString(16) + ' not equal to "pssh"';

      if (
        dv.getUint32(pos + 12, false) == 0x9a04f079 &&
        dv.getUint32(pos + 16, false) == 0x98404286 &&
        dv.getUint32(pos + 20, false) == 0xab92e65b &&
        dv.getUint32(pos + 24, false) == 0xe0885f95
      ) {
        const size: number = dv.getUint32(pos + 28, false);

        const pro: Uint16Array = new Uint16Array(
          abuf.slice(pos + 32 + (4 + 2 + 2 + 2), pos + 32 + size)
        );

        let xmlString: string;
        let b64Kid: string;
        let kidArray: Uint8Array;
        let kid: string;

        xmlString = arrayToString(pro);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

        if (xmlDoc.getElementsByTagName('LA_URL')[0]) {
          //
        }
        if (xmlDoc.getElementsByTagName('KID')[0]) {
          b64Kid =
            xmlDoc.getElementsByTagName('KID')[0].childNodes[0].nodeValue!;
        }

        kidArray = BASE64.decodeArray(b64Kid!);
        //MSbinary To UUID
        kid =
          ('0' + kidArray[3].toString(16)).slice(-2) +
          ('0' + kidArray[2].toString(16)).slice(-2) +
          ('0' + kidArray[1].toString(16)).slice(-2) +
          ('0' + kidArray[0].toString(16)).slice(-2) +
          '-' +
          ('0' + kidArray[5].toString(16)).slice(-2) +
          ('0' + kidArray[4].toString(16)).slice(-2) +
          '-' +
          ('0' + kidArray[7].toString(16)).slice(-2) +
          ('0' + kidArray[6].toString(16)).slice(-2) +
          '-' +
          ('0' + kidArray[8].toString(16)).slice(-2) +
          ('0' + kidArray[9].toString(16)).slice(-2) +
          '-' +
          ('0' + kidArray[10].toString(16)).slice(-2) +
          ('0' + kidArray[11].toString(16)).slice(-2) +
          ('0' + kidArray[12].toString(16)).slice(-2) +
          ('0' + kidArray[13].toString(16)).slice(-2) +
          ('0' + kidArray[14].toString(16)).slice(-2) +
          ('0' + kidArray[15].toString(16)).slice(-2);
        return kid;
      } else {
        pos += box_size;
      }
    }

    return 'CCC';
  }

  extractWideVineKIDFromPSSHBox(initData: Uint8Array): string {
    var abuf = initData.buffer;
    var dv = new DataView(abuf);
    var pos = 0;
    while (pos < abuf.byteLength) {
      var box_size = dv.getUint32(pos, false);
      var type = dv.getUint32(pos + 4, false);

      if (type != 0x70737368)
        throw 'Box type ' + type.toString(16) + ' not equal to "pssh"';

      if (
        dv.getUint32(pos + 12, false) == 0xedef8ba9 &&
        dv.getUint32(pos + 16, false) == 0x79d64ace &&
        dv.getUint32(pos + 20, false) == 0xa3c827dc &&
        dv.getUint32(pos + 24, false) == 0xd51d21ed
      ) {
        //var size = dv.getUint32(pos + 28, false),
        var kidArray = new Uint8Array(
            abuf.slice(pos + 32 + 4, pos + 32 + 4 + 16)
          ),
          kid;

        kid =
          ('0' + kidArray[0].toString(16)).slice(-2) +
          ('0' + kidArray[1].toString(16)).slice(-2) +
          ('0' + kidArray[2].toString(16)).slice(-2) +
          ('0' + kidArray[3].toString(16)).slice(-2) +
          '-' +
          ('0' + kidArray[4].toString(16)).slice(-2) +
          ('0' + kidArray[5].toString(16)).slice(-2) +
          '-' +
          ('0' + kidArray[6].toString(16)).slice(-2) +
          ('0' + kidArray[7].toString(16)).slice(-2) +
          '-' +
          ('0' + kidArray[8].toString(16)).slice(-2) +
          ('0' + kidArray[9].toString(16)).slice(-2) +
          '-' +
          ('0' + kidArray[10].toString(16)).slice(-2) +
          ('0' + kidArray[11].toString(16)).slice(-2) +
          ('0' + kidArray[12].toString(16)).slice(-2) +
          ('0' + kidArray[13].toString(16)).slice(-2) +
          ('0' + kidArray[14].toString(16)).slice(-2) +
          ('0' + kidArray[15].toString(16)).slice(-2);
        return kid;
      } else {
        pos += box_size;
      }
    }

    return 'CCC';
  }

  listenToNeedKey(
    videoModel: VideoModel | DummyVideoModel,
    listener: EventListener
  ) {
    videoModel.listen('webkitneedkey', listener);
    videoModel.listen('msneedkey', listener);
    videoModel.listen('needKey', listener);
  }
  listenToNeedKeyEME01b(
    element: NXHTMLVideoElement | NXMediaKeySession,
    listener: EventListener
  ) {
    LogHandler.log('listenToNeedKeyEME01b:' + this.EME01b_prefix, '#8080ff');
    const args = {
      standard: 'needkey',
      webkit: 'webkitneedkey',
      ms: 'msneedkey',
    };
    element.addEventListener(args[this.EME01b_prefix!], listener, false);
  }

  listenToKeyError(
    source: NXHTMLVideoElement | NXMediaKeySession,
    listener: EventListener
  ) {
    source.addEventListener('webkitkeyerror', listener, false);
    source.addEventListener('mskeyerror', listener, false);
    source.addEventListener('keyerror', listener, false);
  }

  listenToKeyMessage(
    source: NXHTMLVideoElement | NXMediaKeySession,
    listener: EventListener
  ) {
    try {
      source.addEventListener('webkitkeymessage', listener, false);
      source.addEventListener('mskeymessage', listener, false);
      source.addEventListener('keymessage', listener, false);
    } catch (e: any) {
      LogHandler.log('listenToKeyMessage Error: ' + e.message, '#8080ff');
    }
  }

  listenToKeyAdded(
    source: NXHTMLVideoElement | NXMediaKeySession,
    listener: EventListener
  ) {
    source.addEventListener('webkitkeyadded', listener, false);
    source.addEventListener('mskeyadded', listener, false);
    source.addEventListener('keyadded', listener, false);
  }

  unlistenToNeedKeyEME01b(
    element: NXHTMLVideoElement | NXMediaKeySession,
    listener: EventListener
  ) {
    LogHandler.log('unlistenToNeedKeyEME01b:' + this.EME01b_prefix, '#8080ff');
    const args = {
      standard: 'needkey',
      webkit: 'webkitneedkey',
      ms: 'msneedkey',
    };
    element.removeEventListener(args[this.EME01b_prefix!], listener, false);
  }

  unlistenToNeedKey(
    videoModel: VideoModel | DummyVideoModel,
    listener: EventListener
  ) {
    videoModel.unlisten('webkitneedkey', listener);
    videoModel.unlisten('msneedkey', listener);
    videoModel.unlisten('needKey', listener);
  }

  unlistenToKeyError(
    source: NXHTMLVideoElement | NXMediaKeySession,
    listener: EventListener
  ) {
    source.removeEventListener('webkitkeyerror', listener);
    source.removeEventListener('mskeyerror', listener);
    source.removeEventListener('keyerror', listener);
  }

  unlistenToKeyMessage(
    source: NXHTMLVideoElement | NXMediaKeySession,
    listener: EventListener
  ) {
    source.removeEventListener('webkitkeymessage', listener);
    source.removeEventListener('mskeymessage', listener);
    source.removeEventListener('keymessage', listener);
  }

  unlistenToKeyAdded(
    source: NXHTMLVideoElement | NXMediaKeySession,
    listener: EventListener
  ) {
    source.removeEventListener('webkitkeyadded', listener);
    source.removeEventListener('mskeyadded', listener);
    source.removeEventListener('keyadded', listener);
  }
}
