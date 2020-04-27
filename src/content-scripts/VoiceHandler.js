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
import axios from 'axios';
import Cookies from 'js-cookie';
import finder from '@medv/finder';
import uuid from 'uuid';
import actions from '../models/extension-ui-actions';
import { Timer } from 'easytimer.js';
import MicroModal from 'micromodal';

const serverUrl = 'http://localhost:3000';

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
        this._namedTables = {};
        this.timer = '';
        this._eventLog = [];
    }

    start() {
        if (!document.getElementById('transcript')) {
            const transcriptDiv = document.createElement('div');
            transcriptDiv.id = 'transcript';
            document.body.prepend(transcriptDiv);
        }
        if (!document.getElementById('timer')) {
            const timerDiv = document.createElement('div');
            timerDiv.id = 'timer';
            document.body.prepend(timerDiv);
        }

        var port = chrome.runtime.connect();
        port.postMessage({ joke: 'Knock knock' });
        port.onMessage.addListener(msg => {
            if (msg.action == 'paramsMissing') {
                const input = msg.paramsMissing;
                const last = input.pop();
                const result = input.join(', ') + ' and ' + last;

                this._speak('Please select the ' + result);
                this.selectStart();
            }
            if (msg.action == 'executionResult') {
                console.log('executionResult', msg);
                const messages = msg.results.map(m => {
                    return `<p>${m.message}</p>`;
                });
                document.getElementById('result-modal-content').innerHTML = messages.join(' ');
                MicroModal.show('result-modal');
            }
            if (msg.action == 'executionError') {
                console.log('executionError', msg);
                const mErrors = msg.errors.map(e => {
                    return `${msg.message || msg}`;
                });
                document.getElementById('result-modal-content').innerHTML = `Sorry that did not work: ${mErrors.join(' ')}`;
                MicroModal.show('result-modal');
            }
        });

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
            selectables: ['.box-wrap > div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'td', 'caption'],

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
            .on('stop', async ({ inst }) => {
                // Remember selection in case the user wants to add smth in the next one
                inst.keepSelection();
                console.log('inst', inst);
                console.log('inst', inst.v[0].innerText);

                // Copy to clipboard
                await navigator.clipboard.writeText(inst.v[0].innerText);

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

        // Track ctrl-v
        document.body.addEventListener('keydown', async (evt) => {
            console.log('Keydown on input element!')
            evt = evt||window.event; // IE support
            const c = evt.keyCode;
            const ctrlDown = evt.ctrlKey||evt.metaKey; // Mac support

            console.log('c', c);
            console.log('ctrlDown', ctrlDown);

            // Check for ctrl+v
            if (ctrlDown && (c === 86)) {
                console.log('Paste handled');
                // Prevent pasting using ctrl-v to avoid recording text into webtalk
                evt.preventDefault();
                // Tag as variable
                this.tagThisCopy();
                // Paste selected text
                const clipboardText = await navigator.clipboard.readText();
                const srcElement = evt.target || evt.srcElement;
                this._replaceSelectedInput(srcElement, clipboardText);
                return false;
            }

            return true;
        });

        const commands = {
            'this is a *var_name': this.tagVariable.bind(this),
            'this is an *var_name': this.tagVariable.bind(this),
            'these are *var_name': this.tagVariable.bind(this),
            'this variable is a *var_name': this.tagVariable.bind(this),

            // Run with this
            'call :prog_name with this': this.runProgramWithThis.bind(this),
            'run :prog_name with this': this.runProgramWithThis.bind(this),
            'call :prog_name using this': this.runProgramWithThis.bind(this),
            'run :prog_name using this': this.runProgramWithThis.bind(this),
            
            'call :prog_name with :var_name': this.runProgram.bind(this),
            'run :prog_name with :var_name': this.runProgram.bind(this),
            'call :prog_name using :var_name': this.runProgram.bind(this),
            'run :prog_name using :var_name': this.runProgram.bind(this),
            'call :prog_name using :v1 and :v2': this.runProgram.bind(this),
            'call :prog_name with :v1 and :v2': this.runProgram.bind(this),
            'run :prog_name using :v1 and :v2': this.runProgram.bind(this),
            'call :prog_name': this.runProgram.bind(this),
            'run :prog_name': this.runProgram.bind(this),

            // Clipboard
            'run :prog_name copying clipboard as :var_name': this.runProgramWithClipboard.bind(
                this,
            ),

            // Conditionals
             'call :prog_name if :var_name is at least :value': this.runProgramIfAtLeast.bind(
                this,
            ),
            'run :prog_name if :var_name is at least :value': this.runProgramIfAtLeast.bind(
                this,
            ),
            'call :prog_name if :var_name more than :value': this.runProgramIfAtLeast.bind(
                this,
            ),
            'run :prog_name if :var_name more than :value': this.runProgramIfAtLeast.bind(
                this,
            ),
            'call :prog_name if :var_name is greater than :value': this.runProgramIfAtLeast.bind(
                this,
            ),
            'run :prog_name if :var_name is greater than :value': this.runProgramIfAtLeast.bind(
                this,
            ),
            'call :prog_name if :var_name equals :value': this.runProgramIfEqual.bind(
                this,
            ),
            'run :prog_name if :var_name equals :value': this.runProgramIfEqual.bind(
                this,
            ),
            'call :prog_name if :var_name is at most :value': this.runProgramIfAtMost.bind(
                this,
            ),
            'run :prog_name if :var_name is at most :value': this.runProgramIfAtMost.bind(
                this,
            ),
            'call :prog_name if :var_name is less than :value': this.runProgramIfAtMost.bind(
                this,
            ),
            'run :prog_name if :var_name is less than :value': this.runProgramIfAtMost.bind(
                this,
            ),
            'call :prog_name if this is at least :value': this.runProgramIfAtLeast.bind(
                this,
                'condvar'
            ),
            'run :prog_name if this is at least :value': this.runProgramIfAtLeast.bind(
                this,
                'condvar'
            ),
            'call :prog_name if this is greater than :value': this.runProgramIfAtLeast.bind(
                this,
                'condvar'
            ),
            'run :prog_name if this is greater than :value': this.runProgramIfAtLeast.bind(
                this,
                'condvar'
            ),
            'call :prog_name if this equals :value': this.runProgramIfEqual.bind(
                this,
                'condvar'
            ),
            'run :prog_name if this equals :value': this.runProgramIfEqual.bind(
                this,
                'condvar'
            ),
            'call :prog_name if this is at most :value': this.runProgramIfAtMost.bind(
                this,
                'condvar'
            ),
            'run :prog_name if this is at most :value': this.runProgramIfAtMost.bind(
                this,
                'condvar'
            ),
            'call :prog_name if this is less than :value': this.runProgramIfAtMost.bind(
                this,
                'condvar'
            ),
            'run :prog_name if this is less than :value': this.runProgramIfAtMost.bind(
                this,
                'condvar'
            ),

            // 'watch this': this.recordingStart.bind(this),
            'start function :func_name': this.recordingStart.bind(this),
            'stop function :func_name': this.recordingStop.bind(this),
            'start recording :func_name': this.recordingStart.bind(this),
            'stop recording :func_name': this.recordingStop.bind(this),
            'ok done': this.recordingStop.bind(this),

            // Run program with scheduling
            'run :prog_name at *time': this.scheduleProgram.bind(this),
            'run :prog_name with this at *time': this.scheduleProgram.bind(
                this,
            ),

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

            // Table
            'this table contains :table_name': this.selectTable.bind(this),
            'show me :table_name with :var_name greater than :value': this.filterGreaterThanTable.bind(
                this,
            ),
            'show me :table_name with :var_name less than :value': this.filterLessThanTable.bind(
                this,
            ),
            'show me :table_name with :var_name equal to :value': this.filterEqualsTable.bind(
                this,
            ),

            // Aggregation
            'calculate the sum of this': this.calculateAggregation.bind(this, 'sum', 'var'),
            'calculate the sum of :var_name': this.calculateAggregation.bind(this, 'sum'),
            'calculate the average of this': this.calculateAggregation.bind(this, 'average', 'var'),
            'calculate the average of :var_name': this.calculateAggregation.bind(this, 'average'),
            'calculate the count of this': this.calculateAggregation.bind(this, 'count', 'var'),
            'calculate the count of :var_name': this.calculateAggregation.bind(this, 'count'),

            // Return value
            'return this': this.returnThis.bind(this),
            'return :var_name': this.returnValue.bind(this),
            'return the :var_name': this.returnValue.bind(this),
        };

        annyang.addCommands(commands);
        annyang.start();

        annyang.addCallback('result', function(whatWasHeardArray, ...data) {
            console.log('annyang result', data);
            document.getElementById('transcript').textContent =
                whatWasHeardArray[0];

            if (!Cookies.get('userID')) Cookies.set('userID', uuid.v4());

            axios
                .post(`${serverUrl}/record-utterance`, {
                    utterance: whatWasHeardArray[0],
                    user: Cookies.get('userID'),
                })
                .then(_ => {
                    console.log('Recorded utterance:', whatWasHeardArray[0]);
                })
                .catch(e => {
                    console.log('Failed to record utterance.', e);
                });
        });
        annyang.addCallback('resultNoMatch', function(
            whatWasHeardArray,
            ...data
        ) {
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
            document.getElementById('transcript').textContent =
                '[error] ' + str;
            console.log(str);
        });

        annyang.addCallback('errorNetwork', function() {
            document.getElementById('transcript').textContent =
                '[errorNetwork]';
        });

        annyang.addCallback('errorPermissionBlocked', function() {
            document.getElementById('transcript').textContent =
                '[errorPermissionBlocked]';
        });

        annyang.addCallback('errorPermissionDenied', function() {
            document.getElementById('transcript').textContent =
                '[errorPermissionDenied]';
        });
    }

    _speak(message) {
        var msg = new SpeechSynthesisUtterance(message);
        msg.rate = 1.2;
        window.speechSynthesis.speak(msg);
    }

    recordingStart(funcName) {
        this._speak(
            'Recording started.  Do the actions you would like me to record.',
        );
        this._sendMessage({
            action: actions.START,
            funcName: funcName
        });
        /* Digital Timer */
        this.timer = new Timer();
        this.timer.start();
        this.timer.addEventListener('secondsUpdated', _ => {
            document.getElementById(
                'timer',
            ).innerHTML = this.timer.getTimeValues().toString();
        });
    }

    recordingStop(funcName) {
        this._speak(`I stopped recording ${funcName}. Would you like to run ${funcName}?`);
        this._sendMessage({
            action: actions.STOP,
            funcName: funcName
        });
        this.timer.stop();
    }

    selectStart() {
        this._speak('Select the variables you want to name.');

        console.log('selectStart');
        this._sendMessage({
            action: actions.SELECT_START,
        });

        this._selection.cancel();
        this._selection.enable();
    }

    selectStop() {
        this._speak('Selection stopped.');
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
                console.log('Send runtime message.');
            } else {
                this._eventLog.push(msg);
                console.log('Push to event log.');
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

    runProgram(progName, ...args) {
        this._speak(`Running ${progName}.`);
        console.log('run');
        this._sendMessage({
            action: 'RUN_PROGRAM',
            varName: progName,
            args: args,
        });
    }

    runProgramWithThis(progName, ...args) {
        this._speak(`Running ${progName}.`);
        console.log('run');
        this.tagVariable('var');
        this._sendMessage({
            action: 'RUN_PROGRAM',
            varName: progName,
            args: ['var'],
        });
    }

    async runProgramWithClipboard(progName, ...args) {
        this._speak(`Running ${progName} with clipboard content.`);
        console.log('run with clipboard');

        // Get data from clipboard
        const clipboardText = (await navigator.clipboard.readText()).trim();
        const clipboardVarName = args.pop();

        this._sendMessage({
            action: 'RUN_PROGRAM_WITH_CLIPBOARD',
            varName: progName,
            args: [clipboardVarName],
            clipboard: {
                argName: clipboardVarName,
                argValue: clipboardText,
            },
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
        if (condVar === 'condvar') this.tagVariable('condvar');

        this._speak(
            `Running ${progName} if this ${direction[0]} ${value}`,
        );

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

        this._speak(`Running ${progName} at ${time}.`);

        this._sendMessage({
            action: 'SCHEDULE_PROGRAM',
            varName: progName,
            args: args.length === 1 ? ['var'] : args,
            time: time,
        });
    }

    selectTable(tableName) {
        this._speak('Stored table.');

        // Get table from selection
        const firstElem = this._selectedElements.values().next().value;
        this._namedTables[tableName] =
            firstElem.parentNode.parentNode.parentNode;
    }

    filterTable(tableName, varName, value, comparisonFunc) {
        this._speak('Here are your filtered results.');
        const table = this._namedTables[tableName];
        const header = table.children[0].children[0];
        const headers = header.children;
        const rowParent = table.children[0];
        const rows = rowParent.children;
        value = parseFloat(value);

        console.log('varName', varName);
        console.log('value', value);
        console.log('headers', headers);
        console.log('rows', rows);

        // Get index of filtered column
        let colIndex;
        for (let i = 0; i < headers.length; i++) {
            if (headers[i].textContent.toLowerCase() === varName) {
                colIndex = i;
                break;
            }
        }
        console.log('colIndex', colIndex);

        // filter rows (ignoring header)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            row.style.border = null;
            const rowVal = parseFloat(row.children[colIndex].textContent);
            if (comparisonFunc(rowVal, value)) {
                row.style.border = '1px solid red';

                // Reorder row by cloning to be at top
                const newRow = row.cloneNode(true);
                header.after(newRow);

                // delete old row
                row.remove();
            }
        }
    }

    filterGreaterThanTable(tableName, varName, value) {
        this.filterTable(tableName, varName, value, (a, b) => a > b);
    }

    filterLessThanTable(tableName, varName, value) {
        this.filterTable(tableName, varName, value, (a, b) => a < b);
    }

    filterEqualsTable(tableName, varName, value) {
        this.filterTable(tableName, varName, value, (a, b) => a === b);
    }

    calculateAggregation(aggOp, varName) {
        this._speak(`OK I will calculate the ${aggOp} of ${varName}.`);
        const msg = {
            value: null,
            tagName: null,
            inputType: null,
            selection: null,
            action: 'AGGREGATION',
            operator: aggOp === 'average' ? 'avg' : aggOp,
            varName: varName,
            keyCode: null,
            href: null,
        };
        console.log('Aggregation message', msg);

        this._sendMessage(msg);
    }

    tagVariable(varName) {
        // this._speak('I have stored that variable.');
        if (
            this._current_click &&
            ['TEXTAREA', 'INPUT'].includes(this._current_click.target.tagName)
        ) {
            this._tagVariableForInput(varName);
        } else {
            this._tagVariableForSelection(varName);
        }
    }
    
    tagThis() {
        // this._speak('I have stored that variable.');
        if (
            this._current_click &&
            ['TEXTAREA', 'INPUT'].includes(this._current_click.target.tagName)
        ) {
            this._tagVariableForInput('var');
        } else {
            this._tagVariableForSelection('var');
        }
    }

    tagThisCopy() {
        this._tagVariableForInput('var', true);
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
        const msg = {
            selector: selector,
            value: null,
            tagName: null,
            inputType: null,
            selection: null,
            action: 'THIS_IS_A',
            varName: varName,
            keyCode: null,
            href: null,
        };
        console.log('Selection message', msg);

        this._sendMessage(msg);
    }

    _tagVariableForInput(varName, implicit) {
        let replaced = '';
        // Replace text of input only when not implicit
        if (!implicit) {
            if (this._current_click.target.tagName === 'TEXTAREA') {
                replaced = this._replaceSelectedTextArea(
                    this._current_click.target,
                    `[${varName}]`,
                );
            }
            if (this._current_click.target.tagName === 'INPUT') {
                replaced = this._replaceSelectedInput(
                    this._current_click.target,
                    `[${varName}]`,
                );
            }
        }

        const optimizedMinLength = this._current_click.target.id ? 2 : 10; // if the target has an id, use that instead of multiple other selectors
        const selector = finder(this._current_click.target, {
            seedMinLength: 5,
            optimizedMinLength: optimizedMinLength,
        });

        this._sendMessage({
            selector: selector,
            value: this._current_click.target.value,
            oldvalue: replaced,
            tagName: this._current_click.target.tagName,
            inputType:
                this._current_click.target.tagName === 'INPUT'
                    ? this._current_click.target.type
                    : null,
            selection: null,
            action: 'THIS_IS_A',
            varName: implicit ? 'var' : varName, // for implicit variables
            // varName: varName,
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

                if (
                    textInputRange.compareEndPoints('StartToEnd', endRange) > -1
                ) {
                    start = end = len;
                } else {
                    start = -textInputRange.moveStart('character', -len);
                    start +=
                        normalizedValue.slice(0, start).split('\n').length - 1;

                    if (
                        textInputRange.compareEndPoints('EndToEnd', endRange) >
                        -1
                    ) {
                        end = len;
                    } else {
                        end = -textInputRange.moveEnd('character', -len);
                        end +=
                            normalizedValue.slice(0, end).split('\n').length -
                            1;
                    }
                }
            }
        }

        return {
            start: start,
            end: end,
        };
    }

    returnValue(varName) {
        this._speak(`OK I will return ${varName}.`);
        console.log('return ' + varName);
        this._sendMessage({
            action: 'RETURN_VALUE',
            varName: varName,
        });
    }

    returnThis() {
        this._speak(`OK I will return this.`);
        this._sendMessage({
            action: 'RETURN_VALUE',
            varName: 'var',
        });
    }

    _replaceSelectedInput(el, text) {
        const oldvalue = el.value;
        el.value = text;
        return oldvalue;
    }

    _replaceSelectedTextArea(el, text) {
        var sel = this._getInputSelection(el);
        var val = el.value;
        const oldvalue = val.slice(sel.start, sel.end);
        el.value = val.slice(0, sel.start) + text + val.slice(sel.end);
        return oldvalue;
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
