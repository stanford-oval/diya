const puppeteer = require('puppeteer');

var express = require('express')
var app = express();
const fs = require('fs');
var path = require('path');

var app = express();
const port = 3000

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())


app.post('/auth', (req, res) => {
    console.log(req.body) //undefined
    res.end("Success")  
})


app.get('/static/', function (req, res){
	res.sendFile(path.join(__dirname, 'src/css/style.css'));
});

app.get('/', function (req, res){
	console.log('index')
	res.sendFile(path.join(__dirname+'/index.html'));
});

app.get('/sheets', function (req, res){
	console.log('sheets')
	res.sendFile(path.join(__dirname+'/sheets.html'));
});

app.all('/run', function (req, res){

    const names = req.body.names
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

app.listen(3000, function () {
	console.log('Example app listening on port 3000! Go to http://localhost:3000/')
})
