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

import { EventBus } from '../core/EventBus';
import MetricsModel from './MetricsModel';
import { FragmentModel } from './FragmentModel';
import { SegmentRequest } from '../manifest/DashHandler';
import { BufferController } from './BufferController';

/**
 * FragmentController
 *
 * @module FragmentController（FragmentControllerモジュール）
 */

/**
 * FragmentController
 * @constructor
 */
export class FragmentController {
  fragmentModels: Array<FragmentModel>;
  params: Paramstype;
  eventBus: EventBus;
  metricsModel: MetricsModel;
  xhrCustom: XHRCustom;

  constructor(
    params: Paramstype,
    eventBus: EventBus,
    metricsModel: MetricsModel,
    xhrCustom: XHRCustom
  ) {
    this.fragmentModels = []; //NSV-a,
    this.params = params;
    this.eventBus = eventBus;
    this.metricsModel = metricsModel;
    this.xhrCustom = xhrCustom;
  }

  findModel = (bufferController: BufferController): Nullable<FragmentModel> => {
    const ln: number = this.fragmentModels.length;
    // We expect one-to-one relation between FragmentModel and BufferController,
    // so just compare the given BufferController object with the one that stored in the model to find the model for it
    for (let i = 0; i < ln; i++) {
      if (this.fragmentModels[i].getContext() == bufferController) {
        return this.fragmentModels[i];
      }
    }

    return null;
  };

  //NSV-a const isReadyToLoadNextFragment = () => {
  //NSV-a   let isReady = true;
  //NSV-a   const ln = fragmentModels.length;
  //NSV-a   // Loop through the models and check if all of them are in the ready state
  //NSV-a   for (let i = 0; i < ln; i++) {
  //NSV-a     if (!fragmentModels[i].isReady()) {
  //NSV-a       isReady = false;
  //NSV-a       break;
  //NSV-a     }
  //NSV-a   }
  //NSV-a
  //NSV-a   return isReady;
  //NSV-a };

  // executeRequests2 = (): void => {
  //   for (let i = 0; i < this.fragmentModels.length; i++) {
  //     if (this.fragmentModels[i].isReady()) {
  //       this.fragmentModels[i].executeCurrentRequest();
  //     }
  //   }
  // };

  //NSV-a const executeRequests = () => {
  //NSV-a   for (let i = 0; i < fragmentModels.length; i++) {
  //NSV-a     fragmentModels[i].executeCurrentRequest();
  //NSV-a   }
  //NSV-a };
  //NSV-a const checkForExistence = (request, _callback) => {
  //NSV-a   const callback = _callback || (() => {});
  //NSV-a   if (!request) {
  //NSV-a     callback({
  //NSV-a       status: 'ok',
  //NSV-a       data: null,
  //NSV-a     });
  //NSV-a     return;
  //NSV-a   }
  //NSV-a
  //NSV-a   const req = new XMLHttpRequest();
  //NSV-a   let isSuccessful = false;
  //NSV-a
  //NSV-a   req.open('HEAD', request.url, true);
  //NSV-a
  //NSV-a   req.onload = () => {
  //NSV-a     if (req.status < 200 || req.status > 299) {
  //NSV-a     } else {
  //NSV-a       isSuccessful = true;
  //NSV-a
  //NSV-a       callback({
  //NSV-a         status: 'ok',
  //NSV-a         data: request,
  //NSV-a       });
  //NSV-a     }
  //NSV-a   };
  //NSV-a
  //NSV-a   req.onloadend = req.onerror = () => {
  //NSV-a     if (!isSuccessful) {
  //NSV-a       callback({
  //NSV-a         status: 'error',
  //NSV-a         msg: 'checkForExistence error',
  //NSV-a       });
  //NSV-a     }
  //NSV-a   };
  //NSV-a
  //NSV-a   req.send();
  //NSV-a };

  attachBufferController = (
    bufferController: BufferController
  ): Nullable<FragmentModel> => {
    if (!bufferController) return null;
    // Wrap the buffer controller into model and store it to track the loading state and execute the requests
    let model: Nullable<FragmentModel> = this.findModel(bufferController);

    if (!model) {
      model = new FragmentModel(
        this.params,
        this.eventBus,
        this.metricsModel.getMetricsFor(bufferController.getType()),
        this.xhrCustom
      );
      model.setContext(bufferController);
      this.fragmentModels.push(model);
    }
    return model;
  };

  detachBufferController = (bufferController: FragmentModel): void => {
    const idx: number = this.fragmentModels.indexOf(bufferController);
    // If we have the model for the given buffer just remove it from array
    if (idx > -1) {
      this.fragmentModels.splice(idx, 1);
    }
  };

  // onBufferControllerStateChange = (): void => {
  //   this.executeRequests2.call(this);
  // };

  isFragmentLoadedOrPending = (
    bufferController: BufferController,
    request: SegmentRequest
  ): boolean => {
    const fragmentModel: Nullable<FragmentModel> =
      this.findModel(bufferController);
    let isLoaded: boolean;

    if (!fragmentModel) {
      return false;
    }

    isLoaded = fragmentModel.isFragmentLoadedOrPending(
      request,
      bufferController.getBuffer()!.queue!,
      bufferController.getTolerance()
    );

    return isLoaded;
  };

  isFragmentLoadingOrPending = (
    bufferController: BufferController,
    request: SegmentRequest
  ): boolean => {
    const fragmentModel: Nullable<FragmentModel> =
      this.findModel(bufferController);
    let isLoaded: boolean;

    if (!fragmentModel) {
      return false;
    }

    isLoaded = fragmentModel.isFragmentLoadingOrPending(
      request,
      bufferController.getBuffer()!.queue!,
      bufferController.getTolerance()
    );

    return isLoaded;
  };

  getExecutedRequests = (
    bufferController: BufferController
  ): Nullable<Array<SegmentRequest>> => {
    const fragmentModel: Nullable<FragmentModel> =
      this.findModel(bufferController);

    if (!fragmentModel) {
      return null;
    }

    return fragmentModel.getExecutedRequests();
  };

  getPendingRequests = (
    bufferController: BufferController
  ): Nullable<Array<SegmentRequest>> => {
    const fragmentModel: Nullable<FragmentModel> =
      this.findModel(bufferController);

    if (!fragmentModel) {
      return null;
    }

    return fragmentModel.getPendingRequests();
  };

  getLoadingRequests = (
    bufferController: BufferController
  ): Nullable<Array<SegmentRequest>> => {
    const fragmentModel: Nullable<FragmentModel> =
      this.findModel(bufferController);

    if (!fragmentModel) {
      return null;
    }

    return fragmentModel.getLoadingRequests();
  };

  needToPrepareNewRequest = (
    bufferController: BufferController
  ): Nullable<boolean> => {
    const fragmentModel: Nullable<FragmentModel> =
      this.findModel(bufferController);

    if (!fragmentModel) {
      return null;
    }

    return fragmentModel.needToPrepareNewRequest();
  };

  isInitializationRequest = (request: SegmentRequest): boolean => {
    if (
      request &&
      request.type &&
      request.type.toLowerCase() === 'initialization segment'
    )
      return true;
    return false;
  };

  // getLoadingTime = (bufferController: BufferController): Nullable<number> => {
  //   const fragmentModel: Nullable<FragmentModel> = this.findModel(
  //     bufferController
  //   );
  //   if (!fragmentModel) {
  //     return null;
  //   }
  //   return fragmentModel.getLoadingTime();
  // };

  getExecutedRequestForTime = (
    model: Nullable<FragmentModel>,
    time: number
  ): Nullable<SegmentRequest> => {
    if (model) {
      return model.getExecutedRequestForTime(time);
    }

    return null;
  };

  removeExecutedRequest = (
    model: Nullable<FragmentModel>,
    request: SegmentRequest
  ): void => {
    if (model) {
      model.removeExecutedRequest(request);
    }
  };

  removeExecutedRequestsBeforeTime = (
    model: Nullable<FragmentModel>,
    time: number
  ): void => {
    if (model) {
      model.removeExecutedRequestsBeforeTime(time);
    }
  };

  // cancelPendingRequestsForModel = (model: Nullable<FragmentModel>): void => {
  //   if (model) {
  //     model.cancelPendingRequests();
  //   }
  // };

  clearAllRequestsForModel = (model: Nullable<FragmentModel>): void => {
    if (model) {
      model.clearAllRequests();
    }
  };

  abortRequestsForModel = (model: Nullable<FragmentModel>): void => {
    if (model) {
      model.abortRequests();
    }
  };

  isFragmentExists = (
    bfController: BufferController,
    request: SegmentRequest,
    _callback: (val: boolean) => void
  ): void => {
    const callback: (val: boolean) => void = _callback || (() => {});
    const fragmentModel: Nullable<FragmentModel> = this.findModel(bfController);

    if (!fragmentModel) {
      callback(false);
      return;
    }

    fragmentModel.checkForExistence.call(this, request, (d) => {
      if (d.status === 'ok') {
        if (d.data != null) {
          callback(true);
        } else {
          callback(false);
        }
      } else {
        callback(false);
      }
    });
  };

  prepareFragmentForLoading = (
    bufferController: BufferController,
    startLoadingCallback: (request: SegmentRequest) => void,
    successLoadingCallback: (
      request: SegmentRequest,
      response: Uint8Array
    ) => void,
    errorLoadingCallback: (type: string, request: SegmentRequest) => void,
    streamEndCallback: (request: SegmentRequest) => void,
    firstChunkLoadingCallback: (request: SegmentRequest) => number | ChunkQ,
    chunkLoadingCallback: (done: boolean, q: ChunkQ, _in: Uint8Array) => void,
    errorChunkLoadingCallback: (chunkQ: Nullable<ChunkQ>) => void
  ): Nullable<boolean> => {
    const fragmentModel: Nullable<FragmentModel> =
      this.findModel(bufferController);
    if (!fragmentModel) {
      return null;
    }
    fragmentModel.setCallbacks(
      startLoadingCallback,
      successLoadingCallback,
      errorLoadingCallback,
      streamEndCallback,
      firstChunkLoadingCallback,
      chunkLoadingCallback,
      errorChunkLoadingCallback
    );
    return true;
  };

  reset = (): void => {
    for (let i = 0; i < this.fragmentModels.length; i++) {
      this.clearAllRequestsForModel(this.fragmentModels[i]);
    }
    this.fragmentModels = [];
  };
}
