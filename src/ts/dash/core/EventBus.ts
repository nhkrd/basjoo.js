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
 * EventBus
 *
 * @module EventBus（EventBusモジュール）
 */

export class EventBus {
  registrations: EventRegistrations;

  /**
   * EventBus
   * @constructor
   */

  constructor() {
    this.registrations = {};
  }

  /**
   * EventListenerの取得
   * @param {string} type イベントの種類
   * @param {boolean} useCapture
   */

  getListeners = (
    type: string,
    useCapture: boolean
  ): Array<NXEventListener> => {
    const captype = `${useCapture ? '1' : '0'}${type}`;

    if (!(captype in this.registrations)) {
      this.registrations[captype] = [];
    }

    return this.registrations[captype];
  };

  /**
   * EventListenerの登録
   * @param {string} type イベントの種類
   * @param {NXEventListener} listener 登録する関数
   * @param {boolean} useCapture
   */
  addEventListener = (
    type: string,
    listener: NXEventListener,
    useCapture: boolean = false
  ): void => {
    const listeners = this.getListeners(type, useCapture);
    const idx = listeners.indexOf(listener);
    if (idx === -1) {
      listeners.push(listener);
    }
  };

  /**
   * EventListenerの削除
   * @param {string} type イベントの種類
   * @param {NXEventListener} listener 削除する関数
   * @param {boolean} useCapture
   */
  removeEventListener = (
    type: string,
    listener: NXEventListener,
    useCapture: boolean = false
  ): void => {
    const listeners = this.getListeners(type, useCapture);
    const idx = listeners.indexOf(listener);
    if (idx !== -1) {
      listeners.splice(idx, 1);
    }
  };

  /**
   * EventListenerの起動
   * @param {ExEvent} evt イベント
   */
  dispatchEvent = (evt: ExEvent): boolean => {
    const listeners = this.getListeners(evt.type, false).slice();
    for (let i = 0; i < listeners.length; i++) {
      listeners[i].call(this, evt);
    }
    return !evt.defaultPrevented;
  };

  /**
   * EventListenerのクリア(初期化)
   */
  clearAllEventListener = (): void => {
    this.registrations = {};
  };
}
