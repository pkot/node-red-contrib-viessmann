const helper = require('node-red-node-test-helper');
const deviceListNode = require('../nodes/viessmann-device-list.js');
const configNode = require('../nodes/viessmann-config.js');
const nock = require('nock');
const { expect } = require('chai');

helper.init(require.resolve('node-red'));

describe('viessmann-device-list Node', function() {
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
            { id: 'n1', type: 'viessmann-device-list', name: 'test device list', config: 'c1' }
        ];
        helper.load([configNode, deviceListNode], flow, function() {
            const n1 = helper.getNode('n1');
            expect(n1).to.have.property('name', 'test device list');
            done();
        });
    });

    it('should fetch and return list of installations', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-device-list', name: 'test device list', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
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

        // Mock installations endpoint
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/equipment/installations')
            .reply(200, {
                data: [
                    {
                        id: 123456,
                        description: 'My Home',
                        address: {
                            street: 'Main Street 1',
                            city: 'Berlin',
                            postalCode: '10115',
                            country: 'DE'
                        },
                        registeredAt: '2024-01-15T10:30:00.000Z',
                        updatedAt: '2024-01-15T10:30:00.000Z'
                    },
                    {
                        id: 789012,
                        description: 'Vacation Home',
                        address: {
                            street: 'Lake View 5',
                            city: 'Munich',
                            postalCode: '80331',
                            country: 'DE'
                        },
                        registeredAt: '2024-02-10T14:20:00.000Z',
                        updatedAt: '2024-02-10T14:20:00.000Z'
                    }
                ]
            });

        helper.load([configNode, deviceListNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg).to.have.property('payload');
                    expect(msg.payload).to.be.an('array');
                    expect(msg.payload).to.have.lengthOf(2);
                    expect(msg.payload[0]).to.have.property('id', 123456);
                    expect(msg.payload[0]).to.have.property('description', 'My Home');
                    expect(msg.payload[1]).to.have.property('id', 789012);
                    expect(msg.payload[1]).to.have.property('description', 'Vacation Home');
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ payload: {} });
        });
    });

    it('should handle API errors gracefully', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-device-list', name: 'test device list', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
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

        // Mock installations endpoint with error
        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/equipment/installations')
            .reply(500, {
                error: 'Internal Server Error'
            });

        helper.load([configNode, deviceListNode], flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ payload: {} });
        });
    });

    it('should handle missing config node', function(done) {
        const flow = [
            { id: 'n1', type: 'viessmann-device-list', name: 'test device list' }
        ];

        helper.load([configNode, deviceListNode], flow, function() {
            const n1 = helper.getNode('n1');
            
            n1.on('call:error', function() {
                done();
            });

            n1.receive({ payload: {} });
        });
    });

    it('should update status based on config auth state', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config', name: 'test config' },
            { id: 'n1', type: 'viessmann-device-list', name: 'test device list', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
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

        helper.load([configNode, deviceListNode], flow, credentials, function() {
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
            { id: 'n1', type: 'viessmann-device-list', name: 'test device list', config: 'c1' }
        ];
        const credentials = {
            c1: {
                clientId: 'invalid-client-id',
                clientSecret: 'invalid-client-secret'
            }
        };

        nock('https://iam.viessmann.com')
            .post('/idp/v3/token')
            .reply(401, {
                error: 'invalid_client',
                error_description: 'Invalid client credentials'
            });

        helper.load([configNode, deviceListNode], flow, credentials, function() {
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
