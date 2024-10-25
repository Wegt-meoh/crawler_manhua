import { Page } from "puppeteer";

/**
 * Get all pages link
 * @param {string} target 
 * @param {Page} page 
 */
export default async function getPageLinks(target, page) {
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

    return anchors
}