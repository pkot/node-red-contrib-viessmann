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
});
