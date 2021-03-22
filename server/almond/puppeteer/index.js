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
            slowMo: 100,
            headless: false,
            defaultViewport: null,
            //executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
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
        await frame.waitForSelector(selector, { timeout: 10000 });
        await frame.click(selector);
    }

    async setInput(frameUrl, selector, text) {
        const frame = await this._getFrame(frameUrl);
        await frame.waitForSelector(selector, { timeout: 10000 });

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
        await frame.waitForSelector(selector, { timeout: 10000 });

        const values = await frame.$$eval(selector, (elements) => elements.map((el) => el.textContent));
        return values.map((v) => {
            // sometimes, in walmart the returned text is duplicated ("$5.98$5.98")
            // detect that case and fix it
            const match = /(.*)\s*\1/.exec(v);
            if (match)
                v = match[1];

            return ({ text: v, number: parseFloat(v.replace(/[^0-9.]/g, '')) });
        });
    }
}

module.exports = class PuppeteerDevice extends Tp.BaseDevice {
    constructor(engine, state) {
        super(engine, state);

        this._sessions = new Map;


        console.log('created puppeteer device');
    }

    async _getSession(env) {
        console.log('puppeteer getSession');

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
        return values.map((v) => ({ text: v, number: Math.floor(parseFloat(v.replace(/[^0-9.]/g, ''))) }));
    }

    async get_select({ frame_url, selector }, filter, env) {
        return (await this._getSession(env)).select(String(frame_url), selector);
    }

    async do_load({ url }, env) {
        console.log('do_load');
        return (await this._getSession(env)).load(String(url));
    }

    async do_set_input({ frame_url, selector, text }, env) {
        return (await this._getSession(env)).setInput(String(frame_url), selector, text);
    }

    async do_click({ frame_url, selector }, env) {
        return (await this._getSession(env)).click(String(frame_url), selector);
    }
};
