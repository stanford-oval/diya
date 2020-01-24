const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.goto('http://localhost:3000/')

  await page.setViewport({ width: 1265, height: 1287 })

  await page.type('body > #chat > .input-wrap > textarea', '')

  await page.type('body > .btn', '')

  await page.type('body > #chat > .input-wrap > textarea', '')

  await page.type('body > .btn', '')

  await page.type('body > #chat > .input-wrap > textarea', '')

  await browser.close()
})()
