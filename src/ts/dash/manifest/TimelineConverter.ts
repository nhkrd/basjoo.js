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

/**
 * TimelineConverter
 *
 * @module TimelineConverter（TimelineConverterモジュール）
 */

import { Period } from './Period';
import { Mpd } from './Mpd';
import { Representation } from './Representation';
import { Segment } from './DashHandler';

function _calcAvailabilityTimeFromPresentationTime(
  presentationTime: number,
  mpd: Mpd,
  isDynamic: boolean,
  calculateEnd?: boolean
): Date {
  let availabilityTime: Date;

  if (calculateEnd) {
    //@timeShiftBufferDepth specifies the duration of the time shifting buffer that is guaranteed
    // to be available for a Media Presentation with type 'dynamic'.
    // When not present, the value is infinite.
    if (isDynamic && mpd.timeShiftBufferDepth != Number.POSITIVE_INFINITY) {
      availabilityTime = new Date(
        mpd.availabilityStartTime.getTime() +
          (presentationTime + mpd.timeShiftBufferDepth) * 1000
      );
    } else {
      availabilityTime = mpd.availabilityEndTime;
    }
  } else {
    if (isDynamic) {
      availabilityTime = new Date(
        mpd.availabilityStartTime.getTime() + presentationTime * 1000
      );
    } else {
      // in static mpd, all segments are available at the same time
      availabilityTime = mpd.availabilityStartTime;
    }
  }

  return availabilityTime;
}

const TimelineConverter = {
  calcAvailabilityStartTimeFromPresentationTime(
    presentationTime: number,
    mpd: Mpd,
    isDynamic: boolean
  ): Date {
    return _calcAvailabilityTimeFromPresentationTime.call(
      this,
      presentationTime,
      mpd,
      isDynamic
    );
  },

  calcAvailabilityEndTimeFromPresentationTime(
    presentationTime: number,
    mpd: Mpd,
    isDynamic: boolean
  ): Date {
    return _calcAvailabilityTimeFromPresentationTime.call(
      this,
      presentationTime,
      mpd,
      isDynamic,
      true
    );
  },

  // calcPresentationStartTime(period: Period): number {
  //   let presentationStartTime: number;
  //   let isDynamic: boolean;
  //   isDynamic = period.mpd!.type === 'dynamic';
  //   if (isDynamic) {
  //     presentationStartTime = period.mpd!.liveEdgeC;
  //   } else {
  //     presentationStartTime = period.start;
  //   }
  //   return presentationStartTime;
  // },

  calcPresentationTimeFromWallTime(wallTime: Date, period: Period): number {
    return (
      (wallTime.getTime() - period.mpd!.availabilityStartTime.getTime()) / 1000
    );
  },

  calcPresentationTimeFromMediaTime(
    mediaTime: number,
    representation: Representation
  ): number {
    const offset: number = representation.adaptation!.period!.offset;
    const presentationOffset: number = representation.presentationTimeOffset!;

    return offset - presentationOffset + mediaTime;
  },

  calcMediaTimeFromPresentationTime(
    presentationTime: number,
    representation: Representation
  ): number {
    const offset: number = representation.adaptation!.period!.offset;

    return presentationTime - offset;
  },

  calcWallTimeForSegment(segment: Segment, isDynamic: boolean): Date | number {
    if (!isDynamic) {
      return NaN;
    }

    const suggestedPresentationDelay: Nullable<number> =
      segment.representation!.adaptation!.period!.mpd!
        .suggestedPresentationDelay;
    const displayStartTime: number =
      segment.presentationStartTime + suggestedPresentationDelay!;
    const wallTime: Date =
      typeof segment.availabilityStartTime == 'number'
        ? new Date(segment.availabilityStartTime + displayStartTime * 1000)
        : new Date(
            segment.availabilityStartTime.getTime() + displayStartTime * 1000
          );
    return wallTime;
  },

  //NSV-a  const usePublishTime = (representation, duration) => {
  //NSV-a    const publishTime = representation.adaptation.period.mpd.publishTime,
  //NSV-a      isSegmentTemplate = representation.segmentInfoType == 'SegmentTemplate';
  //NSV-a
  //NSV-a    if (isNaN(publishTime)) return false;
  //NSV-a    if (isNaN(duration)) return false;
  //NSV-a
  //NSV-a    if (isSegmentTemplate) {
  //NSV-a      const startTime =
  //NSV-a        representation.adaptation.period.mpd.availabilityStartTime;
  //NSV-a      if (publishTime.getTime() - startTime.getTime() > 2000 * duration) {
  //NSV-a        return true;
  //NSV-a      } else {
  //NSV-a        return false;
  //NSV-a      }
  //NSV-a    } else {
  //NSV-a      return true;
  //NSV-a    }
  //NSV-a  };

  calcSegmentAvailabilityRange(
    representation: Representation,
    isDynamic: boolean
  ): TimeRange {
    const duration: number = representation.segmentDuration;
    const period: Period = representation.adaptation!.period!;
    let periodStart: number = period.start;
    let periodEnd: number = periodStart + period.duration;

    if (!isDynamic) {
      return {
        start: periodStart,
        end: periodEnd,
      };
    }

    const periods: Array<Period> = period.mpd!.periods;

    const isClientServerTimeSyncCompleted: boolean =
      period.isClientServerTimeSyncCompletedForTC;

    const clientServerTimeShift: number = period.clientServerTimeShift;

    if (
      (!isClientServerTimeSyncCompleted || isNaN(duration)) &&
      representation.segmentAvailabilityRange
    ) {
      return representation.segmentAvailabilityRange;
    }

    const currentPresentationTime = this.calcPresentationTimeFromWallTime(
      new Date(new Date().getTime() + clientServerTimeShift),
      period
    );

    const now =
      period.liveEdgeFromRequest > 0
        ? Math.max(currentPresentationTime, period.liveEdgeFromRequest)
        : currentPresentationTime;

    if (period.start === periods[0].start)
      periodStart = Math.max(
        now -
          period.mpd!.timeShiftBufferDepth -
          duration -
          period.mpd!.timestampOffsetFor32bitVE,
        0
      );

    if (period.start === periods[periods.length - 1].start)
      periodEnd = Math.max(
        now -
          duration +
          representation.availabilityTimeOffset -
          period.mpd!.timestampOffsetFor32bitVE,
        0
      );

    return {
      start: periodStart,
      end: periodEnd,
      now: periodEnd,
    };
  },

  // calcMSETimeOffset(representation: Representation): number {
  //   const period: Period = representation.adaptation!.period!;
  //   return period.offset;
  // },
};

export default TimelineConverter;
