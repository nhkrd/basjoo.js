// The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
//
// Copyright (c) 2014, Microsoft Open Technologies, Inc.
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
import ErrorHandler from '../core/ErrorHandler';
import { EventBus } from '../core/EventBus';
import LogHandler from '../core/LogHandler';
import { AdaptationSet } from '../manifest/ManifestModel';
import { Period } from '../manifest/Period';
import { ProtectionModel } from './ProtectionModel';
import { ProtectionModelEME01b } from './ProtectionModelEME01b';
import { ProtectionModelRMKSA } from './ProtectionModelRMKSA';
import { Stream } from '../streaming/Stream';
import VideoModel, { DummyVideoModel } from '../streaming/VideoModel';

/**
 * ProtectionController
 *
 * @module ProtectionController（ProtectionControllerモジュール）
 */

/**
 * ProtectionController
 * @constructor
 */
export class ProtectionController {
  stream: Nullable<Stream>;
  videoModel: Nullable<VideoModel | DummyVideoModel>;
  element: Nullable<NXHTMLVideoElement>;
  eme_prefix: Nullable<string>;
  periodInfo: Nullable<Period>;
  protectionModel: Nullable<
    ProtectionModel | ProtectionModelEME01b | ProtectionModelRMKSA
  >;
  initData: Array<any>;
  updatedKIDs: Array<Nullable<string>>;
  kid: Nullable<string>;
  sessionIds = {};
  needsKeyQue: Array<NeedsKey>;
  eventTypeList: Array<string>;
  needsKeyProcessListener: Nullable<NXEventListener>;
  needsKeyProcessing: boolean;
  needsKeyProcessingTimerId: Nullable<ReturnType<typeof setTimeout>>;
  errHandler = ErrorHandler;
  logHandler = LogHandler;
  NXDebug: Debug;
  sessionToKID = {};
  encryptedListener?: NXEventListener;
  needKeyListener?: NXEventListener;
  keyMessageListener?: NXEventListener;
  keyAddedListener?: NXEventListener;
  keyErrorListener?: NXEventListener;
  eventBus: EventBus;
  params: Paramstype;
  xhrCustom: XHRCustom;

  constructor(params: Paramstype, eventBus: EventBus, xhrCustom: XHRCustom) {
    this.stream = null;
    this.videoModel = null;
    this.element = null;
    this.eme_prefix = null;
    this.periodInfo = null;
    this.protectionModel = null;
    this.initData = [];
    this.updatedKIDs = [];
    this.kid = null;
    this.sessionIds = {};
    this.needsKeyQue = [];
    this.eventTypeList = [];
    this.needsKeyProcessListener = null;
    this.needsKeyProcessing = false;
    this.needsKeyProcessingTimerId = null;
    this.NXDebug = new Debug();
    this.sessionToKID = {};
    this.encryptedListener;
    this.needKeyListener;
    this.keyMessageListener;
    this.keyAddedListener;
    this.keyErrorListener;
    this.eventBus = eventBus;
    this.params = params;
    this.xhrCustom = xhrCustom;
  }

  //
  // Encrypted Media Extensions
  //

  /* istanbul ignore next */
  onMediaSourceNeedsKey = (event: ExEvent): void => {
    let videoCodec;
    let contentProtection;

    this.logHandler.log_item('needkey_type', event.type);
    this.eventTypeList.push(event.type);
    if (this.stream != null && !this.periodInfo) {
      this.periodInfo = this.stream.getPeriodInfo();
    }

    let videoData = this.periodInfo!.getPrimaryMediaData('video');
    if (videoData !== null) {
      videoCodec = videoData.getCodec();
      contentProtection = videoData.getContentProtectionData();
      this.logHandler.log('Code: ' + videoCodec, '#ff8080');
      this.logHandler.log('CP: ' + contentProtection[0].schemeIdUri, '#ff8080');
    }
    this.needsKeyQue.push({
      type: event.type,
      initData: event.initData,
      codec: videoCodec,
      contentProtection: contentProtection,
    });

    if (this.needsKeyProcessing) {
      this.needsKeyProcessListener = this.needsKeyHandlerMED.bind(self);
      this.eventBus.addEventListener(
        'ON_ADDED_KEY_PROCESSED',
        this.needsKeyProcessListener
      );
    } else {
      this.needsKeyHandlerMED.call(self, null);
    }
  };

  needsKeyHandlerMED = (evt: Nullable<ExEvent>): void => {
    var self = this;
    var q;
    var ret;
    //var contentProtection = null;
    var curType = evt != null ? evt.data.keysTypeString : 'none';

    if (this.needsKeyQue.length == 0) {
      this.eventBus.removeEventListener(
        'ON_ADDED_KEY_PROCESSED',
        this.needsKeyProcessListener!
      );
      this.needsKeyProcessListener = null;
      return;
    }

    this.stream!.clearInitTimer();

    while (this.needsKeyQue.length > 0) {
      q = this.needsKeyQue.shift();
      this.logHandler.log('EventType: ' + q.type, '#ff8080');

      this.NXDebug.log('DRM: Key required for - ' + q.codec);
      this.logHandler.log('DRM: Key required for - ' + q.codec);
      if (q.contentProtection != null && q.codec != null) {
        try {
          ret = (this.protectionModel as ProtectionModel)!.selectKeySystem(
            q.codec,
            q.contentProtection,
            q.initData
          );
          this.kid = ret.kid;

          if (curType != 'none' && curType != ret.keysTypeString) {
            continue;
          }
        } catch (error: any) {
          this.NXDebug.log(error);
          this.errHandler.mediaKeySystemSelectionError(this.eventBus, error);
          continue;
        }
      }

      this.initData.push({
        type: q.codec,
        initData: q.initData,
      });

      this.logHandler.log('kid: ' + this.kid, '#ff8080');

      //if ((kid != null) &&(updatedKIDs.indexOf(kid) < 0)){
      if (this.kid != null) {
        var ss;
        ss = (this.protectionModel as ProtectionModel)!.ensureKeySession(
          this.kid!,
          q.codec,
          q.initData
        );
        if (ss) {
          if (ss.sessionIdIsAvailable) {
            this.sessionToKID[ss.sessionId] = this.kid;
          } else {
            this.sessionToKID[ss.tmpSessionId] = this.kid;
          }

          this.needsKeyProcessing = true;
          this.needsKeyProcessingTimerId = setTimeout(function () {
            if (self.needsKeyProcessing) {
              self.needsKeyProcessing = false;
              self.eventBus.dispatchEvent({
                type: 'ON_ADDED_KEY_PROCESSED',
                data: { kid: self.kid, keysTypeString: 'none' },
              });
            }
            self.stream!.onKeyAdded();
            self.needsKeyProcessingTimerId = null;
          }, 1000);

          if (this.needsKeyQue.length > 0 && !this.needsKeyProcessListener) {
            this.needsKeyProcessListener =
              this.needsKeyHandlerEME01b.bind(self);
            this.eventBus.addEventListener(
              'ON_ADDED_KEY_PROCESSED',
              this.needsKeyProcessListener
            );
          }

          break;
        }
      }
    }
  };

  onMediaSourceKeyMessage = (event: ExEvent): void => {
    let session: Nullable<NXMediaKeySession> = null;
    let bytes: Nullable<Uint16Array> = null;
    //let msg: Nullable<string> = null;
    let laURL: Nullable<string> = null;
    const keySystem: string = event.target.keySystem;
    let kid: Nullable<string> = null;
    this.NXDebug.log('DRM: Got a key message...');

    if (this.needsKeyProcessingTimerId) {
      clearTimeout(this.needsKeyProcessingTimerId);
      this.needsKeyProcessingTimerId = null;
    }

    session = event.target;

    if (
      keySystem !== 'webkit-org.w3.clearkey' &&
      keySystem !== 'org.w3.clearkey'
    ) {
      if (event.type == 'mskeymessage') {
        bytes = new Uint16Array(event.message.buffer);
      } else {
        bytes = new Uint16Array(event.message);
      }

      laURL = event.destinationURL || 'unknown';

      this.logHandler.log_DRM('message<br>&nbsp;&nbsp;laURL ==> ' + laURL, 0);

      if (session!.sessionIdIsAvailable) {
        kid = this.sessionToKID[session!.sessionId];
      } else {
        kid = this.sessionToKID[session!.tmpSessionId!];
      }

      (this.protectionModel as ProtectionModel).updateFromMessage(
        kid!,
        session!,
        bytes,
        laURL,
        (d) => {
          if (d.status === 'error') {
            this.NXDebug.log(d.msg!);
            this.errHandler.mediaKeyMessageError(this.eventBus, d.msg!);
          }
          this.updatedKIDs.push(kid);
          this.eventBus.dispatchEvent({
            type: 'addKeyProcessed',
            data: { kid: kid, keysTypeString: keySystem },
          });
        }
      );
    } else {
      if (session!.sessionIdIsAvailable) {
        kid = this.sessionToKID[session!.sessionId];
      } else {
        kid = this.sessionToKID[session!.tmpSessionId!];
      }
      (this.protectionModel as ProtectionModel).updateFromMessageForClearKey(
        kid!,
        session!.sessionId,
        event.message
      );
    }
  };

  onMediaSourceEncrypted = (event: ExEvent): void => {
    const element: NXHTMLVideoElement = event.target!;
    const codecs = {};
    let contentProtections: Nullable<Array<ContentProtection>> = null;

    if (element.mediaKeysObject === undefined) {
      element.mediaKeysObject = null;
      element.pendingSessionData = [];

      if (this.stream != null && !this.periodInfo) {
        this.periodInfo = this.stream.getPeriodInfo();
      }
      let pmd: Nullable<AdaptationSet> =
        this.periodInfo!.getPrimaryMediaData('video');
      if (pmd !== null) {
        codecs['video'] = pmd.getCodec();
        contentProtections = pmd.getContentProtectionData();
      }
      pmd = this.periodInfo!.getPrimaryMediaData('audio');
      if (pmd !== null) {
        codecs['audio'] = pmd.getCodec();
        if (!contentProtections) {
          contentProtections = pmd.getContentProtectionData();
        }
      }

      (this.protectionModel as ProtectionModelRMKSA).selectKeySystemRMKSA(
        codecs,
        contentProtections!,
        event.initData!,
        0,
        0,
        true
      );
    } else {
      //        return;
    }
    (this.protectionModel as ProtectionModelRMKSA).addKeySession(
      element,
      event.initDataType!,
      event.initData!
    );
  };

  createMediaKeysFromMPD_MED = (videoData, audioData): void => {
    var self = this;
    let cpds: Array<ContentProtection>;
    let codec: string;
    //var contentProtection = [];
    return;
    if (videoData !== null) {
      codec = videoData.getCodec();
      cpds = videoData.getContentProtectionData();
      if (cpds) {
        for (var i = 0; i < cpds.length; i++) {
          if (cpds[i].pssh) {
            this.needsKeyQue.push({
              type: 'fromMPD',
              initData: cpds[i].pssh,
              codec: codec,
              contentProtection: [cpds[i]],
            });
          }
        }
      }
    }

    if (audioData !== null) {
      codec = audioData.getCodec();
      cpds = audioData.getContentProtectionData();
      if (cpds) {
        for (var i = 0; i < cpds!.length; i++) {
          if (cpds![i].pssh) {
            this.needsKeyQue.push({
              type: 'fromMPD',
              initData: cpds![i].pssh,
              codec: codec,
              contentProtection: [cpds![i]],
            });
          }
        }
      }
    }

    if (this.needsKeyProcessing) {
      if (!this.needsKeyProcessListener) {
        this.needsKeyProcessListener = this.needsKeyHandlerMED.bind(self);
        this.eventBus.addEventListener(
          'ON_ADDED_KEY_PROCESSED',
          this.needsKeyProcessListener!
        );
      }
    } else {
      this.needsKeyHandlerMED.call(self, null);
    }
  };

  //        createMediaKeysFromMPD_EME01b = function(videoData,audioData) {
  createMediaKeysFromMPD_EME01b = (videoData, audioData): void => {
    var self = this;
    let cpds: Array<ContentProtection>;
    //var contentProtection = [];

    if (videoData !== null) {
      cpds = videoData.getContentProtectionData();
      if (cpds) {
        for (var i = 0; i < cpds!.length; i++) {
          if (cpds![i].pssh) {
            this.needsKeyQue.push({
              type: 'fromMPD',
              initData: cpds[i].pssh,
              contentProtection: [cpds[i]],
            });
          }
        }
      }
    }

    if (audioData !== null) {
      cpds = audioData.getContentProtectionData();
      if (cpds) {
        for (var i = 0; i < cpds.length; i++) {
          if (cpds[i].pssh) {
            this.needsKeyQue.push({
              type: 'fromMPD',
              initData: cpds[i].pssh,
              contentProtection: [cpds[i]],
            });
          }
        }
      }
    }

    if (this.needsKeyProcessing) {
      if (!this.needsKeyProcessListener) {
        this.needsKeyProcessListener = this.needsKeyHandlerEME01b.bind(self);
        this.eventBus.addEventListener(
          'ON_ADDED_KEY_PROCESSED',
          this.needsKeyProcessListener!
        );
      }
    } else {
      this.needsKeyHandlerEME01b.call(self, null);
    }
  };

  //        createMediaKeysFromMPD_RMKS = function(videoData,audioData) {
  createMediaKeysFromMPD_RMKS = (videoData, audioData): void => {
    var cpds,
      codecs = {},
      contentProtection: Array<ContentProtection> = [];
    if (videoData !== null) {
      codecs['video'] = videoData.getCodec();
      cpds = videoData.getContentProtectionData();
      if (cpds) {
        for (var i = 0; i < cpds.length; i++) {
          if (cpds[i].pssh) {
            contentProtection.push(cpds[i]);
          }
        }
      }
    }
    if (audioData !== null) {
      codecs['audio'] = audioData.getCodec();
      cpds = audioData.getContentProtectionData();
      if (cpds) {
        for (var i = 0; i < cpds.length; i++) {
          if (cpds[i].pssh) {
            contentProtection.push(cpds[i]);
          }
        }
      }
    }
    if (contentProtection.length > 0) {
      if (this.element!.mediaKeysObject === undefined) {
        this.element!.mediaKeysObject = null;
        this.element!.pendingContentProtectionData = [];
        this.element!.pendingSessionData = [];
        console.info(contentProtection);
        (this.protectionModel as ProtectionModelRMKSA)!.selectKeySystemRMKSA(
          codecs,
          contentProtection,
          null,
          0,
          0,
          false
        );
      } else {
        //        return;
      }
      (this.protectionModel as ProtectionModelRMKSA)!.addContentProtectionData(
        this.element!,
        contentProtection
      );
    }
  };

  onMediaSourceKeyAdded = (): void => {
    this.logHandler.log_DRM('Key Added', 0);
    this.NXDebug.log('DRM: Key added.');
    this.stream!.onKeyAdded();
  };

  onMediaSourceKeyError = (event: ExEvent): void => {
    const session: NXMediaKeySession = event.target;
    let msg: string =
      'DRM: MediaKeyError - sessionId: ' +
      session.sessionId +
      ' errorCode: ' +
      session.error!.code +
      ' systemErrorCode: ' +
      session.error!.systemCode +
      ' [';
    switch (session.error!.code) {
      case 1:
        msg +=
          "MEDIA_KEYERR_UNKNOWN - An unspecified error occurred. This value is used for errors that don't match any of the other codes.";
        break;
      case 2:
        msg +=
          'MEDIA_KEYERR_CLIENT - The Key System could not be installed or updated.';
        break;
      case 3:
        msg +=
          'MEDIA_KEYERR_SERVICE - The message passed into update indicated an error from the license service.';
        break;
      case 4:
        msg +=
          'MEDIA_KEYERR_OUTPUT - There is no available output device with the required characteristics for the content protection system.';
        break;
      case 5:
        msg +=
          'MEDIA_KEYERR_HARDWARECHANGE - A hardware configuration change caused a content protection error.';
        break;
      case 6:
        msg +=
          'MEDIA_KEYERR_DOMAIN - An error occurred in a multi-device domain licensing configuration. The most common error is a failure to join the domain.';
        break;
    }
    msg += ']';

    this.NXDebug.log(msg);
    this.errHandler.mediaKeySessionError(this.eventBus, msg);
  };

  onAddKeyProcessed = (evt: any): void => {
    if (this.needsKeyProcessingTimerId) {
      clearTimeout(this.needsKeyProcessingTimerId);
      this.needsKeyProcessingTimerId = null;
    }

    if (this.needsKeyProcessing) {
      this.needsKeyProcessing = false;
      this.eventBus.dispatchEvent({
        type: 'ON_ADDED_KEY_PROCESSED',
        data: { kid: evt.data.kid, keysTypeString: evt.data.keysTypeString },
      });
    }
    this.stream!.onKeyAdded();
  };

  /* istanbul ignore next */
  needsKeyHandlerEME01b = (evt: any): void => {
    const self = this;
    let q;
    let ret;
    //var contentProtection = null;
    let curType = evt != null ? evt.data.keysTypeString : 'none';

    if (this.needsKeyQue.length == 0) {
      this.eventBus.removeEventListener(
        'ON_ADDED_KEY_PROCESSED',
        this.needsKeyProcessListener!
      );
      this.needsKeyProcessListener = null;
      return;
    }

    this.stream!.clearInitTimer();
    this.logHandler.log('needsKeyQue.len:' + this.needsKeyQue.length);
    while (this.needsKeyQue.length > 0) {
      q = this.needsKeyQue.shift();
      this.logHandler.log_DRM('needkey( ' + q.type + ' )', 0);

      if (!q.contentProtection) {
        (this.protectionModel as ProtectionModelEME01b)!.generateKeyRequest(
          q.initData,
          'clearkey'
        );
      } else {
        ret = (this
          .protectionModel as ProtectionModelEME01b)!.selectKeySystemEME01b(
          q.contentProtection,
          q.initData
        );
        this.kid = ret.kid;

        if (curType != 'none' && curType != ret.keysTypeString) {
          continue;
        }
      }

      if (this.updatedKIDs.indexOf(this.kid!) < 0) {
        this.logHandler.log('kid= ' + this.kid!, '#fff0f0');

        this.needsKeyProcessingTimerId = setTimeout(function () {
          if (self.needsKeyProcessing) {
            self.needsKeyProcessing = false;
            self.eventBus.dispatchEvent({
              type: 'ON_ADDED_KEY_PROCESSED',
              data: { kid: self.kid!, keysTypeString: 'none' },
            });
          }
          self.needsKeyProcessingTimerId = null;
        }, 1000);

        if (this.needsKeyQue.length > 0 && !this.needsKeyProcessListener) {
          this.needsKeyProcessListener = this.needsKeyHandlerEME01b.bind(self);
          this.eventBus.addEventListener(
            'ON_ADDED_KEY_PROCESSED',
            this.needsKeyProcessListener
          );
        }
        this.initData.push(q.initData);
        this.needsKeyProcessing = true;
        (this.protectionModel as ProtectionModelEME01b)!.generateKeyRequest(
          q.initData,
          this.kid!
        );

        break;
      }
    }
  };

  onMediaSourceNeedsKeyEME01b = (event: any) => {
    var self = this;
    var videoCodec: Nullable<string> = null;
    var contentProtection: Nullable<Array<ContentProtection>> = null;

    if (this.stream != null && !this.periodInfo) {
      this.periodInfo = this.stream.getPeriodInfo();
    }

    var videoData = this.periodInfo!.getPrimaryMediaData('video');
    if (videoData !== null) {
      videoCodec = videoData.getCodec()!;
      contentProtection = videoData.getContentProtectionData()!;
      this.logHandler.log(videoCodec!, '#fff0f0');
    }

    this.needsKeyQue.push({
      type: event.type,
      initData: event.initData,
      contentProtection: contentProtection!,
    });
    if (this.needsKeyProcessing) {
      this.needsKeyProcessListener = this.needsKeyHandlerEME01b.bind(this); //this.needsKeyProcessListener = needsKeyHandlerEME01b.bind(this);
      this.eventBus.addEventListener(
        'ON_ADDED_KEY_PROCESSED',
        this.needsKeyProcessListener!
      );
    } else {
      this.needsKeyHandlerEME01b.call(self, null);
    }
  };

  onMediaSourceKeyMessageEME01b = (event: any): void => {
    const self = this;
    let laURL: string = event.defaultURL;
    let keySystem: string =
      event.keySystem ||
      (this.protectionModel as ProtectionModelEME01b)!.getKeysTypeString(
        this.kid!
      );
    /*
    let keySystem: string =
      event.keySystem !== undefined
        ? event.keySystem
        : (this.protectionModel as ProtectionModelEME01b)!.getKeysTypeString(
            this.kid!
          );
    */
    let msg: Nullable<string> = null;
    let session: Nullable<string> = null;
    this.logHandler.log_DRM(
      'KeyRequest<br>&nbsp;&nbsp;defaultURL ==> ' +
        (event.defaultURL != null ? laURL : 'NONE'),
      0
    );

    if (keySystem == 'com.microsoft.playready') {
      msg = String.fromCharCode.apply(String, event.message);
      if (!event.defaultURL) {
        var parser = new DOMParser(),
          xmlDoc = parser.parseFromString(msg, 'application/xml');

        if (xmlDoc.getElementsByTagName('LA_URL')[0]) {
          laURL =
            xmlDoc.getElementsByTagName('LA_URL')[0].childNodes[0].nodeValue!;
        }
      }
    } else if (keySystem == 'com.widevine.alpha') {
      msg = event.message;
      if (!event.defaultURL) laURL = 'unknown';
    }

    session = event.sessionId;

    if (session! in this.sessionIds) {
      this.logHandler.log(
        '<< onMediaSourceKeyMessageEME01b 99 : sessionId=' + session,
        '#80ff80'
      );
      if (this.needsKeyProcessingTimerId) {
        clearTimeout(this.needsKeyProcessingTimerId);
        this.needsKeyProcessingTimerId = null;
      }

      if (this.needsKeyProcessing) {
        this.needsKeyProcessing = false;
        this.eventBus.dispatchEvent({
          type: 'ON_ADDED_KEY_PROCESSED',
          data: { kid: this.kid, keysTypeString: 'none' },
        });
      }
      return;
    } else {
      this.sessionIds[session!] = session;
    }

    if (!laURL && keySystem == '') {
      keySystem = 'org.w3.clearkey';
    }

    const idata = this.initData.shift();
    if (
      keySystem !== 'webkit-org.w3.clearkey' &&
      keySystem !== 'org.w3.clearkey'
    ) {
      (this.protectionModel as ProtectionModelEME01b).addKeyFromMessage(
        this.kid!,
        session!,
        idata!,
        msg!,
        laURL,
        function (d) {
          if (d.status == 'ok') {
            self.updatedKIDs.push(self.kid);
            self.eventBus.dispatchEvent({
              type: 'addKeyProcessed',
              data: { kid: self.kid, keysTypeString: keySystem },
            });
          }
        }
      );
    } else {
      (
        this.protectionModel as ProtectionModelEME01b
      ).addKeyFromMessageForClearKey(this.kid!, session!, idata!, msg!, laURL);
      this.updatedKIDs.push(this.kid);
      this.eventBus.dispatchEvent({
        type: 'addKeyProcessed',
        data: { kid: this.kid, keysTypeString: keySystem },
      });
    }
    this.logHandler.log('onMediaSourceKeyMessageEME01b 2', 0);
  };

  /* istanbul ignore next */
  onMediaSourceKeyAddedEME01b = (event): void => {
    this.logHandler.log_DRM('Key added sessionID:' + event.sessionId, 0);
  };

  onMediaSourceKeyErrorEME01b = (_event): void => {
    //logHandler.log_DRM( "keyerror errorCode: " + event.errorCode , (-1)) ;

    if (this.needsKeyProcessingTimerId) {
      clearTimeout(this.needsKeyProcessingTimerId);
      this.needsKeyProcessingTimerId = null;
    }
    if (this.needsKeyProcessing) {
      this.needsKeyProcessing = false;
      this.eventBus.dispatchEvent({
        type: 'ON_ADDED_KEY_PROCESSED',
        data: { kid: 'none', keysTypeString: 'none' },
      });
    }
  };

  //
  // Support Functions
  //
  MediaKeys_prefix = (): string => {
    const hasWebKit: boolean = 'WebKitMediaKeys' in window;
    const hasMs: boolean = 'MSMediaKeys' in window;
    const hasMediaSource: boolean = 'MediaKeys' in window;
    let prefix: string = '----';

    if (hasWebKit) {
      prefix = 'webkit';
    } else if (hasMs) {
      prefix = 'ms';
    } else if (hasMediaSource) {
      prefix = 'standard';
    }

    this.eme_prefix = prefix;
    return prefix;
  };

  EME01b_prefix = (element: NXHTMLVideoElement): string => {
    const hasWebKit: boolean =
      typeof (element! as ExWebkitHTMLVideoElement).webkitGenerateKeyRequest ==
      'function';
    const hasMs: boolean =
      typeof (element! as ExMSHTMLVideoElement).msGenerateKeyRequest ==
      'function';
    const hasMediaSource: boolean =
      typeof (element! as ExHTMLVideoElement).generateKeyRequest == 'function';
    let prefix: string = '----';

    if (hasMediaSource) {
      prefix = 'standard';
    } else if (hasWebKit) {
      prefix = 'webkit';
    } else if (hasMs) {
      prefix = 'ms';
    }

    this.eme_prefix = prefix;
    return prefix;
  };

  supportsRequestMediaKeySystemAccess = (): boolean => {
    const hasRMKS: boolean = 'requestMediaKeySystemAccess' in navigator;

    if (hasRMKS) {
      this.logHandler.log_item(
        'EME_ver',
        'EME: ' +
          '<span style="color:#808080">01b</span> <span style="color:#e7527d">requestMediaKeySystemAccess(' +
          this.MediaKeys_prefix() +
          ')</span>'
      );
    }

    return hasRMKS;
  };

  supportsMediaKeys = (): boolean => {
    const hasWebKit: boolean = 'WebKitMediaKeys' in window;
    const hasMs: boolean = 'MSMediaKeys' in window;
    const hasMediaSource: boolean = 'MediaKeys' in window;

    if (hasWebKit || hasMs || hasMediaSource) {
      this.logHandler.log_item(
        'EME_ver',
        'EME: ' +
          '<span style="color:#808080">01b</span> <span style="color:#e7527d">MediaKeys(' +
          this.MediaKeys_prefix() +
          ')</span>'
      );
    }

    return hasWebKit || hasMs || hasMediaSource;
  };

  supportsEME01b = (): boolean => {
    const hasWebKit: boolean =
      typeof (this.element! as ExWebkitHTMLVideoElement)
        .webkitGenerateKeyRequest == 'function';
    const hasMs: boolean =
      typeof (this.element! as ExMSHTMLVideoElement).msGenerateKeyRequest ==
      'function';
    const hasMediaSource: boolean =
      typeof (this.element! as ExHTMLVideoElement).generateKeyRequest ==
      'function';

    if (hasWebKit || hasMs || hasMediaSource) {
      this.logHandler.log_item(
        'EME_ver',
        'EME: ' +
          '<span style="color:#e7527d">01b( ' +
          this.EME01b_prefix(this.element!) +
          ' )</span>' +
          ' <span style="color:#808080">MediaKeys</span>'
      );
    }

    return hasWebKit || hasMs || hasMediaSource;
  };

  init(strm: Stream): void {
    this.stream = strm;
    this.videoModel = strm.getVideoModel();
    this.element = this.videoModel.getElement();

    this.eventBus.addEventListener(
      'addKeyProcessed',
      this.onAddKeyProcessed.bind(this)
    );

    this.logHandler.log('EME' + this.videoModel, '#ff8080');

    if (this.supportsRequestMediaKeySystemAccess()) {
      this.protectionModel = new ProtectionModelRMKSA(
        this.params,
        this.eventBus
      );
      this.protectionModel.init(
        this.videoModel,
        this.stream,
        this.xhrCustom,
        ''
      );

      this.encryptedListener = this.onMediaSourceEncrypted.bind(this);
      this.protectionModel.listenToEncrypted(this.encryptedListener!);
    } else if (this.supportsMediaKeys() || this.supportsEME01b()) {
      if (this.supportsMediaKeys()) {
        this.logHandler.log('MediaKeys 1', '#ff8080');
        this.protectionModel = new ProtectionModel(this.params, this.eventBus);
        this.protectionModel.init(this.videoModel, this.xhrCustom);

        this.needKeyListener = this.onMediaSourceNeedsKey.bind(this);
        this.keyMessageListener = this.onMediaSourceKeyMessage.bind(this);
        this.keyAddedListener = this.onMediaSourceKeyAdded.bind(this);
        this.keyErrorListener = this.onMediaSourceKeyError.bind(this);
      } else if (this.supportsEME01b()) {
        this.logHandler.log('01b 1', '#ff8080');
        this.protectionModel = new ProtectionModelEME01b(
          this.params,
          this.eventBus
        );
        this.protectionModel.init(
          this.videoModel,
          this.xhrCustom,
          this.eme_prefix!
        );

        this.needKeyListener = this.onMediaSourceNeedsKeyEME01b.bind(this);
        this.keyMessageListener = this.onMediaSourceKeyMessageEME01b.bind(this);
        this.keyAddedListener = this.onMediaSourceKeyAddedEME01b.bind(this);
        this.keyErrorListener = this.onMediaSourceKeyErrorEME01b.bind(this);
        this.logHandler.log('01b 4', '#ff8080');
      }

      (this.protectionModel! as ProtectionModelEME01b).listenToNeedKey(
        this.needKeyListener!
      );
      (this.protectionModel! as ProtectionModelEME01b).listenToKeyMessage(
        this.keyMessageListener!
      );
      (this.protectionModel! as ProtectionModelEME01b).listenToKeyAdded(
        this.keyAddedListener!
      );
      (this.protectionModel! as ProtectionModelEME01b).listenToKeyError(
        this.keyErrorListener!
      );
    }
  }

  supportsProtection(): boolean {
    return (
      this.supportsMediaKeys.call(this) ||
      this.supportsEME01b.call(this) ||
      this.supportsRequestMediaKeySystemAccess.call(this)
    );
  }

  createMediaKeysFromMPD = (videoData, audioData): void => {
    if (this.supportsRequestMediaKeySystemAccess()) {
      this.createMediaKeysFromMPD_RMKS(videoData, audioData);
    } else if (this.supportsMediaKeys()) {
      this.createMediaKeysFromMPD_MED(videoData, audioData);
    } else if (this.supportsEME01b()) {
      this.createMediaKeysFromMPD_EME01b(videoData, audioData);
    } else {
    }
  };

  reset(): void {
    this.needsKeyProcessing = false;
    if (this.element) {
      this.element.mediaKeysObject = undefined;
    }
    if (this.needsKeyProcessingTimerId) {
      clearTimeout(this.needsKeyProcessingTimerId);
      this.needsKeyProcessingTimerId = null;
    }

    if (this.supportsRequestMediaKeySystemAccess()) {
      (this.protectionModel! as ProtectionModelRMKSA).unlistenToEncrypted(
        this.encryptedListener!
      );
      (this.protectionModel! as ProtectionModelRMKSA).reset();
    } else if (this.supportsMediaKeys() || this.supportsEME01b()) {
      (
        this.protectionModel! as ProtectionModelEME01b | ProtectionModel
      ).unlistenToNeedKey(this.needKeyListener!);
      (
        this.protectionModel! as ProtectionModelEME01b | ProtectionModel
      ).unlistenToKeyMessage(this.keyMessageListener!);
      (
        this.protectionModel! as ProtectionModelEME01b | ProtectionModel
      ).unlistenToKeyAdded(this.keyAddedListener!);
      (
        this.protectionModel! as ProtectionModelEME01b | ProtectionModel
      ).unlistenToKeyError(this.keyErrorListener!);
    }
  }
}
