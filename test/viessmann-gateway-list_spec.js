const helper = require('node-red-node-test-helper');
const gatewayListNode = require('../nodes/viessmann-gateway-list.js');
const configNode = require('../nodes/viessmann-config.js');
const nock = require('nock');
const { expect } = require('chai');

helper.init(require.resolve('node-red'));

describe('viessmann-gateway-list Node', function() {
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
            { id: 'n1', type: 'viessmann-gateway-list', name: 'test gateway list', config: 'c1' }
        ];
        helper.load([configNode, gatewayListNode], flow, function() {
            const n1 = helper.getNode('n1');
            expect(n1).to.have.property('name', 'test gateway list');
            done();
        });
    });

    it('should fetch and return list of gateways for an installation', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-list', name: 'test gateway list', config: 'c1', wires: [['n2']] },
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

        // Mock gateways endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/equipment/installations/123456/gateways')
            .reply(200, {
                data: [
                    {
                        serial: '7571381573112225',
                        version: '1.2.3.4',
                        firmwareUpdateFailureCounter: 435,
                        autoUpdate: false,
                        createdAt: '2025-09-18T13:56:08.9374248+00:00',
                        producedAt: '2025-09-18T13:56:08.9374519+00:00',
                        lastStatusChangedAt: '2025-09-18T13:56:08.9374752+00:00',
                        aggregatedStatus: 'WorksProperly',
                        targetRealm: 'DC',
                        gatewayType: 'VitoconnectOPTO2',
                        installationId: 518,
                        registeredAt: '2025-09-18T13:56:08.9375793+00:00',
                        description: 'My description',
                        otaOngoing: false
                    },
                    {
                        serial: '9876543210111222',
                        version: '2.0.0.1',
                        firmwareUpdateFailureCounter: 0,
                        autoUpdate: true,
                        createdAt: '2024-01-10T10:00:00.0000000+00:00',
                        producedAt: '2024-01-10T10:00:00.0000000+00:00',
                        lastStatusChangedAt: '2024-01-10T10:00:00.0000000+00:00',
                        aggregatedStatus: 'WorksProperly',
                        targetRealm: 'DC',
                        gatewayType: 'VitoconnectOPTO3',
                        installationId: 518,
                        registeredAt: '2024-01-10T10:00:00.0000000+00:00',
                        description: 'Second Gateway',
                        otaOngoing: false
                    }
                ],
                cursor: {
                    next: 'MTIzNA=='
                }
            });

        helper.load([configNode, gatewayListNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.be.an('array');
                    expect(msg.payload).to.have.lengthOf(2);
                    expect(msg.payload[0]).to.have.property('serial', '7571381573112225');
                    expect(msg.payload[0]).to.have.property('gatewayType', 'VitoconnectOPTO2');
                    expect(msg.payload[0]).to.have.property('aggregatedStatus', 'WorksProperly');
                    expect(msg.payload[1]).to.have.property('serial', '9876543210111222');
                    expect(msg.payload[1]).to.have.property('gatewayType', 'VitoconnectOPTO3');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ installationId: 123456 });
        });
    });

    it('should handle missing installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-list', name: 'test gateway list', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, gatewayListNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ payload: {} });
        });
    });

    it('should handle invalid installationId', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-list', name: 'test gateway list', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load([configNode, gatewayListNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 'invalid' });
        });
    });

    it('should handle API errors gracefully', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-list', name: 'test gateway list', config: 'c1' }
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

        // Mock gateways endpoint with error
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/equipment/installations/123456/gateways')
            .reply(404, {
                error: 'Installation not found'
            });

        helper.load([configNode, gatewayListNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456 });
        });
    });

    it('should handle missing config node', function(done) {
        const flow = [
            { id: 'n1', type: 'viessmann-gateway-list', name: 'test gateway list' }
        ];

        helper.load([configNode, gatewayListNode], flow, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ installationId: 123456 });
        });
    });

    it('should update status based on config auth state', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-gateway-list', name: 'test gateway list', config: 'c1' }
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

        helper.load([configNode, gatewayListNode], flow, credentials, function() {
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
            { id: 'n1', type: 'viessmann-gateway-list', name: 'test gateway list', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id'
                // No accessToken - will cause auth to fail
            }
        };

        helper.load([configNode, gatewayListNode], flow, credentials, function() {
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
