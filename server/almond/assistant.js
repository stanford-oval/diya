// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const assert = require('assert');
const events = require('events');

const Almond = require('almond-dialog-agent');

const Config = require('../config');

class LocalUser {
    constructor() {
        this.id = process.getuid();
        this.account = '';//pwnam.name;
        this.name = '';//pwnam.gecos;
    }
}

class StatelessConversationDelegate {
    constructor(locale) {
        this._locale = locale;
        this._buffer = [];
        this._askSpecial = null;
    }

    flush() {
        const buffer = this._buffer;
        const askSpecial = this._askSpecial;
        this._buffer = [];
        this._askSpecial = null;
        return {
            messages: buffer,
            askSpecial: askSpecial
        };
    }

    send(text, icon) {
        this._buffer.push({ type: 'text', text, icon });
    }

    sendPicture(url, icon) {
        this._buffer.push({ type: 'picture', url, icon });
    }

    sendChoice(idx, what, title, text) {
        this._buffer.push({ type: 'choice', idx, title, text });
    }

    sendLink(title, url) {
        this._buffer.push({ type: 'link', title, url });
    }

    sendButton(title, json) {
        this._buffer.push({ type: 'button', title, json });
    }

    sendRDL(rdl, icon) {
        this._buffer.push({ type: 'rdl', rdl, icon });
    }

    sendResult(message, icon) {
        this._buffer.push({
            type: 'result',
            result: message,

            fallback: message.toLocaleString(this._locale),
            icon
        });
    }

    sendAskSpecial(what) {
        assert(this._askSpecial === null);
        this._askSpecial = what;
    }
}

module.exports = class Assistant extends events.EventEmitter {
    constructor(engine) {
        super();

        this._engine = engine;
        this._platform = engine.platform;

        this._statelessConversation = new Almond(engine, 'stateless', new LocalUser(), new StatelessConversationDelegate(this._platform.locale), {
            sempreUrl: Config.NL_SERVER_URL,
            showWelcome: false
        });

        this._conversations = {
            stateless: this._statelessConversation
        };
        this._lastConversation = this._mainConversation;
    }

    async converse(command) {
        const conversation = this._conversations.stateless;
        const delegate = conversation._delegate;

        switch (command.type) {
        case 'command':
            await conversation.handleCommand(command.text);
            break;
        case 'parsed':
            await conversation.handleParsedCommand(command.json, command.title || '');
            break;
        case 'tt':
            await conversation.handleThingTalk(command.code);
            break;
        default:
            throw new Error('Invalid command type ' + command.type);
        }

        const result = delegate.flush();
        result.conversationId = conversation.id;
        return result;
    }

    hotword() {
        if (!this._speechHandler)
            return;
        this._speechHandler.hotword();
    }

    parse(sentence, target) {
        return this._api.parse(sentence, target);
    }
    createApp(data) {
        return this._api.createApp(data);
    }
    addOutput(out) {
        this._api.addOutput(out);
    }
    removeOutput(out) {
        this._api.removeOutput(out);
    }

    async startConversation() {
        await this._statelessConversation.start();
    }

    notifyAll(...data) {
        return Promise.all(Object.keys(this._conversations).map((id) => {
            if (id === 'stateless')
                return Promise.resolve();
            return this._conversations[id].notify(...data);
        }));
    }

    notifyErrorAll(...data) {
        return Promise.all(Object.keys(this._conversations).map((id) => {
            if (id === 'stateless')
                return Promise.resolve();
            return this._conversations[id].notifyError(...data);
        }));
    }

    getConversation(id) {
        if (id !== undefined && this._conversations[id])
            return this._conversations[id];
        else if (this._lastConversation)
            return this._lastConversation;
        else
            return this._mainConversation;
    }

    openConversation(feedId, delegate) {
        if (this._conversations[feedId])
            delete this._conversations[feedId];
        var conv = new Almond(this._engine, feedId, new LocalUser(), delegate, {
            sempreUrl: Config.NL_SERVER_URL,
            showWelcome: true
        });
        conv.on('active', () => this._lastConversation = conv);
        this._lastConversation = conv;
        this._conversations[feedId] = conv;
        return conv;
    }

    closeConversation(feedId) {
        if (this._conversations[feedId] === this._lastConversation)
            this._lastConversation = null;
        delete this._conversations[feedId];
    }
};
