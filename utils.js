// Some util functions for development

/**
        * 
        * @param {string} url 
        * @param {RequestInit} options 
        * @param {number} timeout retry interval in milliseconds, default: 3000ms
        * @param {number} retries A positive number, 0 means try infinite times, default: 3
        * @returns {Promise<Response>}
        */
export async function fetchWithTimeout(url, options = {}, timeout = 3000, retries = 3) {
    if (retries < 0) {
        throw new Error('retryTimes should be larger than 0')
    }

    const fetchWithAbort = async () => {
        const controller = new AbortController()
        options.signal = controller.signal
        const timeoutId = setTimeout(() => { controller.abort('fetch is not response and timeout') }, timeout)

        try {
            let response = await fetch(url, options)
            clearTimeout(timeoutId)
            return response
        } catch (error) {
            clearTimeout(timeoutId)
            if (error.name === 'AbortError') {
                console.error('Fetch timeout with abort')
            } else {
                console.error('Fetch failed due to network')
            }
            throw new Error('Fetch failed', { cause: error })
        }
    }

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetchWithAbort(url)

            if (!response.ok) {
                throw new Error(`HTTP error!, status: ${response.status}`)
            }

            return response
        } catch (error) {
            if (attempt + 1 === retries) {
                throw Error('Max retries reached. Throwing error:', { cause: error })
            }

            console.log(`attempt ${attempt} failed, retrying...`)
        }
    }
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function getRandomIntInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const dataType = {
    'NUMBER_ARRAY': 0,
    'BASE64_STRING': 1
}