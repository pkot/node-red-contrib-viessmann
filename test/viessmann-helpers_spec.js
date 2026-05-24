const { expect } = require('chai');
const sinon = require('sinon');
const {
    VIESSMANN_API_BASE_URL,
    HTTP_TIMEOUT_MS,
    extractErrorMessage,
    truncateForStatus,
    validateInstallationId,
    validateGatewaySerial,
    validateDeviceId
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
});
