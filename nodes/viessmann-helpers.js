/**
 * Barrel re-export for Viessmann node helpers.
 *
 * The implementation now lives in nodes/lib/:
 *   - lib/client.js        - HTTP client, transport, retry, token refresh
 *   - lib/validators.js    - input validators (msg.installationId etc.)
 *   - lib/format.js        - message formatting / truncation
 *   - lib/node-runtime.js  - Node-RED lifecycle, status, request wrappers
 *
 * This module exists for backward-compatible imports from the consumer
 * node files (and the existing test suite). New code should require
 * directly from `./lib/*`.
 */

const client = require('./lib/client');
const validators = require('./lib/validators');
const format = require('./lib/format');
const runtime = require('./lib/node-runtime');

module.exports = {
    // Client transport constants
    VIESSMANN_API_BASE_URL: client.VIESSMANN_API_BASE_URL,
    HTTP_TIMEOUT_MS: client.HTTP_TIMEOUT_MS,
    RETRYABLE_STATUSES: client.RETRYABLE_STATUSES,
    MAX_RETRIES: client.MAX_RETRIES,
    parseRetryAfter: client.parseRetryAfter,

    // Validators
    validateConfigNode: validators.validateConfigNode,
    validateInstallationId: validators.validateInstallationId,
    validateGatewaySerial: validators.validateGatewaySerial,
    validateDeviceId: validators.validateDeviceId,
    validateFeature: validators.validateFeature,
    validateCommand: validators.validateCommand,
    validateParams: validators.validateParams,
    viessmannRefSource: validators.viessmannRefSource,
    validateViessmannRef: validators.validateViessmannRef,

    // Formatting
    extractErrorMessage: format.extractErrorMessage,
    truncateForStatus: format.truncateForStatus,

    // Node-RED runtime
    initializeViessmannNode: runtime.initializeViessmannNode,
    createStatusUpdater: runtime.createStatusUpdater,
    setupDependentNode: runtime.setupDependentNode,
    surfaceUnexpectedError: runtime.surfaceUnexpectedError,
    executeApiGet: runtime.executeApiGet,
    executeApiPost: runtime.executeApiPost
};
