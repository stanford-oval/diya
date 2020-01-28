// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 2 -*-
//
// This file is part of Nightmare
//
// Copyright 2020 The Board of Trustees of the Leland Stanford Junior University
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Author: Michael Fischer <mfischer@cs.stanford.edu>
//         Giovanni Campagna <gcampagn@cs.stanford.edu>
'use strict'

import annyang from 'annyang'
import finder from '@medv/finder'

export default class VoiceHandler {
  constructor () {
    this._mouse_x = 0
    this._mouse_y = 0
    this._current_click = null

    this._eventLog = []
  }

  start () {
    // always track mouse position
    document.addEventListener('mousemove', (event) => {
      this._mouse_x = event.pageX
      this._mouse_y = event.pageY
    })
    document.body.addEventListener('click', (event) => {
      this._current_click = event
    })


    // code to debug
    setTimeout(()=>{
      console.log("gesture starting")
    }, 1000)

    const commands = {
      'this is a *var_name': this.tagVariable.bind(this),
      'this is an *var_name': this.tagVariable.bind(this),
      'from here': this.gestureStart.bind(this),
      'to here': this.gestureStop.bind(this)
    }

    annyang.addCommands(commands)
    annyang.start()

    annyang.addCallback('result', function (whatWasHeardArray) {
      console.log('result')
      console.log(whatWasHeardArray)
      document.getElementById('transcript').textContent = whatWasHeardArray[0]
    })
    annyang.addCallback('resultNoMatch', function (whatWasHeardArray) {
      // ship to almond for processing...
    })

    annyang.addCallback('start', function (whatWasHeardArray) {
      document.getElementById('transcript').textContent = '[start]'
    })

    annyang.addCallback('soundstart', function () {
      document.getElementById('transcript').textContent = '[soundstart]'
    })
  }

  _sendMessage (msg) {
    try {
      // poor man's way of detecting whether this script was injected by an actual extension, or is loaded for
      // testing purposes
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.sendMessage(msg)
      } else {
        this._eventLog.push(msg)
      }
    } catch (err) {
      console.debug('caught error', err)
    }
  }

  gestureRecognizer (trail) {
    const selector = 'up' // 'down'
    switch (selector) {
      case 'up':
        this.selectColumn()
        break
      case 'down':
        this.selectRows()
        this.selectList()
        break
      default:
    }
  }

  gestureStart (selector) {
    var element = document.elementFromPoint(this._mouse_x, this._mouse_y)
    const type = element.is()
    switch (type) {
      case 'LI':
        break
      case 'TR':
        break
      default:
        break
    }
  }

  gestureStop (selector) {

  }

  selectRandom (selector) {

  }

  selectClass (selector) {

  }

  selectList (selector) {

  }

  selectColumn () {

  }

  selectRow () {

  }

  tagVariable (varName) {
    console.log('tagVariable', varName, this._current_click)

    if (!this._current_click) return

    if (this._current_click.target.tagName === 'TEXTAREA') {
      this._replaceSelectedTextArea(this._current_click.target, `[${varName}]`)
    }

    if (this._current_click.target.tagName === 'INPUT') {
      this._replaceSelectedInput(this._current_click.target, `[${varName}]`)
    }

    const optimizedMinLength = this._current_click.target.id ? 2 : 10 // if the target has an id, use that instead of multiple other selectors
    const selector = finder(this._current_click.target, {seedMinLength: 5, optimizedMinLength: optimizedMinLength})

    this._sendMessage({
      selector: selector,
      value: this._current_click.target.value,
      tagName: this._current_click.target.tagName,
      inputType: this._current_click.target.tagName === 'INPUT' ? this._current_click.target.type : null,
      selection: null,
      action: 'THIS_IS_A',
      varName: varName,
      keyCode: null,
      href: this._current_click.target.href ? this._current_click.target.href : null
    })
  }

  _getInputSelection (el) {
    var start = 0; var end = 0; var normalizedValue; var range

    var textInputRange; var len; var endRange

    if (typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
      start = el.selectionStart
      end = el.selectionEnd
    } else {
      range = document.selection.createRange()

      if (range && range.parentElement() === el) {
        len = el.value.length
        normalizedValue = el.value.replace(/\r\n/g, '\n')

        // Create a working TextRange that lives only in the input
        textInputRange = el.createTextRange()
        textInputRange.moveToBookmark(range.getBookmark())

        // Check if the start and end of the selection are at the very end
        // of the input, since moveStart/moveEnd doesn't return what we want
        // in those cases
        endRange = el.createTextRange()
        endRange.collapse(false)

        if (textInputRange.compareEndPoints('StartToEnd', endRange) > -1) {
          start = end = len
        } else {
          start = -textInputRange.moveStart('character', -len)
          start += normalizedValue.slice(0, start).split('\n').length - 1

          if (textInputRange.compareEndPoints('EndToEnd', endRange) > -1) {
            end = len
          } else {
            end = -textInputRange.moveEnd('character', -len)
            end += normalizedValue.slice(0, end).split('\n').length - 1
          }
        }
      }
    }

    return {
      start: start,
      end: end
    }
  }

  _replaceSelectedInput (el, text) {
    el.value = text
  }

  _replaceSelectedTextArea (el, text) {
    var sel = this._getInputSelection(el); var val = el.value
    el.value = val.slice(0, sel.start) + text + val.slice(sel.end)
  }
}