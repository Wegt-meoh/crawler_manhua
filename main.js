import puppeteer from 'puppeteer';
import fs from "node:fs/promises"
import path from 'node:path';
import { sleep, getRandomIntInRange } from './utils.js';

const target = 'https://www.colamanga.com/manga-rt21385'
const outputDir = 'output'

// Launch the browser and open a new blank page
const browser = await puppeteer.launch();
const page = await browser.newPage();
page.on('console', (msg) => {
    console.log('Browser console log:', msg.text());
});

// Navigate the page to a URL.
await page.goto(target);

// Set screen size.
await page.setViewport({ width: 1080, height: 1024 });

const isAscending = await page.$$eval('.fed-drop-head a', anchors => anchors.reduce((prevValue, anchor) => {
    return prevValue + anchor.innerText
}, '').includes('正序') ? true : false)

let anchors = await page.$$eval('.all_data_list a', anchors => anchors.map(a => ({ title: a.title, href: a.href })));
if (isAscending) {
    anchors.reverse()
}

// test
anchors = anchors.slice(201, 206)

for (let i = 0; i < anchors.length; i++) {
    await page.goto(anchors[i].href, { referer: target, waitUntil: 'networkidle0' })
    await page.addScriptTag({ path: path.resolve('browser.js') })


    let prevScrollHeight = -10
    while (true) {
        await page.evaluate(() => window.scrollTo({ left: 0, top: document.body.scrollHeight }))

        try {
            await page.waitForNetworkIdle()
        } catch {
            prevScrollHeight = -10
            await page.reload()
            continue
        }

        await sleep(300)

        const scrollHeight = await page.evaluate(() => {
            return document.body.scrollHeight;  // Total height of the page                                       
        });

        if (prevScrollHeight === scrollHeight) {
            break
        }

        prevScrollHeight = scrollHeight
    }

    const imageList = await page.evaluate(async () => {
        const nameAndDataList = []
        const imageUrlList = Array.from(document.querySelectorAll('.mh_comicpic img[src]')).map(n => n.src)
        const imageNameList = imageUrlList.map(url => url.split('/').pop())

        for (let i = 0; i < imageUrlList.length; i++) {
            const response = await window.fetchWithTimeout(imageUrlList[i])
            const arrayBuffer = await response.arrayBuffer()

            nameAndDataList.push({ name: imageNameList[i], data: Array.from(new Uint8Array(arrayBuffer)) })
        }

        return nameAndDataList
    })

    const dowloadDir = path.join(outputDir, path.basename(target), i + '_' + anchors[i].title);
    await fs.mkdir(dowloadDir, { recursive: true })
    await Promise.all(imageList.map(image => fs.writeFile(path.join(dowloadDir, image.name), Buffer.from(image.data))))
    await sleep(getRandomIntInRange(5, 10) * 1000)
}

await browser.close();