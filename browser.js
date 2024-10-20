// This javascript file is used to inject into the browser


/**
        * 
        * @param {string} url 
        * @param {RequestInit} options 
        * @param {number} timeout retry interval in milliseconds, default: 3000ms
        * @param {number} retries A positive number, 0 means try infinite times, default: 3
        * @returns {Promise<any>}
        */
async function fetchWithTimeout(url, options = {}, timeout = 3000, retries = 3) {
    if (retries < 0) {
        throw new Error('retryTimes should be larger than 0')
    }

    console.log(typeof this.fetch)

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
                console.error('Fetch request time out')
            } else {
                console.error('Fetch failed:', error)
            }
            throw new Error(error)
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
                console.error('Max retries reached. Throwing error')
                throw new Error(error)
            }

            console.log(`attempt ${attempt} failed, retrying...`)
        }
    }
}