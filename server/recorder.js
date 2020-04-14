// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
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

const assert = require('assert');
const Tp = require('thingpedia');
const ThingTalk = require('thingtalk');
const Ast = ThingTalk.Ast;
const Type = ThingTalk.Type;
const Builtin = ThingTalk.Builtin;
const { ParserClient } = require('almond-dialog-agent');

const crypto = require('crypto');
const express = require('express');
const stemmer = require('stemmer');
const { parseTime } = require('./utils/time');
const router = new express.Router();

const Config = require('./config');

function makeRandom(size = 32) {
    return crypto.randomBytes(size).toString('hex');
}

function elementIsFocusable(event) {
    const tagName = event.tagName.toLowerCase();
    return (
        (tagName === 'input' &&
            !['submit', 'reset', 'button'].includes(event.inputType)) ||
        tagName === 'textarea'
    );
}
function elementIsActionable(event) {
    const tagName = event.tagName.toLowerCase();
    return (
        (tagName === 'input' &&
            ['submit', 'reset', 'button'].includes(event.inputType)) ||
        tagName === 'button' ||
        tagName === 'a'
    );
}

// HACK this should be somewhere else
const namedPrograms = new Tp.Helpers.FilePreferences('./named-programs.json');

class ProgramBuilder {
    constructor() {
        this.name = null;
        this._statements = [];
        this._declaredProcedures = new Map();
        this._declaredVariables = new Map();
    }

    _makeProgram() {
        const declarations = Array.from(this._declaredProcedures.values());
        return new Ast.Program(
            null,
            [] /* classes */,
            declarations,
            this._statements,
        );
    }

    finish() {
        let prog;
        if (this.name !== null) {
            const procedure = this._makeProgram();
            const args = {};
            for (let [name, type] of this._declaredVariables) args[name] = type;
            const decl = new Ast.Statement.Declaration(
                null,
                this.name,
                'procedure',
                args,
                procedure,
            );
            prog = new Ast.Program(null, [], [decl], []);
        } else {
            prog = this._makeProgram();
        }
        const code = prog.prettyprint();
        console.log('Generated', code);
        return code;
    }

    declareVariable(varName, type) {
        this._declaredVariables.set(varName, type);
    }

    addStatement(stmt) {
        this._statements.push(stmt);
    }

    addAction(action) {
        this.addStatement(new Ast.Statement.Command(null, null, [action]));
    }

    addQueryAction(query, action) {
        this.addStatement(new Ast.Statement.Command(null, query, [action]));
    }

    addNamedQuery(name, query) {
        console.log('ADDING NAMED QUERY!!!!!!');
        this.addStatement(
            new Ast.Statement.Assignment(null, name, query, query.schema),
        );
    }

    addProcedure(decl) {
        this._declaredProcedures.set(decl.name, decl);
    }

    addAtTimedAction(action, stream) {
        console.log('TIMER_STREAM!!!!!!!!!!!!!!!');

        this.addStatement(new Ast.Statement.Rule(null, stream, [action]));
        console.log('FINISHED ADDING STATEMENT!!!');
    }
}

function wordsToVariable(words, prefix = '') {
    // stem all words
    if (!Array.isArray(words)) words = words.split(/\s+/g);

    words = words.map(word => stemmer(word));

    return prefix + words.join('_');
}

class RecordingSession {
    constructor(engine) {
        this._builder = new ProgramBuilder();
        console.log('BUILDER!!!', this._builder);

        this._engine = engine;
        this._platform = engine.platform;
        this._parser = new ParserClient(
            Config.NL_SERVER_URL,
            this._platform.locale,
            this._platform.getSharedPreferences(),
        );
        this._formatter = new ThingTalk.Formatter(engine.platform.locale, engine.platform.timezone, engine.schemas, this._platform.getCapability('gettext'));

        this._currentFocus = null;
        this._currentInput = null;

        this._recordingMode = false;

        // accumulated arguments in session (meant for auto argument passing)
        this._accArgs = new Set();
        // accumulated arguments while recording (meant for auto argument passing)
        this._accRecArgs = new Set();
    }

    _addPuppeteerQuery(event, name, params, saveAs) {
        console.log('ADDING QUERY!!!');
        if (event.frameUrl) {
            params.push(
                new Ast.InputParam(
                    null,
                    'frame_url',
                    new Ast.Value.Entity(event.frameUrl, 'tt:url', null),
                ),
            );
        }
        if (event.selector) {
            params.push(
                new Ast.InputParam(
                    null,
                    'selector',
                    new Ast.Value.String(event.selector),
                ),
            );
        }
        console.log(params);

        this._builder.addNamedQuery(
            saveAs,
            new Ast.Table.Invocation(
                null,
                new Ast.Invocation(
                    null,
                    new Ast.Selector.Device(
                        null,
                        'com.google.puppeteer',
                        'com.google.puppeteer',
                        null,
                    ),
                    name,
                    params,
                    null,
                ),
                null,
            ),
        );
    }

    _addPuppeteerAction(event, name, params) {
        if (event.frameUrl) {
            params.push(
                new Ast.InputParam(
                    null,
                    'frame_url',
                    new Ast.Value.Entity(event.frameUrl, 'tt:url', null),
                ),
            );
        }
        if (event.selector) {
            params.push(
                new Ast.InputParam(
                    null,
                    'selector',
                    new Ast.Value.String(event.selector),
                ),
            );
        }

        this._builder.addAction(
            new Ast.Action.Invocation(
                null,
                new Ast.Invocation(
                    null,
                    new Ast.Selector.Device(
                        null,
                        'com.google.puppeteer',
                        'com.google.puppeteer',
                        null,
                    ),
                    name,
                    params,
                    null,
                ),
                null,
            ),
        );
    }

    _maybeFlushCurrentInput(event) {
        // input events come in a whole bunch, but we only want to record the final one
        // so we wait until the next recorded event or command and maybe flush the current one
        // if the next event is for the same element (selector + frameId + frameUrl) we ignore it
        // and overwrite _currentInput

        if (this._currentInput === null) return;

        if (event) {
            if (this._currentInput.varName && !event.varName)
                event.varName = this._currentInput.varName;

            if (
                (event.action === 'change' ||
                    event.action === 'select' ||
                    event.action === 'THIS_IS_A') &&
                event.selector === this._currentInput.selector &&
                event.frameId === this._currentInput.frameId &&
                event.frameUrl === this._currentInput.frameUrl
            )
                return;
        }

        console.log(this._currentInput);
        let value = new Ast.Value.String(this._currentInput.value);
        if (this._currentInput.varName) {
            this._builder.declareVariable(
                wordsToVariable(this._currentInput.varName, 'v_'),
                Type.String,
            );
            const chunks = this._currentInput.value.split(
                '[' + this._currentInput.varName + ']',
            );

            let operands = [];
            for (let i = 0; i < chunks.length; i++) {
                if (i > 0) {
                    operands.push(
                        new Ast.Value.VarRef(
                            wordsToVariable(this._currentInput.varName, 'v_'),
                        ),
                    );
                }
                if (chunks[i]) operands.push(new Ast.Value.String(chunks[i]));
            }
            if (operands.length > 1)
                value = new Ast.Value.Computation('+', operands);
            else value = operands[0];
        }

        this._addPuppeteerAction(this._currentInput, 'set_input', [
            new Ast.InputParam(null, 'text', value),
        ]);
        this._currentInput = null;
    }

    _doNameProgram(name) {
        this._builder.name = wordsToVariable(name, 'p_');
        const code = this._builder.finish();
        namedPrograms.set(this._builder.name, code);

        this._builder = new ProgramBuilder();
    }

    async _doRunProgram() {
        console.log('RUNNING PROGRAM!!!');
        const code = this._builder.finish();
        console.log('CODE (_doRunProgram)', code);
        const app = await this._engine.createApp(code, {
            description: 'this is a thingtalk program', // there is a bug in thingtalk where we fail to describe certain programs...
        });

        let results = [];
        let errors = [];
        if (!app) return { results, errors };

        for (;;) {
            let { item: next, resolve, reject } = await app.mainOutput.next();

            if (next.isDone) {
                resolve();
                break;
            }

            if (next.isNotification) {
                try {
                    console.log(next);
                    const message = await this._formatter.formatForType(next.outputType, next.outputValue, 'string');
                    results.push({
                        message: message,
                        value: next.outputValue,
                        type: next.outputType,
                    });
                    resolve();
                } catch (e) {
                    reject(e);
                }
            } else if (next.isError) {
                // If Thingtalk command fails
                errors.push(next.error);
                resolve();
            } else if (next.isQuestion) {
                let e = new Error('User cancelled');
                e.code = 'ECANCELLED';
                reject(e);
            }
        }

        if (errors.length > 0) console.error(errors);

        console.log('doRunProgram Error!!!', errors);
        console.log('doRunProgram Results!!!', results);

        return { results, errors };
    }

    async _runProgram(progName, options) {
        console.log('_runProgram', progName, options.args);
        let time = null;
        if (options.time) {
            console.log('_scheduleProgram', progName, options.time, options.args);
            time = await parseTime(options.time);
            console.log(time);
        }
        const params_missing = this._recordProgramCall(progName, options.args, time, options.condition);

        if (params_missing && params_missing.length > 0)
            return { params_missing, results: [], errors: [] };

        if (!this._recordingMode) {
            const { results, errors } = await this._doRunProgram();
            this._builder = new ProgramBuilder();
            return { params_missing: [], results, errors };
        }

        return { params_missing: [], results: [], errors: [] };
    }

    _getRelevantStoredArgs(neededArgs) {
        const argSet = this._recordingMode ? this._accRecArgs : this._accArgs; // accumulated args
        const result = [];
        // Get args in argSet that are also needed
        for (let item of argSet) {
            if (neededArgs.includes(item)) result.push(item);
        }

        return result;
    }

    _missingArgs(providedArgs, requiredArgs) {
        const missingArgs = [];
        for (let i = 0; i < requiredArgs.length; i++) {
            if (!providedArgs.includes(requiredArgs[i])) {
                missingArgs.push(requiredArgs[i]);
            }
        }

        return missingArgs;
    }

    _recordProgramCall(progName, givenArgs, time, condition) {
        console.log(`RECORD PROGRAM CALL!!!`);
        progName = wordsToVariable(progName, 'p_');
        const prog = namedPrograms.get(progName);
        console.log(`PROG: ${prog}`);
        if (!prog) throw new Error(`No such program ${progName}`);

        const parsed = ThingTalk.Grammar.parse(prog);
        assert(
            parsed.classes.length === 0 &&
                parsed.declarations.length === 1 &&
                parsed.declarations[0].name === progName &&
                parsed.rules.length === 0,
        );

        const decl = parsed.declarations[0];

        // check if enough args provided
        const requiredArgs = Object.keys(decl.args).map(x => x.split('_')[1]);
        let args = givenArgs;
        if (condition && condition.value && requiredArgs.length > 0) {
            // Handling implicit arguments for conditional
            args = this._getRelevantStoredArgs(requiredArgs);
            console.log(`RETRIEVED ARGS: ${args}`);
        }
        const missingArgs = this._missingArgs(args, requiredArgs);
        if (missingArgs.length !== 0) {
            // send missing args
            return missingArgs;
        }

        console.log('I"M HERE', decl);

        // FIXME we should use an alias here but aliases do not work
        //let in_params = args.map((arg) =>
        //    new Ast.InputParam(null, wordsToVariable(arg, 'v_'), new Ast.Value.VarRef(wordsToVariable(arg, '__t_') + '.text')));
        let in_params = args.map(
            arg =>
                new Ast.InputParam(
                    null,
                    wordsToVariable(arg, 'v_'),
                    new Ast.Value.VarRef('text'),
                ),
        );
        console.log(`In Params: ${in_params}`);

        this._builder.addProcedure(decl);
        const action = new Ast.Action.VarRef(null, progName, in_params, null);

        if (time) {
            const ttTime = Ast.Value.fromJS(
                Type.Time,
                new Builtin.Time(
                    time.getHours(),
                    time.getMinutes(),
                    time.getSeconds(),
                ),
            );
            let stream = new Ast.Stream.AtTimer(null, [ttTime], null, null);

            if (args.length > 0) {
                console.log('QUERY TIME!!!');
                const tables = args.map(
                    arg =>
                        new Ast.Table.VarRef(
                            null,
                            wordsToVariable(arg, 't_'),
                            [],
                            null,
                        ),
                );
                stream = tables.reduce(
                    (t1, t2) => new Ast.Stream.Join(null, t1, t2, [], null),
                    stream,
                );

                this._builder.addAtTimedAction(action, stream);
            } else {
                this._builder.addAtTimedAction(action, stream);
            }

            return undefined;
        }

        if (args.length > 0) {
            console.log('query without time args', args);
            console.log('QUERY WITHOUT TIME!!!');
            let tables = args.map(
                arg =>
                    new Ast.Table.VarRef(
                        null,
                        wordsToVariable(arg, 't_'),
                        [],
                        null,
                    ),
            );

            if (condition && condition.value) {
                const { condVar, value, direction } = condition;
                const condTable = new Ast.Table.Filter(
                    null,
                    new Ast.Table.VarRef(
                        null,
                        wordsToVariable(condVar, 't_'),
                        [],
                        null,
                    ),
                    new Ast.BooleanExpression.Atom(
                        null,
                        'number',
                        direction,
                        new Ast.Value.Number(parseInt(value)),
                    ),
                    null,
                );
                tables = [condTable].concat(tables);
            }

            const query = tables.reduce(
                (t1, t2) => new Ast.Table.Join(null, t1, t2, [], null),
            );
            this._builder.addQueryAction(query, action);
        } else {
            console.log('CONDITION!!!');
            console.log('condition', condition);
            if (condition && condition.value) {
                const { condVar, value, direction } = condition;
                const condTable = new Ast.Table.Filter(
                    null,
                    new Ast.Table.VarRef(
                        null,
                        wordsToVariable(condVar, 't_'),
                        [],
                        null,
                    ),
                    new Ast.BooleanExpression.Atom(
                        null,
                        'number',
                        direction,
                        new Ast.Value.Number(parseInt(value)),
                    ),
                    null,
                );
                this._builder.addQueryAction(condTable, action);
            } else {
                this._builder.addAction(action);
            }
        }

        return undefined;
    }

    _doReturnValue(varName) {
        const table = new Ast.Table.VarRef(null, wordsToVariable(varName, 't_'), [], null);
        const action = new Ast.Action.Notify(null, 'notify', null);
        this._builder.addQueryAction(table, action);
    }

    _handleThisIsA(event) {
        this._maybeFlushCurrentInput(event);
        if (event.tagName) {
            console.log('TAGGED A VARIABLE!!!');
            // tagged a variable inside an input
            this._currentInput = event;
        } else {
            console.log('TAGGED A SELECTION!!!');
            // tagged a selection
            this._addPuppeteerQuery(
                event,
                'select',
                [],
                wordsToVariable(event.varName, 't_'),
            );
        }

        // Keep track of args for auto argument passing
        if (this._recordingMode) {
            this._accRecArgs.add(event.varName);
        } else {
            this._accArgs.add(event.varName);
        }
    }

    async addRecordingEvent(event) {
        console.log('addRecordingEvent', event);
        switch (event.action) {
            case 'START_RECORDING':
                this._accRecArgs = new Set;
                // reset the selection state when the user clicks start
                this._currentInput = null;
                this._currentSelection = null;
                this._builder = new ProgramBuilder();
                this._recordingMode = true;
                break;

            case 'STOP_RECORDING':
                this._recordingMode = false;
                this._accRecArgs = new Set;
                return { code: this._builder.finish() };

            case 'GOTO':
                console.log('GOTO', event);
                this._maybeFlushCurrentInput(event);
                this._addPuppeteerAction(event, 'load', [
                    new Ast.InputParam(
                        null,
                        'url',
                        new Ast.Value.Entity(event.href, 'tt:url', null),
                    ),
                ]);
                break;

            case 'VIEWPORT':
                // ignore
                break;

            case 'click':
            case 'dblclick':
                this._maybeFlushCurrentInput(event);
                if (elementIsFocusable(event)) this._currentFocus = event;

                if (elementIsActionable(event))
                    this._addPuppeteerAction(event, 'click', []);
                break;

            case 'THIS_IS_A':
                this._handleThisIsA(event);
                break;

            case 'change':
            case 'select':
                this._maybeFlushCurrentInput(event);
                this._currentInput = event;
                break;

            case 'NAME_PROGRAM':
                this._maybeFlushCurrentInput(event);
                this._doNameProgram(event.varName);
                break;

            case 'RETURN_VALUE':
                this._maybeFlushCurrentInput(event);
                this._doReturnValue(event.varName);
                break;

            case 'RUN_PROGRAM':
                console.log('RUN_PROGRAM');
                this._maybeFlushCurrentInput(event);

                return this._runProgram(event.varName, {
                    args: event.args
                });

            case 'RUN_PROGRAM_IF':
                this._maybeFlushCurrentInput(event);
                return this._runProgram(event.varName, {
                    args: [],
                    condition: {
                        condVar: event.condVar,
                        value: event.value,
                        direction: event.direction,
                    }
                });

            case 'SCHEDULE_PROGRAM':
                this._maybeFlushCurrentInput(event);
                return this._runProgram(event.varName, {
                    args: event.args,
                    time: event.time
                });

            case 'keydown':
                // ignore (we handle change/select events instead)
                break;

            default:
                this._maybeFlushCurrentInput(event);
                // log
                console.log('unknown recording event', event);
        }

        return undefined;
    }

    _tryConfigureDevice(kind) {
        return this._engine.thingpedia
            .getDeviceSetup([kind])
            .then(factories => {
                var factory = factories[kind];
                if (!factory) {
                    // something funky happened or thingpedia did not recognize the kind
                    return null;
                }

                if (factory.type === 'none') {
                    return this._engine.devices
                        .addSerialized({ kind: factory.kind })
                        .then(device => {
                            return device;
                        });
                } else {
                    return null;
                }
            });
    }

    async _chooseDevice(selector) {
        let kind = selector.kind;
        if (selector.id !== null) return;
        let devices = this._engine.devices.getAllDevicesOfKind(kind);

        if (devices.length === 0) {
            const [device] = await this._tryConfigureDevice(kind);
            if (device) selector.id = device.uniqueId;
        } else {
            selector.id = devices[0].uniqueId;
        }
    }

    async _slotFill(program) {
        for (const [, slot, ,] of program.iterateSlots()) {
            if (!(slot instanceof Ast.Selector)) continue;
            await this._chooseDevice(slot);
        }
    }

    async _processCandidate(candidate, parsed) {
        let program;
        try {
            program = ThingTalk.NNSyntax.fromNN(
                candidate.code,
                parsed.entities,
            );
            await program.typecheck(this._engine.schemas, true);
        } catch (e) {
            console.error(
                'Failed to analyze ' +
                    candidate.code.join(' ') +
                    ' : ' +
                    e.message,
            );
            return null;
        }
        if (!program.isProgram) return null;
        await this._slotFill(program);
        return program;
    }

    async addNLCommand(command) {
        const parsed = await this._parser.sendUtterance(command, null, null);

        this._maybeFlushCurrentInput();

        const candidates = (
            await Promise.all(
                parsed.candidates.map(candidate => {
                    return this._processCandidate(candidate, parsed);
                }),
            )
        ).filter(r => r !== null);

        if (!candidates.length)
            return {
                reply: 'Sorry, I did not understand that.',
                status: 'noparse',
            };

        const program = candidates[0];

        // FIXME replace $context.selection with the current selection on the screen
        this._statements.push(...program.rules);
        return { reply: '', status: 'ok' };
    }

    async destroy() {}
}

const _sessions = new Map();

router.post('/start', (req, res) => {
    const token = makeRandom();
    console.log(`TOKEN: ${token}`);
    _sessions.set(token, new RecordingSession(req.app.engine));
    res.json({ status: 'ok', token });
});

router.post('/add-event', (req, res, next) => {
    console.log('router /add-event');
    const session = _sessions.get(req.body.token);
    if (!session) {
        res.status(404).json({ error: 'invalid token', code: 'ENOENT' });
        return;
    }
    session
        .addRecordingEvent(req.body.event)
        .then((result = {}) => {
            result.status = 'ok';
            console.log('RESULT!!!!');
            console.log('result', result);
            res.json(result);
        })
        .catch(next);
});

router.post('/converse', (req, res, next) => {
    const session = _sessions.get(req.body.token);
    if (!session) {
        res.status(404).json({ error: 'invalid token', code: 'ENOENT' });
        return;
    }
    session
        .addNLCommand(req.body.command)
        .then(result => {
            res.json(result);
        })
        .catch(next);
});

router.post('/destroy', (req, res, next) => {
    const session = _sessions.get(req.body.token);
    _sessions.delete(req.body.token);
    if (session) {
        session.destroy().catch(e => {
            console.error(`Failed to stop recording session`, e);
        });
    }
    res.json({ status: 'ok' });
});

router.get('/procedures', (req, res) => {
    const programsObj = new Tp.Helpers.FilePreferences('./named-programs.json');
    const programs = programsObj.keys();
    const procedures = programs.map(procName => {
        const proc = programsObj.get(procName);
        const parsed = ThingTalk.Grammar.parse(proc);
        assert(
            parsed.classes.length === 0 &&
                parsed.declarations.length === 1 &&
                parsed.rules.length === 0,
        );

        const decl = parsed.declarations[0];

        return {
            name: decl.name,
            prettyName: decl.name.split('_')[1],
            args: Object.keys(decl.args),
            prettyArgs: Object.keys(decl.args).map(a => a.split('_')[1]),
            code: proc,
        };
    });

    // Used for sorting programs by name
    const comparePrograms = (a, b) => {
        const aName = a.prettyName;
        const bName = b.prettyName;
        if (aName < bName) {
            return -1;
        } else if (aName > bName) {
            return 1;
        } else {
            return 0;
        }
    };

    res.json(procedures.sort((a, b) => comparePrograms(a, b)));
});

router.get('/token', (req, res) => {
    res.json({
        token: _sessions,
    });
});

module.exports = router;
