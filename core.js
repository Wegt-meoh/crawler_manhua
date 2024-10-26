import fsPromise from "node:fs/promises"
import path from 'node:path';
import { sleep, getRandomIntInRange, fetchWithTimeout, dataType } from './utils.js';
import { Page } from "puppeteer";

/**
 * Main work
 * @param {string} target 
 * @param {string} outputDir 
 * @param {{title:string,href:string}[]} anchors 
 * @param {Page} page 
 */
export default async function work(target, outputDir, anchors, page) {
    const resume = 0;

    outerloop: for (let i = resume; i < anchors.length; i++) {
        try {
            const saveDirPath = path.join(outputDir, path.basename(target), i + '_' + anchors[i].title)
            // Navigate to main content page
            await page.goto(anchors[i].href, { referer: target })

            // Scroll to the bottom of the page until all images have been loaded
            await scrollDownToLoadAllImages(page)

            // Inject NodeJs variables and functions into browser
            await page.evaluate((fn, dataType) => {
                window.fetchWithTimeout = new Function(`return ${fn}`)()
                window.dataType = JSON.parse(dataType)
            }, fetchWithTimeout.toString(), JSON.stringify(dataType))

            // Get images data     
            const imageDataList = await getImagesData(page)

            // Save images data as local files
            await saveImagesLocally(imageDataList, saveDirPath)

            await sleep(getRandomIntInRange(5, 10) * 1000)
        } catch (error) {
            if (error.name === 'TimeoutError') {
                i -= 1
                await sleep(getRandomIntInRange(5, 10) * 1000)
                console.error('capture error retry again the error is', error)
            } else {
                console.error('catch unhandled error, terminal program, the error is', error)
                break outerloop
            }
        }
    }
}

/**
 * @param {Page} page 
 */
async function scrollDownToLoadAllImages(page) {
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
}

/**
 * 
 * @param {Page} page 
 * @returns 
 */
async function getImagesData(page) {
    return page.evaluate(async () => {
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
}

/**
 * 
 * @param {any} imageDataList 
 * @param {string} saveDirPath 
 */
async function saveImagesLocally(imageDataList, saveDirPath) {
    await fsPromise.mkdir(saveDirPath, { recursive: true })

    await Promise.all(imageDataList.map(image => {
        const savePath = path.join(saveDirPath, image.name)
        switch (image.dataType) {
            case dataType.NUMBER_ARRAY:
                return fsPromise.writeFile(savePath, Buffer.from(image.data))
            case dataType.BASE64_STRING:
                return fsPromise.writeFile(savePath, image.data, 'base64')
            default:
                throw new Error(`Unknown data type: ${image.type}, when write image data`)
        }
    }))
}