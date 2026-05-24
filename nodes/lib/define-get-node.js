/**
 * Declarative factory for read-only Viessmann GET nodes.
 *
 * Each consumer node was previously the same template differing only in
 * which validators it ran and which URL it built. This factory captures
 * that template once - validators+URL+payload-shape come in as opts -
 * so the four discovery node files collapse to ~15 lines each.
 *
 * Usage:
 *
 *   defineGetNode(RED, {
 *     type: 'viessmann-gateway-devices',
 *     getContext: (node, msg) => { ... validators, return ctx or null ... },
 *     url: (ctx) => '/iot/v2/.../devices',
 *     statusText: 'fetching...',
 *     errorPrefix: 'Failed to fetch gateway devices',
 *     shapePayload: (response) => response.data.data || []
 *   });
 *
 * For nodes that need a more elaborate payload pipeline (e.g.
 * viessmann-read, which derives a status string from the response) or
 * that POST rather than GET (e.g. viessmann-write), keep the hand-rolled
 * input handler - the factory only covers the orthogonal-GET shape.
 */

const { initializeViessmannNode, executeApiGet, surfaceUnexpectedError } = require('./node-runtime');

/**
 * @param {object} RED - The Node-RED runtime
 * @param {object} opts
 * @param {string} opts.type - Node-RED type id (e.g. 'viessmann-gateway-devices')
 * @param {(node: object, msg: object) => object|null} opts.getContext
 *   Run validators against msg. Return the context object (e.g. {installationId, gatewaySerial})
 *   or null to short-circuit (validators emit their own node.error/status).
 * @param {(ctx: object) => string} opts.url
 *   Build the API path (relative; the factory prepends node.apiBaseUrl).
 * @param {string} [opts.statusText] - Yellow-state text during the request.
 * @param {string} [opts.errorPrefix] - Prefix for node.error on failure.
 * @param {(response: object, ctx: object) => *} [opts.shapePayload]
 *   Map the axios response into msg.payload. Defaults to `response.data.data || []`.
 */
function defineGetNode(RED, opts) {
    if (!opts || !opts.type || typeof opts.getContext !== 'function' || typeof opts.url !== 'function') {
        throw new TypeError('defineGetNode requires { type, getContext, url } at minimum');
    }
    const statusText = opts.statusText || 'fetching...';
    const errorPrefix = opts.errorPrefix || 'Failed to fetch data';
    const shapePayload = opts.shapePayload || ((response) => response.data.data || []);

    function ViessmannGetNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            const ctx = opts.getContext(node, msg);
            if (!ctx) return;

            const url = `${node.apiBaseUrl}${opts.url(ctx)}`;

            let response;
            try {
                response = await executeApiGet(node, msg, url, statusText, errorPrefix);
            } catch (_apiError) {
                return;
            }

            try {
                msg.payload = shapePayload(response, ctx);
                node.send(msg);
            } catch (error) {
                surfaceUnexpectedError(node, msg, error);
            }
        });
    }

    RED.nodes.registerType(opts.type, ViessmannGetNode);
}

module.exports = { defineGetNode };
