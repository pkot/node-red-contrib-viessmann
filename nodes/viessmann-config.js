const axios = require('axios');

// Token refresh buffer time (5 minutes before expiration)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

module.exports = function(RED) {
    /**
     * Helper function to mask sensitive data for logging
     * Shows only the last 4 characters of a string
     * @param {string} value - The value to mask
     * @returns {string} Masked value
     */
    function maskSensitiveData(value) {
        if (!value || typeof value !== 'string') {
            return '****';
        }
        if (value.length <= 4) {
            return '****';
        }
        return '****' + value.slice(-4);
    }

    function ViessmannConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Store debug flag from config
        this.enableDebug = config.enableDebug || false;
        
        // OAuth2 endpoints
        this.tokenUrl = 'https://iam.viessmann-climatesolutions.com/idp/v3/token';
        
        // Token storage - initialize from credentials if provided
        this.accessToken = node.credentials.accessToken || null;
        this.refreshToken = node.credentials.refreshToken || null;
        this.tokenExpiry = null;
        
        // Authentication state
        this.authState = 'disconnected'; // 'disconnected', 'authenticating', 'authenticated', 'error'
        this.authError = null;
        
        // List of dependent nodes
        this.dependentNodes = [];
        
        /**
         * Log debug information if debug mode is enabled
         * @param {string} message - The debug message to log
         */
        const debugLog = function(message) {
            if (node.enableDebug) {
                node.log('[DEBUG] ' + message);
            }
        };
        
        /**
         * Update authentication state and notify dependent nodes
         * @param {string} state - New authentication state
         * @param {string} error - Optional error message
         */
        const updateAuthState = function(state, error) {
            node.authState = state;
            node.authError = error || null;
            
            // Notify all dependent nodes
            node.dependentNodes.forEach(depNode => {
                if (depNode && typeof depNode.updateStatus === 'function') {
                    depNode.updateStatus();
                }
            });
        };
        
        // Initialize token expiry tracking if we have an access token
        if (this.accessToken) {
            // Assume token expires in 1 hour (default for Viessmann) minus buffer
            // This will trigger a refresh on first use if refresh token is available
            this.tokenExpiry = Date.now() + (3600 * 1000);
            updateAuthState('authenticated');
        }
        
        /**
         * Register a dependent node to receive auth state updates
         * @param {object} depNode - The dependent node to register
         */
        this.registerDependent = function(depNode) {
            if (!node.dependentNodes.includes(depNode)) {
                node.dependentNodes.push(depNode);
            }
        };
        
        /**
         * Unregister a dependent node
         * @param {object} depNode - The dependent node to unregister
         */
        this.unregisterDependent = function(depNode) {
            const index = node.dependentNodes.indexOf(depNode);
            if (index > -1) {
                node.dependentNodes.splice(index, 1);
            }
        };
        
        /**
         * Validate that we have an access token
         * @returns {Promise<void>}
         */
        this.authenticate = async function() {
            if (node.accessToken) {
                debugLog('Access token is already available');
                updateAuthState('authenticated');
                return;
            }
            
            const errorMsg = 'No access token configured. Please generate an access token using the PKCE flow and configure it in the node settings.';
            node.error(errorMsg);
            updateAuthState('error', errorMsg);
            throw new Error(errorMsg);
        };
        
        /**
         * Refresh the access token using refresh token
         * @returns {Promise<void>}
         */
        this.refreshAccessToken = async function() {
            if (!node.refreshToken) {
                debugLog('No refresh token available, cannot refresh');
                const errorMsg = 'Access token expired and no refresh token available. Please generate new tokens.';
                node.error(errorMsg);
                updateAuthState('error', errorMsg);
                throw new Error(errorMsg);
            }
            
            try {
                updateAuthState('authenticating');
                debugLog('Starting token refresh');
                debugLog('Current refresh token: ' + maskSensitiveData(node.refreshToken));
                debugLog('Client ID: ' + maskSensitiveData(node.credentials.clientId));
                
                const response = await axios.post(node.tokenUrl, new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: node.credentials.clientId,
                    refresh_token: node.refreshToken
                }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                
                // Update tokens in both node and credentials for persistence
                node.accessToken = response.data.access_token;
                node.credentials.accessToken = response.data.access_token;
                debugLog('Updated access token in credentials for persistence: ' + maskSensitiveData(response.data.access_token));
                if (response.data.refresh_token) {
                    node.refreshToken = response.data.refresh_token;
                    node.credentials.refreshToken = response.data.refresh_token;
                    debugLog('Updated refresh token in credentials for persistence: ' + maskSensitiveData(response.data.refresh_token));
                }
                node.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
                
                const expiryDate = new Date(node.tokenExpiry);
                debugLog('Token refresh successful');
                debugLog('New access token: ' + maskSensitiveData(node.accessToken));
                if (response.data.refresh_token) {
                    debugLog('New refresh token: ' + maskSensitiveData(node.refreshToken));
                }
                debugLog('Token expires in: ' + response.data.expires_in + ' seconds (' + expiryDate.toISOString() + ')');
                
                node.log('Successfully refreshed access token and updated credentials');
                updateAuthState('authenticated');
            } catch (error) {
                debugLog('Token refresh failed with error: ' + error.message);
                if (error.response) {
                    debugLog('Error status: ' + error.response.status);
                    debugLog('Error data: ' + JSON.stringify(error.response.data));
                }
                const errorMsg = error.response?.data?.error_description || error.message;
                const fullErrorMsg = 'Token refresh failed: ' + errorMsg + '. You may need to generate new tokens.';
                node.error(fullErrorMsg);
                updateAuthState('error', fullErrorMsg);
                throw error;
            }
        };
        
        /**
         * Get a valid access token, refreshing if necessary
         * @returns {Promise<string>} Valid access token
         */
        this.getValidToken = async function() {
            debugLog('Checking token validity');
            
            // If no token exists, authenticate
            if (!node.accessToken) {
                debugLog('No access token found, initiating authentication');
                await node.authenticate();
                return node.accessToken;
            }
            
            // Check if token is expired (with buffer)
            const now = Date.now();
            const timeUntilExpiry = node.tokenExpiry - now;
            debugLog('Current token status: ' + Math.max(0, timeUntilExpiry) + 'ms until expiry (buffer: ' + TOKEN_REFRESH_BUFFER_MS + 'ms)');
            
            if (node.tokenExpiry && now >= (node.tokenExpiry - TOKEN_REFRESH_BUFFER_MS)) {
                debugLog('Token is expired or near expiry, refreshing');
                if (node.refreshToken) {
                    debugLog('Using refresh token for renewal');
                    await node.refreshAccessToken();
                } else {
                    debugLog('No refresh token available, re-authenticating');
                    await node.authenticate();
                }
            } else {
                debugLog('Token is still valid, returning existing token');
            }
            
            return node.accessToken;
        };
    }
    
    RED.nodes.registerType("viessmann-config", ViessmannConfigNode, {
        credentials: {
            clientId: { type: "text" },
            accessToken: { type: "password" },
            refreshToken: { type: "password" }
        }
    });
};
