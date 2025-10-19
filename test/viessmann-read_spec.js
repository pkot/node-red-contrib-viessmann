const helper = require('node-red-node-test-helper');
const readNode = require('../nodes/viessmann-read.js');
const configNode = require('../nodes/viessmann-config.js');
const nock = require('nock');
const { expect } = require('chai');

helper.init(require.resolve('node-red'));

describe('viessmann-read Node', function() {
    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload();
        helper.stopServer(done);
        nock.cleanAll();
    });

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
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.temperature')
            .reply(200, {
                data: {
                    feature: 'heating.circuits.0.temperature',
                    gatewayId: '7571381573112225',
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
                gatewaySerial: '7571381573112225', 
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
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock features endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features')
            .reply(200, {
                data: [
                    {
                        feature: 'heating.circuits.0.temperature',
                        gatewayId: '7571381573112225',
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
                        gatewayId: '7571381573112225',
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
                gatewaySerial: '7571381573112225', 
                deviceId: '0'
            });
        });
    });

    it('should handle missing installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ gatewaySerial: '7571381573112225', deviceId: '0' });
        });
    });

    it('should handle missing gatewaySerial', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

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
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225' });
        });
    });

    it('should handle invalid installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // Test various invalid inputs: string, alphanumeric, negative, zero, float
            const invalidInputs = [
                { installationId: 'invalid', gatewaySerial: '7571381573112225', deviceId: '0' },
                { installationId: '123abc', gatewaySerial: '7571381573112225', deviceId: '0' },
                { installationId: -1, gatewaySerial: '7571381573112225', deviceId: '0' },
                { installationId: 0, gatewaySerial: '7571381573112225', deviceId: '0' },
                { installationId: 1.5, gatewaySerial: '7571381573112225', deviceId: '0' }
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
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

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
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // Test various invalid inputs: number, empty string, whitespace-only, null
            const invalidInputs = [
                { installationId: 123456, gatewaySerial: '7571381573112225', deviceId: 12345 },
                { installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '' },
                { installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '   ' },
                { installationId: 123456, gatewaySerial: '7571381573112225', deviceId: null }
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
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock API error
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features')
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
                gatewaySerial: '7571381573112225', 
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
                gatewaySerial: '7571381573112225', 
                deviceId: '0'
            });
        });
    });

    it('should update status based on config auth state', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const c1 = helper.getNode('c1');
            
            expect(n1).to.have.property('updateStatus');
            expect(typeof n1.updateStatus).to.equal('function');
            
            // Should be authenticated with token
            expect(c1.authState).to.equal('authenticated');
            done();
        });
    });

    it('should show error status when auth fails', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: '',
                refreshToken: ''
            }
        };

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const c1 = helper.getNode('c1');
            
            expect(n1).to.have.property('updateStatus');
            expect(typeof n1.updateStatus).to.equal('function');
            
            // Should be disconnected without token
            expect(c1.authState).to.equal('disconnected');
            done();
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
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.temperature')
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
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.temperature')
            .reply(200, {
                data: {
                    feature: 'heating.circuits.0.temperature',
                    gatewayId: '7571381573112225',
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
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.temperature'
            });
        });
    });

    it('should set status with value and unit for single feature read', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.temperature')
            .reply(200, {
                data: {
                    feature: 'heating.circuits.0.temperature',
                    gatewayId: '7571381573112225',
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
                    expect(msg.payload.properties.value).to.have.property('value', 21.5);
                    expect(msg.payload.properties.value).to.have.property('unit', 'celsius');
                    
                    // Check that status was set with value and unit
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', '21.5celsius');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.temperature'
            });
        });
    });

    it('should set status with value only when unit is missing', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint - no unit
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.operating.modes.active')
            .reply(200, {
                data: {
                    feature: 'heating.circuits.0.operating.modes.active',
                    gatewayId: '7571381573112225',
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
            });

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.have.property('feature', 'heating.circuits.0.operating.modes.active');
                    expect(msg.payload.properties.value).to.have.property('value', 'dhw');
                    
                    // Check that status was set with value only
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', 'dhw');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.operating.modes.active'
            });
        });
    });

    it('should set status with value and unit from properties.status', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint with properties.status instead of properties.value
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/device.status')
            .reply(200, {
                data: {
                    feature: 'device.status',
                    gatewayId: '7571381573112225',
                    deviceId: '0',
                    isEnabled: true,
                    isReady: true,
                    properties: {
                        status: {
                            type: 'string',
                            value: 'OK',
                            unit: ''
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
                    expect(msg.payload).to.have.property('feature', 'device.status');
                    expect(msg.payload.properties.status).to.have.property('value', 'OK');
                    
                    // Check that status was set with value from properties.status
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', 'OK');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'device.status'
            });
        });
    });

    it('should set status to success when value is null or undefined', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint with null value
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.temperature')
            .reply(200, {
                data: {
                    feature: 'heating.circuits.0.temperature',
                    gatewayId: '7571381573112225',
                    deviceId: '0',
                    isEnabled: true,
                    isReady: true,
                    properties: {
                        value: {
                            type: 'number',
                            value: null,
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
                    
                    // Check that status was set to success when value is null
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', 'success');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.temperature'
            });
        });
    });

    it('should set status to success when reading all features', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock features endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features')
            .reply(200, {
                data: [
                    {
                        feature: 'heating.circuits.0.temperature',
                        gatewayId: '7571381573112225',
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
                ]
            });

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.be.an('array');
                    
                    // Check that status was set to success for all features read
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', 'success');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0'
            });
        });
    });

    it('should fail if token refresh fails on 401 error', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'expired-access-token',
                refreshToken: 'invalid-refresh-token'
            }
        };

        // First request with expired token returns 401
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.temperature')
            .reply(401, {
                error: 'Unauthorized',
                message: 'Invalid or expired token'
            });

        // Token refresh fails
        nock('https://iam.viessmann-climatesolutions.com')
            .post('/idp/v3/token')
            .reply(401, {
                error: 'invalid_grant',
                error_description: 'Invalid refresh token'
            });

        helper.load([configNode, readNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.temperature'
            });
        });
    });

    it('should set status with value from properties.strength', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint with properties.strength
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.burner.strength')
            .reply(200, {
                data: {
                    feature: 'heating.burner.strength',
                    gatewayId: '7571381573112225',
                    deviceId: '0',
                    isEnabled: true,
                    isReady: true,
                    properties: {
                        strength: {
                            type: 'number',
                            value: 75
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
                    expect(msg.payload.properties.strength).to.have.property('value', 75);
                    
                    // Check that status was set with strength value
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', '75');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.burner.strength'
            });
        });
    });

    it('should set status with value from properties.active', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint with properties.active
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.active')
            .reply(200, {
                data: {
                    feature: 'heating.circuits.0.active',
                    gatewayId: '7571381573112225',
                    deviceId: '0',
                    isEnabled: true,
                    isReady: true,
                    properties: {
                        active: {
                            type: 'boolean',
                            value: true
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
                    expect(msg.payload.properties.active).to.have.property('value', true);
                    
                    // Check that status was set with active value
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', 'true');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.circuits.0.active'
            });
        });
    });

    it('should set status with value and unit from properties.hours', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint with properties.hours
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.burner.statistics')
            .reply(200, {
                data: {
                    feature: 'heating.burner.statistics',
                    gatewayId: '7571381573112225',
                    deviceId: '0',
                    isEnabled: true,
                    isReady: true,
                    properties: {
                        hours: {
                            type: 'number',
                            value: 1234.5,
                            unit: 'hour'
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
                    expect(msg.payload.properties.hours).to.have.property('value', 1234.5);
                    expect(msg.payload.properties.hours).to.have.property('unit', 'hour');
                    
                    // Check that status was set with hours value and unit
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', '1234.5hour');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.burner.statistics'
            });
        });
    });

    it('should set status with value from properties.starts', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint with properties.starts
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.burner.starts')
            .reply(200, {
                data: {
                    feature: 'heating.burner.starts',
                    gatewayId: '7571381573112225',
                    deviceId: '0',
                    isEnabled: true,
                    isReady: true,
                    properties: {
                        starts: {
                            type: 'number',
                            value: 5678
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
                    expect(msg.payload.properties.starts).to.have.property('value', 5678);
                    
                    // Check that status was set with starts value
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', '5678');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.burner.starts'
            });
        });
    });

    it('should set status with value and unit from properties.temperature', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-read', name: 'test read', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock feature endpoint with properties.temperature
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features/heating.boiler.temperature')
            .reply(200, {
                data: {
                    feature: 'heating.boiler.temperature',
                    gatewayId: '7571381573112225',
                    deviceId: '0',
                    isEnabled: true,
                    isReady: true,
                    properties: {
                        temperature: {
                            type: 'number',
                            value: 65.5,
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
                    expect(msg.payload.properties.temperature).to.have.property('value', 65.5);
                    expect(msg.payload.properties.temperature).to.have.property('unit', 'celsius');
                    
                    // Check that status was set with temperature value and unit
                    const status = n1.status.lastCall.args[0];
                    expect(status).to.have.property('fill', 'green');
                    expect(status).to.have.property('shape', 'dot');
                    expect(status).to.have.property('text', '65.5celsius');
                    
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                installationId: 123456, 
                gatewaySerial: '7571381573112225', 
                deviceId: '0',
                feature: 'heating.boiler.temperature'
            });
        });
    });
});
