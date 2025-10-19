const helper = require('node-red-node-test-helper');
const deviceFeaturesNode = require('../nodes/viessmann-device-features.js');
const configNode = require('../nodes/viessmann-config.js');
const nock = require('nock');
const { expect } = require('chai');

helper.init(require.resolve('node-red'));

describe('viessmann-device-features Node', function() {
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
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        helper.load([configNode, deviceFeaturesNode], flow, function() {
            const n1 = helper.getNode('n1');
            expect(n1).to.have.property('name', 'test device features');
            done();
        });
    });

    it('should fetch and return list of features for a device', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock OAuth2 token endpoint
        nock('https://iam.viessmann.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'test-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'test-refresh-token'
            });

        // Mock device features endpoint
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
                        commands: {
                            setMode: {
                                uri: '/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.operating.modes.active/commands/setMode',
                                name: 'setMode',
                                isExecutable: true,
                                params: {
                                    mode: {
                                        type: 'string',
                                        required: true,
                                        constraints: {
                                            enum: ['standby', 'dhw', 'dhwAndHeating']
                                        }
                                    }
                                }
                            }
                        },
                        timestamp: '2025-10-18T14:30:00.000Z'
                    }
                ]
            });

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.be.an('array');
                    expect(msg.payload).to.have.lengthOf(2);
                    expect(msg.payload[0]).to.have.property('feature', 'heating.circuits.0.temperature');
                    expect(msg.payload[0]).to.have.property('isEnabled', true);
                    expect(msg.payload[0]).to.have.property('properties');
                    expect(msg.payload[0].properties.value).to.have.property('value', 21.5);
                    expect(msg.payload[1]).to.have.property('feature', 'heating.circuits.0.operating.modes.active');
                    expect(msg.payload[1]).to.have.property('commands');
                    expect(msg.payload[1].commands).to.have.property('setMode');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '0' });
        });
    });

    it('should handle missing installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
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
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
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
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
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
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
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
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            let errorCount = 0;
            const expectedErrors = 3;
            
            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === expectedErrors) {
                    done();
                }
            });

            // Test various invalid inputs (empty string, only whitespace, etc)
            n1.receive({ installationId: 123456, gatewaySerial: '', deviceId: '0' });
            n1.receive({ installationId: 123456, gatewaySerial: '   ', deviceId: '0' });
            n1.receive({ installationId: 123456, gatewaySerial: 123, deviceId: '0' }); // number instead of string
        });
    });

    it('should handle invalid deviceId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            let errorCount = 0;
            const expectedErrors = 3;
            
            n1.on('call:error', function() {
                errorCount++;
                if (errorCount === expectedErrors) {
                    done();
                }
            });

            // Test various invalid inputs (empty string, only whitespace, etc)
            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '' });
            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '   ' });
            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: 123 }); // number instead of string
        });
    });

    it('should handle API errors gracefully', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        // Mock OAuth2 token endpoint
        nock('https://iam.viessmann.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'test-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'test-refresh-token'
            });

        // Mock device features endpoint with error
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/features/installations/123456/gateways/7571381573112225/devices/0/features')
            .reply(404, {
                error: 'Device not found'
            });

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '0' });
        });
    });

    it('should handle missing config node', function(done) {
        const flow = [
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features' }
        ];

        helper.load([configNode, deviceFeaturesNode], flow, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225', deviceId: '0' });
        });
    });

    it('should update status based on config auth state', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        nock('https://iam.viessmann.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'test-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'test-refresh-token'
            });

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
            const c1 = helper.getNode('c1');
            const n1 = helper.getNode('n1');
            
            // Track status updates
            let statusCalls = [];
            const originalStatus = n1.status;
            n1.status = function(status) {
                statusCalls.push(status);
                originalStatus.call(n1, status);
            };
            
            // Authenticate to trigger status update
            c1.authenticate().then(() => {
                // Should have updated status
                expect(statusCalls.length).to.be.greaterThan(0);
                
                // Last status should be green/connected
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
            { id: 'n1', type: 'viessmann-device-features', name: 'test device features', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id'
                // No accessToken - will cause auth to fail
            }
        };

        helper.load([configNode, deviceFeaturesNode], flow, credentials, function() {
            const c1 = helper.getNode('c1');
            const n1 = helper.getNode('n1');
            
            // Track status updates
            let statusCalls = [];
            const originalStatus = n1.status;
            n1.status = function(status) {
                statusCalls.push(status);
                originalStatus.call(n1, status);
            };
            
            // Authenticate to trigger status update (will fail)
            c1.authenticate().catch(() => {
                // Should have updated status to error
                expect(statusCalls.length).to.be.greaterThan(0);
                
                // Last status should be red/error
                const lastStatus = statusCalls[statusCalls.length - 1];
                expect(lastStatus.fill).to.equal('red');
                
                done();
            });
        });
    });
});
