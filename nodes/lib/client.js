/**
 * ViessmannClient - HTTP client for the Viessmann SaaS API.
 *
 * Owns the cross-cutting transport concerns:
 *   - axios instance with baseURL, timeout, default headers
 *   - token retrieval and 401-triggered refresh-and-retry
 *   - transient-failure retry (429 with Retry-After, 5xx with bounded backoff)
 *   - in-flight GET de-duplication (concurrent same-URL GETs share one request)
 *   - default-on TTL response cache for GETs (POST clears the cache)
 *   - concurrency-bounded request queue
 *
 * UI concerns (node.status, node.error) stay in the per-node wrappers
 * (executeApiGet/executeApiPost in viessmann-helpers.js). The client surfaces
 * retry timing through an optional onRetryWait callback so the wrapper can
 * reflect it in the visible node status without coupling the client to
 * Node-RED-specific APIs.
 */

const axios = require('axios');

const VIESSMANN_API_BASE_URL = 'https://api.viessmann-climatesolutions.com';
const VIESSMANN_IAM_BASE_URL = 'https://iam.viessmann-climatesolutions.com';
const VIESSMANN_TOKEN_PATH = '/idp/v3/token';
const VIESSMANN_AUTHORIZE_PATH = '/idp/v3/authorize';
const HTTP_TIMEOUT_MS = 30000;

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

// Default cache TTL for GET responses. Viessmann publishes a tight per-day
// rate budget, so a small staleness window dramatically cuts request volume
// for the common "two read nodes polling the same feature" pattern. The
// config node forwards cacheTTL / maxConcurrent from its editor config when
// set, so users can override these defaults.
const DEFAULT_CACHE_TTL_MS = 30000;

// Default cap on simultaneous in-flight upstream requests. Beyond this, calls
// queue up. 4 is enough for typical Node-RED flows (a handful of read/write
// nodes plus their initialization) without making one slow upstream block the
// whole flow.
const DEFAULT_MAX_CONCURRENT = 4;

// Hard cap on cached entries. Lazy expiry already removes stale rows, but
// many distinct URLs (e.g. polling lots of devices) would otherwise grow the
// Map unboundedly. When this is reached we evict the oldest (FIFO via Map's
// insertion order).
const MAX_CACHE_ENTRIES = 256;

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
     * @param {number} [options.cacheTTL] - GET response cache TTL in ms (0 disables)
     * @param {number} [options.maxConcurrent] - Cap on simultaneous in-flight upstream requests
     * @param {object} [options.axiosInstance] - Inject a pre-built axios instance (testing)
     * @param {Function} [options.log] - Debug logger; defaults to noop
     */
    constructor(configNode, options = {}) {
        this._config = configNode;
        this._baseURL = options.baseURL || VIESSMANN_API_BASE_URL;
        this._timeout = options.timeout || HTTP_TIMEOUT_MS;
        this._maxRetries = options.maxRetries ?? MAX_RETRIES;
        this._cacheTTL = Math.max(0, options.cacheTTL ?? DEFAULT_CACHE_TTL_MS);

        // Validate maxConcurrent: 0 or negative would deadlock the queue.
        const requestedMaxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
        if (!Number.isFinite(requestedMaxConcurrent) || requestedMaxConcurrent < 1) {
            throw new RangeError(`maxConcurrent must be a positive integer (got ${requestedMaxConcurrent})`);
        }
        this._maxConcurrent = Math.floor(requestedMaxConcurrent);

        this._log = typeof options.log === 'function' ? options.log : () => {};
        this._axios = options.axiosInstance || axios.create({
            baseURL: this._baseURL,
            timeout: this._timeout,
            headers: { 'Accept': 'application/json' }
        });

        // key -> { response, expiresAt } for cached GETs
        this._cache = new Map();
        // Monotonic counter bumped by POST and invalidateCache(). Captured by
        // each GET at start; if the epoch advanced while the request was in
        // flight, the response is NOT written back to the cache (it could be
        // stale relative to whatever invalidated it).
        this._cacheEpoch = 0;
        // key -> Promise<response> for de-duped in-flight GETs
        this._inflight = new Map();
        // FIFO of waiter resolvers when at _maxConcurrent
        this._queue = [];
        this._active = 0;
    }

    /**
     * GET request. url may be absolute (baseURL ignored by axios) or a path.
     *
     * Cached responses are shared by reference - callers must not mutate
     * response.data. Pass `options.cache: false` to bypass the cache for
     * this call.
     *
     * @param {string} url
     * @param {object} [options]
     * @param {Function} [options.onRetryWait] - Called as ({status, attempt, delayMs}) before each retry sleep.
     * @param {boolean} [options.cache] - If false, bypass cache for this call.
     */
    get(url, options = {}) {
        const cacheEnabled = this._cacheTTL > 0 && options.cache !== false;
        const key = `GET ${url}`;

        if (cacheEnabled) {
            const cached = this._cache.get(key);
            if (cached) {
                if (cached.expiresAt > Date.now()) {
                    this._log(`Cache hit: ${url}`);
                    return Promise.resolve(cached.response);
                }
                // Lazy expiry - drop stale entry to keep the Map bounded.
                this._cache.delete(key);
            }
        }

        // De-duplicate concurrent identical GETs even when cache is off:
        // a stampede of new read nodes all asking the same URL should share
        // one upstream request.
        const inflight = this._inflight.get(key);
        if (inflight) {
            this._log(`In-flight coalesce: ${url}`);
            return inflight;
        }

        // Capture the epoch at request start. If a POST or invalidateCache()
        // happens before we resolve, we must NOT write back to the cache.
        const epochAtStart = this._cacheEpoch;

        const promise = (async () => {
            try {
                const response = await this._scheduledRequest({ method: 'GET', url }, options);
                if (cacheEnabled && epochAtStart === this._cacheEpoch) {
                    this._cache.set(key, {
                        response,
                        expiresAt: Date.now() + this._cacheTTL
                    });
                    if (this._cache.size > MAX_CACHE_ENTRIES) {
                        // Evict oldest insertion (Map preserves insertion order).
                        const oldestKey = this._cache.keys().next().value;
                        this._cache.delete(oldestKey);
                    }
                }
                return response;
            } finally {
                this._inflight.delete(key);
            }
        })();

        this._inflight.set(key, promise);
        return promise;
    }

    /**
     * POST request. Clears the entire GET cache - any state change is
     * conservatively assumed to invalidate every cached read.
     */
    post(url, data, options = {}) {
        if (this._cache.size > 0) {
            this._log(`POST ${url} - invalidating cache (${this._cache.size} entries)`);
        }
        // Bump epoch unconditionally - even an in-flight GET started before
        // this POST must be prevented from writing its (possibly-stale-after-
        // write) response into the cache.
        this._cache.clear();
        this._cacheEpoch += 1;
        return this._scheduledRequest({
            method: 'POST',
            url,
            data,
            headers: { 'Content-Type': 'application/json' }
        }, options);
    }

    /**
     * Explicitly drop all cached responses. Useful for manual refresh from
     * a flow. Also bumps the cache epoch so any in-flight GETs do not write
     * their results back after invalidation.
     */
    invalidateCache() {
        this._cache.clear();
        this._cacheEpoch += 1;
    }

    /**
     * Run requestFn through the bounded concurrency queue.
     * @private
     */
    async _scheduledRequest(axiosConfig, options) {
        if (this._active >= this._maxConcurrent) {
            this._log(`Concurrency cap (${this._maxConcurrent}) reached - queueing`);
            await new Promise(resolve => this._queue.push(resolve));
        }
        this._active += 1;
        try {
            return await this._request(axiosConfig, options);
        } finally {
            this._active -= 1;
            const next = this._queue.shift();
            if (next) next();
        }
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
    VIESSMANN_IAM_BASE_URL,
    VIESSMANN_TOKEN_PATH,
    VIESSMANN_AUTHORIZE_PATH,
    HTTP_TIMEOUT_MS,
    RETRYABLE_STATUSES,
    MAX_RETRIES,
    DEFAULT_CACHE_TTL_MS,
    DEFAULT_MAX_CONCURRENT,
    parseRetryAfter,
    backoffDelayMs
};
