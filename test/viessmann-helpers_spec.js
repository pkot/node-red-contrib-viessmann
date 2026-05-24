const { expect } = require('chai');
const sinon = require('sinon');
const {
    VIESSMANN_API_BASE_URL,
    HTTP_TIMEOUT_MS,
    RETRYABLE_STATUSES,
    MAX_RETRIES,
    extractErrorMessage,
    truncateForStatus,
    parseRetryAfter,
    validateInstallationId,
    validateGatewaySerial,
    validateDeviceId,
    validateViessmannRef
} = require('../nodes/viessmann-helpers');

describe('viessmann-helpers', function() {

    describe('VIESSMANN_API_BASE_URL', function() {
        it('should be the correct Viessmann API base URL', function() {
            expect(VIESSMANN_API_BASE_URL).to.equal('https://api.viessmann-climatesolutions.com');
        });
    });

    describe('HTTP_TIMEOUT_MS', function() {
        it('should be a positive integer suitable for axios timeout', function() {
            expect(HTTP_TIMEOUT_MS).to.be.a('number');
            expect(HTTP_TIMEOUT_MS).to.be.greaterThan(0);
            expect(Number.isInteger(HTTP_TIMEOUT_MS)).to.equal(true);
        });
    });

    describe('retry policy constants', function() {
        it('should include 429 and the common transient 5xx statuses', function() {
            expect(RETRYABLE_STATUSES.has(429)).to.equal(true);
            expect(RETRYABLE_STATUSES.has(502)).to.equal(true);
            expect(RETRYABLE_STATUSES.has(503)).to.equal(true);
            expect(RETRYABLE_STATUSES.has(504)).to.equal(true);
        });

        it('should not retry non-transient statuses', function() {
            expect(RETRYABLE_STATUSES.has(400)).to.equal(false);
            expect(RETRYABLE_STATUSES.has(401)).to.equal(false);
            expect(RETRYABLE_STATUSES.has(404)).to.equal(false);
            expect(RETRYABLE_STATUSES.has(500)).to.equal(false);
        });

        it('should cap retries at a small positive integer', function() {
            expect(MAX_RETRIES).to.be.a('number');
            expect(MAX_RETRIES).to.be.greaterThan(0);
            expect(MAX_RETRIES).to.be.lessThan(10);
        });
    });

    describe('parseRetryAfter', function() {
        it('should return null for missing header', function() {
            expect(parseRetryAfter(undefined)).to.equal(null);
            expect(parseRetryAfter(null)).to.equal(null);
            expect(parseRetryAfter('')).to.equal(null);
        });

        it('should parse delta-seconds into milliseconds', function() {
            expect(parseRetryAfter('0')).to.equal(0);
            expect(parseRetryAfter('1')).to.equal(1000);
            expect(parseRetryAfter('5')).to.equal(5000);
        });

        it('should clamp very large values to the maximum delay', function() {
            // 86400s = 1 day, far above any sane cap.
            expect(parseRetryAfter('86400')).to.be.lessThan(86400 * 1000);
        });

        it('should parse HTTP-date strings', function() {
            // Use a 60-second future offset so the test isn't flaky on slow CI.
            // HTTP-date has 1-second resolution; ms >= 0 keeps the assertion robust.
            const future = new Date(Date.now() + 60000).toUTCString();
            const ms = parseRetryAfter(future);
            expect(ms).to.be.a('number');
            expect(ms).to.be.at.least(0);
        });

        it('should return null for garbage input', function() {
            expect(parseRetryAfter('not-a-number-or-date')).to.equal(null);
        });
    });

    describe('extractErrorMessage', function() {
        it('should extract error from axios response data', function() {
            const error = {
                response: { data: { error: 'Device not found' } },
                message: 'Request failed with status code 404'
            };
            expect(extractErrorMessage(error)).to.equal('Device not found');
        });

        it('should fall back to error.message when no response data', function() {
            const error = { message: 'Network Error' };
            expect(extractErrorMessage(error)).to.equal('Network Error');
        });

        it('should fall back to error.message when response has no error field', function() {
            const error = {
                response: { data: {} },
                message: 'Request failed'
            };
            expect(extractErrorMessage(error)).to.equal('Request failed');
        });

        it('should handle error with no response property', function() {
            const error = { message: 'ECONNREFUSED' };
            expect(extractErrorMessage(error)).to.equal('ECONNREFUSED');
        });

        it('should include HTTP status in the message when response has status', function() {
            const error = {
                response: { status: 401, data: { message: 'Invalid token' } }
            };
            expect(extractErrorMessage(error)).to.equal('HTTP 401: Invalid token');
        });

        it('should prefer OAuth-style error_description when present', function() {
            const error = {
                response: {
                    status: 400,
                    data: { error: 'invalid_grant', error_description: 'Refresh token expired' }
                }
            };
            expect(extractErrorMessage(error)).to.equal('HTTP 400: Refresh token expired');
        });

        it('should report HTTP status alone when body has no recognizable detail', function() {
            const error = { response: { status: 503, data: {} } };
            expect(extractErrorMessage(error)).to.equal('HTTP 503');
        });

        it('should describe no-response errors with the error code', function() {
            const error = { request: {}, code: 'ECONNRESET', message: 'socket hang up' };
            expect(extractErrorMessage(error)).to.equal('No response from server (ECONNRESET)');
        });

        it('should describe no-response errors without a code', function() {
            const error = { request: {}, message: 'something failed' };
            expect(extractErrorMessage(error)).to.equal('No response from server');
        });

        it('should handle string response body', function() {
            const error = { response: { status: 502, data: 'Bad Gateway' } };
            expect(extractErrorMessage(error)).to.equal('HTTP 502: Bad Gateway');
        });

        it('should not throw on null/undefined input', function() {
            expect(extractErrorMessage(null)).to.equal('Unknown error');
            expect(extractErrorMessage(undefined)).to.equal('Unknown error');
        });

        it('should stringify non-object thrown values', function() {
            expect(extractErrorMessage('bare string')).to.equal('bare string');
            expect(extractErrorMessage(42)).to.equal('42');
        });
    });

    describe('truncateForStatus', function() {
        it('should return short strings unchanged', function() {
            expect(truncateForStatus('hello')).to.equal('hello');
        });

        it('should truncate strings longer than default maxLength', function() {
            const longStr = 'a'.repeat(40);
            const result = truncateForStatus(longStr);
            expect(result).to.have.lengthOf(30);
            expect(result).to.match(/\.\.\.$/);
        });

        it('should respect custom maxLength', function() {
            const result = truncateForStatus('hello world', 8);
            expect(result).to.equal('hello...');
        });

        it('should return string at exactly maxLength unchanged', function() {
            const str = 'a'.repeat(30);
            expect(truncateForStatus(str)).to.equal(str);
        });

        it('should convert non-string values to string', function() {
            expect(truncateForStatus(12345)).to.equal('12345');
            expect(truncateForStatus(true)).to.equal('true');
            expect(truncateForStatus(null)).to.equal('null');
            expect(truncateForStatus(undefined)).to.equal('undefined');
        });
    });

    describe('validateInstallationId', function() {
        let node;

        beforeEach(function() {
            node = {
                status: sinon.stub(),
                error: sinon.stub()
            };
        });

        it('should return valid integer installationId', function() {
            expect(validateInstallationId(node, { installationId: 123 })).to.equal(123);
        });

        it('should coerce numeric string to integer', function() {
            expect(validateInstallationId(node, { installationId: '456' })).to.equal(456);
        });

        it('should return null for null installationId', function() {
            expect(validateInstallationId(node, { installationId: null })).to.be.null;
            expect(node.error.calledOnce).to.be.true;
        });

        it('should return null for undefined installationId', function() {
            expect(validateInstallationId(node, {})).to.be.null;
            expect(node.error.calledOnce).to.be.true;
        });

        it('should return null for zero', function() {
            expect(validateInstallationId(node, { installationId: 0 })).to.be.null;
        });

        it('should return null for negative numbers', function() {
            expect(validateInstallationId(node, { installationId: -5 })).to.be.null;
        });

        it('should return null for floats', function() {
            expect(validateInstallationId(node, { installationId: 1.5 })).to.be.null;
        });

        it('should return null for non-numeric strings', function() {
            expect(validateInstallationId(node, { installationId: 'abc' })).to.be.null;
        });
    });

    describe('validateGatewaySerial', function() {
        let node;

        beforeEach(function() {
            node = {
                status: sinon.stub(),
                error: sinon.stub()
            };
        });

        it('should return valid string gatewaySerial', function() {
            expect(validateGatewaySerial(node, { gatewaySerial: 'ABC123' })).to.equal('ABC123');
        });

        it('should trim whitespace', function() {
            expect(validateGatewaySerial(node, { gatewaySerial: '  ABC123  ' })).to.equal('ABC123');
        });

        it('should return null for null', function() {
            expect(validateGatewaySerial(node, { gatewaySerial: null })).to.be.null;
        });

        it('should return null for undefined', function() {
            expect(validateGatewaySerial(node, {})).to.be.null;
        });

        it('should return null for non-string types', function() {
            expect(validateGatewaySerial(node, { gatewaySerial: 12345 })).to.be.null;
        });

        it('should return null for empty string', function() {
            expect(validateGatewaySerial(node, { gatewaySerial: '' })).to.be.null;
        });

        it('should return null for whitespace-only string', function() {
            expect(validateGatewaySerial(node, { gatewaySerial: '   ' })).to.be.null;
        });
    });

    describe('validateDeviceId', function() {
        let node;

        beforeEach(function() {
            node = {
                status: sinon.stub(),
                error: sinon.stub()
            };
        });

        it('should return valid string deviceId', function() {
            expect(validateDeviceId(node, { deviceId: '0' })).to.equal('0');
        });

        it('should trim whitespace', function() {
            expect(validateDeviceId(node, { deviceId: '  0  ' })).to.equal('0');
        });

        it('should return null for null', function() {
            expect(validateDeviceId(node, { deviceId: null })).to.be.null;
        });

        it('should return null for undefined', function() {
            expect(validateDeviceId(node, {})).to.be.null;
        });

        it('should return null for non-string types', function() {
            expect(validateDeviceId(node, { deviceId: 123 })).to.be.null;
        });

        it('should return null for empty string', function() {
            expect(validateDeviceId(node, { deviceId: '' })).to.be.null;
        });

        it('should return null for whitespace-only string', function() {
            expect(validateDeviceId(node, { deviceId: '   ' })).to.be.null;
        });
    });

    describe('validateViessmannRef', function() {
        let node;

        beforeEach(function() {
            node = {
                status: sinon.stub(),
                error: sinon.stub()
            };
        });

        it('should accept individual msg fields and return the bundle', function() {
            const ref = validateViessmannRef(node, {
                installationId: 12345,
                gatewaySerial: 'GW-1',
                deviceId: '0'
            });
            expect(ref).to.deep.equal({ installationId: 12345, gatewaySerial: 'GW-1', deviceId: '0' });
            expect(node.error.called).to.be.false;
        });

        it('should accept msg.viessmann bundle in preference to individual fields', function() {
            const ref = validateViessmannRef(node, {
                viessmann: { installationId: 99, gatewaySerial: 'BUNDLE', deviceId: '7' },
                installationId: 12345,
                gatewaySerial: 'IGNORED',
                deviceId: 'IGNORED'
            });
            expect(ref).to.deep.equal({ installationId: 99, gatewaySerial: 'BUNDLE', deviceId: '7' });
        });

        it('should short-circuit on first invalid field (only one error emitted)', function() {
            const ref = validateViessmannRef(node, {});
            expect(ref).to.equal(null);
            // Only the first validator (installationId) should have surfaced an error.
            expect(node.error.callCount).to.equal(1);
        });

        it('should stop at gatewaySerial when installationId is valid but gatewaySerial missing', function() {
            const ref = validateViessmannRef(node, { installationId: 1 });
            expect(ref).to.equal(null);
            expect(node.error.callCount).to.equal(1);
            // Last status reflects the field that failed.
            const lastStatus = node.status.lastCall.args[0];
            expect(lastStatus.text).to.equal('no gatewaySerial');
        });

        it('should stop at deviceId when first two are valid but deviceId missing', function() {
            const ref = validateViessmannRef(node, { installationId: 1, gatewaySerial: 'GW' });
            expect(ref).to.equal(null);
            expect(node.error.callCount).to.equal(1);
            const lastStatus = node.status.lastCall.args[0];
            expect(lastStatus.text).to.equal('no deviceId');
        });

        it('should reject array msg.viessmann (must be a plain object)', function() {
            const ref = validateViessmannRef(node, {
                viessmann: ['nope'],
                // Fallback fields exist so error path is the same as missing.
            });
            // Falls back to msg-level fields; both missing -> first error.
            expect(ref).to.equal(null);
            expect(node.error.callCount).to.equal(1);
        });

        it('should preserve _msgid so Catch nodes route correctly when a bundle is used', function() {
            // When msg.viessmann is provided, validators see a clone (not the
            // original msg object) - but the clone copies _msgid so Catch
            // routing still matches.
            const originalMsg = {
                _msgid: 'abc123',
                viessmann: { installationId: 'not-a-number' }
            };
            validateViessmannRef(node, originalMsg);
            const [, passedMsg] = node.error.firstCall.args;
            expect(passedMsg._msgid).to.equal('abc123');
        });

        it('should pass the original msg by reference when no bundle is provided', function() {
            // Legacy path - no bundle, no clone, validators see the original
            // msg object itself.
            const originalMsg = { _msgid: 'xyz', installationId: 'bad' };
            validateViessmannRef(node, originalMsg);
            const [, passedMsg] = node.error.firstCall.args;
            expect(passedMsg).to.equal(originalMsg);
        });
    });
});
