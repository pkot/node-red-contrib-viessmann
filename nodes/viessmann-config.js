const axios = require('axios');

module.exports = function(RED) {
    function ViessmannConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // OAuth2 endpoints
        this.tokenUrl = 'https://iam.viessmann.com/idp/v3/token';
        
        // Token storage
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        
        /**
         * Authenticate using OAuth2 client credentials flow
         * @returns {Promise<void>}
         */
        this.authenticate = async function() {
            try {
                const response = await axios.post(node.tokenUrl, new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: node.credentials.clientId,
                    client_secret: node.credentials.clientSecret
                }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                
                node.accessToken = response.data.access_token;
                node.refreshToken = response.data.refresh_token;
                node.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
                
                node.log('Successfully authenticated with Viessmann API');
            } catch (error) {
                node.error('Authentication failed: ' + (error.response?.data?.error_description || error.message));
                throw error;
            }
        };
        
        /**
         * Refresh the access token using refresh token
         * @returns {Promise<void>}
         */
        this.refreshAccessToken = async function() {
            try {
                const response = await axios.post(node.tokenUrl, new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: node.credentials.clientId,
                    client_secret: node.credentials.clientSecret,
                    refresh_token: node.refreshToken
                }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                
                node.accessToken = response.data.access_token;
                if (response.data.refresh_token) {
                    node.refreshToken = response.data.refresh_token;
                }
                node.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
                
                node.log('Successfully refreshed access token');
            } catch (error) {
                node.error('Token refresh failed: ' + (error.response?.data?.error_description || error.message));
                // If refresh fails, try to re-authenticate
                await node.authenticate();
            }
        };
        
        /**
         * Get a valid access token, refreshing if necessary
         * @returns {Promise<string>} Valid access token
         */
        this.getValidToken = async function() {
            // If no token exists, authenticate
            if (!node.accessToken) {
                await node.authenticate();
                return node.accessToken;
            }
            
            // Check if token is expired (with 5 minute buffer)
            const bufferTime = 5 * 60 * 1000; // 5 minutes
            if (node.tokenExpiry && Date.now() >= (node.tokenExpiry - bufferTime)) {
                if (node.refreshToken) {
                    await node.refreshAccessToken();
                } else {
                    await node.authenticate();
                }
            }
            
            return node.accessToken;
        };
    }
    
    RED.nodes.registerType("viessmann-config", ViessmannConfigNode, {
        credentials: {
            clientId: { type: "text" },
            clientSecret: { type: "password" }
        }
    });
};
