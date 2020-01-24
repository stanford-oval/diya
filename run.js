const puppeteer = require('puppeteer');



// names = process.argv = process.argv.slice(2)

names = ['Michael', 'Gabi']
emails = ['michael@michael.com', 'gabi@gabi.com']

for (let i = 0, p = Promise.resolve(); i < names.length; i++) {

	p = p.then(_ => new Promise(resolve =>
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
		})()
	))
}


// p = p.then(_ => new Promise(resolve =>
	// setTimeout(function () {
		// console.log(i);
		// resolve();
	// }, Math.random() * 1000)
// ));

// process.argv.forEach(function (val, index, array) {

// 	console.log(index + ': ' + val);
// // 		(async () => {

// // 			const browser = await puppeteer.launch({
// // 				headless: false,
// // 				slowMo: 100
// // 			});

// // 			const page = await browser.newPage()

// // 			await page.goto('http://localhost:3000/')
// // 			await page.setViewport({ width: 2560, height: 1297 })
		  
// // 			await page.waitForSelector('body')
// // 			await page.click('body')

// // 			await page.waitForSelector('body > textarea')
// // 			await page.click('body > textarea')

// // 			await page.type('body > textarea', 'hello my name is ' + val)

// // 			await page.waitForSelector('body > #send')
// // 			await page.click('body > #send')
// // 			await browser.close()
// // 		})()
// });







// (async ()=>{
// 	for (var i = 0; i < 10 ; i++) {
// 		await new Promise(
// 			// function(resolve){   
// 				// setTimeout(resolve, Math.random()*1000)

// 				// (async () => {
// 				// 	const page = await browser.newPage()

// 					// await page.goto('http://localhost:3000/')
// 					// await page.setViewport({ width: 2560, height: 1297 })

// 					// await page.waitForSelector('body')
// 					// await page.click('body')

// 					// await page.waitForSelector('body > textarea')
// 					// await page.click('body > textarea')

// 					// await page.type('body > textarea', 'hello my name is ' + name)

// 					// await page.waitForSelector('body > #send')
// 					// await page.click('body > #send')
// 					// await browser.close()
// 				// })()

// 			console.log(i)
// 		)
// 	}
// }
// )()