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
'use strict';

import annyang from 'annyang';
import finder from '@medv/finder';
import actions from '../models/extension-ui-actions';

export default class VoiceHandler {
  constructor() {
    this._mouse_x_current = 0;
    this._mouse_y_current = 0;
    this._mouse_x_start = 0;
    this._mouse_y_start = 0;
    this._mouse_x_stop = 0;
    this._mouse_y_stop = 0;
    this._delta_x = 0;
    this._delta_y = 0;
    this._current_click = null;
    this._selection = null;
    this._selectedElements = new Set();
    this._programNameCurrent = "";

    this._eventLog = [];
  }

  start() {


    var port = chrome.runtime.connect();
    port.postMessage({joke: "Knock knock"});
    port.onMessage.addListener((msg) => {
      if (msg.action == "STOP_RECORDING"){
        this._speak("what would you like to name this program?")
      }
      if (msg.action == "paramsMissing"){
        const input = msg.paramsMissing;
        const last = input.pop();
        const result = input.join(', ') + ' and ' + last;

        this._speak("Please select the " + result)
        this.selectStart()

      }
    })

    // var port2 = chrome.extension.connect({ name: 'recordControls' })
    // port2.onMessage.addListener((msg) => {
    //   if (msg.action == "paramsUpdated"){
    //     console.log("missing parsms")
    //   }
    // })



    this._selection = Selection.create({
      // Class for the selection-area
      class: 'selection',

      // All elements in this container can be selected
      // selectables: ['div'],
      selectables: ['.box-wrap > div', 'li', 'td', 'a'],

      // The container is also the boundary in this case
      // boundaries: ['.box-wrap']
    })
      .on('start', ({ inst, selected, oe }) => {
        // Remove class if the user isn't pressing the control key or ⌘ key
        if (!oe.ctrlKey && !oe.metaKey) {
          // Clear previous selection
          for (let el of this._selectedElements) {
            el.classList.remove('selected');
          }
          this._selectedElements.clear();
          inst.clearSelection();
        }
      })
      .on('move', event => {
        // {changed: {removed, added}}

        let removed = event.changed.removed;
        let added = event.changed.added;

        // Add a custom class to the elements that where selected.
        for (const el of added) {
          this._selectedElements.add(el);
          el.classList.add('selected');
        }

        // Remove the class from elements that where removed
        // since the last selection
        for (const el of removed) {
          this._selectedElements.remove(el);
          el.classList.remove('selected');
        }
      })
      .on('stop', ({ inst }) => {
        // Remember selection in case the user wants to add smth in the next one
        inst.keepSelection();

        // console.log(this._selection.option('class'))
        // console.log(this._selection.option('class', 'selection_2'))
      });
    this._selection.disable();


    document.addEventListener('keyup', event => {
      if (event.key === 'Escape') {
        // escape key maps to keycode `27`
        this.selectClear();
      }
    });

    // always track mouse position
    document.addEventListener('mousemove', event => {
      this._mouse_x = event.pageX;
      this._mouse_y = event.pageY;
    });
    document.body.addEventListener('click', event => {
      this._current_click = event;
    });

    const commands = {
      'this is a *var_name': this.tagVariable.bind(this),
      'this is an *var_name': this.tagVariable.bind(this),
      'these are *var_name': this.tagVariable.bind(this),
      'this variable is a *var_name': this.tagVariable.bind(this),

      'call this program :var_name': this.nameProgram.bind(this),
      'call this command :var_name': this.nameProgram.bind(this),
      'name this command :var_name': this.nameProgram.bind(this),
      'name this program :var_name': this.nameProgram.bind(this),
      'this program is :var_name': this.nameProgram.bind(this),
      'this program is called :var_name': this.nameProgram.bind(this),
      'this program should be called :var_name': this.nameProgram.bind(this),

      'call :prog_name with :var_name': this.runProgram.bind(this),
      'run :prog_name with :var_name': this.runProgram.bind(this),
      'call :prog_name using :var_name': this.runProgram.bind(this),
      'run :prog_name using :var_name': this.runProgram.bind(this),
      'call :prog_name using :v1 and :v2': this.runProgram.bind(this),
      'call :prog_name with :v1 and :v2': this.runProgram.bind(this),
      'run :prog_name using :v1 and :v2': this.runProgram.bind(this),
      'call :prog_name': this.runProgram.bind(this),
      'run :prog_name': this.runProgram.bind(this),

      // Conditionals
      'call :prog_name if :var_name is at least :value': this.runProgramIfAtLeast.bind(this),
      'run :prog_name if :var_name is at least :value': this.runProgramIfAtLeast.bind(this),
      'call :prog_name if :var_name equals :value': this.runProgramIfEqual.bind(this),
      'run :prog_name if :var_name equals :value': this.runProgramIfEqual.bind(this),
      'call :prog_name if :var_name is at most :value': this.runProgramIfAtMost.bind(this),
      'run :prog_name if :var_name is at most :value': this.runProgramIfAtMost.bind(this),
      'call :prog_name if :var_name more than :value': this.runProgramIfAtMost.bind(this),
      'run :prog_name if :var_name more than :value': this.runProgramIfAtMost.bind(this),
      'call :prog_name if :var_name greater than :value': this.runProgramIfAtMost.bind(this),
      'run :prog_name if :var_name greater than :value': this.runProgramIfAtMost.bind(this),

      'watch this': this.recordingStart.bind(this),
      'start recording': this.recordingStart.bind(this),
      'stop recording': this.recordingStop.bind(this),
      'ok done': this.recordingStop.bind(this),

      // Run program with scheduling
      'run :prog_name at *time': this.scheduleProgram.bind(this),
      'run :prog_name with :var_name at *time': this.scheduleProgram.bind(this),

      //'from here': this.gestureStart.bind(this),
      //'to here': this.gestureStop.bind(this),
      //'more like this': this.selectClass.bind(this),
      //'clear selected': this.selectClear.bind(this),
      'begin selection': this.selectStart.bind(this),
      'start selection': this.selectStart.bind(this),
      'start select': this.selectStart.bind(this),
      'stop selection': this.selectStop.bind(this),
      'stop select': this.selectStop.bind(this),
      'end selection': this.selectStop.bind(this),
    };

    annyang.addCommands(commands);
    annyang.start();

    annyang.addCallback('result', function(whatWasHeardArray, ...data) {
      console.log('annyang result', data);
      document.getElementById('transcript').textContent = whatWasHeardArray[0];
    });
    annyang.addCallback('resultNoMatch', function(whatWasHeardArray, ...data) {
      // ship to almond for processing...
      console.log('no match', whatWasHeardArray, data);
    });

    annyang.addCallback('start', function(whatWasHeardArray) {
      document.getElementById('transcript').textContent = '[start]';
    });

    annyang.addCallback('soundstart', function() {
      document.getElementById('transcript').textContent = '[soundstart]';
    });

    annyang.addCallback('error', function(str) {
      document.getElementById('transcript').textContent = '[error] ' + str;
      console.log(str)
    });

    annyang.addCallback('errorNetwork', function() {
      document.getElementById('transcript').textContent = '[errorNetwork]';
    });

    annyang.addCallback('errorPermissionBlocked', function() {
      document.getElementById('transcript').textContent = '[errorPermissionBlocked]';
    });

    annyang.addCallback('errorPermissionDenied', function() {
      document.getElementById('transcript').textContent = '[errorPermissionDenied]';
    });
  }

  _speak(message) {
    var msg = new SpeechSynthesisUtterance(message)
    msg.rate = 1.4
    window.speechSynthesis.speak(msg)
  }

  recordingStart() {
    this._speak("Recording started.  Do the actions you would like me to record.")
    this._sendMessage({
      action: actions.START,
    });
  }

  recordingStop() {
    this._sendMessage({
      action: actions.STOP,
    });
  }

  selectStart() {
    console.log('selectStart');
    this._sendMessage({
      action: actions.SELECT_START,
    });

    this._selection.cancel();
    this._selection.enable();
  }

  selectStop() {
    console.log('selectStop');
    this._sendMessage({
      action: actions.SELECT_STOP,
    });

    this._selection.cancel();
    this._selection.disable();
  }

  _sendMessage(msg) {
    // ensure the server is initialized for the current page
    window.eventRecorder.sendCurrentUrl();

    try {
      // poor man's way of detecting whether this script was injected by an actual extension, or is loaded for
      // testing purposes
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.sendMessage(msg);
      } else {
        this._eventLog.push(msg);
      }
    } catch (err) {
      console.error('caught error', err);
    }
  }

  gestureRecognizer(trail) {
    const selector = 'up'; // 'down'
    switch (selector) {
      case 'up':
        this.selectColumn();
        break;
      case 'down':
        this.selectRows();
        this.selectList();
        break;
      default:
    }
  }

  selectClear(selected) {
    this._selection.cancel();
  }

  gestureStart(selector) {
    console.log(this._mouse_x, this._mouse_y);

    this._mouse_x_start = this._mouse_x;
    this._mouse_y_start = this._mouse_y;
  }

  nameProgram(progName) {
    this._speak("I have named this program " + progName)
    this._speak("Would you like to run " + progName + "?")
    this._programNameCurrent = progName

    this._sendMessage({
      action: 'NAME_PROGRAM',
      varName: progName,
    });
  }

  runProgram(progName, ...args) {
    console.log('run');
    this._sendMessage({
      action: 'RUN_PROGRAM',
      varName: progName,
      args: args,
    });
  }

  runProgramIfAtLeast(progName, ...args) {
    this.runProgramIf(progName, '>=', ...args);
  }

  runProgramIfEqual(progName, ...args) {
    this.runProgramIf(progName, '==', ...args);
  }

  runProgramIfAtMost(progName, ...args) {
    this.runProgramIf(progName, '<=', ...args);
  }

  runProgramIf(progName, direction, ...args) {
    if (args.length !== 2) {
      throw Error('Not enough arguments.');
    }

    const value = args.pop();
    const condVar = args.pop(); // variable being conditioned on

    console.log('DETECTING CONDITIONAL RUN!!!');

    this._sendMessage({
      action: 'RUN_PROGRAM_IF',
      varName: progName,
      args: args,
      condVar: condVar,
      value: value,
      direction: direction,
    });
  }

  scheduleProgram(progName, ...args) {
    if (args.length < 1) {
      throw Error('No time provided when scheduling program.');
    }

    const time = args.pop();

    this._sendMessage({
      action: 'SCHEDULE_PROGRAM',
      varName: progName,
      args: args,
      time: time,
    });
  }

  tagVariable(varName) {
    if (
      this._current_click &&
      ['TEXTAREA', 'INPUT'].includes(this._current_click.target.tagName)
    ) {
      this._tagVariableForInput(varName);
    } else {
      this._tagVariableForSelection(varName);
    }
  }

  _getMultiSelector(elements) {
    const selectors = [];
    for (let el of elements) {
      const optimizedMinLength = el.id ? 2 : 10; // if the target has an id, use that instead of multiple other selectors
      selectors.push(
        finder(el, {
          seedMinLength: 5,
          optimizedMinLength: optimizedMinLength,
          className(className) {
            return className !== 'selected';
          },
        }),
      );
    }
    return selectors.join(', ');
  }

  _tagVariableForSelection(varName) {
    const selector = this._getMultiSelector(this._selectedElements);

    this._sendMessage({
      selector: selector,
      value: null,
      tagName: null,
      inputType: null,
      selection: null,
      action: 'THIS_IS_A',
      varName: varName,
      keyCode: null,
      href: null,
    });
  }

  _tagVariableForInput(varName) {
    if (this._current_click.target.tagName === 'TEXTAREA') {
      this._replaceSelectedTextArea(this._current_click.target, `[${varName}]`);
    }

    if (this._current_click.target.tagName === 'INPUT') {
      this._replaceSelectedInput(this._current_click.target, `[${varName}]`);
    }

    const optimizedMinLength = this._current_click.target.id ? 2 : 10; // if the target has an id, use that instead of multiple other selectors
    const selector = finder(this._current_click.target, {
      seedMinLength: 5,
      optimizedMinLength: optimizedMinLength,
    });

    this._sendMessage({
      selector: selector,
      value: this._current_click.target.value,
      tagName: this._current_click.target.tagName,
      inputType:
        this._current_click.target.tagName === 'INPUT'
          ? this._current_click.target.type
          : null,
      selection: null,
      action: 'THIS_IS_A',
      varName: varName,
      keyCode: null,
      href: this._current_click.target.href
        ? this._current_click.target.href
        : null,
    });
  }

  _getInputSelection(el) {
    var start = 0;
    var end = 0;
    var normalizedValue;
    var range;

    var textInputRange;
    var len;
    var endRange;

    if (
      typeof el.selectionStart === 'number' &&
      typeof el.selectionEnd === 'number'
    ) {
      start = el.selectionStart;
      end = el.selectionEnd;
    } else {
      range = document.selection.createRange();

      if (range && range.parentElement() === el) {
        len = el.value.length;
        normalizedValue = el.value.replace(/\r\n/g, '\n');

        // Create a working TextRange that lives only in the input
        textInputRange = el.createTextRange();
        textInputRange.moveToBookmark(range.getBookmark());

        // Check if the start and end of the selection are at the very end
        // of the input, since moveStart/moveEnd doesn't return what we want
        // in those cases
        endRange = el.createTextRange();
        endRange.collapse(false);

        if (textInputRange.compareEndPoints('StartToEnd', endRange) > -1) {
          start = end = len;
        } else {
          start = -textInputRange.moveStart('character', -len);
          start += normalizedValue.slice(0, start).split('\n').length - 1;

          if (textInputRange.compareEndPoints('EndToEnd', endRange) > -1) {
            end = len;
          } else {
            end = -textInputRange.moveEnd('character', -len);
            end += normalizedValue.slice(0, end).split('\n').length - 1;
          }
        }
      }
    }

    return {
      start: start,
      end: end,
    };
  }

  _replaceSelectedInput(el, text) {
    el.value = text;
  }

  _replaceSelectedTextArea(el, text) {
    var sel = this._getInputSelection(el);
    var val = el.value;
    el.value = val.slice(0, sel.start) + text + val.slice(sel.end);
  }
}

// gestureStop (selector) {
//   this._mouse_x_stop = this._mouse_x
//   this._mouse_y_stop = this._mouse_y

//   this._delta_x = this._mouse_x_start - this._mouse_x_stop
//   this._delta_y = this._mouse_y_start - this._mouse_y_stop

//   console.log(this._delta_x, this._delta_x)
// }

// selectRandom (selector) {
// }

// selectClass (selector) {
// }

// selectList (selector) {
// }

// selectColumn () {
// }

// selectRow () {
// }
