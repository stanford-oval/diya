// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2020 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Tp = require('thingpedia');
const puppeteer = require('puppeteer');

class PuppeteerSession {
    constructor() {
    }

    async init() {
        console.log('PUPPETEER LAUNCH!');
        this._browser = await puppeteer.launch({
            // debugging:
            headless: false,
            slowMo: 100
        });
        this._page = await this._browser.newPage();

        this._frames = null;
    }

    async destroy() {
        if (this._browser)
            await this._browser.close();
        this._browser = null;
    }

    async load(url) {
        this._frames = null;
        await this._page.goto(url);
    }

    async _getFrame(frameUrl) {
        if (this._frames === null)
            this._frames = await this._page.frames();

        return this._frames.find((frame) => frame.url() === frameUrl) || this._page;
    }

    async click(frameUrl, selector) {
        const frame = await this._getFrame(frameUrl);
        await frame.waitForSelector(selector);
        await frame.click(selector);
    }

    async setInput(frameUrl, selector, text) {
        const frame = await this._getFrame(frameUrl);
        await frame.waitForSelector(selector);

        const element = await frame.$(selector);
        // select everything
        await element.click({ clickCount: 3 });
        // erase
        await element.press('Backspace');
        // type
        await element.type(text);
    }

    async select(frameUrl, selector) {
        const frame = await this._getFrame(frameUrl);
        await frame.waitForSelector(selector);

        const values = await frame.$$eval(selector, (elements) => elements.map((el) => el.textContent));
        return values.map((v) => ({ text: v, number: parseInt(v) }));
    }
}

module.exports = class PuppeeterDevice extends Tp.BaseDevice {
    constructor(engine, state) {
        super(engine, state);

        this._sessions = new Map;
    }

    async _getSession(env) {
        const appId = env.app.uniqueId;
        let session = this._sessions.get(appId);
        if (session)
            return session;

        session = new PuppeteerSession();
        this._sessions.set(appId, session);
        env.engine.apps.on('app-removed', (app) => {
            if (app === env.app) {
                this._sessions.delete(appId);
                session.destroy();
            }
        });
        await session.init();
        console.log('Created new Puppeteer session');
        return session;
    }

    async get_inject({ values }) {
        return values.map((v) => ({ text: v }));
    }

    async get_select({ frame_url, selector }, filter, env) {
        return (await this._getSession(env)).select(String(frame_url), selector);
    }

    async do_load({ url }, env) {
        return (await this._getSession(env)).load(String(url));
    }

    async do_set_input({ frame_url, selector, text }, env) {
        return (await this._getSession(env)).setInput(String(frame_url), selector, text);
    }

    async do_click({ frame_url, selector }, env) {
        return (await this._getSession(env)).click(String(frame_url), selector);
    }
};
