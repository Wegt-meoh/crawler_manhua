import puppeteer from 'puppeteer';
import fsPromise from "node:fs/promises"
import path from 'node:path';
import { sleep, getRandomIntInRange, fetchWithTimeout } from './utils.js';

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

// Navigate the page to a URL.
await page.goto(target, { waitUntil: 'domcontentloaded' });

// Query all main content link
const anchors = await page.$$eval('.all_data_list a',
    anchors => anchors.map(a =>
        ({ title: a.title, href: a.href })
    )
);
const isAscending = await page.$$eval('.fed-drop-head a', anchors =>
    anchors.reduce((prevValue, anchor) =>
        prevValue + anchor.innerText
        , ''
    ).includes('正序') ? true : false
)
if (isAscending) {
    anchors.reverse()
}

// Main work
const resume = 515;
const dataType = {
    'NUMBER_ARRAY': 0,
    'BASE64_STRING': 1
}
outerloop: for (let i = resume; i < anchors.length; i++) {
    try {
        // Navigate to main content page
        await page.goto(anchors[i].href, { referer: target })

        // Scroll to the bottom of the page until all images have been loaded
        let prevScrollHeight = -10
        while (true) {
            // Scroll to the bottom
            await page.evaluate(() => window.scrollTo({ left: 0, top: document.body.scrollHeight }))
            // Wait for images loaded
            await page.waitForFunction(() => {
                const imageList = Array.from(document.querySelectorAll('.mh_comicpic>img[src]'))
                const isAllImagesLoaded = imageList.every(image => image.complete && image.naturalWidth > 0)
                return isAllImagesLoaded
            })
            // Get total height of the page     
            const scrollHeight = await page.evaluate(() => {
                return document.body.scrollHeight;
            });
            if (prevScrollHeight === scrollHeight) {
                // All images have been loaded
                break
            }
            prevScrollHeight = scrollHeight
            await sleep(getRandomIntInRange(1, 3) * 1000)
        }

        // Inject NodeJs variables and functions into browser
        await page.evaluate((fn, dataType) => {
            window.fetchWithTimeout = new Function(`return ${fn}`)()
            window.dataType = JSON.parse(dataType)
        }, fetchWithTimeout.toString(), JSON.stringify(dataType))

        // Get images data     
        const imageDataList = await page.evaluate(async () => {
            const result = []
            const imageElements = document.querySelectorAll('.mh_comicpic img[src]')
            const cavans = document.createElement('canvas')
            const context = cavans.getContext('2d')

            for (let imageElement of imageElements) {
                try {
                    // Try fetch data over network 
                    const response = await fetchWithTimeout(imageElement.src, {}, 5000, 3)
                    const arrayBuffer = await response.arrayBuffer()

                    result.push({
                        name: imageElement.src.split('/').pop(),
                        dataType: dataType.NUMBER_ARRAY,
                        data: Array.from(new Uint8Array(arrayBuffer))
                    })
                } catch {
                    // If failed, get the image data from image element
                    result.push(await new Promise(res => {
                        imageElement.onload = () => {
                            cavans.width = imageElement.width
                            cavans.height = imageElement.height

                            context.drawImage(imageElement, 0, 0)
                            const base64Data = cavans.toDataURL().replace(/^data:image\/png;base64,/, '')
                            res({
                                name: imageElement.src.split('/').pop() + '.png',
                                dataType: dataType.BASE64_STRING,
                                data: base64Data
                            })
                        }

                        imageElement.onerror = () => {
                            throw new Error(`Image onerror, image src:${imageElement.src}`)
                        }

                        if (imageElement.complete) {
                            if (imageElement.naturalWidth > 0) {
                                imageElement.onload()
                            } else {
                                imageElement.onerror()
                            }
                        }
                    }))
                }
            }
            return result
        })

        const dowloadDir = path.join(outputDir, path.basename(target), i + '_' + anchors[i].title)
        await fsPromise.mkdir(dowloadDir, { recursive: true })

        await Promise.all(imageDataList.map(image => {
            const savePath = path.join(dowloadDir, image.name)
            switch (image.dataType) {
                case dataType.NUMBER_ARRAY:
                    return fsPromise.writeFile(savePath, Buffer.from(image.data))
                case dataType.BASE64_STRING:
                    return fsPromise.writeFile(savePath, image.data, 'base64')
                default:
                    throw new Error(`Unknown data type: ${image.type}, when write image data`)
            }
        }))
        await sleep(getRandomIntInRange(5, 10) * 1000)
    } catch (error) {
        switch (error.name) {
            case 'TimeoutError':
                i -= 1
                await sleep(getRandomIntInRange(5, 10) * 1000)
                console.error('capture error retry again the error is', error)
                break
            default:
                console.error('catch unhandled error, terminal program, the error is', error)
                break outerloop
        }
    }
}

// Finish
await browser.close();