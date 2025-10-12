const helper = require('node-red-node-test-helper');
const gatewayDevicesNode = require('../nodes/viessmann-gateway-devices.js');
const configNode = require('../nodes/viessmann-config.js');
const nock = require('nock');
const { expect } = require('chai');

helper.init(require.resolve('node-red'));

describe('viessmann-gateway-devices Node', function() {
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
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices', config: 'c1' }
        ];
        helper.load([configNode, gatewayDevicesNode], flow, function() {
            const n1 = helper.getNode('n1');
            expect(n1).to.have.property('name', 'test gateway devices');
            done();
        });
    });

    it('should fetch and return list of devices for a gateway', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices', config: 'c1', wires: [['n2']] },
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

        // Mock gateway devices endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/equipment/installations/123456/gateways/7571381573112225/devices')
            .reply(200, {
                data: [
                    {
                        gatewaySerial: '7571381573112225',
                        id: '0',
                        boilerSerial: '123456789012',
                        boilerSerialEditor: 'User',
                        bmuSerial: '123456789012',
                        bmuSerialEditor: 'User',
                        createdAt: '2025-09-18T13:56:08.9193723+00:00',
                        editedAt: '2025-09-18T13:56:08.9193938+00:00',
                        modelId: 'MODEL_7',
                        status: 'Offline',
                        deviceType: 'heating',
                        roles: ['type:boiler', 'type:E3'],
                        isBoilerSerialEditable: false,
                        brand: null,
                        translationKey: null
                    },
                    {
                        gatewaySerial: '7571381573112225',
                        id: '1',
                        boilerSerial: '987654321098',
                        boilerSerialEditor: 'User',
                        bmuSerial: '987654321098',
                        bmuSerialEditor: 'User',
                        createdAt: '2025-09-19T10:00:00.0000000+00:00',
                        editedAt: '2025-09-19T10:00:00.0000000+00:00',
                        modelId: 'MODEL_8',
                        status: 'Online',
                        deviceType: 'heating',
                        roles: ['type:boiler'],
                        isBoilerSerialEditable: true,
                        brand: 'Viessmann',
                        translationKey: 'device.model8'
                    }
                ]
            });

        helper.load([configNode, gatewayDevicesNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.be.an('array');
                    expect(msg.payload).to.have.lengthOf(2);
                    expect(msg.payload[0]).to.have.property('id', '0');
                    expect(msg.payload[0]).to.have.property('gatewaySerial', '7571381573112225');
                    expect(msg.payload[0]).to.have.property('deviceType', 'heating');
                    expect(msg.payload[0]).to.have.property('status', 'Offline');
                    expect(msg.payload[1]).to.have.property('id', '1');
                    expect(msg.payload[1]).to.have.property('status', 'Online');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225' });
        });
    });

    it('should handle missing installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, gatewayDevicesNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ gatewaySerial: '7571381573112225' });
        });
    });

    it('should handle missing gatewaySerial', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, gatewayDevicesNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456 });
        });
    });

    it('should handle invalid installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, gatewayDevicesNode], flow, credentials, function() {
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
            n1.receive({ installationId: 'invalid', gatewaySerial: '7571381573112225' });
            n1.receive({ installationId: '123abc', gatewaySerial: '7571381573112225' });
            n1.receive({ installationId: -1, gatewaySerial: '7571381573112225' });
            n1.receive({ installationId: 0, gatewaySerial: '7571381573112225' });
            n1.receive({ installationId: 1.5, gatewaySerial: '7571381573112225' });
        });
    });

    it('should handle invalid gatewaySerial', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, gatewayDevicesNode], flow, credentials, function() {
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
            n1.receive({ installationId: 123456, gatewaySerial: '' });
            n1.receive({ installationId: 123456, gatewaySerial: '   ' });
            n1.receive({ installationId: 123456, gatewaySerial: 123 }); // number instead of string
        });
    });

    it('should handle API errors gracefully', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices', config: 'c1' }
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

        // Mock gateway devices endpoint with error
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/equipment/installations/123456/gateways/7571381573112225/devices')
            .reply(404, {
                error: 'Gateway not found'
            });

        helper.load([configNode, gatewayDevicesNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225' });
        });
    });

    it('should handle missing config node', function(done) {
        const flow = [
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices' }
        ];

        helper.load([configNode, gatewayDevicesNode], flow, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456, gatewaySerial: '7571381573112225' });
        });
    });

    it('should update status based on config auth state', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices', config: 'c1' }
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

        helper.load([configNode, gatewayDevicesNode], flow, credentials, function() {
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
            { id: 'n1', type: 'viessmann-gateway-devices', name: 'test gateway devices', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id'
                // No accessToken - will cause auth to fail
            }
        };

        helper.load([configNode, gatewayDevicesNode], flow, credentials, function() {
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
