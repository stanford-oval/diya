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
const { ParserClient } = require('genie-toolkit');

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
        tagName === 'a' ||
        tagName === 'img' ||
        tagName === 'span'
    );
}

// HACK this should be somewhere else
const namedPrograms = new Tp.Helpers.FilePreferences('./named-programs.json');

class MemoryStore {
    constructor() {
        this._store = {};
    }

    get(key) {
        return this._store[key];
    }

    set(key, value) {
        this._store[key] = value;
    }
}
const PERSISTENT_NAMED_PROGRAMS = true;

class ProgramBuilder {
    constructor() {
        this.name = null;
        this._statements = [];
        this._declaredProcedures = new Map();
        this._declaredVariables = new Map();

        // accumulated arguments (meant for auto argument passing)
        this._accArgs = new Set();

        // HACKS to avoid spurious/broken events
        this.isToplevel = false;
        this.hasGoto = false;
        this.taggedInputs = new Set;

        // value of the selection during recording
        this.selectionValues = new Map;
    }

    trackVariable(varName) {
        this._accArgs.add(varName);
    }

    getTrackedVariables() {
        return this._accArgs;
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

    finishForDeclaration() {
        const args = {};
        for (let [name, [type,]] of this._declaredVariables) args[name] = type;
        const subdeclarations = Array.from(this._declaredProcedures.values());
        const decl = new Ast.FunctionDeclaration(
            null,
            this.name,
            args,
            subdeclarations,
            this._statements,
        );
        const prog = new Ast.Program(null, [], [decl], []);
        const code = prog.prettyprint();
        console.log('Generated', code);
        return code;
    }

    finishForExecution() {
        const prog = this._makeProgram().clone();

        // replace parameters with real values
        for (let slot of prog.iterateSlots2()) {
            if (slot instanceof Ast.DeviceSelector)
                continue;
            const value = slot.get();
            if (value.isVarRef && this._declaredVariables.has(value.name))
                slot.set(this._declaredVariables.get(value.name)[1]);
        }

        const code = prog.prettyprint();
        console.log('Generated', code);
        return code;
    }

    declareVariable(varName, type, value) {
        this._declaredVariables.set(varName, [type, value]);
    }

    addStatement(stmt) {
        this._statements.push(stmt);
    }

    addAction(action) {
        this.addStatement(new Ast.ExpressionStatement(null, action));
    }

    addReturnStatement(action) {
        this.addStatement(new Ast.ReturnStatement(null, action));
    }

    addQueryAction(query, action) {
        this.addStatement(new Ast.ExpressionStatement(null, new Ast.ChainExpression(null, [query, action], action.schema)));
    }

    addNamedQuery(name, query) {
        this.addStatement(
            new Ast.Assignment(null, name, query, query.schema),
        );
    }

    addNamedAction(name, action) {
        this.addStatement(
            new Ast.Assignment(null, name, action, action.schema),
        );
    }

    addNamedQueryAction(name, query, action) {
        this.addStatement(
            new Ast.Assignment(null, name, new Ast.ChainExpression(null, [query, action], action.schema), action.schema),
        );
    }

    addProcedure(decl) {
        this._declaredProcedures.set(decl.name, decl);
    }

    addAtTimedAction(action, stream) {
        this.addStatement(new Ast.ExpressionStatement(null, new Ast.ChainExpression(null, [stream, action], action.schema)));
    }
}

function wordsToVariable(words, prefix = '') {
    if (words === 'this')
        return prefix + 'this';

    // stem all words
    if (!Array.isArray(words)) words = words.split(/\s+/g);

    words = words.map(word => stemmer(word));

    return prefix + words.join('_');
}

class RecordingSession {
    constructor(engine) {
        this._engine = engine;
        this._platform = engine.platform;
        this._parser = ParserClient.get(
            Config.NL_SERVER_URL,
            this._platform.locale,
            this._platform,
            this._engine.thingpedia,
        );

        this._currentFocus = null;
        this._currentInput = null;

        this._builderStack = [new ProgramBuilder()];
        this._builderStack[0].isToplevel = true;
        this._namedPrograms = PERSISTENT_NAMED_PROGRAMS ? namedPrograms : new MemoryStore;
    }

    _pushProgramBuilder() {
        this._builderStack.push(new ProgramBuilder());
    }
    _popProgramBuilder() {
        assert(this._recordingMode);
        this._builderStack.pop();
    }
    get _builder() {
        return this._builderStack[this._builderStack.length-1];
    }
    get _recordingMode() {
        return this._builderStack.length >= 2;
    }

    _addPuppeteerQuery(event, name, params, saveAs) {
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

        this._builder.addNamedQuery(
            saveAs,
            new Ast.InvocationExpression(
                null,
                new Ast.Invocation(
                    null,
                    new Ast.DeviceSelector(
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
            new Ast.InvocationExpression(
                null,
                new Ast.Invocation(
                    null,
                    new Ast.DeviceSelector(
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

        let value = new Ast.Value.String(this._currentInput.value);
        if (this._currentInput.varName) {
            this._builder.declareVariable(
                wordsToVariable(this._currentInput.varName, 'v_'),
                Type.String,
                new Ast.Value.String(this._currentInput.oldvalue)
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
        this._builder.taggedInputs.add(this._currentInput.frameUrl + '#' + this._currentInput.frameId + '#' + this._currentInput.selector);
        this._currentInput = null;
    }

    _doStopRecording(name) {
        const code = this._builder.finishForDeclaration();
        this._namedPrograms.set(this._builder.name, code);
        this._popProgramBuilder();
    }

    async _doRunProgram(builder) {
        console.log('RUNNING PROGRAM!!!');
        const code = builder.finishForExecution();
        const output = await this._engine.createAppAndReturnResults(code, {
            description: 'this is a thingtalk program', // there is a bug in thingtalk where we fail to describe certain programs...
        });

        if (output.errors.length > 0) console.error(output.errors);

        // simplify the way we represent outputs
        const resultselection = [];
        const results = output.results.map((r) => {
            resultselection.push(r.formatted[0]);
            return {
                message: r.formatted[0],
                value: r.raw,
                type: r.type,
            };
        });
        // make errors json serializable
        const errors = output.errors.map((e) => ({
            message: e.message,
            code: e.code,
            status: e.status
        }));

        console.log('doRunProgram Error!!!', errors);
        console.log('doRunProgram Results!!!', results);
        this._builder.selectionValues.set(wordsToVariable('result', 't_'), resultselection);

        return { results, errors };
    }

    async _runProgram(progName, options) {
        let time = null;
        if (options.time)
            time = await parseTime(options.time);
        const params_missing = this._recordProgramCall(
            progName,
            options.args,
            time,
            options.condition,
            options.clipboard,
        );

        if (params_missing && params_missing.length > 0)
            return { params_missing, results: [], errors: [] };

        // make a program that only contains a single statement (plus the procedure declaration)
        // and call it immediately
        const tmpbuilder = await this._makeImmediateProgramCall(progName,
            options.args,
            time,
            options.condition,
            options.clipboard,
        );
        const { results, errors } = await this._doRunProgram(tmpbuilder);
        return { params_missing: [], results, errors };
    }

    _getRelevantStoredArgs(neededArgs) {
        const argSet = this._builder.getTrackedVariables(); // accumulated args
        const result = [];
        // Get args in argSet that are also needed
        for (let item of argSet) {
            if (neededArgs.includes(item)) result.push(item);
        }

        return result;
    }

    _missingArgs(providedArgs, requiredArgs) {
        providedArgs = providedArgs.map((arg) => wordsToVariable(arg, ''));
        const missingArgs = [];
        for (let i = 0; i < requiredArgs.length; i++) {
            const required = wordsToVariable(requiredArgs[i], '');
            if (!providedArgs.includes(required)) {
                missingArgs.push(requiredArgs[i]);
            }
        }

        return missingArgs;
    }

    _makeConstantTable(injectschema, variable, value) {
        // HACK: we use a puppeteer pseudo call to make up a constant and avoid
        // new syntax in ThingTalk
        return new Ast.InvocationExpression(
            null,
            new Ast.Invocation(
                null,
                new Ast.DeviceSelector(
                    null,
                    'com.google.puppeteer',
                    'com.google.puppeteer',
                    null,
                ),
                'inject',
                [new Ast.InputParam(null, 'values', new Ast.Value.Array(value.map((v) => new Ast.Value.String(v))))],
                injectschema,
            ),
            injectschema.removeArgument('values'),
        );
    }

    async _makeImmediateProgramCall(progName, givenArgs, time, condition) {
        progName = wordsToVariable(progName, 'p_');
        const prog = this._namedPrograms.get(progName);
        const parsed = ThingTalk.Syntax.parse(prog);
        assert(
            parsed.classes.length === 0 &&
                parsed.declarations.length === 1 &&
                parsed.declarations[0].name === progName &&
                parsed.statements.length === 0,
        );

        const decl = parsed.declarations[0];

        const requiredArgs = Object.keys(decl.args).map(x => x.split('_')[1]);
        let args = givenArgs;
        let queryArgs = givenArgs;
        if (args.includes('this')) { // if implicit this, default to first required arg
            args = [requiredArgs[0]];
            queryArgs = ['this']; // these args are the variables under which data is actually stored.
        }

        // FIXME we should use an alias here but aliases do not work
        //let in_params = args.map((arg) =>
        //    new Ast.InputParam(null, wordsToVariable(arg, 'v_'), new Ast.Value.VarRef(wordsToVariable(arg, '__t_') + '.text')));
        const in_params = args.map((arg) =>
            new Ast.InputParam(null,
                wordsToVariable(arg, 'v_'),
                new Ast.Value.VarRef('text'),
            ),
        );
        const builder = new ProgramBuilder();
        builder.addProcedure(decl);
        const action = new Ast.FunctionCallExpression(null, progName, in_params, null);

        const injectschema = await this._engine.schemas.getSchemaAndNames('com.google.puppeteer', 'query', 'inject');

        let tables = queryArgs.map((arg) => {
            const variable = wordsToVariable(arg, 't_');
            const value = this._builder.selectionValues.get(variable) || [];
            return this._makeConstantTable(injectschema, variable, value);
        });

        if (condition && condition.value) {
            const { condVar, value, direction } = condition;
            const variable = wordsToVariable(condVar, 't_');
            const condValue = this._builder.selectionValues.get(variable) || [];
            const condTable = new Ast.FilterExpression(
                null,
                this._makeConstantTable(injectschema, variable, condValue),
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

        const query = tables.length ? tables.reduce(
            (t1, t2) => new Ast.ChainExpression(null, [t1, t2], null),
        ) : null;

        if (time) {
            const ttTime = new Ast.Value.Array([Ast.Value.fromJS(
                Type.Time,
                new Builtin.Time(
                    time.getHours(),
                    time.getMinutes(),
                    time.getSeconds(),
                ),
            )]);
            let stream = new Ast.FunctionCallExpression(null, 'attimer', [new Ast.InputParam(null, 'time', ttTime)], null);

            if (query)
                stream = new Ast.ChainExpression(null, [stream, query], null);
            builder.addAtTimedAction(action, stream);
        } else if (query) {
            builder.addQueryAction(query, action);
        } else {
            builder.addAction(action);
        }

        return builder;
    }

    _recordProgramCall(progName, givenArgs, time, condition) {
        progName = wordsToVariable(progName, 'p_');
        const prog = this._namedPrograms.get(progName);
        if (!prog) throw new Error(`No such program ${progName}`);

        const parsed = ThingTalk.Syntax.parse(prog);
        assert(
            parsed.classes.length === 0 &&
                parsed.declarations.length === 1 &&
                parsed.declarations[0].name === progName &&
                parsed.statements.length === 0,
        );

        const decl = parsed.declarations[0];

        const requiredArgs = Object.keys(decl.args).map(x => x.split('_')[1]);
        let args = givenArgs;
        let queryArgs = givenArgs;
        if (args.includes('this')) { // if implicit this, default to first required arg
            args = [requiredArgs[0]];
            queryArgs = ['this']; // these args are the variables under which data is actually stored.
        } else {
            // check if enough args provided
            if (condition && condition.value && requiredArgs.length > 0) {
                // Handling implicit arguments for conditional
                args = this._getRelevantStoredArgs(requiredArgs);
            }
            // if using implicit this argument (i.e. wildcard), handled on frontend
            const missingArgs = this._missingArgs(args, requiredArgs);
            if (missingArgs.length !== 0) {
                // send missing args
                return missingArgs;
            }
        }

        // FIXME we should use an alias here but aliases do not work
        //let in_params = args.map((arg) =>
        //    new Ast.InputParam(null, wordsToVariable(arg, 'v_'), new Ast.Value.VarRef(wordsToVariable(arg, '__t_') + '.text')));
        const in_params = args.map((arg) =>
            new Ast.InputParam(null,
                wordsToVariable(arg, 'v_'),
                new Ast.Value.VarRef('text'),
            ),
        );

        this._builder.addProcedure(decl);
        const action = new Ast.FunctionCallExpression(null, progName, in_params, null);

        let tables = queryArgs.map((arg) =>
                new Ast.FunctionCallExpression(
                    null,
                    wordsToVariable(arg, 't_'),
                    [],
                    null,
                ),
        );

        if (condition && condition.value) {
            const { condVar, value, direction } = condition;
            const condTable = new Ast.FilterExpression(
                null,
                new Ast.FunctionCallExpression(
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

        const query = tables.length ? tables.reduce(
            (t1, t2) => new Ast.ChainExpression(null, [t1, t2], null),
        ) : null;

        if (time) {
            const ttTime = new Ast.Value.Array([Ast.Value.fromJS(
                Type.Time,
                new Builtin.Time(
                    time.getHours(),
                    time.getMinutes(),
                    time.getSeconds(),
                ),
            )]);
            let stream = new Ast.FunctionCallExpression(null, 'attimer', [new Ast.InputParam(null, 'time', ttTime)], null);

            if (query)
                stream = new Ast.ChainExpression(null, [stream, query], null);
            this._builder.addAtTimedAction(action, stream);
        } else if (query) {
            this._builder.addNamedQueryAction(wordsToVariable('result', 't_'), query, action);
        } else {
            this._builder.addNamedAction(wordsToVariable('result', 't_'), action);
        }

        return undefined;
    }

    _doAggregation(operator, varName) {
        const variable = wordsToVariable(varName, 't_');
        const table = new Ast.FunctionCallExpression(
            null,
            variable,
            [],
            null,
        );
        const aggregation = new Ast.AggregationExpression(null, table, 'number', operator, null, null);

        let saveAs = operator === 'avg' ? 'average' : operator;
        this._builder.addNamedQuery(wordsToVariable(saveAs, 't_'), aggregation);

        console.log('aggregation', variable, this._builder.selectionValues.get(variable));

        // return the result immediately
        const values = (this._builder.selectionValues.get(variable) || [])
            .map((v) => parseFloat(v.replace(/[^0-9.]/g, '')));

        let result;
        switch (operator) {
        case 'avg':
            result = values.reduce((x, y) => x+y, 0) / result.length;
            break;
        case 'count':
            result = result.length;
            break;
        case 'sum':
            result = values.reduce((x, y) => x+y, 0);
            break;
        case 'max':
            result = values.reduce((x, y) => Math.max(x, y), -Infinity);
            break;
        case 'min':
            result = values.reduce((x, y) => Math.min(x, y), Infinity);
            break;
        }

        return { params_missing: [], results: [{
            message: String(result),
            value: {
                number: result
            },
            type: operator + '(com.google.puppeteer:select)'
        }], errors: [] };
    }

    _doReturnValue(varName, condition) {
        const table = new Ast.FunctionCallExpression(
            null,
            wordsToVariable(varName, 't_'),
            [],
            null,
        );
        let tables = [table];
        if (condition && condition.value) {
            const { condvar, value, direction } = condition;
            if (condvar !== varName) {
                const condTable = new Ast.FunctionCallExpression(
                    null,
                    new Ast.FunctionCallExpression(
                        null,
                        wordsToVariable(condvar, 't_'),
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
            } else {
                tables[0] = new Ast.FilterExpression(null, table,
                    new Ast.BooleanExpression.Atom(
                        null,
                        'number',
                        direction,
                        new Ast.Value.Number(parseInt(value)),
                    ),
                    null,
                );
            }
        }

        const query = tables.reduce((t1, t2) => new Ast.ChainExpression(null, [t1, t2], null));
        this._builder.addReturnStatement(query);
    }

    _handleThisIsA(event) {
        this._maybeFlushCurrentInput(event);
        if (event.tagName) {
            // tagged a variable inside an input
            this._currentInput = event;
        } else {
            const variable = wordsToVariable(event.varName, 't_');
            this._builder.selectionValues.set(variable, event.value);

            // tagged a selection
            this._addPuppeteerQuery(
                event,
                'select',
                [],
                variable,
            );
        }

        // Keep track of args for auto argument passing
        this._builder.trackVariable(event.varName);
    }

    async addRecordingEvent(event) {
        switch (event.action) {
            case 'START_RECORDING':
                this._accRecArgs = new Set();
                // reset the selection state when the user clicks start
                this._currentInput = null;
                this._currentSelection = null;
                this._pushProgramBuilder();
                this._builder.name = wordsToVariable(event.funcName, 'p_');
                break;

            case 'STOP_RECORDING':
                this._maybeFlushCurrentInput(event);
                this._doStopRecording(event.varName);
                break;

            case 'GOTO':
                this._maybeFlushCurrentInput(event);

                if (this._builder.isToplevel) {
                    // at the top level, discard everything recorded so far
                    this._builderStack = [new ProgramBuilder()];
                    this._builderStack[0].isToplevel = true;
                }

                if (this._builder.hasGoto)
                    break;
                this._builder.hasGoto = true;
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
                // after tagging a variable we'll get a change event for the same input
                // but we don't want to add a set_input with a constant
                if (this._currentInput && this._currentInput.varName &&
                    event.selector === this._currentInput.selector &&
                    event.frameId === this._currentInput.frameId &&
                    event.frameUrl === this._currentInput.frameUrl)
                    break;
                if (this._builder.taggedInputs.has(event.frameUrl + '#' + event.frameId + '#' + event.selector))
                    break;

                this._maybeFlushCurrentInput(event);
                this._currentInput = event;
                break;

            case 'RETURN_VALUE':
                this._maybeFlushCurrentInput(event);
                this._doReturnValue(event.varName, event.condition);
                break;

            case 'AGGREGATION':
                this._maybeFlushCurrentInput(event);
                return this._doAggregation(event.operator, event.varName);

            case 'RUN_PROGRAM':
                this._maybeFlushCurrentInput(event);

                return this._runProgram(event.varName, {
                    args: event.args,
                });

            case 'RUN_PROGRAM_WITH_CLIPBOARD':
                this._maybeFlushCurrentInput(event);

                return this._runProgram(event.varName, {
                    args: event.args,
                    clipboard: event.clipboard,
                });

            case 'RUN_PROGRAM_IF':
                this._maybeFlushCurrentInput(event);
                return this._runProgram(event.varName, {
                    args: [],
                    condition: {
                        condVar: event.condVar,
                        value: event.value,
                        direction: event.direction,
                    },
                });

            case 'SCHEDULE_PROGRAM':
                this._maybeFlushCurrentInput(event);
                return this._runProgram(event.varName, {
                    args: event.args,
                    time: event.time,
                });

            case 'keydown':
            case 'select':
                // ignore (we handle change events instead)
                break;

            default:
                // log
                console.log('unknown recording event', event);
                //this._maybeFlushCurrentInput(event);
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
            if (!(slot instanceof Ast.DeviceSelector)) continue;
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
        this._statements.push(...program.statements);
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
    const session = _sessions.get(req.body.token);
    if (!session) {
        res.status(404).json({ error: 'invalid token', code: 'ENOENT' });
        return;
    }
    session
        .addRecordingEvent(req.body.event)
        .then((result = {}) => {
            result.status = 'ok';
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
        const parsed = ThingTalk.Syntax.parse(proc);
        assert(
            parsed.classes.length === 0 &&
                parsed.declarations.length === 1 &&
                parsed.statements.length === 0,
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
