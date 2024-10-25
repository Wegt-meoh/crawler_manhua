import puppeteer from 'puppeteer';
import getPageLinks from './getPageLink.js'
import work from './core.js';

const target = 'https://www.colamanga.com/manga-rt21385'
const outputDir = 'output1'

// Launch the browser and open a new blank page
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Set screen size.
await page.setViewport({ width: 1080, height: 1024 });

// Bind console listener
page.on('console', (msg) => {
    if (msg.type !== 'error') return;
    console.log(`Browser console ${msg.type}: ${msg.text()}`);
});

// Get all pages link
const anchors = await getPageLinks(target, page)

// Main work
await work(target, outputDir, anchors, page)

// Finish
await browser.close();