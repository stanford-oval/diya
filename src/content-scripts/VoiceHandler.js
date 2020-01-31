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
    this._mouse_x_current = 0
    this._mouse_y_current = 0
    this._mouse_x_start = 0
    this._mouse_y_start = 0
    this._mouse_x_stop = 0
    this._mouse_y_stop = 0
    this._delta_x = 0
    this._delta_y = 0
    this._current_click = null
    this._selection = null

    this._eventLog = []
  
}
  start () {

    let color = 1

    this._selection = Selection.create({

        // Class for the selection-area
        class: 'selection',

        // All elements in this container can be selected
        // selectables: ['div'],
        selectables: ['.box-wrap > div', 'li', 'td', 'a'],

        // The container is also the boundary in this case
        // boundaries: ['.box-wrap']
    })
    .on('start', ({inst, selected, oe}) => {

        // Remove class if the user isn't pressing the control key or ⌘ key
        if (!oe.ctrlKey && !oe.metaKey) {

            // Unselect all elements
            for (const el of selected) {
                el.classList.remove('selected');
                inst.removeFromSelection(el);
            }

            // Clear previous selection
            inst.clearSelection();
        }
    })
    .on('move', (event) => {
        // {changed: {removed, added}}

        let removed = event.changed.removed;
        let added = event.changed.added;

        // Add a custom class to the elements that where selected.
        for (const el of added) {
            el.classList.add('selected');
        }

        // Remove the class from elements that where removed
        // since the last selection
        for (const el of removed) {
            el.classList.remove('selected');
        }
    })
    .on('stop', ({inst}) => {
        // Remember selection in case the user wants to add smth in the next one
        inst.keepSelection();

        // console.log(this._selection.option('class'))
        // console.log(this._selection.option('class', 'selection_2'))


    });

    // this._selection.disable() 


    // const background_style = 'background-color:#CCF'
    // const $table = $("#restaurants")
    // $table.find("td").click(function(){
    //     $('table tr > td, table tr > th').attr('style', 'background-color:none;')
    //     const $this = $(this)
    //     const index = $this.parent().children().index($this) + 1
    //     $('table tr > td:nth-child(' + index + ')').attr('style', background_style)
    //     $('table tr > th:nth-child(' + index + ')').addClass('selected')
    // })
    // let $select = $("#groceries")
    // $select.click((event)=>{
    //     $('.selected').removeClass('.selected')
    //     $(event.currentTarget).find("li").addClass('selected')
    // })
    // $select = $("#directions")
    // $select.click((event)=>{
    //     $('.selected').removeClass('.selected')
    //     $(event.currentTarget).find("li").addClass('selected')
    // })

    document.addEventListener('keyup', (event) => {
      if (event.key === "Escape") { // escape key maps to keycode `27`
        this.selectClear()
      }
    })

    // always track mouse position
    document.addEventListener('mousemove', (event) => {
      this._mouse_x = event.pageX
      this._mouse_y = event.pageY
    })
    document.body.addEventListener('click', (event) => {
      this._current_click = event
    })

    const commands = {
      'this is a *var_name': this.tagVariable.bind(this),
      'this is an *var_name': this.tagVariable.bind(this),
      'these are *var_name': this.tagVariable.bind(this),
      'this variable is a *var_name': this.tagVariable.bind(this),

      'call this program *var_name': this.nameProgram.bind(this),
      'call this command *var_name': this.nameProgram.bind(this),
      'name this command *var_name': this.nameProgram.bind(this),
      'name this program *var_name': this.nameProgram.bind(this),
      'this program is *var_name': this.nameProgram.bind(this),
      'this program is called *var_name': this.nameProgram.bind(this),
      'this program should be called *var_name': this.nameProgram.bind(this),

      'from here': this.gestureStart.bind(this),
      'to here': this.gestureStop.bind(this),
      'more like this': this.selectClass.bind(this),
      'clear selected': this.selectClear.bind(this),
      'start selection': this.selectStart.bind(this),
      'start select': this.selectStart.bind(this),
      'stop selection': this.selectStop.bind(this),
      'stop select': this.selectStop.bind(this),
    }

    annyang.addCommands(commands)
    annyang.start()

    annyang.addCallback('result', function (whatWasHeardArray) {
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

  selectStart () {
    this._selection.cancel()
    this._selection.enable()
  }

  selectStop () {
    this._selection.cancel()
    this._selection.disable()
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



  selectClear (selected) {
    this._selection.cancel() 
  }

  gestureStart (selector) {
    console.log(this._mouse_x, this._mouse_y)

    this._mouse_x_start = this._mouse_x
    this._mouse_y_start = this._mouse_y


    // var element = document.elementFromPoint(this._mouse_x, this._mouse_y)
    // const type = element.is()
    // switch (type) {
    //   case 'LI':
    //     break
    //   case 'TR':
    //     break
    //   default:
    //     break
    // }
  }


  gestureStop (selector) {
    this._mouse_x_stop = this._mouse_x
    this._mouse_y_stop = this._mouse_y

    this._delta_x = this._mouse_x_start - this._mouse_x_stop
    this._delta_y = this._mouse_y_start - this._mouse_y_stop

    console.log(this._delta_x, this._delta_x)


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

  nameProgram (varName) {
    this._sendMessage({
      action: 'NAME_PROGRAM',
      varName: varName
    })
  }

  tagVariable (varName) {
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
