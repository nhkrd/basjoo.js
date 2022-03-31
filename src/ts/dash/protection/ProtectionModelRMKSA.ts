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

import { BASE64 } from '../core/Base64';
import Debug from '../core/Debug';
import { EventBus } from '../core/EventBus';
import LogHandler from '../core/LogHandler';
import { ProtectionExtensions, stringToArray } from './ProtectionExtensions';
import { Stream } from '../streaming/Stream';
import { hasProperty } from '../core/Utils';
import VideoModel, { DummyVideoModel } from '../streaming/VideoModel';

/**
 * ProtectionModelRMKSA
 *
 * @module ProtectionModelRMKSA（ProtectionModelRMKSAモジュール）
 */

/**
 * ProtectionModelRMKSA
 * @constructor
 */
export class ProtectionModelRMKSA {
  element: Nullable<NXHTMLVideoElement>;
  videoModel?: VideoModel | DummyVideoModel;
  //NSV-a keySystems = [],
  kids: Array<string>;
  keySystemDescs: Nullable<Array<KeySystem>>;
  xhrCustom: Nullable<XHRCustom>;
  protectionExt: Nullable<ProtectionExtensions>;
  stream: Nullable<Stream>;
  useFetch: boolean;
  logHandler = LogHandler;
  NXDebug: Debug;
  eventBus: EventBus;
  checkList: Array<KeySystemString>;

  constructor(params: Paramstype, eventBus: EventBus) {
    this.element = null;
    //NSV-a keySystems = [],
    this.kids = [];
    this.keySystemDescs = null;
    this.xhrCustom = null;
    this.protectionExt = null;
    this.stream = null;
    this.useFetch = params.USE_FETCH && 'fetch' in window ? true : false;
    this.useFetch = false;
    this.NXDebug = new Debug();
    this.eventBus = eventBus;
    this.checkList = [
      {
        schemeIdUri: 'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95',
        keysTypeString: 'com.microsoft.playready',
      },
      {
        schemeIdUri: 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
        keysTypeString: 'com.widevine.alpha',
      },
      {
        schemeIdUri: 'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b',
        keysTypeString: 'org.w3.clearkey',
      },
    ];
  }

  // teardownKeySystem = (kid: string): void => {
  //   this.removeKeySystem(kid);
  // };

  //NSV-a const abortWrapper = (f, c) =>
  //NSV-a   new Promise((resolve, reject) => {
  //NSV-a     setTimeout(() => {
  //NSV-a       c.aborted = true;
  //NSV-a       reject(new Error('abort'));
  //NSV-a     }, 1000);
  //NSV-a     f.then(resolve, reject);
  //NSV-a   });
  //NSV-a
  //NSV-a const getKID = (data) => {
  //NSV-a   if (!data || !hasProperty(data, 'cenc:default_KID')) {
  //NSV-a     return 'unknown';
  //NSV-a   }
  //NSV-a   return data['cenc:default_KID'];
  //NSV-a };

  createSupportedKeySystem = (
    codecs: { [type: string]: string },
    keysTypeString: string
  ): Promise<void | MediaKeys> => {
    const systemOptions: Array<OptionType> = [];
    const option: OptionType = {};
    option['initDataTypes'] = ['cenc'];
    if (codecs['video']) {
      option['videoCapabilities'] = [
        {
          contentType: codecs['video'],
          robustness: '',
        },
      ];
    }
    if (codecs['audio']) {
      option['audioCapabilities'] = [
        {
          contentType: codecs['audio'],
          robustness: '',
        },
      ];
    }
    systemOptions.push(option);

    return navigator
      .requestMediaKeySystemAccess(keysTypeString, systemOptions)
      .then(
        (
          keySystemAccess: MediaKeySystemAccess //NXDebug.info(keySystemAccess.getConfiguration());
        ) => keySystemAccess.createMediaKeys()
      );
  };

  getSystems = (): Array<KeySystem> => [
    {
      schemeIdUri: 'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95',
      keysTypeString: 'com.microsoft.playready',
      isSupported(data) {
        return this.schemeIdUri === data.schemeIdUri!.toLowerCase();
      },
    },
    {
      schemeIdUri: 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
      keysTypeString: 'com.widevine.alpha',
      isSupported(data) {
        return this.schemeIdUri === data.schemeIdUri!.toLowerCase();
      },
    },
    {
      schemeIdUri: 'urn:mpeg:dash:mp4protection:2011',
      keysTypeString: 'com.microsoft.playready',
      isSupported(data) {
        return (
          this.schemeIdUri === data.schemeIdUri!.toLowerCase() &&
          data.value!.toLowerCase() === 'cenc'
        );
      },
    },
    {
      schemeIdUri: 'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b',
      keysTypeString: 'org.w3.clearkey',
      isSupported(data) {
        return this.schemeIdUri === data.schemeIdUri!.toLowerCase();
      },
    },
  ];

  selectKeySystemRMKSA = (
    codecs: { [type: string]: string },
    contentProtection: Array<ContentProtection>,
    _initData: Nullable<Uint8Array>,
    _cp: number,
    _ks: number,
    fromEvent: boolean
  ): void => {
    let ks = _ks;
    let cp = _cp;
    let initData = _initData;
    //    let idat: Uint8Array;
    let kid;
    if (this.keySystemDescs![ks].isSupported(contentProtection[cp])) {
      /* istanbul ignore next */
      this.createSupportedKeySystem(
        codecs,
        this.keySystemDescs![ks].keysTypeString
      )
        .then((createdMediaKeys: void | MediaKeys) => {
          if (fromEvent == false) initData = contentProtection[cp]!.pssh!;

          if (
            this.keySystemDescs![ks].keysTypeString ===
            'com.microsoft.playready'
          ) {
            //            idat = new Uint8Array(initData!.buffer);
            kid = this.protectionExt!.extractKIDFromPSSHBox(
              new Uint8Array(initData!)
            );
          } else if (
            this.keySystemDescs![ks].keysTypeString === 'com.widevine.alpha'
          ) {
            //            idat = new Uint8Array(initData!.buffer);
            kid = this.protectionExt!.extractWideVineKIDFromPSSHBox(
              new Uint8Array(initData!)
            );
          } else if (
            this.keySystemDescs![ks].keysTypeString === 'org.w3.clearkey'
          ) {
            //            idat = new Uint8Array(initData!.buffer);
            kid = this.protectionExt!.extractClearKeyKIDFromPSSHBox(
              new Uint8Array(initData!)
            );
          } else {
            kid = 'unknown';
          }

          this.logHandler.log_item(
            'codec_video',
            'V-Codec: ' + codecs['video']
          );
          this.logHandler.log_item(
            'keysystem',
            'KeySystem: ' + this.keySystemDescs![ks].keysTypeString
          );
          this.logHandler.log_item('keysystem_kid_v', 'KID: ' + kid);

          this.logHandler.log_DRM('  KID ==> ' + kid, 99);
          this.logHandler.log_DRM(
            '  KeyInfo ==> ' + this.keySystemDescs![ks].keysTypeString,
            99
          );
          this.logHandler.log_DRM('  Codec ==> ' + codecs['video'], 99);
          this.NXDebug.log(
            'DRM: Selected Key System: ' +
              this.keySystemDescs![ks].keysTypeString +
              ' For KID: ' +
              kid
          );
          (createdMediaKeys as ExMediaKeys).keysTypeString =
            this.keySystemDescs![ks].keysTypeString;
          (createdMediaKeys as ExMediaKeys).schemeIdUri =
            this.keySystemDescs![ks].schemeIdUri;
          this.element!.mediaKeysObject = createdMediaKeys as NXMediaKeys;

          if (fromEvent) {
            for (var i = 0; i < this.element!.pendingSessionData!.length; i++) {
              var data = this.element!.pendingSessionData![i]!;
              this.makeNewRequest(
                this.element!.mediaKeysObject,
                data.initDataType,
                data.initData
              );
            }

            this.element!.pendingSessionData = [];
          } else {
            for (
              var i = 0;
              i < this.element!.pendingContentProtectionData.length;
              i++
            ) {
              var cpd = this.element!.pendingContentProtectionData[i];
              if (this.keySystemDescs![ks].isSupported(cpd)) {
                this.makeNewRequest(
                  this.element!.mediaKeysObject,
                  'cenc',
                  cpd!.pssh!
                );
              }
            }
            this.element!.pendingContentProtectionData = [];
          }

          return this.element!.setMediaKeys(createdMediaKeys as ExMediaKeys);
        })
        .catch((error: any) => {
          this.NXDebug.log(
            this.keySystemDescs![ks].keysTypeString + ' error:' + error
          );
          if (cp < contentProtection.length - 1) {
            cp++;
          } else if (ks < this.keySystemDescs!.length - 1) {
            ks++;
            cp = 0;
          } else {
            throw new Error(
              'DRM: The protection system for this content is not supported.'
            );
          }
          this.selectKeySystemRMKSA(
            codecs,
            contentProtection,
            initData,
            cp,
            ks,
            fromEvent
          );
        });
    } else {
      if (cp < contentProtection.length - 1) {
        cp++;
      } else if (ks < this.keySystemDescs!.length - 1) {
        ks++;
        cp = 0;
      } else {
        throw new Error(
          'DRM: The protection system for this content is not supported.'
        );
      }
      this.selectKeySystemRMKSA(
        codecs,
        contentProtection,
        initData,
        cp,
        ks,
        fromEvent
      );
    }
  };

  addKeySession = (
    element: NXHTMLVideoElement,
    initDataType: string,
    initData: Uint8Array
  ): void => {
    if (element.mediaKeysObject) {
      this.makeNewRequest(element.mediaKeysObject, initDataType, initData);
    } else {
      element.pendingSessionData!.push({
        initDataType,
        initData,
      });
    }
  };

  addContentProtectionData = (
    element: NXHTMLVideoElement,
    contentProtection: Array<ContentProtection>
  ): void => {
    if (element.mediaKeysObject) {
      for (var i = 0; i < contentProtection.length; i++) {
        if (
          element.mediaKeysObject.schemeIdUri ==
          contentProtection[i].schemeIdUri!.toLowerCase()
        ) {
          this.makeNewRequest(
            element.mediaKeysObject,
            'cenc',
            contentProtection[i].pssh!
          );
        }
      }
    } else {
      element.pendingContentProtectionData =
        element.pendingContentProtectionData.concat(contentProtection);
    }
  };

  makeNewRequest = (
    mediaKeys: NXMediaKeys,
    initDataType: string,
    initData: Uint8Array
  ): void => {
    const self = this;
    let keySession: Nullable<NXMediaKeySession> = null;
    const keysTypeString: string = mediaKeys.keysTypeString;
    let kid: string;
    let idat: Uint8Array;

    if (keysTypeString === 'com.microsoft.playready') {
      idat = new Uint8Array(initData);
      kid = this.protectionExt!.extractKIDFromPSSHBox(idat);
      if (this.kids.indexOf(kid) > -1) {
        return;
      } else {
        this.kids.push(kid);
      }

      const pro: Nullable<Document> =
        this.protectionExt!.extractPROFromPSSHBox(idat);
      let laURL: string;
      if (pro!.getElementsByTagName('LA_URL')[0]) {
        laURL = pro!.getElementsByTagName('LA_URL')[0].childNodes[0].nodeValue!;
      } else {
        laURL = 'unknown';
      }

      keySession = (mediaKeys as ExMediaKeys).createSession(
        'temporary'
      ) as ExMediaKeySession;
      keySession.laURL = laURL;
      keySession.keysTypeString = keysTypeString;

      keySession.addEventListener(
        'message',
        this.licenseRequestReady.bind(this),
        false
      );

      keySession
        .generateRequest(initDataType, initData)
        .then(() => {})
        .catch((_error: any) => {
          this.logHandler.log('gerateRequest error');
        });
    } else if (keysTypeString === 'com.widevine.alpha') {
      idat = new Uint8Array(initData);
      kid = this.protectionExt!.extractWideVineKIDFromPSSHBox(idat);

      if (this.kids.indexOf(kid) > -1) {
        return;
      } else {
        this.kids.push(kid);
      }
      keySession = (mediaKeys as ExMediaKeys).createSession(
        'temporary'
      ) as ExMediaKeySession;
      //keySession!.laURL = laURL;
      keySession!.keysTypeString = keysTypeString;

      keySession!.addEventListener(
        'message',
        this.licenseRequestReady_wv.bind(this),
        false
      );

      keySession!
        .generateRequest(initDataType, initData)
        .then(function () {})
        .catch(function (/* error:any */) {
          self.logHandler.log('gerateRequest error');
        });
    } else if (keysTypeString == 'org.w3.clearkey') {
      const keys: {
        [key: string]: any;
      } = this.protectionExt!.extractClearKeyFromMessageForRMKSA(
        new Uint8Array(initData)
      );
      const keyids: {
        kids?: Array<string>;
      } = {};
      kid = keys['keys'][0]['kid'];
      keyids['kids'] = [kid];

      if (this.kids.indexOf(kid) > -1) {
        return;
      } else {
        this.kids.push(kid);
      }
      keySession = (
        mediaKeys as ExMediaKeys
      ).createSession() as ExMediaKeySession;
      keySession!.addEventListener(
        'message',
        this.handleClearKeyMessage.bind(this, keys),
        false
      );
      keySession!.generateRequest(
        'keyids',
        stringToArray(JSON.stringify(keyids))
      );
    }
  };

  handleClearKeyMessage = (
    keys: {
      [key: string]: any;
    },
    event: MediaKeyMessageEvent
  ): void => {
    const keySession: Nullable<EventTarget> = event.target;
    keys['type'] = 'temporary';

    (keySession as MediaKeySession)
      .update(stringToArray(JSON.stringify(keys)))
      .then(() => {
        this.stream!.onKeyAdded();
      })
      .catch((error: any) => {
        this.logHandler.log(error);
      });
  };

  /* istanbul ignore next */
  licenseRequestReady = (event: MediaKeyMessageEvent): void => {
    let bytes: Uint8Array | Uint16Array = new Uint8Array(event.message);
    let msg = String.fromCharCode.apply(null, Array.from(bytes));
    let decodedChallenge: Nullable<string> = null;
    const parser: DOMParser = new DOMParser();
    let xmlDoc: XMLDocument = parser.parseFromString(msg, 'application/xml');
    const headers: Array<CommonHeader> = [];

    const qrys = hasProperty(this.xhrCustom, 'query')
      ? this.xhrCustom!['query']!.concat()
      : [];

    const hdrs = hasProperty(this.xhrCustom, 'header')
      ? this.xhrCustom!['header']!.concat()
      : [];

    const onPrepare = hasProperty(this.xhrCustom, 'onPrepare')
      ? this.xhrCustom!['onPrepare']
      : () => {};

    const onSuccess = hasProperty(this.xhrCustom, 'onSuccess')
      ? this.xhrCustom!['onSuccess']
      : () => {};

    const onError = hasProperty(this.xhrCustom, 'onError')
      ? this.xhrCustom!['onError']
      : () => {};

    let laURL: Nullable<string>;
    let ctypeIsSet: boolean;

    if (xmlDoc.getElementsByTagName('parsererror')[0]) {
      bytes = new Uint16Array(event.message);
      msg = String.fromCharCode.apply(null, Array.from(bytes));
      xmlDoc = parser.parseFromString(msg, 'application/xml');
    }

    if (xmlDoc.getElementsByTagName('LA_URL')[0]) {
      laURL = xmlDoc.getElementsByTagName('LA_URL')[0].childNodes[0].nodeValue;
    } else {
      laURL = (event.target! as ExEventTarget).laURL!;
    }

    if (xmlDoc.getElementsByTagName('PlayReadyKeyMessage')[0]) {
      if (xmlDoc.getElementsByTagName('Challenge')[0]) {
        const Challenge: Nullable<string> =
          xmlDoc.getElementsByTagName('Challenge')[0].childNodes[0].nodeValue;
        if (Challenge) {
          decodedChallenge = BASE64.decode(Challenge);
        }
      } else {
        this.logHandler.log(
          'error: DRM: playready update, can not find Challenge in keyMessage'
        );
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
      this.logHandler.log(
        'error: DRM: playready update, invalid header name/value pair in keyMessage'
      );
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
      xhr.keySession = event.target as NXMediaKeySession;
      xhr.keysTypeString = (event.target as NXMediaKeySession)!.keysTypeString;
      xhr.url = laURL!;

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

          (xhr.keySession as MediaKeySession)
            .update(xhr.response)
            .then(() => {
              this.stream!.onKeyAdded();
            })
            .catch((_error: any) => {
              this.NXDebug.info('session.update error');
            });
        } else {
          onError!({
            status: xhr.status!,
            req: xhr,
            xhr,
          });
          //callback({status:"error", msg:'DRM: playready update, XHR status is "' + xhr.statusText + '" (' + xhr.status + '), expected to be 200. readyState is ' + xhr.readyState});
        }
      };

      xhr.onabort = () => {
        onError!({
          status: xhr.status!,
          req: xhr,
          xhr,
        });
        //callback({status:"error", msg:'DRM: playready update, XHR aborted. status is "' + xhr.statusText + '" (' + xhr.status + '), readyState is ' + xhr.readyState});
      };
      xhr.onerror = () => {
        onError!({
          status: xhr.status!,
          req: xhr,
          xhr,
        });
        //callback({status:"error", msg:'DRM: playready update, XHR error. status is "' + xhr.statusText + '" (' + xhr.status + '), readyState is ' + xhr.readyState});
      };

      xhr.open!('POST', xhr.url);
      xhr.responseType = 'arraybuffer';

      if (headers) {
        ctypeIsSet = false;
        headers.forEach((hdr) => {
          xhr.setRequestHeader!(hdr.name, hdr.value);
          if (hdr.name.toLowerCase() === 'content-type') {
            ctypeIsSet = true;
          }
        });
        if (!ctypeIsSet) {
          xhr.setRequestHeader!('Content-Type', 'text/xml; charset=utf-8');
        }
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

      request.keySession = event.target as MediaKeySession;
      request.url = laURL!;

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
      if (headers) {
        ctypeIsSet = false;
        headers.forEach((hdr) => {
          init.headers![hdr.name] = hdr.value;
          if (hdr.name.toLowerCase() === 'content-type') {
            ctypeIsSet = true;
          }
        });
        if (!ctypeIsSet) {
          init.headers!['Content-Type'] = 'text/xml; charset=utf-8';
        }
      }
      init.body = decodedChallenge;

      fetch(request.url, init)
        .then((res: Response) => {
          LogHandler.log_DRM('License( res.status == ' + res.status + ' )', 3);
          request.status = res.status;
          if (res.ok == true) {
            return res.arrayBuffer();
          } else {
            return Promise.reject(new Error('res.false'));
          }
        })
        .then((ab: ArrayBuffer) => {
          onSuccess!({
            status: request.status!,
            req: request,
            xhr: request,
          });

          (request.keySession as MediaKeySession)
            .update(ab)
            .then(() => {
              this.stream!.onKeyAdded();
            })
            .catch((_err: any) => {
              this.NXDebug.info('session.update error');
            });
        })
        .then((_err: any) => {
          if (acon.aborted) {
            LogHandler.log_DRM('License Request aborted.', 3);
            request.status = -1;
          }
          onError!({
            status: request.status!,
            req: request,
            xhr: request,
          });
        });
    }

    LogHandler.log_DRM('Get License()<br>&nbsp;&nbsp;laURL ==> ' + laURL, 2);
  };

  licenseRequestReady_wv = (event: MediaKeyMessageEvent): void => {
    const self = this;
    let bytes = new Uint8Array(event.message);
    //  laURL;

    const headers: Array<CommonHeader> = [];
    const qrys = hasProperty(this.xhrCustom, 'query')
      ? this.xhrCustom!['query']!.concat()
      : [];
    const hdrs = hasProperty(this.xhrCustom, 'header')
      ? this.xhrCustom!['header']!.concat()
      : [];
    const onPrepare = hasProperty(this.xhrCustom, 'onPrepare')
      ? this.xhrCustom!['onPrepare']
      : () => {};
    const onSuccess = hasProperty(this.xhrCustom, 'onSuccess')
      ? this.xhrCustom!['onSuccess']
      : () => {};
    const onError = hasProperty(this.xhrCustom, 'onError')
      ? this.xhrCustom!['onError']
      : () => {};

    var xhr: ExXMLHttpRequest = new XMLHttpRequest();
    xhr.keySession = event.target as NXMediaKeySession;
    xhr.keysTypeString = (event.target as NXMediaKeySession)!.keysTypeString;
    xhr.url = 'unknown';

    onPrepare!({ req: xhr, qrys: qrys, hdrs: hdrs, xhr: xhr });

    if (qrys.length > 0) {
      qrys.forEach(function (qry) {
        xhr.url += xhr.url!.indexOf('?') > 0 ? '&' : '?';
        xhr.url += qry.name + '=' + qry.value;
      });
    }
    //laURL = xhr.url;
    if (hdrs.length > 0) {
      hdrs.forEach(function (hdr) {
        headers.push({ name: hdr.name, value: hdr.value });
      });
    }
    xhr.onload = function () {
      self.logHandler.log_DRM('License( xhr.status == ' + xhr.status + ' )', 3);
      if (xhr.status == 200) {
        onSuccess!({ status: xhr.status, req: xhr, xhr: xhr });
        xhr
          .keySession!.update(xhr.response)
          .then(function () {
            self.stream!.onKeyAdded();
          })
          .catch(function (/* error: any */) {
            self.NXDebug.info('session.update error');
          });
      } else {
        onError!({ status: xhr.status!, req: xhr, xhr: xhr });
      }
    };
    xhr.onabort = function () {
      onError!({ status: xhr.status!, req: xhr, xhr: xhr });
    };
    xhr.onerror = function () {
      onError!({ status: xhr.status!, req: xhr, xhr: xhr });
    };

    xhr.open!('POST', xhr.url);
    xhr.responseType = 'arraybuffer';
    xhr.send!(bytes);
  };

  // setup(): void {
  //   //NSV-a keySystems = protectionExt.getKeySystems();
  //   this.element = this.videoModel!.getElement();
  // }

  init(
    v: VideoModel | DummyVideoModel,
    strm: Stream,
    xhrCustom: XHRCustom,
    prefix: string
  ): void {
    this.videoModel = v;
    this.element = v.getElement();
    this.xhrCustom = xhrCustom;
    this.keySystemDescs = this.getSystems.call(this);
    this.stream = strm;

    try {
      this.protectionExt = new ProtectionExtensions({}, this.eventBus);
    } catch (e: any) {
      this.logHandler.log(e);
    }
    this.protectionExt!.init(this.element!, prefix);
    //NSV-a keySystems = protectionExt.getKeySystems();
  }

  listenToEncrypted(listener: (evt: Event) => void): void {
    this.videoModel!.listen('encrypted', listener);
  }

  listenToKeyAdded(listener: EventListener): void {
    this.protectionExt!.listenToKeyAdded(this.element!, listener);
  }

  listenToKeyError(listener: EventListener): void {
    this.protectionExt!.listenToKeyError(this.element!, listener);
  }

  unlistenToEncrypted(listener: EventListener): void {
    this.videoModel!.unlisten('encrypted', listener);
  }

  unlistenToKeyAdded(listener: EventListener): void {
    this.protectionExt!.unlistenToKeyAdded(this.element!, listener);
  }

  unlistenToKeyError(listener: EventListener): void {
    this.protectionExt!.unlistenToKeyError(this.element!, listener);
  }

  reset(): void {
    this.kids = [];
  }
}
