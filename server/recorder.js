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
const { ParserClient } = require('almond-dialog-agent');

const crypto = require('crypto');
const express = require('express');
const stemmer = require('stemmer');
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
    this.addStatement(
      new Ast.Statement.Assignment(null, name, query, query.schema),
    );
  }

  addProcedure(decl) {
    this._declaredProcedures.set(decl.name, decl);
  }

  addStream(time) {
    const stream = 0;

    this.addStatement(
      new Ast.Statement.Rule(
        null,
        stream,
        null,
      )
    );
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

    this._engine = engine;
    this._platform = engine.platform;
    this._parser = new ParserClient(
      Config.NL_SERVER_URL,
      this._platform.locale,
      this._platform.getSharedPreferences(),
    );

    this._currentFocus = null;
    this._currentInput = null;

    this._recordingMode = false;
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
      if (operands.length > 1) value = new Ast.Value.Computation('+', operands);
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
    await this._engine.createApp(this._builder.finish(), {
      description: 'a program created with Nightmare', // there is a bug in thingtalk where we fail to describe certain programs...
    });
  }

  async _runProgram(progName, args) {
    console.log('_runProgram', progName, args);
    this._recordProgramCall(progName, args);

    if (!this._recordingMode) {
      await this._doRunProgram();
      this._builder = new ProgramBuilder();
    }
  }

  async _scheduleProgram(progName, time, args) {
    console.log('_scheduleProgram', progName, time, args);
    this._recordProgramCall(progName, args);

    if (!this._recordingMode) {
      await this._doRunProgram();
      this._builder = new ProgramBuilder();
    }
  }

  _recordProgramCall(progName, args, time) {
    progName = wordsToVariable(progName, 'p_');
    const prog = namedPrograms.get(progName);
    if (!prog) throw new Error(`No such program ${progName}`);

    const parsed = ThingTalk.Grammar.parse(prog);
    assert(
      parsed.classes.length === 0 &&
        parsed.declarations.length === 1 &&
        parsed.declarations[0].name === progName &&
        parsed.rules.length === 0,
    );

    const decl = parsed.declarations[0];

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

    this._builder.addProcedure(decl);
    const action = new Ast.Action.VarRef(null, progName, in_params, null);
    if (args.length > 0) {
      const tables = args.map(
        arg => new Ast.Table.VarRef(null, wordsToVariable(arg, 't_'), [], null),
      );
      const query = tables.reduce(
        (t1, t2) => new Ast.Table.Join(null, t1, t2, [], null),
      );
      this._builder.addQueryAction(query, action);
    } else {
      this._builder.addAction(action);
    }
  }

  _handleThisIsA(event) {
    this._maybeFlushCurrentInput(event);
    if (event.tagName) {
      // tagged a variable inside an input
      this._currentInput = event;
    } else {
      // tagged a selection
      this._addPuppeteerQuery(
        event,
        'select',
        [],
        wordsToVariable(event.varName, 't_'),
      );
    }
  }

  async addRecordingEvent(event) {
    switch (event.action) {
      case 'START_RECORDING':
        // reset the selection state when the user clicks start
        this._currentInput = null;
        this._currentSelection = null;
        this._builder = new ProgramBuilder();
        this._recordingMode = true;
        break;

      case 'STOP_RECORDING':
        this._recordingMode = false;
        return { code: this._builder.finish() };

      case 'GOTO':
        console.log(event);
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

      case 'RUN_PROGRAM':
        this._maybeFlushCurrentInput(event);
        this._runProgram(event.varName, event.args);
        break;

      case 'SCHEDULE_PROGRAM':
        this._maybeFlushCurrentInput(event);
        // this._scheduleProgram(event.varName, event.time, event.args);
        break;

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
    return this._engine.thingpedia.getDeviceSetup([kind]).then(factories => {
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
      program = ThingTalk.NNSyntax.fromNN(candidate.code, parsed.entities);
      await program.typecheck(this._engine.schemas, true);
    } catch (e) {
      console.error(
        'Failed to analyze ' + candidate.code.join(' ') + ' : ' + e.message,
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
      return { reply: 'Sorry, I did not understand that.', status: 'noparse' };

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

module.exports = router;
