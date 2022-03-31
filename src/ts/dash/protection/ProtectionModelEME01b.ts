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

import Debug from '../core/Debug';
import { EventBus } from '../core/EventBus';
import LogHandler from '../core/LogHandler';
import { ProtectionExtensions } from './ProtectionExtensions';
//import { hasProperty } from '../core/Utils';
import VideoModel, { DummyVideoModel } from '../streaming/VideoModel';

/**
 * ProtectionModelEME01b
 *
 * @module ProtectionModelEME01b（ProtectionModelEME01bモジュール）
 */

/**
 * ProtectionModelEME01b
 * @constructor
 */
export class ProtectionModelEME01b {
  element: Nullable<NXHTMLVideoElement>;
  videoModel?: VideoModel | DummyVideoModel;
  keySystems: Array<KeySystem>;
  xhrCustom: Nullable<XHRCustom>;
  protectionExt: Nullable<ProtectionExtensions>;
  logHandler = LogHandler;
  NXDebug: Debug;
  params: Paramstype;
  eventBus: EventBus;

  constructor(params: Paramstype, eventBus: EventBus) {
    this.element = null;
    this.keySystems = [];
    this.xhrCustom = null;
    this.protectionExt = null;
    this.NXDebug = new Debug();
    this.params = params;
    this.eventBus = eventBus;
  }

  // teardownKeySystem = (kid: string): void => {
  //   this.removeKeySystem(kid);
  // };
  selectKeySystemEME01b = (
    contentProtection: Array<ContentProtection>,
    initData: Uint8Array
  ): Nullable<KeySystemTypeEME01b> => {
    let kid: Nullable<string> = null;

    for (let ks = 0; ks < this.keySystems.length; ++ks) {
      for (let cp = 0; cp < contentProtection.length; ++cp) {
        if (this.keySystems[ks].isSupported(contentProtection[cp])) {
          if (
            this.keySystems[ks].keysTypeString === 'com.microsoft.playready'
          ) {
            kid = this.protectionExt!.extractKIDFromPSSHBox(initData);
          } else if (
            this.keySystems[ks].keysTypeString === 'com.widevine.alpha'
          ) {
            kid = this.protectionExt!.extractWideVineKIDFromPSSHBox(initData);
          } else {
            kid = 'unknown';
          }
          this.logHandler.log_item(
            'keysystem',
            'KeySystem: ' + this.keySystems[ks].keysTypeString
          );
          this.logHandler.log_item('keysystem_kid_v', 'KID: ' + kid);

          this.addKeySystem01b(
            kid!,
            contentProtection[cp],
            this.keySystems[ks]
          );

          return {
            kid: kid,
            initData: initData,
            keysTypeString: this.keySystems[ks].keysTypeString,
          };
        }
      }
    }

    return kid;
  };

  //NSV-a const getAuthToken = (atURL, _callback) => {
  //NSV-a   const callback = _callback || (() => {});
  //NSV-a   const xhr = new XMLHttpRequest();
  //NSV-a
  //NSV-a   xhr.onload = () => {
  //NSV-a     if (xhr.status == 200) {
  //NSV-a       callback({
  //NSV-a         status: 'ok',
  //NSV-a         data: xhr.response,
  //NSV-a       });
  //NSV-a     } else {
  //NSV-a       callback({
  //NSV-a         status: 'error',
  //NSV-a         msg:
  //NSV-a           'DRM: get auth token xhr status is "' +
  //NSV-a           xhr.statusText +
  //NSV-a           '" (' +
  //NSV-a           xhr.status +
  //NSV-a           '), expected to be 200. readyState is ' +
  //NSV-a           xhr.readyState,
  //NSV-a       });
  //NSV-a     }
  //NSV-a   };
  //NSV-a   xhr.onabort = () => {
  //NSV-a     callback({
  //NSV-a       status: 'error',
  //NSV-a       msg:
  //NSV-a         'DRM: get auth token, XHR aborted. status is "' +
  //NSV-a         xhr.statusText +
  //NSV-a         '" (' +
  //NSV-a         xhr.status +
  //NSV-a         '), readyState is ' +
  //NSV-a         xhr.readyState,
  //NSV-a     });
  //NSV-a   };
  //NSV-a   xhr.onerror = () => {
  //NSV-a     callback({
  //NSV-a       status: 'error',
  //NSV-a       msg:
  //NSV-a         'DRM: get auth token, XHR error. status is "' +
  //NSV-a         xhr.statusText +
  //NSV-a         '" (' +
  //NSV-a         xhr.status +
  //NSV-a         '), readyState is ' +
  //NSV-a         xhr.readyState,
  //NSV-a     });
  //NSV-a   };
  //NSV-a
  //NSV-a   xhr.open('GET', atURL);
  //NSV-a   xhr.responseType = 'json';
  //NSV-a   xhr.send();
  //NSV-a };

  _licenseFromMessage = (
    kid: string,
    msg: string,
    laURL: string,
    token: XHRCustom,
    callback: (val: ResponseData) => void
  ): void => {
    this.NXDebug.debug('_licenseFromMessage ' + kid + ' ' + laURL);
    this.logHandler.log('_licenseFromMessage ' + kid + ' ' + laURL);
    return this.keySystems[kid].keySystem.getKeyEME01b(
      msg,
      laURL,
      token,
      callback
    );
  };

  addKeyFromMessage = (
    kid: string,
    session: string,
    idata: Uint8Array,
    msg: string,
    laURL: string,
    callback: (d: ResponseData) => void = () => {}
  ): void => {
    const self = this;
    const keysTypeString: string =
      this.keySystems[kid].keySystem.keysTypeString;
    this._licenseFromMessage.call(
      self,
      kid,
      msg,
      laURL,
      this.xhrCustom!,
      (d) => {
        if (d.status === 'ok') {
          this.protectionExt!.addKey(d.data, idata, session, keysTypeString);
          callback(d);
        } else {
          callback(d);
        }
      }
    );
  };

  addKeyFromMessageForClearKey = (
    kid: string,
    session: string,
    idata: Uint8Array,
    _msg: string,
    _laURL: string
  ): void => {
    this.protectionExt!.addKeyForClearKey(kid, session, idata);
  };

  // setup(): void {
  //   this.keySystems = this.protectionExt!.getKeySystems();
  //   this.element = this.videoModel!.getElement();
  // }

  init(
    v: VideoModel | DummyVideoModel,
    xhrCustom: XHRCustom,
    prefix: string
  ): void {
    this.videoModel = v;
    this.element = v.getElement();
    this.xhrCustom = xhrCustom;
    try {
      this.protectionExt = new ProtectionExtensions(this.params, this.eventBus);
    } catch (e: any) {
      this.logHandler.log(e);
    }
    this.protectionExt!.init(this.element, prefix);
    this.keySystems = this.protectionExt!.getKeySystems();
  }

  addKeySystem01b(
    kid: string,
    contentProtectionData: ContentProtection,
    keySystemDesc: KeySystem
  ): void {
    const keysLocal = null;

    this.keySystems[kid] = {
      kID: kid,
      contentProtection: contentProtectionData,
      keySystem: keySystemDesc,
      keys: keysLocal,
      initData: null,
      keySessions: [],
    };
  }

  getInitData(kid: string): Nullable<Uint8Array> {
    let keySystem: KID = this.keySystems[kid];
    return keySystem.keySystem.getInitData!(keySystem.contentProtection);
  }

  getKeysTypeString(kid: string): string {
    return this.keySystems[kid].keySystem.keysTypeString;
  }

  addKey(type: Uint8Array, key: string, data: string, _id: string): void {
    this.logHandler.log_DRM('ProtectionModel::addKey ' + type + ' ' + key, 1);
    // @ts-ignore
    this.protectionExt!.addKey(this.element, type, key, data);
  }

  generateKeyRequest(data: Nullable<Uint8Array>, kid: string): void {
    if (kid != 'clearkey') {
      this.protectionExt!.generateKeyRequest(
        this.element,
        data,
        this.keySystems[kid]
      );
    } else {
      this.protectionExt!.generateKeyRequest(this.element, data, null);
    }
  }

  listenToNeedKey(listener: EventListener): void {
    this.protectionExt!.listenToNeedKeyEME01b(this.element!, listener);
  }

  listenToKeyMessage(listener: EventListener): void {
    this.protectionExt!.listenToKeyMessage(this.element!, listener);
  }

  listenToKeyAdded(listener: EventListener): void {
    this.protectionExt!.listenToKeyAdded(this.element!, listener);
  }

  listenToKeyError(listener: EventListener): void {
    this.protectionExt!.listenToKeyError(this.element!, listener);
  }

  unlistenToNeedKey(listener: EventListener): void {
    this.protectionExt!.unlistenToNeedKeyEME01b(this.element!, listener);
  }

  unlistenToKeyMessage(listener: EventListener): void {
    this.protectionExt!.unlistenToKeyMessage(this.element!, listener);
  }

  unlistenToKeyAdded(listener: EventListener): void {
    this.protectionExt!.unlistenToKeyAdded(this.element!, listener);
  }

  unlistenToKeyError(listener: EventListener): void {
    this.protectionExt!.unlistenToKeyError(this.element!, listener);
  }
}
