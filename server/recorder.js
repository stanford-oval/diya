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
"use strict";

const ThingTalk = require('thingtalk');
const Ast = ThingTalk.Ast;

const crypto = require('crypto');
const express = require('express');
const router = new express.Router();

function makeRandom(size = 32) {
    return crypto.randomBytes(size).toString('hex');
}

function elementIsFocusable(event) {
    const tagName = event.tagName.toLowerCase();
    return (tagName === 'input' && !['submit', 'reset', 'button'].includes(event.inputType)) || tagName === 'textarea';
}
function elementIsActionable(event) {
    const tagName = event.tagName.toLowerCase();
    return (tagName === 'input' && ['submit', 'reset', 'button'].includes(event.inputType)) || tagName === 'button' || tagName === 'a';
}

class RecordingSession {
    constructor() {
        this._statements = [];

        this._currentFocus = null;
        this._currentInput = null;
    }

    _addPuppeteerAction(event, name, params) {
        if (event.frameId || event.frameId === 0)
            params.push(new Ast.InputParam('frame_id', new Ast.Value.Number(event.frameId)));
        if (event.frameUrl)
            params.push(new Ast.InputParam('frame_url', new Ast.Value.Entity(event.frameUrl, 'tt:url', null)));
        if (event.selector)
            params.push(new Ast.InputParam('selector', new Ast.Value.String(event.selector)));

        this._statements.push(new Ast.Statement.Command(null, [
            new Ast.Action.Invocation(new Ast.Invocation(new Ast.Selector.Device('com.google.puppeteer', null, null), name, params, null), null)
        ]));
    }

    _maybeFlushCurrentInput(event) {
        // input events come in a whole bunch, but we only want to record the final one
        // so we wait until the next recorded event or command and maybe flush the current one
        // if the next event is for the same element (selector + frameId + frameUrl) we ignore it
        // and overwrite _currentInput

        if (this._currentInput === null)
            return;

        if (event) {
            if ((event.action === 'change' || event.action === 'select') &&
                event.selector === this._currentInput.selector &&
                event.frameId === this._currentInput.frameId &&
                event.frameUrl === this._currentInput.frameUrl)
                return;
        }

        this._addPuppeteerAction(this._currentInput, 'set_input', [
            new Ast.InputParam('text', new Ast.Value.String(this._currentInput.value))
        ]);
        this._currentInput = null
    }

    async addRecordingEvent(event) {
        switch (event.action) {
        case 'GOTO':
            this._maybeFlushCurrentInput(event);
            this._addPuppeteerAction(event, 'load', [new Ast.InputParam('url', new Ast.Value.Entity(event.href, 'tt:url', null))]);
            break;

        case 'VIEWPORT':
            // ignore
            break;

        case 'click':
        case 'dblclick':
            this._maybeFlushCurrentInput(event);
            if (elementIsFocusable(event))
                this._currentFocus = event;

            if (elementIsActionable(event))
                this._addPuppeteerAction(event, 'click', []);
            break;

        case 'change':
        case 'select':
            this._maybeFlushCurrentInput(event);
            this._currentInput = event;
            break;

        case 'keydown':
            // ignore (we handle change/select events instead)
            break;

        default:
            this._maybeFlushCurrentInput(event);
            // log
            console.log('unknown recording event', event);
        }
    }

    async addNLCommand(command) {
        // TODO send to neural network then add thingtalk code
        console.log('addNLCommand', command);
        return 'command accepted';
    }

    async stop() {
        this._maybeFlushCurrentInput();

        const program = new Ast.Program(/* classes */ [], /* declarations */ [], this._statements, /* principal */ null, /* oninputs */ []);

        const code = program.prettyprint();
        console.log('Generated', code);
        return code;
    }

    async destroy() {
    }
}

const _sessions = new Map;

router.post('/start', (req, res) => {
    const token = makeRandom();
    _sessions.set(token, new RecordingSession());
    res.json({ status: 'ok', token });
});

router.post('/add-event', (req, res, next) => {
    const session = _sessions.get(req.body.token);
    if (!session) {
        res.status(404).json({ error: 'invalid token', code: 'ENOENT' });
        return;
    }
    session.addRecordingEvent(req.body.event).then(() => {
        res.json({ status: 'ok' });
    }).catch(next);
});

router.post('/converse', (req, res, next) => {
    const session = _sessions.get(req.body.token);
    if (!session) {
        res.status(404).json({ error: 'invalid token', code: 'ENOENT' });
        return;
    }
    session.addNLCommand(req.body.command).then((reply) => {
        res.json({ status: 'ok', reply });
    }).catch(next);
});

router.post('/stop', (req, res, next) => {
    const session = _sessions.get(req.body.token);
    if (!session) {
        res.status(404).json({ error: 'invalid token', code: 'ENOENT' });
        return;
    }
    _sessions.delete(req.body.token);
    session.stop().then((code) => {
        res.json({ status: 'ok', code });
    }).catch(next);
});

router.post('/destroy', (req, res, next) => {
    const session = _sessions.get(req.body.token);
    _sessions.delete(req.body.token);
    if (session) {
        session.destroy().catch((e) => {
            console.error(`Failed to stop recording session`, e);
        });
    }
    res.json({ status: 'ok' });
});

module.exports = router;
