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

//
// Focus Navigator
//

function displog(txt) {
//	document.getElementById("log").innerHTML = txt;
}

//
// FocusNavi
//
function FocusNavi() {
  var keyCodes = {'LEFT':37, 'UP':38, 'RIGHT':39, 'DOWN':40};
  var elemList = [];
  var handlersList = [];

  //
  // getAbsolutePos
  //
  function getAbsolutePos(element) {
    var absoLeft = element.offsetLeft;
    var absoTop = element.offsetTop;
    var eParent = element.offsetParent;
    while (eParent && eParent !== document.body) {
      absoLeft += eParent.offsetLeft;
      absoTop  += eParent.offsetTop;
      eParent = eParent.offsetParent;
    }
    return {'element':element, 'top':absoTop, 'bottom':absoTop+element.offsetHeight, 'left':absoLeft, 'right':absoLeft+element.offsetWidth };
  }

  //
  // getDistance
  //
  function getDistance(fromElem, toElem, direction) {
    var distX = (fromElem.left+fromElem.right) - (toElem.left+toElem.right);
    var distY = (fromElem.top+fromElem.bottom) - (toElem.top+toElem.bottom);
    var distL = 0;
    var distR = 0;
    var distT = 0;
    var distB = 0;

    if( direction == 'UP' ) {
      distT = fromElem.top - toElem.top;
      distB = fromElem.bottom - toElem.bottom;
      distL = fromElem.left - toElem.left;
      distR = fromElem.right - toElem.right;
      if( distL < 0 ) { distL = distL * (-1); }
      if( distR < 0 ) { distR = distR * (-1); }
    }
    else if( direction == 'DOWN' ) {
      distT = toElem.top - fromElem.top;
      distB = toElem.bottom - fromElem.bottom;
      distL = fromElem.left - toElem.left;
      distR = fromElem.right - toElem.right;
      if( distL < 0 ) { distL = distL * (-1); }
      if( distR < 0 ) { distR = distR * (-1); }
    }
    else if( direction == 'LEFT' ) {
      distL = fromElem.left - toElem.left;
      distR = fromElem.right - toElem.right;
      distT = fromElem.top - toElem.top;
      distB = fromElem.bottom - toElem.bottom;
      if( distT < 0 ) { distT = distT * (-1); }
      if( distB < 0 ) { distB = distB * (-1); }
    }
    else if( direction == 'RIGHT' ) {
      distL = toElem.left - fromElem.left;
      distR = toElem.right - fromElem.right;
      distT = fromElem.top - toElem.top;
      distB = fromElem.bottom - toElem.bottom;
      if( distT < 0 ) { distT = distT * (-1); }
      if( distB < 0 ) { distB = distB * (-1); }
    }

    if( distX < 0 ) { distX = distX * (-1); }
    if( distY < 0 ) { distY = distY * (-1); }

    var minX = distX;
    if( distL < minX ) { minX = distL; }
    if( distR < minX ) { minX = distR; }
    var minY = distY;
    if( distT < minY ) { minY = distT; }
    if( distB < minY ) { minY = distB; }

    return {'x':distX, 'y':distY, 'L':distL, 'R':distR, 'T':distT, 'B':distB, 'minX':minX , 'minY':minY };
  }

  //
  // isProperDirection
  //
  function isProperDirection(fromElem, toElem, direction) {
    var retc = false;
    var check1 = 0;
    var check2 = 0;

    if( toElem.element.offsetParent ) {
      if( direction == 'UP' ) {
        check1 = fromElem.top - toElem.top;
        check2 = fromElem.bottom - toElem.bottom;
      }
      else if( direction == 'DOWN' ) {
        check1 = toElem.top - fromElem.top;
        check2 = toElem.bottom - fromElem.bottom;
      }
      else if( direction == 'LEFT' ) {
        check1 = fromElem.left - toElem.left;
        check2 = fromElem.right - toElem.right;
      }
      else if( direction == 'RIGHT' ) {
        check1 = toElem.left - fromElem.left;
        check2 = toElem.right - fromElem.right;
      }

      if( (0 <= check1) && (0 <= check2) && !((0 == check1)&&(0 == check2)) ) {
          retc = true;
      }
    }

//console.log( fromElem.top + ' ' +  fromElem.right + ' ' +  fromElem.bottom  + ' ' +  fromElem.left );
//console.log( toElem.element.offsetParent  + ' ' + toElem.top + ' ' +  toElem.right + ' ' +  toElem.bottom  + ' ' +  toElem.left + ' ' + retc );
    return retc;
}

  //
  // isSelectNewElem
  //
  function isSelectNewElem( curElem, newElem, direction ) {
    var retc = null;
    if( (direction == 'UP') || (direction == 'DOWN') ) {
      retc = (newElem.distance.minX < curElem.distance.minX)
           || ((newElem.distance.minX == curElem.distance.minX) && (newElem.distance.minY < curElem.distance.minY))
           || ((newElem.distance.minX == curElem.distance.minX) && (newElem.distance.minY == curElem.distance.minY) && (newElem.distance.y < curElem.distance.y) ) ;
    }
    else if( (direction == 'LEFT') || (direction == 'RIGHT') ) {
      retc = (newElem.distance.minY < curElem.distance.minY)
           || ((newElem.distance.minY == curElem.distance.minY) && (newElem.distance.minX < curElem.distance.minX))
           || ((newElem.distance.minY == curElem.distance.minY) && (newElem.distance.minX == curElem.distance.minX) && (newElem.distance.x < curElem.distance.x)) ;
    }
    return retc;
  }

  //
  // selectNextElem
  //
  function selectNextElem( elemList, direction ) {
    var nextElem = null;
    if( 0 < elemList.length ) {
      nextElem = elemList[0];
      for( var i=1; i<elemList.length ; i++ ) {
        if( isSelectNewElem( nextElem, elemList[i], direction ) ) {
          nextElem = elemList[i];
        }
      }
    }
    return nextElem;
  }

  //
  // onkeydown
  //
  var onkeydown = function(event) {
    var nextElem = null;
    var nextElemList = [];

//console.log( event.keyCode );
//displog( event.keyCode );

    for( var keyName in keyCodes ) {
      if( event.keyCode == keyCodes[keyName] ) {
        var fromElem = getAbsolutePos(event.target);
        for (var i = 0; i < elemList.length; i++) {
          if( event.target !== elemList[i] ) {
            var elemPos = getAbsolutePos( elemList[i] );
//console.log( keyName + ' ' + elemList[i] );
            if( isProperDirection(fromElem, elemPos, keyName) ) {
              elemPos['distance'] = getDistance(fromElem, elemPos, keyName);
              nextElemList.push(elemPos);
            }
          }
        }
//console.log( nextElemList );

        nextElem = selectNextElem( nextElemList, keyName );
        if( nextElem ) {
//console.log( nextElem );
          nextElem.element.focus();
        }

        event.stopPropagation();
        event.preventDefault();
        break;
      }
    }
  }

  //
  // init
  //
  this.init = function() {
    elemList = [];
    handlersList = [];

    var elements = document.getElementsByClassName('focusable');
    for (var i = 0; i < elements.length; ++i) {
      elemList.push( elements[i] );
      handlersList.push(elements[i].addEventListener('keydown', onkeydown));
    }
    var elements = document.getElementsByTagName('A');
    for (var i = 0; i < elements.length; ++i) {
      elemList.push( elements[i] );
      handlersList.push(elements[i].addEventListener('keydown', onkeydown));
    }
  };
}
