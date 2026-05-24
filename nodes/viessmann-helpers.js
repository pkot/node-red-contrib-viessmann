/**
 * Helper functions for Viessmann nodes
 */

const axios = require('axios');

/**
 * Viessmann API base URL constant
 */
const VIESSMANN_API_BASE_URL = 'https://api.viessmann-climatesolutions.com';

/**
 * Default HTTP request timeout in milliseconds.
 * Bounds every outgoing axios call so a hung connection surfaces as an error
 * instead of blocking the Node-RED flow indefinitely.
 */
const HTTP_TIMEOUT_MS = 30000;

/**
 * Retry policy for transient API failures. 429 honours Retry-After; the rest
 * use a bounded exponential backoff (1s, 2s, 4s, capped at MAX_RETRY_DELAY_MS).
 */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

/**
 * Initialize a Viessmann node with common setup
 * @param {object} RED - The Node-RED runtime
 * @param {object} node - The Node-RED node instance (this)
 * @param {object} config - The node configuration
 */
function initializeViessmannNode(RED, node, config) {
    RED.nodes.createNode(node, config);
    
    // Get the config node
    node.config = RED.nodes.getNode(config.config);
    
    // Viessmann API base URL
    node.apiBaseUrl = VIESSMANN_API_BASE_URL;
    
    // Setup dependent node status and registration
    setupDependentNode(node);
}

/**
 * Validate that config node is available
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {boolean} True if config is valid, false otherwise
 */
function validateConfigNode(node, msg) {
    if (!node.config) {
        node.status({fill: 'red', shape: 'dot', text: 'no config'});
        node.error('No configuration node found. Please configure the Viessmann config node.', msg);
        return false;
    }
    return true;
}

/**
 * Create a status update function for dependent nodes
 * @param {object} node - The Node-RED node instance
 * @returns {function} Status update function
 */
function createStatusUpdater(node) {
    return function() {
        if (!node.config) {
            node.status({fill: 'red', shape: 'dot', text: 'no config'});
            return;
        }
        
        switch (node.config.authState) {
            case 'authenticated':
                node.status({fill: 'green', shape: 'dot', text: 'connected'});
                break;
            case 'authenticating':
                node.status({fill: 'yellow', shape: 'ring', text: 'authenticating...'});
                break;
            case 'error': {
                const errorText = node.config.authError || 'auth failed';
                node.status({fill: 'red', shape: 'dot', text: errorText});
                break;
            }
            case 'disconnected':
            default:
                node.status({fill: 'grey', shape: 'ring', text: 'disconnected'});
                break;
        }
    };
}

/**
 * Setup dependent node registration with config node
 * @param {object} node - The Node-RED node instance
 */
function setupDependentNode(node) {
    // Create and assign status update function
    node.updateStatus = createStatusUpdater(node);
    
    // Register with config node to receive auth state updates
    if (node.config) {
        node.config.registerDependent(node);
        node.updateStatus();
    } else {
        node.status({fill: 'red', shape: 'dot', text: 'no config'});
    }
    
    // Unregister when node is closed
    node.on('close', function() {
        if (node.config) {
            node.config.unregisterDependent(node);
        }
    });
}

/**
 * Extract a user-facing message from an axios error.
 *
 * Distinguishes axios's three failure shapes:
 *   - error.response  : the server replied with an HTTP status.
 *                       Prefer data.error_description (OAuth-style),
 *                       then data.message (Viessmann 401 body uses this),
 *                       then data.error (older API shape),
 *                       then a string body.
 *   - error.request   : a request was sent but no response arrived
 *                       (DNS, TCP reset, timeout, etc.). Include error.code
 *                       when present so the user can diagnose.
 *   - otherwise       : a setup error - fall back to error.message.
 *
 * @param {Error} error - axios error or any thrown value
 * @returns {string} Human-readable message
 */
function extractErrorMessage(error) {
    if (error === null || error === undefined) {
        return 'Unknown error';
    }
    if (typeof error !== 'object') {
        return String(error);
    }
    if (error.response) {
        const { status, data } = error.response;
        const detail = data?.error_description
            || data?.message
            || data?.error
            || (typeof data === 'string' ? data : '');
        if (status !== undefined) {
            return detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`;
        }
        return detail || error.message || 'Unknown error';
    }
    if (error.request) {
        return error.code
            ? `No response from server (${error.code})`
            : 'No response from server';
    }
    return error.message || 'Unknown error';
}

/**
 * Truncate long text for status display
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length (default: 30)
 * @returns {string} Truncated text
 */
function truncateForStatus(text, maxLength = 30) {
    if (typeof text !== 'string') {
        text = String(text);
    }
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Validate installationId parameter
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {number|null} Validated installationId or null if invalid
 */
function validateInstallationId(node, msg) {
    if (msg.installationId === null || msg.installationId === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no installationId'});
        node.error('No installationId provided. Please provide msg.installationId.', msg);
        return null;
    }
    
    const installationId = Number(msg.installationId);
    if (!Number.isInteger(installationId) || installationId <= 0) {
        node.status({fill: 'red', shape: 'dot', text: 'invalid installationId'});
        node.error('Invalid installationId. Must be a positive integer.', msg);
        return null;
    }
    
    return installationId;
}

/**
 * Validate gatewaySerial parameter
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {string|null} Validated gatewaySerial or null if invalid
 */
function validateGatewaySerial(node, msg) {
    if (msg.gatewaySerial === null || msg.gatewaySerial === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no gatewaySerial'});
        node.error('No gatewaySerial provided. Please provide msg.gatewaySerial.', msg);
        return null;
    }
    
    if (typeof msg.gatewaySerial !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid gatewaySerial'});
        node.error('Invalid gatewaySerial. Must be a string.', msg);
        return null;
    }
    
    const gatewaySerial = msg.gatewaySerial.trim();
    if (gatewaySerial === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid gatewaySerial'});
        node.error('Invalid gatewaySerial. Must be a non-empty string.', msg);
        return null;
    }
    
    return gatewaySerial;
}

/**
 * Validate deviceId parameter
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {string|null} Validated deviceId or null if invalid
 */
function validateDeviceId(node, msg) {
    if (msg.deviceId === null || msg.deviceId === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no deviceId'});
        node.error('No deviceId provided. Please provide msg.deviceId.', msg);
        return null;
    }
    
    if (typeof msg.deviceId !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid deviceId'});
        node.error('Invalid deviceId. Must be a string.', msg);
        return null;
    }
    
    const deviceId = msg.deviceId.trim();
    if (deviceId === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid deviceId'});
        node.error('Invalid deviceId. Must be a non-empty string.', msg);
        return null;
    }
    
    return deviceId;
}

/**
 * Parse an HTTP Retry-After header value into milliseconds, or return null if unparseable.
 * Accepts either a delta-seconds number or an HTTP-date.
 * @param {string|undefined} header - The Retry-After header value
 * @returns {number|null} Milliseconds to wait, or null if the header is missing/invalid.
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
 * Exponential backoff delay with mild jitter to avoid thundering herd.
 * @param {number} attempt - 1-indexed attempt number
 * @returns {number} delay in milliseconds
 */
function backoffDelayMs(attempt) {
    const jitter = 0.9 + Math.random() * 0.2;
    return Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1) * jitter, MAX_RETRY_DELAY_MS);
}

/**
 * Wrap a request function with retry-on-transient-failure (429 / 5xx).
 * 429 honours Retry-After; 5xx and 429-without-Retry-After use exponential backoff.
 * Non-retryable errors are rethrown immediately.
 * @param {object} node - The Node-RED node instance
 * @param {Function} requestFn - Function that performs one request attempt
 * @param {string} statusText - Base text for the node status during retry waits
 * @returns {Promise<object>} Response from the first successful attempt
 */
async function executeWithRetry(node, requestFn, statusText) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await requestFn();
        } catch (error) {
            const status = error.response?.status;
            if (!RETRYABLE_STATUSES.has(status) || attempt >= MAX_RETRIES) {
                throw error;
            }
            const nextAttempt = attempt + 1;
            const retryAfterMs = status === 429
                ? parseRetryAfter(error.response.headers?.['retry-after'])
                : null;
            const delayMs = retryAfterMs ?? backoffDelayMs(nextAttempt);
            const waitSecs = Math.max(1, Math.ceil(delayMs / 1000));
            node.status({fill: 'yellow', shape: 'ring', text: `${statusText} (HTTP ${status}, retry in ${waitSecs}s)`});
            node.debug(`HTTP ${status} - retrying in ${delayMs}ms (attempt ${nextAttempt}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

/**
 * Execute an API request with automatic token refresh on 401 error
 * @param {object} node - The Node-RED node instance
 * @param {Function} requestFn - Function that executes the API request
 * @returns {Promise<object>} Response data
 */
async function executeWithTokenRefresh(node, requestFn) {
    try {
        return await requestFn();
    } catch (error) {
        // Check if error is 401 Unauthorized (invalid token)
        if (error.response && error.response.status === 401) {
            node.debug('Received 401 error, attempting to refresh token and retry');
            
            try {
                // Attempt to refresh the token
                await node.config.refreshAccessToken();
                
                node.debug('Retrying request with refreshed token');
                
                // Retry the request with the new token
                return await requestFn();
            } catch (refreshError) {
                // If refresh fails, throw the original error
                node.debug(`Token refresh failed: ${refreshError.message}`);
                throw error;
            }
        }
        
        throw error;
    }
}

/**
 * Execute an API GET request with standard error handling
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @param {string} url - The API endpoint URL
 * @param {string} statusText - Text to show during operation (default: 'fetching...')
 * @param {string} errorPrefix - Prefix for error messages (default: 'Failed to fetch data')
 * @returns {Promise<object>} Response data
 */
async function executeApiGet(node, msg, url, statusText = 'fetching...', errorPrefix = 'Failed to fetch data') {
    try {
        node.status({fill: 'yellow', shape: 'ring', text: statusText});

        node.debug(`Executing GET ${url}`);

        // Retry transient 429/5xx around the token-refresh-aware request.
        const response = await executeWithRetry(node, () => executeWithTokenRefresh(node, async () => {
            const token = await node.config.getValidToken();
            return await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                timeout: HTTP_TIMEOUT_MS
            });
        }), statusText);

        node.status({fill: 'green', shape: 'dot', text: 'success'});
        return response;
    } catch (error) {
        const errorMsg = extractErrorMessage(error);
        const statusMsg = truncateForStatus(errorMsg);
        node.status({fill: 'red', shape: 'dot', text: statusMsg});
        node.error(`${errorPrefix}: ${errorMsg}`, msg);
        throw error;
    }
}

/**
 * Execute an API POST request with standard error handling
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @param {string} url - The API endpoint URL
 * @param {object} data - The data to post
 * @param {string} statusText - Text to show during operation (default: 'writing...')
 * @param {string} errorPrefix - Prefix for error messages (default: 'Failed to write data')
 * @returns {Promise<object>} Response data
 */
async function executeApiPost(node, msg, url, data, statusText = 'writing...', errorPrefix = 'Failed to write data') {
    try {
        node.status({fill: 'yellow', shape: 'ring', text: statusText});

        node.debug(`Executing POST ${url} with data: ${JSON.stringify(data)}`);

        // Retry transient 429/5xx around the token-refresh-aware request.
        const response = await executeWithRetry(node, () => executeWithTokenRefresh(node, async () => {
            const token = await node.config.getValidToken();
            return await axios.post(url, data, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: HTTP_TIMEOUT_MS
            });
        }), statusText);

        node.status({fill: 'green', shape: 'dot', text: 'success'});
        return response;
    } catch (error) {
        const errorMsg = extractErrorMessage(error);
        const statusMsg = truncateForStatus(errorMsg);
        node.status({fill: 'red', shape: 'dot', text: statusMsg});
        node.error(`${errorPrefix}: ${errorMsg}`, msg);
        throw error;
    }
}

module.exports = {
    VIESSMANN_API_BASE_URL,
    HTTP_TIMEOUT_MS,
    RETRYABLE_STATUSES,
    MAX_RETRIES,
    initializeViessmannNode,
    validateConfigNode,
    createStatusUpdater,
    setupDependentNode,
    extractErrorMessage,
    truncateForStatus,
    parseRetryAfter,
    validateInstallationId,
    validateGatewaySerial,
    validateDeviceId,
    executeApiGet,
    executeApiPost
};
