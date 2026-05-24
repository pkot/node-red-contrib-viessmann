const axios = require('axios');
const {
    ViessmannClient,
    HTTP_TIMEOUT_MS,
    VIESSMANN_IAM_BASE_URL,
    VIESSMANN_TOKEN_PATH
} = require('./lib/client');

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

        // When true, viessmann-write performs a client-side schema check
        // against the feature's declared `commands` before posting (#77).
        // Off by default to preserve the existing opaque pass-through;
        // users opt-in for stricter validation.
        this.validateBeforeWrite = config.validateBeforeWrite === true || config.validateBeforeWrite === 'true';
        
        // OAuth2 endpoints
        this.tokenUrl = VIESSMANN_IAM_BASE_URL + VIESSMANN_TOKEN_PATH;
        
        // Token storage - initialize from credentials if provided
        this.accessToken = node.credentials.accessToken || null;
        this.refreshToken = node.credentials.refreshToken || null;
        this.tokenExpiry = null;
        
        // Authentication state. Read-only from outside; mutated only inside
        // updateAuthState (which also emits the 'auth-state' event below).
        this.authState = 'disconnected'; // 'disconnected', 'authenticating', 'authenticated', 'error'
        this.authError = null;

        // Dependent nodes observe state changes via this.on('auth-state', cb)
        // instead of the previous registerDependent / dependentNodes array.
        // EventEmitter is inherited from the Node-RED node base.

        // Shared HTTP client. Owns the axios instance, retry policy, 401
        // refresh-and-retry, response cache, in-flight de-duplication, and
        // concurrency throttle. Per-node wrappers (viessmann-helpers.js)
        // layer status icon and node.error on top.
        //
        // cacheTTL and maxConcurrent fall back to client defaults when the
        // editor config doesn't set them. Numeric coercion guards against
        // string values arriving from the HTML editor.
        const clientOptions = {
            log: (m) => debugLog(m)
        };
        if (config.cacheTTL !== undefined && config.cacheTTL !== '') {
            const ttl = Number(config.cacheTTL);
            if (Number.isFinite(ttl) && ttl >= 0) clientOptions.cacheTTL = ttl;
        }
        if (config.maxConcurrent !== undefined && config.maxConcurrent !== '') {
            const mc = Number(config.maxConcurrent);
            if (Number.isFinite(mc) && mc >= 1) clientOptions.maxConcurrent = mc;
        }
        this.client = new ViessmannClient(node, clientOptions);
        
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
         * Update authentication state and notify subscribers via the
         * 'auth-state' event.
         * @param {string} state - New authentication state
         * @param {string} error - Optional error message
         */
        const updateAuthState = function(state, error) {
            node.authState = state;
            node.authError = error || null;
            node.emit('auth-state', { state, error: node.authError });
        };

        /**
         * Read-only snapshot of the current auth state. Prefer this over
         * directly accessing node.authState / node.authError.
         */
        this.getAuthSnapshot = function() {
            return { state: node.authState, error: node.authError };
        };
        
        // Initialize token expiry tracking if we have an access token
        if (this.accessToken) {
            // Assume token expires in 1 hour (default for Viessmann) minus buffer
            // This will trigger a refresh on first use if refresh token is available
            this.tokenExpiry = Date.now() + (3600 * 1000);
            updateAuthState('authenticated');
        }
        
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

            // Do not call node.error here. The caller (executeApiGet/Post)
            // calls node.error(message, msg) using Node-RED's
            // node.error(error, msg) signature, which is what routes the
            // failure to a Catch node attached to the user's flow.
            // node.warn keeps the failure visible in the editor sidebar
            // without double-firing.
            const errorMsg = 'No access token configured. Please generate an access token using the PKCE flow and configure it in the node settings.';
            node.warn(errorMsg);
            updateAuthState('error', errorMsg);
            throw new Error(errorMsg);
        };
        
        // In-flight refresh promise. While set, concurrent callers share it
        // so we never POST /idp/v3/token twice with the same (rotating) refresh
        // token - the IdP would reject the losers and we'd race-overwrite
        // node.refreshToken with a stale value.
        node._refreshPromise = null;

        /**
         * Refresh the access token using refresh token.
         * De-duplicates concurrent calls: if a refresh is already in flight,
         * all callers await the same promise.
         * @returns {Promise<void>}
         */
        this.refreshAccessToken = function() {
            if (node._refreshPromise) {
                debugLog('Refresh already in flight, awaiting existing request');
                return node._refreshPromise;
            }

            node._refreshPromise = (async function doRefresh() {
                if (!node.refreshToken) {
                    debugLog('No refresh token available, cannot refresh');
                    const errorMsg = 'Access token expired and no refresh token available. Please generate new tokens.';
                    // node.warn (not node.error): the request-level helper will
                    // call node.error(message, originatingMsg) - Node-RED's
                    // signature is node.error(error, msg) - so the user's
                    // Catch node routes to the correct flow.
                    node.warn(errorMsg);
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
                        },
                        timeout: HTTP_TIMEOUT_MS
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
                        // Only log a small allowlist of OAuth error fields.
                        // Avoid JSON.stringify(error.response.data) because
                        // some IdPs echo submitted parameters back in the
                        // error body, and Node-RED logs often land in
                        // journalctl / syslog / log aggregators.
                        //
                        // Even within the allowlist, error_description can
                        // contain reflected values - defensively redact the
                        // current refresh token and client id from it.
                        const data = error.response.data || {};
                        const safe = {};
                        if (data.error !== undefined) safe.error = data.error;
                        if (data.error_uri !== undefined) safe.error_uri = data.error_uri;
                        if (data.error_description !== undefined) {
                            let desc = String(data.error_description);
                            if (node.refreshToken) {
                                desc = desc.split(node.refreshToken).join(maskSensitiveData(node.refreshToken));
                            }
                            if (node.credentials.clientId) {
                                desc = desc.split(node.credentials.clientId).join(maskSensitiveData(node.credentials.clientId));
                            }
                            safe.error_description = desc;
                        }
                        debugLog('Error fields: ' + JSON.stringify(safe));
                    }
                    const errorMsg = error.response?.data?.error_description || error.message;
                    const fullErrorMsg = 'Token refresh failed: ' + errorMsg + '. You may need to generate new tokens.';
                    // node.warn (not node.error): the request-level helper will
                    // call node.error(message, originatingMsg) - Node-RED's
                    // signature is node.error(error, msg) - so the user's
                    // Catch node routes to the correct flow.
                    node.warn(fullErrorMsg);
                    updateAuthState('error', fullErrorMsg);
                    throw error;
                }
            })().finally(() => {
                node._refreshPromise = null;
            });

            return node._refreshPromise;
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
