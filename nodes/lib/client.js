/**
 * ViessmannClient - HTTP client for the Viessmann SaaS API.
 *
 * Owns the cross-cutting concerns that previously leaked into helpers:
 *   - axios instance with baseURL, timeout, default headers
 *   - token retrieval and 401-triggered refresh-and-retry
 *   - transient-failure retry (429 with Retry-After, 5xx with bounded backoff)
 *
 * UI concerns (node.status, node.error) stay in the per-node wrappers
 * (executeApiGet/executeApiPost in viessmann-helpers.js). The client surfaces
 * retry timing through an optional onRetryWait callback so the wrapper can
 * reflect it in the visible node status without coupling the client to
 * Node-RED-specific APIs.
 */

const axios = require('axios');

const VIESSMANN_API_BASE_URL = 'https://api.viessmann-climatesolutions.com';
const HTTP_TIMEOUT_MS = 30000;

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

/**
 * Parse an HTTP Retry-After header into milliseconds, or return null if unparseable.
 * Accepts delta-seconds or HTTP-date.
 */
function parseRetryAfter(header) {
    if (header === undefined || header === null || header === '') {
        return null;
    }
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
    }
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) {
        return Math.max(0, Math.min(dateMs - Date.now(), MAX_RETRY_DELAY_MS));
    }
    return null;
}

/**
 * Exponential backoff with mild jitter to avoid thundering herd.
 * @param {number} attempt - 1-indexed attempt
 */
function backoffDelayMs(attempt) {
    const jitter = 0.9 + Math.random() * 0.2;
    return Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1) * jitter, MAX_RETRY_DELAY_MS);
}

class ViessmannClient {
    /**
     * @param {object} configNode - The viessmann-config node (provides getValidToken / refreshAccessToken)
     * @param {object} [options]
     * @param {string} [options.baseURL] - Override the API base URL
     * @param {number} [options.timeout] - Per-request timeout in ms
     * @param {number} [options.maxRetries] - Cap on transient-failure retries
     * @param {object} [options.axiosInstance] - Inject a pre-built axios instance (testing)
     * @param {Function} [options.log] - Debug logger; defaults to noop
     */
    constructor(configNode, options = {}) {
        this._config = configNode;
        this._baseURL = options.baseURL || VIESSMANN_API_BASE_URL;
        this._timeout = options.timeout || HTTP_TIMEOUT_MS;
        this._maxRetries = options.maxRetries ?? MAX_RETRIES;
        this._log = typeof options.log === 'function' ? options.log : () => {};
        this._axios = options.axiosInstance || axios.create({
            baseURL: this._baseURL,
            timeout: this._timeout,
            headers: { 'Accept': 'application/json' }
        });
    }

    /**
     * GET request. url may be absolute (baseURL ignored by axios) or a path.
     * @param {string} url
     * @param {object} [options]
     * @param {Function} [options.onRetryWait] - Called as ({status, attempt, delayMs}) before each retry sleep.
     */
    get(url, options = {}) {
        return this._request({ method: 'GET', url }, options);
    }

    /**
     * POST request.
     * @param {string} url
     * @param {*} data - request body
     * @param {object} [options]
     */
    post(url, data, options = {}) {
        return this._request({
            method: 'POST',
            url,
            data,
            headers: { 'Content-Type': 'application/json' }
        }, options);
    }

    async _request(axiosConfig, { onRetryWait } = {}) {
        return this._withRetry(() => this._withTokenRefresh(async () => {
            const token = await this._config.getValidToken();
            return this._axios.request({
                ...axiosConfig,
                headers: { ...(axiosConfig.headers || {}), Authorization: `Bearer ${token}` }
            });
        }), onRetryWait);
    }

    async _withTokenRefresh(requestFn) {
        try {
            return await requestFn();
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this._log('Received 401 - refreshing token and retrying');
                try {
                    await this._config.refreshAccessToken();
                    return await requestFn();
                } catch (refreshError) {
                    this._log(`Token refresh failed: ${refreshError.message}`);
                    throw error;
                }
            }
            throw error;
        }
    }

    async _withRetry(requestFn, onRetryWait) {
        for (let attempt = 0; ; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                const status = error.response?.status;
                if (!RETRYABLE_STATUSES.has(status) || attempt >= this._maxRetries) {
                    throw error;
                }
                const nextAttempt = attempt + 1;
                const retryAfterMs = status === 429
                    ? parseRetryAfter(error.response.headers?.['retry-after'])
                    : null;
                const delayMs = retryAfterMs ?? backoffDelayMs(nextAttempt);
                if (typeof onRetryWait === 'function') {
                    onRetryWait({ status, attempt: nextAttempt, delayMs });
                }
                this._log(`HTTP ${status} - retrying in ${delayMs}ms (attempt ${nextAttempt}/${this._maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
}

module.exports = {
    ViessmannClient,
    VIESSMANN_API_BASE_URL,
    HTTP_TIMEOUT_MS,
    RETRYABLE_STATUSES,
    MAX_RETRIES,
    parseRetryAfter,
    backoffDelayMs
};
