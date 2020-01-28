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

const crypto = require('crypto');
const express = require('express');
const router = new express.Router();

function makeRandom(size = 32) {
    return crypto.randomBytes(size).toString('hex');
}

class RecordingSession {
    constructor() {
        this._statements = [];
    }

    async addRecordingEvent(event) {
        console.log('addRecordingEvent', event);
        // TODO convert to a thingtalk statement...
    }

    async addNLCommand(command) {
        // TODO send to neural network then add thingtalk code
        console.log('addNLCommand', command);
        return 'command accepted';
    }

    async stop() {
        return `now => @com.twitter.post(status="hello");`;
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
