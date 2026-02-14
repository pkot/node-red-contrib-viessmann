const helper = require('node-red-node-test-helper');
const configNode = require('../nodes/viessmann-config.js');
const nock = require('nock');
const { expect } = require('chai');

helper.init(require.resolve('node-red'));

describe('viessmann-config Node', function() {
    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload();
        helper.stopServer(done);
        nock.cleanAll();
    });

    it('should be loaded', function(done) {
        const flow = [{ id: 'n1', type: 'viessmann-config', name: 'test config' }];
        helper.load(configNode, flow, function() {
            const n1 = helper.getNode('n1');
            expect(n1).to.have.property('name', 'test config');
            done();
        });
    });

    it('should store credentials securely', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };
        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            expect(n1.credentials).to.have.property('clientId', 'test-client-id');
            expect(n1.credentials).to.have.property('accessToken', 'test-access-token');
            expect(n1.credentials).to.have.property('refreshToken', 'test-refresh-token');
            done();
        });
    });

    it('should use provided access token', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.authenticate().then(() => {
                expect(n1.accessToken).to.equal('test-access-token');
                expect(n1.refreshToken).to.equal('test-refresh-token');
                expect(n1.authState).to.equal('authenticated');
                done();
            }).catch(done);
        });
    });

    it('should refresh token when expired', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                accessToken: 'initial-token',
                refreshToken: 'initial-refresh-token'
            }
        };

        // Mock token refresh
        nock('https://iam.viessmann-climatesolutions.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'refreshed-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'new-refresh-token'
            });

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // Token is initially loaded from credentials
            expect(n1.accessToken).to.equal('initial-token');
            
            // Force token to be expired
            n1.tokenExpiry = Date.now() - 1000;
            
            // getValidToken should trigger a refresh
            n1.getValidToken().then(() => {
                expect(n1.accessToken).to.equal('refreshed-token');
                expect(n1.refreshToken).to.equal('new-refresh-token');
                done();
            }).catch(done);
        });
    });

    it('should update credentials when tokens are refreshed', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                accessToken: 'initial-access-token',
                refreshToken: 'initial-refresh-token'
            }
        };

        // Mock token refresh
        nock('https://iam.viessmann-climatesolutions.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'new-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'new-refresh-token'
            });

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // Verify initial credentials
            expect(n1.credentials.accessToken).to.equal('initial-access-token');
            expect(n1.credentials.refreshToken).to.equal('initial-refresh-token');
            
            // Trigger token refresh
            n1.refreshAccessToken().then(() => {
                // Verify that credentials are updated with new tokens
                expect(n1.credentials.accessToken).to.equal('new-access-token');
                expect(n1.credentials.refreshToken).to.equal('new-refresh-token');
                
                // Also verify the node properties are updated
                expect(n1.accessToken).to.equal('new-access-token');
                expect(n1.refreshToken).to.equal('new-refresh-token');
                done();
            }).catch(done);
        });
    });

    it('should update access token in credentials even when refresh token is not returned', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                accessToken: 'initial-access-token',
                refreshToken: 'initial-refresh-token'
            }
        };

        // Mock token refresh that only returns new access token
        nock('https://iam.viessmann-climatesolutions.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'new-access-token-only',
                token_type: 'Bearer',
                expires_in: 3600
                // No refresh_token in response
            });

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // Verify initial credentials
            expect(n1.credentials.accessToken).to.equal('initial-access-token');
            expect(n1.credentials.refreshToken).to.equal('initial-refresh-token');
            
            // Trigger token refresh
            n1.refreshAccessToken().then(() => {
                // Verify that access token credential is updated
                expect(n1.credentials.accessToken).to.equal('new-access-token-only');
                
                // Verify that refresh token credential remains unchanged
                expect(n1.credentials.refreshToken).to.equal('initial-refresh-token');
                
                // Also verify the node properties
                expect(n1.accessToken).to.equal('new-access-token-only');
                expect(n1.refreshToken).to.equal('initial-refresh-token');
                done();
            }).catch(done);
        });
    });

    it('should provide valid token to requesting nodes', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
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

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.getValidToken().then(token => {
                expect(token).to.equal('test-access-token');
                done();
            }).catch(done);
        });
    });

    it('should not log debug messages when debug is disabled', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config',
            enableDebug: false
        }];
        const credentials = {
            n1: {
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

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // Store original log function
            const originalLog = n1.log;
            let logMessages = [];
            n1.log = function(msg) {
                logMessages.push(msg);
                originalLog.call(n1, msg);
            };
            
            n1.authenticate().then(() => {
                // Should only have one log message (the success message)
                const debugLogs = logMessages.filter(msg => msg.includes('[DEBUG]'));
                expect(debugLogs.length).to.equal(0);
                done();
            }).catch(done);
        });
    });

    it('should log debug messages when debug is enabled', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config',
            enableDebug: true
        }];
        const credentials = {
            n1: {
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

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // Store original log function
            const originalLog = n1.log;
            let logMessages = [];
            n1.log = function(msg) {
                logMessages.push(msg);
                originalLog.call(n1, msg);
            };
            
            n1.authenticate().then(() => {
                // Should have multiple debug log messages
                const debugLogs = logMessages.filter(msg => msg.includes('[DEBUG]'));
                expect(debugLogs.length).to.be.greaterThan(0);
                done();
            }).catch(done);
        });
    });

    it('should log debug messages during token refresh', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config',
            enableDebug: true
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        nock('https://iam.viessmann-climatesolutions.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'refreshed-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'new-refresh-token'
            });

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            // Manually set tokens to simulate a refresh scenario
            n1.accessToken = 'old-token';
            n1.refreshToken = 'old-refresh-token';
            n1.tokenExpiry = Date.now() + 3600000;
            
            // Store original log function
            const originalLog = n1.log;
            let logMessages = [];
            n1.log = function(msg) {
                logMessages.push(msg);
                originalLog.call(n1, msg);
            };
            
            n1.refreshAccessToken().then(() => {
                const debugLogs = logMessages.filter(msg => msg.includes('[DEBUG]'));
                
                // Should have debug messages about token refresh
                const hasRefreshMsg = debugLogs.some(msg => msg.includes('Starting token refresh'));
                expect(hasRefreshMsg).to.be.true;
                
                done();
            }).catch(done);
        });
    });

    it('should log debug messages in getValidToken', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config',
            enableDebug: true
        }];
        const credentials = {
            n1: {
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

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // Store original log function
            const originalLog = n1.log;
            let logMessages = [];
            n1.log = function(msg) {
                logMessages.push(msg);
                originalLog.call(n1, msg);
            };
            
            n1.getValidToken().then(() => {
                const debugLogs = logMessages.filter(msg => msg.includes('[DEBUG]'));
                
                // Should have debug message about checking token validity
                const hasCheckMsg = debugLogs.some(msg => msg.includes('Checking token validity'));
                expect(hasCheckMsg).to.be.true;
                
                done();
            }).catch(done);
        });
    });

    it('should update auth state to authenticated on successful authentication', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token'
            }
        };

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // With tokens provided, auth state should be authenticated on load
            expect(n1.authState).to.equal('authenticated');
            
            n1.authenticate().then(() => {
                expect(n1.authState).to.equal('authenticated');
                expect(n1.authError).to.be.null;
                done();
            }).catch(done);
        });
    });

    it('should update auth state to error on authentication failure', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id'
                // No accessToken or refreshToken
            }
        };

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.authenticate().then(() => {
                done(new Error('Should have failed authentication'));
            }).catch(() => {
                expect(n1.authState).to.equal('error');
                expect(n1.authError).to.include('No access token configured');
                done();
            });
        });
    });

    it('should notify dependent nodes on auth state change', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
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

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            // Mock dependent node
            let statusUpdateCount = 0;
            const mockDepNode = {
                updateStatus: function() {
                    statusUpdateCount++;
                }
            };
            
            n1.registerDependent(mockDepNode);
            
            n1.authenticate().then(() => {
                // Should have been called during authenticating and authenticated states
                expect(statusUpdateCount).to.be.greaterThan(0);
                done();
            }).catch(done);
        });
    });

});
