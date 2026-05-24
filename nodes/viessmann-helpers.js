/**
 * Helper functions for Viessmann nodes.
 *
 * Transport, token refresh, and retry policy live on `node.config.client`
 * (the ViessmannClient instance in nodes/lib/client.js). This file keeps the
 * Node-RED UI surface: status icons, error surfacing, input validators, node
 * lifecycle.
 */

const {
    VIESSMANN_API_BASE_URL,
    HTTP_TIMEOUT_MS,
    RETRYABLE_STATUSES,
    MAX_RETRIES,
    parseRetryAfter
} = require('./lib/client');

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
            const base = detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`;
            const hint = actionableStatusHint(status);
            return hint ? `${base} - ${hint}` : base;
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
 * For statuses where the user's fix is well-known, return a short hint to
 * append to the error message. Returns '' for statuses with no actionable
 * guidance.
 */
function actionableStatusHint(status) {
    switch (status) {
        case 403:
            return 'token lacks scope (regenerate tokens if scopes changed)';
        case 404:
            return 'check installationId/gatewaySerial/deviceId';
        case 401:
            return 'token expired or invalid (the client refreshes automatically; if this persists, regenerate tokens)';
        default:
            return '';
    }
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
 * Validate the msg.feature / msg.datapoint field (the two are aliases).
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {string|null} Validated, trimmed feature name, or null on failure
 *
 * Side effects: node.error + node.status on failure.
 */
function validateFeature(node, msg) {
    // ?? so msg.feature = null also falls through to datapoint.
    const raw = msg.feature ?? msg.datapoint;
    if (raw === null || raw === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no feature'});
        node.error('No feature/datapoint provided. Please provide msg.feature or msg.datapoint.', msg);
        return null;
    }
    if (typeof raw !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid feature'});
        node.error('Invalid feature/datapoint. Must be a string.', msg);
        return null;
    }
    const value = raw.trim();
    if (value === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid feature'});
        node.error('Invalid feature/datapoint. Must be a non-empty string.', msg);
        return null;
    }
    return value;
}

/**
 * Validate the msg.command field.
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {string|null} Validated, trimmed command, or null on failure
 *
 * Side effects: node.error + node.status on failure.
 */
function validateCommand(node, msg) {
    if (msg.command === null || msg.command === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no command'});
        node.error('No command provided. Please provide msg.command.', msg);
        return null;
    }
    if (typeof msg.command !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid command'});
        node.error('Invalid command. Must be a string.', msg);
        return null;
    }
    const value = msg.command.trim();
    if (value === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid command'});
        node.error('Invalid command. Must be a non-empty string.', msg);
        return null;
    }
    return value;
}

/**
 * Validate the msg.params field. Must be a plain object (POST body).
 * Empty objects pass but emit a node.warn so users notice an unusual call.
 *
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {object|null} The validated params object, or null on failure
 *
 * Side effects: node.error + node.status on failure; node.warn on empty.
 */
function validateParams(node, msg) {
    if (msg.params === null || msg.params === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no params'});
        node.error('No params provided. Please provide msg.params.', msg);
        return null;
    }
    if (typeof msg.params !== 'object' || Array.isArray(msg.params) || !isPlainObject(msg.params)) {
        node.status({fill: 'red', shape: 'dot', text: 'invalid params'});
        node.error('Invalid params. msg.params must be a plain object (e.g., {temperature: 22}).', msg);
        return null;
    }
    if (Object.keys(msg.params).length === 0 && typeof node.warn === 'function') {
        node.warn('Posting empty msg.params - the Viessmann command will be called with no body.');
    }
    return msg.params;
}

/**
 * A "plain object" is a Record-style object literal: not a class instance,
 * Date, Buffer, Map, Set, etc. Used by validateParams to reject things that
 * pass `typeof === 'object'` but JSON-serialize unpredictably.
 */
function isPlainObject(value) {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/**
 * Resolve a msg into a validation-source object: prefers msg.viessmann (the new
 * preferred bundle) when present, otherwise returns the msg itself.
 *
 * The result is what the individual validators will read coordinate fields from.
 * Everything else on the msg (notably _msgid) is preserved on the returned
 * object so node.error(text, source) still routes a Catch node to the
 * originating flow.
 *
 * @param {object} msg - The incoming message
 * @returns {object} validation source - the msg itself when no bundle is provided
 */
function viessmannRefSource(msg) {
    if (!msg.viessmann || typeof msg.viessmann !== 'object' || Array.isArray(msg.viessmann)) {
        return msg;
    }
    return Object.assign({}, msg, {
        installationId: msg.viessmann.installationId,
        gatewaySerial: msg.viessmann.gatewaySerial,
        deviceId: msg.viessmann.deviceId
    });
}

/**
 * Validate the three coordinates that address a Viessmann device.
 *
 * Accepts either:
 *   - msg.viessmann = { installationId, gatewaySerial, deviceId }   (preferred bundle)
 *   - msg.installationId / msg.gatewaySerial / msg.deviceId         (legacy fields)
 *
 * Short-circuits on the first failure so a malformed message produces one
 * node.error / one status update instead of three. Returns null on any
 * failure (validators emit their own user-facing errors via node.error).
 *
 * Side effects: sets node.status and calls node.error(message, source) on the
 * first invalid field. The `source` is either the original msg or a clone with
 * _msgid preserved, so a downstream Catch node still routes correctly.
 *
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {{installationId: number, gatewaySerial: string, deviceId: string}|null}
 */
function validateViessmannRef(node, msg) {
    const source = viessmannRefSource(msg);

    const installationId = validateInstallationId(node, source);
    if (installationId === null) return null;
    const gatewaySerial = validateGatewaySerial(node, source);
    if (gatewaySerial === null) return null;
    const deviceId = validateDeviceId(node, source);
    if (deviceId === null) return null;

    return { installationId, gatewaySerial, deviceId };
}

/**
 * Surface an unexpected error from the payload-processing block of a node's
 * input handler (the block AFTER executeApiGet/Post returns).
 *
 * executeApiGet/Post handle their own failures (call node.error / node.status
 * for every thrown error inside them, then rethrow). To avoid double-firing,
 * the consumer-node pattern is:
 *
 *   let response;
 *   try { response = await executeApiGet(...); }
 *   catch (_) { return; }              // already surfaced upstream
 *   try {
 *     msg.payload = ...response...;
 *     node.send(msg);
 *   } catch (error) {
 *     surfaceUnexpectedError(node, msg, error);
 *   }
 *
 * Anything that reaches this function is something we didn't anticipate -
 * a TypeError from accessing an unexpected response shape, a cyclic
 * JSON.stringify, or a bug in our shaping code - and it would otherwise
 * be silently dropped.
 *
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @param {*} error - The thrown value
 */
function surfaceUnexpectedError(node, msg, error) {
    const message = error && error.message ? error.message : String(error);
    node.status({fill: 'red', shape: 'dot', text: 'internal error'});
    node.error('Internal error: ' + message, msg);
}

/**
 * Build a retry-wait callback that reflects the next retry's countdown in the
 * node's status icon, so users see "fetching... (HTTP 429, retry in 2s)"
 * instead of a frozen yellow ring.
 */
function statusRetryReporter(node, statusText) {
    return function({ status, delayMs }) {
        const waitSecs = Math.max(1, Math.ceil(delayMs / 1000));
        node.status({fill: 'yellow', shape: 'ring', text: `${statusText} (HTTP ${status}, retry in ${waitSecs}s)`});
    };
}

/**
 * Execute an API GET via the shared ViessmannClient with UI side effects
 * layered on top.
 *
 * On *any* thrown error (axios or otherwise) this helper calls node.error
 * and node.status, then rethrows. Callers should treat the rejected promise
 * as "already surfaced" and not double-fire node.error on it. For errors
 * that happen AFTER this returns - e.g. payload-shaping bugs - use
 * surfaceUnexpectedError in the consumer node.
 *
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @param {string} url - The API endpoint URL
 * @param {string} statusText - Text to show during operation (default: 'fetching...')
 * @param {string} errorPrefix - Prefix for error messages (default: 'Failed to fetch data')
 */
async function executeApiGet(node, msg, url, statusText = 'fetching...', errorPrefix = 'Failed to fetch data') {
    try {
        node.status({fill: 'yellow', shape: 'ring', text: statusText});
        node.debug(`Executing GET ${url}`);
        const response = await node.config.client.get(url, {
            onRetryWait: statusRetryReporter(node, statusText)
        });
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
 * Execute an API POST via the shared ViessmannClient with UI side effects.
 * Same already-surfaced-on-throw contract as executeApiGet.
 */
async function executeApiPost(node, msg, url, data, statusText = 'writing...', errorPrefix = 'Failed to write data') {
    try {
        node.status({fill: 'yellow', shape: 'ring', text: statusText});
        node.debug(`Executing POST ${url} with data: ${JSON.stringify(data)}`);
        const response = await node.config.client.post(url, data, {
            onRetryWait: statusRetryReporter(node, statusText)
        });
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
    validateViessmannRef,
    validateFeature,
    validateCommand,
    validateParams,
    viessmannRefSource,
    surfaceUnexpectedError,
    executeApiGet,
    executeApiPost
};
