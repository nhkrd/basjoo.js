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

import Debug from '../core/Debug';
import { EventBus } from '../core/EventBus';
import LogHandler from '../core/LogHandler';
import { ProtectionExtensions } from './ProtectionExtensions';
import VideoModel, { DummyVideoModel } from '../streaming/VideoModel';
/**
 * ProtectionModel
 *
 * @module ProtectionModel（ProtectionModelモジュール）
 */

/**
 * ProtectionModel
 * @constructor
 */
export class ProtectionModel {
  element: Nullable<NXHTMLVideoElement>;
  keyAddedListener: Nullable<EventListener>;
  keyErrorListener: Nullable<EventListener>;
  keyMessageListener: Nullable<EventListener>;
  keySystems: Array<KeySystem>;
  kids: Array<string>;
  keySystemDescs: Nullable<Array<KeySystem>>;
  videoModel: Nullable<VideoModel | DummyVideoModel>;
  xhrCustom: Nullable<XHRCustom>;
  protectionExt: ProtectionExtensions;
  logHandler = LogHandler;
  NXDebug: Debug;

  constructor(params: Paramstype, eventBus: EventBus) {
    this.element = null;
    this.keyAddedListener = null;
    this.keyErrorListener = null;
    this.keyMessageListener = null;
    this.keySystems = [];
    this.kids = [];
    this.keySystemDescs = null;
    this.videoModel = null;
    this.xhrCustom = null;
    this.protectionExt = new ProtectionExtensions(params, eventBus);
    this.NXDebug = new Debug();
  }

  teardownKeySystem = (kid: string): void => {
    const self = this;
    this.removeKeySystem.call(self, kid);
  };

  //NSV-a  const getKID = (data) => {
  //NSV-a    if (!data || !utils.hasProperty(data, 'cenc:default_KID')) {
  //NSV-a      return null;
  //NSV-a    }
  //NSV-a    return data['cenc:default_KID'];
  //NSV-a  };
  //NSV-a
  //NSV-a  const _getKID = (idx, contentProtections) => {
  //NSV-a    if (utils.hasProperty(contentProtections[idx], 'cenc:default_KID')) {
  //NSV-a      return contentProtections[idx]['cenc:default_KID'];
  //NSV-a    } else {
  //NSV-a      for (let i = 0; i < contentProtections.length; i++) {
  //NSV-a        if (utils.hasProperty(contentProtections[i], 'cenc:default_KID')) {
  //NSV-a          return contentProtections[i]['cenc:default_KID'];
  //NSV-a        }
  //NSV-a      }
  //NSV-a    }
  //NSV-a    return null;
  //NSV-a  };

  selectKeySystem = (
    codec: string,
    contentProtections: Array<ContentProtection>,
    initData: Uint8Array
  ): KeySystemType => {
    const self = this;
    for (let ks = 0; ks < this.keySystemDescs!.length; ++ks) {
      for (let cp = 0; cp < contentProtections.length; ++cp) {
        if (
          this.keySystemDescs![ks].isSupported(contentProtections[cp]) &&
          this.protectionExt.supportsCodec(
            this.keySystemDescs![ks].keysTypeString,
            codec
          )
        ) {
          let kid: undefined | string;

          if (!kid) {
            if (
              this.keySystemDescs![ks].keysTypeString ===
              'com.microsoft.playready'
            ) {
              kid = this.protectionExt.extractKIDFromPSSHBox(initData);
            } else if (
              this.keySystemDescs![ks].keysTypeString === 'com.widevine.alpha'
            ) {
              kid = this.protectionExt!.extractWideVineKIDFromPSSHBox(initData);
            } else {
              kid = 'unknown';
            }
          }

          this.logHandler.log_item('codec_video', 'V-Codec: ' + codec);
          this.logHandler.log_item(
            'keysystem',
            'KeySystem: ' + this.keySystemDescs![ks].keysTypeString
          );
          this.logHandler.log_item('keysystem_kid_v', 'KID: ' + kid);

          if (this.kids!.indexOf(kid) == -1) {
            this.NXDebug.debug(String(this.kids));
            this.addKeySystem.call(
              self,
              kid!,
              contentProtections[cp],
              this.keySystemDescs![ks]
            );
            this.kids.push(kid!);
          }

          this.logHandler.log_DRM('  KID ==> ' + kid, 99);
          this.logHandler.log_DRM(
            '  KeyInfo ==> ' + this.keySystemDescs![ks].keysTypeString,
            99
          );
          this.logHandler.log_DRM('  Codec ==> ' + codec, 99);
          this.NXDebug.log(
            'DRM: Selected Key System: ' +
              this.keySystemDescs![ks].keysTypeString +
              ' For KID: ' +
              kid
          );

          return {
            kid: kid!,
            keysTypeString: this.keySystemDescs![ks].keysTypeString,
          };
        }
      }
    }
    throw new Error(
      'DRM: The protection system for this content is not supported.'
    );
  };

  ensureKeySession = (
    kid: string,
    codec: string,
    eventInitData: Nullable<Uint8Array>
  ): Nullable<NXMediaKeySession> => {
    const self = this;
    let session: Nullable<NXMediaKeySession> = null;
    let initData: Nullable<Uint8Array> = null;

    if (!this.needToAddKeySession.call(self, kid)) {
      return null;
    }

    if (!initData && eventInitData != null) {
      initData = eventInitData;
      this.logHandler.log('DRM: Using initdata from needskey event.');
      this.NXDebug.log('DRM: Using initdata from needskey event.');
    }
    // } else if (initData != null) {
    //   this.logHandler.log('DRM: Using initdata from prheader in mpd.');
    //   this.NXDebug.log('DRM: Using initdata from prheader in mpd.');
    // }

    if (initData != null) {
      session = this.addKeySession.call(self, kid, codec, initData);
      this.logHandler.log(
        'DRM: Added Key Session [' +
          (session!.sessionIdIsAvailable
            ? session!.sessionId
            : session!.tmpSessionId) +
          '] for KID: ' +
          kid +
          ' type: ' +
          codec
      );
      this.NXDebug.log(
        'DRM: Added Key Session [' +
          session!.sessionId +
          '] for KID: ' +
          kid +
          ' type: ' +
          codec
      );
    } else {
      this.NXDebug.log('DRM: initdata is null.');
    }
    return session;
  };

  //NSV-a  const getAuthToken = (atURL, _callback) => {
  //NSV-a    const callback = _callback || (() => {}),
  //NSV-a      xhr = new XMLHttpRequest();
  //NSV-a    xhr.onload = () => {
  //NSV-a      if (xhr.status == 200) {
  //NSV-a        callback({
  //NSV-a          status: 'ok',
  //NSV-a          data: xhr.response,
  //NSV-a        });
  //NSV-a      } else {
  //NSV-a        callback({
  //NSV-a          status: 'error',
  //NSV-a          msg:
  //NSV-a            'DRM: get auth token xhr status is "' +
  //NSV-a            xhr.statusText +
  //NSV-a            '" (' +
  //NSV-a            xhr.status +
  //NSV-a            '), expected to be 200. readyState is ' +
  //NSV-a            xhr.readyState,
  //NSV-a        });
  //NSV-a      }
  //NSV-a    };
  //NSV-a    xhr.onabort = () => {
  //NSV-a      callback({
  //NSV-a        status: 'error',
  //NSV-a        msg:
  //NSV-a          'DRM: get auth token, XHR aborted. status is "' +
  //NSV-a          xhr.statusText +
  //NSV-a          '" (' +
  //NSV-a          xhr.status +
  //NSV-a          '), readyState is ' +
  //NSV-a          xhr.readyState,
  //NSV-a      });
  //NSV-a    };
  //NSV-a    xhr.onerror = () => {
  //NSV-a      callback({
  //NSV-a        status: 'error',
  //NSV-a        msg:
  //NSV-a          'DRM: get auth token, XHR error. status is "' +
  //NSV-a          xhr.statusText +
  //NSV-a          '" (' +
  //NSV-a          xhr.status +
  //NSV-a          '), readyState is ' +
  //NSV-a          xhr.readyState,
  //NSV-a      });
  //NSV-a    };
  //NSV-a
  //NSV-a    xhr.open('GET', atURL);
  //NSV-a    xhr.responseType = 'json';
  //NSV-a    xhr.send();
  //NSV-a  };

  updateFromMessage = (
    kid: string,
    session: NXMediaKeySession,
    bytes: Nullable<Uint16Array>,
    laURL: string,
    callback: (d: ResponseData) => void
  ): void => {
    const self = this;

    this._updateFromMessage.call(
      self,
      kid,
      bytes,
      laURL,
      this.xhrCustom!,
      (d) => {
        if (d.status === 'ok') {
          session.update(d.data);
          this.logHandler.log_DRM('update()', 1);
          callback(d);
        } else {
          callback(d);
        }
      }
    );
  };

  updateFromMessageForClearKey = (
    kid: string,
    session: string,
    msg: Uint8Array
  ): void => {
    this.protectionExt.addKeyForClearKey(kid, session, msg);
  };

  addKeySession = (
    kid: string,
    mediaCodec: string,
    initData: Uint8Array
  ): Nullable<NXMediaKeySession> => {
    let session: Nullable<NXMediaKeySession> = null;
    try {
      session = this.protectionExt.createSession(
        this.keySystems[kid].keys,
        mediaCodec,
        initData
      );
    } catch (e) {
      this.logHandler.log('createSession ' + e);
    }
    if (session!.sessionId) {
      session!.sessionIdIsAvailable = true;
    } else {
      session!.tmpSessionId = new Date().getTime();
    }
    try {
      this.protectionExt.listenToKeyAdded(session!, this.keyAddedListener!);
      this.protectionExt.listenToKeyError(session!, this.keyErrorListener!);
      this.protectionExt.listenToKeyMessage(session!, this.keyMessageListener!);

      this.keySystems[kid].initData = initData;
      this.keySystems[kid].keySessions.push(session);
    } catch (e) {
      this.logHandler.log('after listener ' + e);
    }
    return session;
  };

  addKeySystem = (
    kid: string,
    contentProtectionData: ContentProtection,
    keySystemDesc: KeySystem
  ): void => {
    let keysLocal: Nullable<NXMediaKeys> = null;
    if (this.element!.mediaKeysObject! == undefined) {
      keysLocal = this.protectionExt.createMediaKeys(
        keySystemDesc.keysTypeString
      );
      this.protectionExt.setMediaKey(this.element!, keysLocal!);
    } else {
      keysLocal = this.element!.mediaKeysObject!;
    }

    this.keySystems[kid] = {
      kID: kid,
      contentProtection: contentProtectionData,
      keySystem: keySystemDesc,
      keys: keysLocal,
      initData: null,
      keySessions: [],
    };
  };

  removeKeySystem = (kid: Nullable<string>): void => {
    if (
      kid !== null &&
      this.keySystems[kid] !== undefined &&
      this.keySystems[kid].keySessions.length !== 0
    ) {
      const keySessions: Array<NXMediaKeySession> =
        this.keySystems[kid].keySessions;

      for (let kss = 0; kss < keySessions.length; ++kss) {
        this.protectionExt.unlistenToKeyError(
          keySessions[kss],
          this.keyErrorListener!
        );
        this.protectionExt.unlistenToKeyAdded(
          keySessions[kss],
          this.keyAddedListener!
        );
        this.protectionExt.unlistenToKeyMessage(
          keySessions[kss],
          this.keyMessageListener!
        );
        keySessions[kss].close();
      }

      this.keySystems[kid] = undefined;
    }
  };

  needToAddKeySession = (kid: string): boolean => {
    let keySystem: KeySystem | undefined = this.keySystems[kid];

    return keySystem!.keySystem!.needToAddKeySession!(
      keySystem!.initData!,
      keySystem!.keySessions
    );
  };

  //NSV-a  const getInitData = (kid) => {
  //NSV-a    let keySystem = null;
  //NSV-a    keySystem = keySystems[kid];
  //NSV-a    return keySystem.keySystem.getInitData(keySystem.contentProtection);
  //NSV-a  };

  _updateFromMessage = (
    kid: string,
    bytes: Nullable<Uint16Array>,
    laURL: string,
    token: XHRCustom,
    callback: (d: ResponseData) => void
  ): void =>
    this.keySystems[kid].keySystem.getUpdate(bytes, laURL, token, callback);

  init(
    v: VideoModel | DummyVideoModel,
    xhrCustom: XHRCustom,
    _prefix?: string
  ): void {
    this.videoModel = v;
    this.xhrCustom = xhrCustom;
    this.element = this.videoModel.getElement();
    this.keySystemDescs = this.protectionExt.getKeySystems();
    this.protectionExt.init(this.element, '');
  }

  listenToNeedKey(listener: EventListener): void {
    this.protectionExt.listenToNeedKey(this.videoModel!, listener);
  }

  listenToKeyError(listener: EventListener): void {
    this.keyErrorListener = listener;

    for (let ks = 0; ks < this.keySystems.length; ++ks) {
      const keySessions: Array<NXMediaKeySession> =
        this.keySystems[ks]!.keySessions!;

      for (let kss = 0; kss < keySessions.length; ++kss) {
        this.protectionExt.listenToKeyError(keySessions[kss], listener);
      }
    }
  }

  listenToKeyMessage(listener: EventListener): void {
    this.keyMessageListener = listener;

    for (let ks = 0; ks < this.keySystems.length; ++ks) {
      const keySessions: Array<NXMediaKeySession> =
        this.keySystems[ks]!.keySessions!;

      for (let kss = 0; kss < keySessions.length; ++kss) {
        this.logHandler.log('Model.listenToKeyMessage ' + kss); //aaaaa

        this.protectionExt.listenToKeyMessage(keySessions[kss], listener);
      }
    }
  }

  listenToKeyAdded(listener: EventListener): void {
    this.keyAddedListener = listener;

    for (let ks = 0; ks < this.keySystems.length; ++ks) {
      const keySessions: Array<NXMediaKeySession> =
        this.keySystems[ks]!.keySessions!;

      for (let kss = 0; kss < keySessions.length; ++kss) {
        this.protectionExt.listenToKeyAdded(keySessions[kss], listener);
      }
    }
  }

  unlistenToNeedKey(listener: EventListener): void {
    this.protectionExt.unlistenToNeedKey(this.videoModel!, listener);
  }

  unlistenToKeyError(listener: EventListener): void {
    for (let ks = 0; ks < this.keySystems.length; ++ks) {
      const keySessions: Array<NXMediaKeySession> =
        this.keySystems[ks]!.keySessions!;

      for (let kss = 0; kss < keySessions.length; ++kss) {
        this.protectionExt.unlistenToKeyError(keySessions[kss], listener);
      }
    }
  }

  unlistenToKeyMessage(listener: EventListener): void {
    for (let ks = 0; ks < this.keySystems.length; ++ks) {
      const keySessions: Array<NXMediaKeySession> =
        this.keySystems[ks]!.keySessions!;

      for (let kss = 0; kss < keySessions.length; ++kss) {
        this.protectionExt.unlistenToKeyMessage(keySessions[kss], listener);
      }
    }
  }

  unlistenToKeyAdded(listener: EventListener): void {
    for (let ks = 0; ks < this.keySystems.length; ++ks) {
      const keySessions: Array<NXMediaKeySession> =
        this.keySystems[ks]!.keySessions!;

      for (let kss = 0; kss < keySessions.length; ++kss) {
        this.protectionExt.unlistenToKeyAdded(keySessions[kss], listener);
      }
    }
  }
}
