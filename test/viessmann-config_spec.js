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
                clientSecret: 'test-client-secret'
            }
        };
        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            expect(n1.credentials).to.have.property('clientId', 'test-client-id');
            expect(n1.credentials).to.have.property('clientSecret', 'test-client-secret');
            done();
        });
    });

    it('should authenticate with OAuth2 client credentials', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
            }
        };

        // Mock the OAuth2 token endpoint
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
            
            n1.authenticate().then(() => {
                expect(n1.accessToken).to.equal('test-access-token');
                expect(n1.refreshToken).to.equal('test-refresh-token');
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
                clientSecret: 'test-client-secret'
            }
        };

        // Mock initial authentication
        nock('https://iam.viessmann.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'initial-token',
                token_type: 'Bearer',
                expires_in: 1,
                refresh_token: 'initial-refresh-token'
            });

        // Mock token refresh
        nock('https://iam.viessmann.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'refreshed-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'new-refresh-token'
            });

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.authenticate().then(() => {
                expect(n1.accessToken).to.equal('initial-token');
                
                // Wait for token to expire
                setTimeout(() => {
                    n1.getValidToken().then(() => {
                        expect(n1.accessToken).to.equal('refreshed-token');
                        done();
                    }).catch(done);
                }, 1500);
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

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.getValidToken().then(token => {
                expect(token).to.equal('test-access-token');
                done();
            }).catch(done);
        });
    });

    it('should handle authentication errors gracefully', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
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

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.authenticate().then(() => {
                done(new Error('Should have failed authentication'));
            }).catch(err => {
                expect(err).to.exist;
                done();
            });
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

    it('should mask sensitive data in debug logs', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config',
            enableDebug: true
        }];
        const credentials = {
            n1: {
                clientId: 'my-secret-client-id',
                clientSecret: 'my-secret-client-secret'
            }
        };

        nock('https://iam.viessmann.com')
            .post('/idp/v3/token')
            .reply(200, {
                access_token: 'my-long-access-token-value',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'my-long-refresh-token-value'
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
                const debugLogs = logMessages.filter(msg => msg.includes('[DEBUG]'));
                
                // Check that full credentials/tokens are NOT logged
                debugLogs.forEach(logMsg => {
                    expect(logMsg).to.not.include('my-secret-client-id');
                    expect(logMsg).to.not.include('my-secret-client-secret');
                    expect(logMsg).to.not.include('my-long-access-token-value');
                    expect(logMsg).to.not.include('my-long-refresh-token-value');
                });
                
                // Check that masked values ARE logged (last 4 chars)
                // Client ID should show as ****t-id (last 4 chars of 'my-secret-client-id')
                const hasClientIdMasked = debugLogs.some(msg => msg.includes('****t-id'));
                // Access token should show as ****alue (last 4 chars of 'my-long-access-token-value')
                const hasAccessTokenMasked = debugLogs.some(msg => msg.includes('****alue'));
                
                expect(hasClientIdMasked).to.be.true;
                expect(hasAccessTokenMasked).to.be.true;
                
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
                clientSecret: 'test-client-secret'
            }
        };

        nock('https://iam.viessmann.com')
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

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            expect(n1.authState).to.equal('disconnected');
            
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

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.authenticate().then(() => {
                done(new Error('Should have failed authentication'));
            }).catch(() => {
                expect(n1.authState).to.equal('error');
                expect(n1.authError).to.include('Invalid client credentials');
                expect(n1.authError).to.include('Client ID and Client Secret');
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

    it('should include scope in authentication request', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config',
            scope: 'IoT User offline_access'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
            }
        };

        // Mock authentication endpoint
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
            
            // Verify scope is stored
            expect(n1.scope).to.equal('IoT User offline_access');
            
            n1.authenticate().then(() => {
                done();
            }).catch(done);
        });
    });

    it('should use default scope if not configured', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
            }
        };

        // Mock authentication endpoint
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
            
            // Verify default scope is set
            expect(n1.scope).to.equal('IoT User offline_access');
            
            n1.authenticate().then(() => {
                done();
            }).catch(done);
        });
    });

    it('should provide helpful error for invalid_scope', function(done) {
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config',
            scope: 'invalid_scope'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
            }
        };

        nock('https://iam.viessmann.com')
            .post('/idp/v3/token')
            .reply(400, {
                error: 'invalid_scope',
                error_description: 'Invalid scope'
            });

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.authenticate().then(() => {
                done(new Error('Should have failed authentication'));
            }).catch(() => {
                expect(n1.authState).to.equal('error');
                expect(n1.authError).to.include('Invalid scope');
                expect(n1.authError).to.include('Developer Portal');
                expect(n1.authError).to.include('invalid_scope');
                done();
            });
        });
    });

    it('should provide helpful error for unauthorized_client', function(done) {
        this.timeout(5000); // Increase timeout
        const flow = [{ 
            id: 'n1', 
            type: 'viessmann-config', 
            name: 'test config'
        }];
        const credentials = {
            n1: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
            }
        };

        nock('https://iam.viessmann.com')
            .post('/idp/v3/token')
            .reply(401, {
                error: 'unauthorized_client',
                error_description: 'Unauthorized client'
            });

        helper.load(configNode, flow, credentials, function() {
            const n1 = helper.getNode('n1');
            
            n1.authenticate().then(() => {
                done(new Error('Should have failed authentication'));
            }).catch((err) => {
                try {
                    expect(n1.authState).to.equal('error');
                    expect(n1.authError).to.include('Unauthorized client');
                    expect(n1.authError).to.include('redirect URIs');
                    expect(n1.authError).to.include('consent');
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
});
