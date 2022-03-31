/*
 * The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Digital Primates
 * Copyright (c) 2022, NHK(Japan Broadcasting Corporation).
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * - Neither the names of the copyright holders nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { SegmentRequest } from '../manifest/DashHandler';
import { EventBus } from './EventBus';
import { ManifestModel } from '../manifest/ManifestModel';

/**
 * ErrorHandler
 *
 * @module ErrorHandler（ErrorHandlerモジュール）
 */

/**
 * ErrorHandler
 * @constructor
 */
const ErrorHandler = {
  capabilityError(eventBus: EventBus, err: NXCustomEvent | string): void {
    eventBus.dispatchEvent({
      type: 'error',
      error: 'capability',
      event: err,
    });
  },

  downloadError(
    eventBus: EventBus,
    id: string,
    url: string,
    request: { url: string } | ExXMLHttpRequest,
    _request?: SegmentRequest
  ): void {
    eventBus.dispatchEvent({
      type: 'error',
      error: 'download',
      event: {
        id,
        url,
        request,
        _request,
      },
    });
  },

  manifestError(
    eventBus: EventBus,
    message: string,
    id: string,
    manifest: ManifestModel | string
  ): void {
    eventBus.dispatchEvent({
      type: 'error',
      error: 'manifestError',
      event: {
        message,
        id,
        manifest,
      },
    });
  },

  // closedCaptionsError(
  //   eventBus: EventBus,
  //   message: string,
  //   id: string,
  //   ccContent: any
  // ): void {
  //   eventBus.dispatchEvent({
  //     type: 'error',
  //     error: 'cc',
  //     event: {
  //       message,
  //       id,
  //       cc: ccContent,
  //     },
  //   });
  // },

  mediaSourceError(eventBus: EventBus, err: NXCustomEvent | string): void {
    eventBus.dispatchEvent({
      type: 'error',
      error: 'mediasource',
      event: err,
    });
  },

  mediaKeySessionError(eventBus: EventBus, err: NXCustomEvent | string): void {
    eventBus.dispatchEvent({
      type: 'error',
      error: 'key_session',
      event: err,
    });
  },

  mediaKeyMessageError(eventBus: EventBus, err: NXCustomEvent | string): void {
    eventBus.dispatchEvent({
      type: 'error',
      error: 'key_message',
      event: err,
    });
  },

  mediaKeySystemSelectionError(eventBus: EventBus, err: NXCustomEvent): void {
    eventBus.dispatchEvent({
      type: 'error',
      error: 'key_system_selection',
      event: err,
    });
  },
};

export default ErrorHandler;
