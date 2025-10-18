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
            .get('/iot/v2/equipment/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.temperature')
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
            .get('/iot/v2/equipment/installations/123456/gateways/7571381573112225/devices/0/features')
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
            
            let errorCount = 0;
            const expectedErrors = 5;
            
            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === expectedErrors) {
                    done();
                }
            });

            // Test various invalid inputs
            n1.receive({ installationId: 'invalid', gatewaySerial: '7571381573112225', deviceId: '0' });
            n1.receive({ installationId: '123abc', gatewaySerial: '7571381573112225', deviceId: '0' });
            n1.receive({ installationId: -1, gatewaySerial: '7571381573112225', deviceId: '0' });
            n1.receive({ installationId: 0, gatewaySerial: '7571381573112225', deviceId: '0' });
            n1.receive({ installationId: 1.5, gatewaySerial: '7571381573112225', deviceId: '0' });
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
            
            let errorCount = 0;
            const expectedErrors = 4;
            
            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === expectedErrors) {
                    done();
                }
            });

            // Test various invalid inputs
            n1.receive({ installationId: 123456, gatewaySerial: 12345, deviceId: '0' });
            n1.receive({ installationId: 123456, gatewaySerial: '', deviceId: '0' });
            n1.receive({ installationId: 123456, gatewaySerial: '   ', deviceId: '0' });
            n1.receive({ installationId: 123456, gatewaySerial: null, deviceId: '0' });
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
            
            let errorCount = 0;
            const expectedErrors = 4;
            
            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === expectedErrors) {
                    done();
                }
            });

            // Test various invalid inputs
            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: 12345 });
            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '' });
            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '   ' });
            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: null });
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
            .get('/iot/v2/equipment/installations/123456/gateways/7571381573112225/devices/0/features')
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
});
