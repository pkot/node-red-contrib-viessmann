const helper = require('node-red-node-test-helper');
const readNode = require('../nodes/viessmann-read.js');
const configNode = require('../nodes/viessmann-config.js');
const nock = require('nock');
const { expect } = require('chai');
const { makeCredentials, useNodeRedHelper } = require('./support/fixtures');

helper.init(require.resolve('node-red'));

describe('viessmann-read Node', function() {
    useNodeRedHelper(helper);

    it('should be loaded', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        helper.load([configNode, readNode], flow, function() {
            const n1 = helper.getNode('n1');
            expect(n1).to.have.property('name', 'test read');
            done();
        });
    });

    it('should read a specific feature from a device', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = makeCredentials();

        // Mock feature endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/1234567890123456/devices/0/features/heating.circuits.0.temperature')
            .reply(200, {
                data: {
                    feature: 'heating.circuits.0.temperature',
                    gatewayId: '1234567890123456',
                    deviceId: '0',
                    isEnabled: true,
                    isReady: true,
                    properties: {
                        value: {
                            type: 'number',
                            value: 21.5,
                            unit: 'celsius'
                        }
                    },
                    commands: {},
                    timestamp: '2025-10-18T14:30:00.000Z'
                }
            });

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.have.property('feature', 'heating.circuits.0.temperature');
                    expect(msg.payload).to.have.property('properties');
                    expect(msg.payload.properties.value).to.have.property('value', 21.5);
                    expect(msg.payload.properties.value).to.have.property('unit', 'celsius');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({
                installationId: 123456,
                gatewaySerial: '1234567890123456',
                deviceId: '0',
                feature: 'heating.circuits.0.temperature'
            });
        });
    });

    it('should warn and return envelope when response.data.data is missing', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = makeCredentials();

        // Pathological response: 200 OK but the envelope's `data` is missing.
        const envelope = { meta: { foo: 'bar' } };
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/1234567890123456/devices/0/features/heating.circuits.0.temperature')
            .reply(200, envelope);

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            const warnings = [];
            const origWarn = n1.warn;
            n1.warn = function(m) { warnings.push(String(m)); origWarn.call(n1, m); };

            n2.on('input', function(msg) {
                try {
                    expect(msg.payload).to.deep.equal(envelope);
                    expect(warnings.some(w => w.toLowerCase().includes('unexpected response shape'))).to.equal(true);
                    done();
                } catch (err) { done(err); }
            });

            n1.receive({
                installationId: 123456,
                gatewaySerial: '1234567890123456',
                deviceId: '0',
                feature: 'heating.circuits.0.temperature'
            });
        });
    });

    it('should read all features when no feature is specified', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = makeCredentials();

        // Mock features endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/1234567890123456/devices/0/features')
            .reply(200, {
                data: [
                    {
                        feature: 'heating.circuits.0.temperature',
                        gatewayId: '1234567890123456',
                        deviceId: '0',
                        isEnabled: true,
                        isReady: true,
                        properties: {
                            value: {
                                type: 'number',
                                value: 21.5,
                                unit: 'celsius'
                            }
                        },
                        commands: {},
                        timestamp: '2025-10-18T14:30:00.000Z'
                    },
                    {
                        feature: 'heating.circuits.0.operating.modes.active',
                        gatewayId: '1234567890123456',
                        deviceId: '0',
                        isEnabled: true,
                        isReady: true,
                        properties: {
                            value: {
                                type: 'string',
                                value: 'dhw'
                            }
                        },
                        commands: {},
                        timestamp: '2025-10-18T14:30:00.000Z'
                    }
                ]
            });

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.be.an('array');
                    expect(msg.payload).to.have.lengthOf(2);
                    expect(msg.payload[0]).to.have.property('feature', 'heating.circuits.0.temperature');
                    expect(msg.payload[1]).to.have.property('feature', 'heating.circuits.0.operating.modes.active');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({
                installationId: 123456,
                gatewaySerial: '1234567890123456',
                deviceId: '0'
            });
        });
    });

    it('should handle missing installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');

            n1.on('call:error', function() {
                done();
            });

            n1.receive({ gatewaySerial: '1234567890123456', deviceId: '0' });
        });
    });

    it('should handle missing gatewaySerial', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');

            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456, deviceId: '0' });
        });
    });

    it('should handle missing deviceId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');

            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456, gatewaySerial: '1234567890123456' });
        });
    });

    it('should handle invalid installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');

            // Test various invalid inputs: string, alphanumeric, negative, zero, float
            const invalidInputs = [
                { installationId: 'invalid', gatewaySerial: '1234567890123456', deviceId: '0' },
                { installationId: '123abc', gatewaySerial: '1234567890123456', deviceId: '0' },
                { installationId: -1, gatewaySerial: '1234567890123456', deviceId: '0' },
                { installationId: 0, gatewaySerial: '1234567890123456', deviceId: '0' },
                { installationId: 1.5, gatewaySerial: '1234567890123456', deviceId: '0' }
            ];

            let errorCount = 0;

            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === invalidInputs.length) {
                    done();
                }
            });

            invalidInputs.forEach(input => n1.receive(input));
        });
    });

    it('should handle invalid gatewaySerial', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');

            // Test various invalid inputs: number, empty string, whitespace-only, null
            const invalidInputs = [
                { installationId: 123456, gatewaySerial: 12345, deviceId: '0' },
                { installationId: 123456, gatewaySerial: '', deviceId: '0' },
                { installationId: 123456, gatewaySerial: '   ', deviceId: '0' },
                { installationId: 123456, gatewaySerial: null, deviceId: '0' }
            ];

            let errorCount = 0;

            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === invalidInputs.length) {
                    done();
                }
            });

            invalidInputs.forEach(input => n1.receive(input));
        });
    });

    it('should handle invalid deviceId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');

            // Test various invalid inputs: number, empty string, whitespace-only, null
            const invalidInputs = [
                { installationId: 123456, gatewaySerial: '1234567890123456', deviceId: 12345 },
                { installationId: 123456, gatewaySerial: '1234567890123456', deviceId: '' },
                { installationId: 123456, gatewaySerial: '1234567890123456', deviceId: '   ' },
                { installationId: 123456, gatewaySerial: '1234567890123456', deviceId: null }
            ];

            let errorCount = 0;

            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === invalidInputs.length) {
                    done();
                }
            });

            invalidInputs.forEach(input => n1.receive(input));
        });
    });

    it('should handle API errors gracefully', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        // Mock API error
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/1234567890123456/devices/0/features')
            .reply(404, {
                error: 'Device not found'
            });

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');

            n1.on('call:error', function() {
                done();
            });

            n1.receive({
                installationId: 123456,
                gatewaySerial: '1234567890123456',
                deviceId: '0'
            });
        });
    });

    it('should handle network connection refused error', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        // Real axios decorates connection errors with a `code` property; nock's
        // string form doesn't, so we pass an Error explicitly to mirror reality.
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/1234567890123456/devices/0/features')
            .replyWithError(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }));

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');

            // Override error to capture it since call:error may not fire for network errors
            const origError = n1.error;
            n1.error = function(msg, origMsg) {
                origError.call(n1, msg, origMsg);
                try {
                    expect(msg).to.include('ECONNREFUSED');
                    done();
                } catch (err) {
                    done(err);
                }
            };

            n1.receive({
                installationId: 123456,
                gatewaySerial: '1234567890123456',
                deviceId: '0'
            });
        });
    });

    it('should handle network timeout error', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/1234567890123456/devices/0/features')
            .replyWithError(Object.assign(new Error('connect ETIMEDOUT 10.0.0.1:443'), { code: 'ETIMEDOUT' }));

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');

            const origError = n1.error;
            n1.error = function(msg, origMsg) {
                origError.call(n1, msg, origMsg);
                try {
                    expect(msg).to.include('ETIMEDOUT');
                    done();
                } catch (err) {
                    done(err);
                }
            };

            n1.receive({
                installationId: 123456,
                gatewaySerial: '1234567890123456',
                deviceId: '0'
            });
        });
    });

    it('should handle missing config node', function(done) {
        const flow = [
            { id: 'n1', type: 'viessmann-read', name: 'test read' }
        ];

        helper.load([readNode], flow, function() {
            const n1 = helper.getNode('n1');

            n1.on('call:error', function() {
                done();
            });

            n1.receive({
                installationId: 123456,
                gatewaySerial: '1234567890123456',
                deviceId: '0'
            });
        });
    });

    it('should update status based on config auth state', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = makeCredentials();

        helper.load([configNode, readNode], flow, credentials, function() {
            const c1 = helper.getNode('c1');
            const n1 = helper.getNode('n1');

            // Capture every status() call so we can assert on the actual
            // visible icon, not just internal state.
            const statusCalls = [];
            const originalStatus = n1.status;
            n1.status = function(status) {
                statusCalls.push(status);
                originalStatus.call(n1, status);
            };

            c1.authenticate().then(() => {
                expect(statusCalls.length).to.be.greaterThan(0);
                const lastStatus = statusCalls[statusCalls.length - 1];
                expect(lastStatus.fill).to.equal('green');
                expect(lastStatus.text).to.equal('connected');
                done();
            }).catch(done);
        });
    });

    it('should show error status when auth fails', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id'
                // No accessToken - authenticate() will reject and push the
                // node into the error auth state.
            }
        };

        helper.load([configNode, readNode], flow, credentials, function() {
            const c1 = helper.getNode('c1');
            const n1 = helper.getNode('n1');

            const statusCalls = [];
            const originalStatus = n1.status;
            n1.status = function(status) {
                statusCalls.push(status);
                originalStatus.call(n1, status);
            };

            c1.authenticate().catch(() => {
                try {
                    expect(statusCalls.length).to.be.greaterThan(0);
                    const lastStatus = statusCalls[statusCalls.length - 1];
                    expect(lastStatus.fill).to.equal('red');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should refresh token and retry on 401 error', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'expired-access-token',
                refreshToken: 'valid-refresh-token'
            }
        };

        // First request with expired token returns 401
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/1234567890123456/devices/0/features/heating.circuits.0.temperature')
            .reply(401, {
                error: 'Unauthorized',
                message: 'Invalid or expired token'
            });

        // Token refresh endpoint
        nock('https://iam.viessmann-climatesolutions.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'new-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'new-refresh-token'
            });

        // Retry with new token succeeds
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/1234567890123456/devices/0/features/heating.circuits.0.temperature')
            .reply(200, {
                data: {
                    feature: 'heating.circuits.0.temperature',
                    gatewayId: '1234567890123456',
                    deviceId: '0',
                    isEnabled: true,
                    isReady: true,
                    properties: {
                        value: {
                            type: 'number',
                            value: 21.5,
                            unit: 'celsius'
                        }
                    },
                    commands: {},
                    timestamp: '2025-10-18T14:30:00.000Z'
                }
            });

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.have.property('feature', 'heating.circuits.0.temperature');
                    expect(msg.payload).to.have.property('properties');
                    expect(msg.payload.properties.value).to.have.property('value', 21.5);
                    expect(msg.payload.properties.value).to.have.property('unit', 'celsius');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({
                installationId: 123456,
                gatewaySerial: '1234567890123456',
                deviceId: '0',
                feature: 'heating.circuits.0.temperature'
            });
        });
    });

    it('should reflect formatFeatureStatus output in node.status for single-feature reads', function(done) {
        // Smoke test that the formatFeatureStatus helper is actually wired
        // into the read input handler. The pure helper itself is covered
        // exhaustively by test/format-feature-status_spec.js.
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = makeCredentials();

        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/1234567890123456/devices/0/features/heating.circuits.0.temperature')
            .reply(200, {
                data: {
                    feature: 'heating.circuits.0.temperature',
                    properties: { value: { value: 21.5, unit: 'celsius' } }
                }
            });

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function() {
                try {
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('text', '21.5celsius');
                    done();
                } catch (err) { done(err); }
            });

            n1.receive({
                installationId: 123456,
                gatewaySerial: '1234567890123456',
                deviceId: '0',
                feature: 'heating.circuits.0.temperature'
            });
        });
    });

});
