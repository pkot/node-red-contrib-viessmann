/**
 * Node-RED runtime glue for Viessmann consumer nodes:
 *   - initializeViessmannNode: create-node + attach-config + status setup
 *   - createStatusUpdater / setupDependentNode: render config auth state in
 *     the consumer node's status icon; subscribe to the config's
 *     'auth-state' event.
 *   - executeApiGet / executeApiPost: UI-side wrappers around
 *     node.config.client (transport lives in lib/client.js).
 *   - surfaceUnexpectedError: surface non-API errors thrown in the
 *     post-API-call payload-processing block of a node's input handler.
 */

const { VIESSMANN_API_BASE_URL } = require('./client');
const { extractErrorMessage, truncateForStatus } = require('./format');

function initializeViessmannNode(RED, node, config) {
    RED.nodes.createNode(node, config);
    node.config = RED.nodes.getNode(config.config);
    node.apiBaseUrl = VIESSMANN_API_BASE_URL;
    setupDependentNode(node);
}

/**
 * Create a status update function for dependent nodes.
 *
 * Accepts an optional `snapshot` argument (state, error). Falls back to
 * `node.config.getAuthSnapshot()` when called with no argument.
 */
function createStatusUpdater(node) {
    return function(snapshot) {
        if (!node.config) {
            node.status({fill: 'red', shape: 'dot', text: 'no config'});
            return;
        }
        const { state, error } = snapshot || node.config.getAuthSnapshot();

        switch (state) {
            case 'authenticated':
                node.status({fill: 'green', shape: 'dot', text: 'connected'});
                break;
            case 'authenticating':
                node.status({fill: 'yellow', shape: 'ring', text: 'authenticating...'});
                break;
            case 'error':
                node.status({fill: 'red', shape: 'dot', text: error || 'auth failed'});
                break;
            case 'disconnected':
            default:
                node.status({fill: 'grey', shape: 'ring', text: 'disconnected'});
                break;
        }
    };
}

/**
 * Subscribe a consumer node to the config node's auth-state event so its
 * status icon reflects auth changes.
 */
function setupDependentNode(node) {
    node.updateStatus = createStatusUpdater(node);
    // Per-node set of AbortControllers for in-flight requests. Populated by
    // executeApiGet/executeApiPost, drained on close. Without this an
    // in-flight request would outlive the redeployed node and try to call
    // node.send/node.status on a destroyed instance.
    node._inflightAbortControllers = new Set();

    if (!node.config) {
        node.status({fill: 'red', shape: 'dot', text: 'no config'});
        return;
    }

    const onAuthState = function(snapshot) { node.updateStatus(snapshot); };
    node.config.on('auth-state', onAuthState);

    node.updateStatus();

    node.on('close', function() {
        if (node.config && typeof node.config.off === 'function') {
            node.config.off('auth-state', onAuthState);
        }
        // Abort any in-flight requests so they don't try to use the node
        // after Node-RED has torn it down.
        for (const controller of node._inflightAbortControllers) {
            try { controller.abort(); } catch (_e) { /* best-effort */ }
        }
        node._inflightAbortControllers.clear();
    });
}

/**
 * Surface an unexpected error from the payload-processing block of a node's
 * input handler (the block AFTER executeApiGet/Post returns).
 */
function surfaceUnexpectedError(node, msg, error) {
    const message = error && error.message ? error.message : String(error);
    node.status({fill: 'red', shape: 'dot', text: 'internal error'});
    node.error('Internal error: ' + message, msg);
}

/**
 * JSON.stringify that never throws on cyclic structures - the debug-log
 * path must not turn into a failure path. Falls back to a placeholder so a
 * pathological msg.params doesn't masquerade as an API failure.
 */
function safeStringifyForDebug(value) {
    try {
        return JSON.stringify(value);
    } catch (_err) {
        return '<unserializable: ' + (_err && _err.message ? _err.message : 'unknown error') + '>';
    }
}

/**
 * Build a retry-wait callback that reflects the next retry's countdown in
 * the node's status icon.
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
 * On *any* thrown error this helper calls node.error and node.status, then
 * rethrows. Callers should treat the rejected promise as "already surfaced"
 * and not double-fire node.error on it. Use surfaceUnexpectedError for
 * errors that happen AFTER this returns.
 */
async function executeApiGet(node, msg, url, statusText = 'fetching...', errorPrefix = 'Failed to fetch data') {
    if (!node.config) {
        node.status({fill: 'red', shape: 'dot', text: 'no config'});
        const err = new Error('No configuration node available');
        node.error(`${errorPrefix}: ${err.message}`, msg);
        throw err;
    }
    const controller = trackAbortController(node);
    try {
        node.status({fill: 'yellow', shape: 'ring', text: statusText});
        node.config.debugLog(`Executing GET ${url}`);
        const response = await node.config.client.get(url, {
            onRetryWait: statusRetryReporter(node, statusText),
            signal: controller.signal
        });
        node.status({fill: 'green', shape: 'dot', text: 'success'});
        return response;
    } catch (error) {
        const errorMsg = extractErrorMessage(error);
        const statusMsg = truncateForStatus(errorMsg);
        node.status({fill: 'red', shape: 'dot', text: statusMsg});
        node.error(`${errorPrefix}: ${errorMsg}`, msg);
        throw error;
    } finally {
        if (node._inflightAbortControllers) {
            node._inflightAbortControllers.delete(controller);
        }
    }
}

/**
 * Execute an API POST via the shared ViessmannClient. Same surface contract
 * as executeApiGet.
 */
async function executeApiPost(node, msg, url, data, statusText = 'writing...', errorPrefix = 'Failed to write data') {
    if (!node.config) {
        node.status({fill: 'red', shape: 'dot', text: 'no config'});
        const err = new Error('No configuration node available');
        node.error(`${errorPrefix}: ${err.message}`, msg);
        throw err;
    }
    const controller = trackAbortController(node);
    try {
        node.status({fill: 'yellow', shape: 'ring', text: statusText});
        node.config.debugLog(`Executing POST ${url} with data: ${safeStringifyForDebug(data)}`);
        const response = await node.config.client.post(url, data, {
            onRetryWait: statusRetryReporter(node, statusText),
            signal: controller.signal
        });
        node.status({fill: 'green', shape: 'dot', text: 'success'});
        return response;
    } catch (error) {
        const errorMsg = extractErrorMessage(error);
        const statusMsg = truncateForStatus(errorMsg);
        node.status({fill: 'red', shape: 'dot', text: statusMsg});
        node.error(`${errorPrefix}: ${errorMsg}`, msg);
        throw error;
    } finally {
        if (node._inflightAbortControllers) {
            node._inflightAbortControllers.delete(controller);
        }
    }
}

/**
 * Allocate an AbortController for one request and register it on the node so
 * a node.close() can cancel it. Returns the controller; callers should
 * forward `controller.signal` to the request and remove the controller from
 * the tracker in `finally`.
 */
function trackAbortController(node) {
    const controller = new AbortController();
    if (node._inflightAbortControllers) {
        node._inflightAbortControllers.add(controller);
    }
    return controller;
}

module.exports = {
    initializeViessmannNode,
    createStatusUpdater,
    setupDependentNode,
    surfaceUnexpectedError,
    executeApiGet,
    executeApiPost
};
