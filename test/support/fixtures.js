/**
 * Shared test fixtures for the Viessmann Node-RED specs.
 *
 * Centralizes the credential, flow, nock-mock, status-capture, and helper-
 * lifecycle boilerplate that previously appeared verbatim in every spec
 * file. Tests that need an exception inline their override; the common case
 * is one call.
 */

const nock = require('nock');
const {
    VIESSMANN_API_BASE_URL,
    VIESSMANN_IAM_BASE_URL,
    VIESSMANN_TOKEN_PATH
} = require('../../nodes/lib/client');

const DEFAULT_CLIENT_ID = 'test-client-id';
const DEFAULT_ACCESS_TOKEN = 'test-access-token';
const DEFAULT_REFRESH_TOKEN = 'test-refresh-token';

/**
 * Build a credentials object suitable for helper.load(...).
 * Default node id is 'c1' (the config node in every consumer-node spec).
 * Pass a different nodeId for viessmann-config_spec.js (where the config is
 * the node under test and uses id 'n1'). Override individual fields via
 * the second arg.
 */
function makeCredentials(nodeId = 'c1', overrides = {}) {
    return {
        [nodeId]: {
            clientId: DEFAULT_CLIENT_ID,
            accessToken: DEFAULT_ACCESS_TOKEN,
            refreshToken: DEFAULT_REFRESH_TOKEN,
            ...overrides
        }
    };
}

/**
 * Build a minimal flow with a viessmann-config (id: c1) and one consumer
 * node (id: n1). Pass withHelper: true to add a node-red-test-helper sink
 * (id: n2) wired to n1's output.
 */
function makeFlow(nodeType, { name, withHelper = false, extraConfig } = {}) {
    const consumer = { id: 'n1', type: nodeType, name: name || `test ${nodeType}`, config: 'c1' };
    if (extraConfig) Object.assign(consumer, extraConfig);
    if (withHelper) consumer.wires = [['n2']];

    const flow = [
        { id: 'c1', type: 'viessmann-config', name: 'test config' },
        consumer
    ];
    if (withHelper) {
        flow.push({ id: 'n2', type: 'helper' });
    }
    return flow;
}

/**
 * Mock the IAM token refresh endpoint with a 200 reply. Pass a body override
 * if a particular test needs custom rotation values.
 */
function mockTokenRefresh(bodyOverride = {}) {
    return nock(VIESSMANN_IAM_BASE_URL)
        .post(VIESSMANN_TOKEN_PATH)
        .reply(200, {
            access_token: 'refreshed-token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'new-refresh-token',
            ...bodyOverride
        });
}

/**
 * Mock a GET on the Viessmann API.
 */
function mockApiGet(path, status, body, headers) {
    let i = nock(VIESSMANN_API_BASE_URL).get(path);
    return headers ? i.reply(status, body, headers) : i.reply(status, body);
}

/**
 * Mock a POST on the Viessmann API.
 */
function mockApiPost(path, status, body, headers) {
    let i = nock(VIESSMANN_API_BASE_URL).post(path);
    return headers ? i.reply(status, body, headers) : i.reply(status, body);
}

/**
 * Replace node.status with an array-pushing wrapper. Returns the array so
 * the test can assert on captured calls.
 */
function captureNodeStatus(node) {
    const calls = [];
    const original = node.status;
    node.status = function(status) {
        calls.push(status);
        original.call(node, status);
    };
    return calls;
}

/**
 * Register node-red-node-test-helper start/stop hooks plus nock cleanup on
 * the current mocha describe block. Call once at the top of each describe.
 */
function useNodeRedHelper(helper) {
    beforeEach(function(done) {
        helper.startServer(done);
    });
    afterEach(function(done) {
        helper.unload();
        helper.stopServer(done);
        nock.cleanAll();
    });
}

module.exports = {
    DEFAULT_CLIENT_ID,
    DEFAULT_ACCESS_TOKEN,
    DEFAULT_REFRESH_TOKEN,
    makeCredentials,
    makeFlow,
    mockTokenRefresh,
    mockApiGet,
    mockApiPost,
    captureNodeStatus,
    useNodeRedHelper
};
