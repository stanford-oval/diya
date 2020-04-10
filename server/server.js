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

const express = require('express');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const Engine = require('thingengine-core');
const AssistantDispatcher = require('./almond/assistant');
const platform = require('./almond/platform');
const Config = require('./config');

async function runThingTalk(engine, code) {
    console.log('*****RUNNING THINGTALK*****');
    const app = await engine.createApp(code, {});

    // drain the queue of results from the app
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
                results.push({
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

    return { results, errors };
}

function initFrontend(db) {
    const app = express();
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    app.set('port', port);

    app.set('view engine', 'ejs');

    app.use(
        '/css',
        express.static(path.join(path.dirname(module.filename), 'css')),
    );
    app.use(
        '/js',
        express.static(path.join(path.dirname(module.filename), 'js')),
    );

    // logger
    app.use(morgan('dev'));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    app.use('/recorder', require('./recorder'));

    app.get('/simple_button', (req, res) => {
        res.render('simple_button');
    });

    app.get('/simple_text', (req, res) => {
        res.render('simple_text');
    });

    app.get('/for_each_emails', (req, res) => {
        res.render('for_each_emails');
    });

    app.get('/for_each_stocks', (req, res) => {
        res.render('for_each_stocks');
    });

    app.get('/if_stocks', (req, res) => {
        res.render('if_stocks');
    });

    app.get('/if_restaurants', (req, res) => {
        res.render('if_restaurants');
    });

    app.get('/trigger_action_restaurants', (req, res) => {
        res.render('trigger_action_restaurants');
    });

    app.get('/trigger_action_stocks', (req, res) => {
        res.render('trigger_action_stocks');
    });

    app.get('/filter_restaurants', (req, res) => {
        res.render('filter_restaurants');
    });

    app.get('/filter_stocks', (req, res) => {
        res.render('filter_stocks');
    });

    app.get('/nlp_stocks', (req, res) => {
        res.render('nlp_stocks');
    });

    app.get('/nlp_restaurants', (req, res) => {
        res.render('nlp_restaurants');
    });

    app.get('/other', (req, res) => {
        res.render('other');
    });

    app.get('/sheets', (req, res) => {
        res.render(path.join(__dirname + '/sheets.html'));
    });

    app.get('/about', (req, res) => {
        res.render('about');
    });

    app.get('/cheatsheet', (req, res) => {
        res.render('cheatsheet');
    });

    app.get('/state', (req, res) => {
        res.render('state/state');
    });

    app.get('/survey', (req, res) => {
        res.render('survey');
    });

    app.post('/record-utterance', (req, res) => {
        console.log('Recording Utterance!');
        const utterance = req.body.utterance;
        const user = req.body.user;
        if (!utterance) res.status(400).json({ status: 'error' });

        db.get('utterances')
            .push({
                timestamp: new Date().toLocaleString(),
                text: utterance,
                user: user,
            })
            .write();

        res.status(200).json({
            status: 'ok',
        });
    });

    app.get('/', (req, res) => {
        res.render('about');
    });

    app.post('/devices/create', (req, res, next) => {
        app.engine.devices.addSerialized(req.body).then(d => {
            res.json({
                status: 'ok',
                data: app.engine.getDeviceInfo(d.uniqueId),
            });
        });
    });

    app.post('/run', (req, res, next) => {
        console.log('RUN ENDPOINT');

        if (!req.body.code) {
            res.status(400).json({ error: 'Missing code', code: 'EINVAL' });
            return;
        }

        runThingTalk(app.engine, req.body.code)
            .then(result => {
                res.json({ status: 'ok', data: result });
            })
            .catch(next);

        /*const names = req.body.names
        // const code = req.body.code

	    code = `
		    (async () => {
			    const browser = await puppeteer.launch({
				    headless: false,
				    slowMo: 100
			    });
			    const page = await browser.newPage()
			    await page.goto('http://localhost:3000/')
			    await page.setViewport({ width: 1278, height: 1319 })
			    await page.waitForSelector('body > input:nth-child(7)')
			    await page.click('body > input:nth-child(7)')
			    await page.type('body > input:nth-child(7)', emails[i])
			    await page.type('body > textarea', 'my name is ' + names[i])
			    await page.waitForSelector('body > #send')
			    await page.click('body > #send')
			    await page.waitForSelector('body > #send')
			    await page.click('body > #send')
			    await page.waitForSelector('body')
			    await page.click('body')
			    await browser.close()
			    resolve()
		    })()`

	    emails = ['michael@michael.com', 'gabi@gabi.com']

	    for (let i = 0, p = Promise.resolve(); i < names.length; i++) {
		    p = p.then(_ => new Promise(resolve =>
			    eval(code)
		    ))
	    }

	    // require('child_process').fork('./../run.js aaaaaa');
	    // res.send('run response')
	    // res.send(req.query)
	    */
    });

    // app.all('/get_thingtalk', urlencodedparser, function (req, res){
    // 	command = req.body.command
    // 	log_command(command)
    // 	$.ajax({
    // 		url: "https://nlp-staging.almond.stanford.edu/@demo.css.models/en-US/query?q="+command,
    // 		// url: "https://almond-dev.stanford.edu/nnparser/en-US/query?q="+command,
    // 		type: "GET",
    // 		success: function(response){
    // 			// console.log(response['candidates'][0])
    // 			res.send(response)
    // 			return
    // 		},
    // 		error: function(response){
    // 			console.log("error")
    // 			res.send(response)
    // 			return
    // 		}
    // 	});
    // });

    return app;
}

async function main() {
    let stopped = false;
    let running = false;
    let engine, frontend, ad;

    function handleStop() {
        if (running) engine.stop();
        else stopped = true;
    }

    process.on('SIGINT', handleStop);
    process.on('SIGTERM', handleStop);

    engine = new Engine(platform, { thingpediaUrl: Config.THINGPEDIA_URL });

    // Local db
    const dbFilename = 'db.json';
    const adapter = new FileSync('db.json');
    const db = low(adapter);

    const jsonFileIsEmpty = filename => {
        const json = JSON.parse(fs.readFileSync(filename));
        return !Object.keys(json).length;
    };

    if (!fs.existsSync(dbFilename) || jsonFileIsEmpty(dbFilename)) {
        db.defaults({ utterances: [] }).write();
    }

    frontend = initFrontend(db);
    frontend.engine = engine;

    ad = new AssistantDispatcher(engine);
    platform.setAssistant(ad);
    await engine.open();

    frontend.listen(frontend.get('port'), () => {
        console.log(
            'Nightmare server listening on port 3000! Go to http://localhost:3000/',
        );
    });

    try {
        try {
            console.log('Ready');
            if (!stopped) {
                running = true;
                await ad.startConversation();
                await engine.run();
            }
        } finally {
            try {
                await engine.close();
            } catch (error) {
                console.log('Exception during stop: ' + error.message);
                console.log(error.stack);
            }
        }
    } catch (error) {
        console.error('Uncaught exception: ' + error.message);
        console.error(error.stack);
    } finally {
        console.log('Cleaning up');
        platform.exit();
    }
}

main();
