const axios = require('axios');
const {
    ViessmannClient,
    HTTP_TIMEOUT_MS,
    VIESSMANN_IAM_BASE_URL,
    VIESSMANN_TOKEN_PATH
} = require('./lib/client');

// Refresh slightly before actual expiry to avoid races where a request
// in flight crosses the boundary and gets a 401.
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

module.exports = function(RED) {
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

        this.enableDebug = config.enableDebug || false;

        // Opt-in client-side schema check before write (#77). Off by default
        // to preserve the opaque pass-through behavior.
        this.validateBeforeWrite = config.validateBeforeWrite === true || config.validateBeforeWrite === 'true';

        this.tokenUrl = VIESSMANN_IAM_BASE_URL + VIESSMANN_TOKEN_PATH;
        this.accessToken = node.credentials.accessToken || null;
        this.refreshToken = node.credentials.refreshToken || null;
        this.tokenExpiry = null;

        // 'disconnected' | 'authenticating' | 'authenticated' | 'error'.
        // Mutated only inside updateAuthState, which emits 'auth-state'.
        this.authState = 'disconnected';
        this.authError = null;

        // Numeric coercion guards against string values arriving from the
        // HTML editor; out-of-range values fall back to client defaults.
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

        // Exposed as `node.debugLog` so consumer nodes (via node-runtime)
        // route their debug output through the same "Enable Debug Logging"
        // checkbox.
        const debugLog = function(message) {
            if (node.enableDebug) {
                node.log('[DEBUG] ' + message);
            }
        };
        this.debugLog = debugLog;

        const updateAuthState = function(state, error) {
            node.authState = state;
            node.authError = error || null;
            node.emit('auth-state', { state, error: node.authError });
        };

        // Prefer this over reading node.authState / node.authError directly.
        this.getAuthSnapshot = function() {
            return { state: node.authState, error: node.authError };
        };

        // Optimistic 1-hour expiry on load. The token's real age is unknown
        // (could be 59 minutes old). When this estimate proves wrong, the
        // 401-refresh path in executeApiGet/Post corrects it - see #83 for
        // a deferred fix that would persist real expiry.
        if (this.accessToken) {
            this.tokenExpiry = Date.now() + (3600 * 1000);
            updateAuthState('authenticated');
        }

        this.authenticate = async function() {
            if (node.accessToken) {
                debugLog('Access token is already available');
                updateAuthState('authenticated');
                return;
            }

            // node.warn (not node.error): the request-level helper calls
            // node.error(message, originatingMsg) so a downstream Catch
            // node routes correctly. Surfacing here too would double-fire.
            const errorMsg = 'No access token configured. Please generate an access token using the PKCE flow and configure it in the node settings.';
            node.warn(errorMsg);
            updateAuthState('error', errorMsg);
            throw new Error(errorMsg);
        };

        // De-dup concurrent refresh calls. Without this, N callers each
        // POST /idp/v3/token with the same refresh_token; the IdP rotates
        // the token on the first response and rejects the rest as
        // invalid_grant.
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
                    // node.warn instead of node.error - the request-level
                    // helper does node.error(msg, originatingMsg) for
                    // Catch-node routing; double-firing here would log twice.
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

                    // Write to both .accessToken and .credentials.accessToken
                    // because only the credentials version survives a Node-RED
                    // restart.
                    node.accessToken = response.data.access_token;
                    node.credentials.accessToken = response.data.access_token;
                    debugLog('Updated access token: ' + maskSensitiveData(response.data.access_token));
                    if (response.data.refresh_token) {
                        node.refreshToken = response.data.refresh_token;
                        node.credentials.refreshToken = response.data.refresh_token;
                        debugLog('Updated refresh token: ' + maskSensitiveData(response.data.refresh_token));
                    }
                    // Defend against missing expires_in: NaN comparisons are
                    // always false, so an unhandled NaN would disable all
                    // future expiry-based refreshes.
                    const expiresInSeconds = Number(response.data.expires_in);
                    const validExpiresIn = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0;
                    if (!validExpiresIn) {
                        node.warn('Token refresh response did not include a valid expires_in; assuming 1 hour.');
                    }
                    const effectiveExpiresIn = validExpiresIn ? expiresInSeconds : 3600;
                    node.tokenExpiry = Date.now() + (effectiveExpiresIn * 1000);

                    const expiryDate = new Date(node.tokenExpiry);
                    debugLog('Token refresh successful');
                    debugLog('New access token: ' + maskSensitiveData(node.accessToken));
                    if (response.data.refresh_token) {
                        debugLog('New refresh token: ' + maskSensitiveData(node.refreshToken));
                    }
                    debugLog('Token expires in: ' + effectiveExpiresIn + ' seconds (' + expiryDate.toISOString() + ')');

                    node.log('Successfully refreshed access token and updated credentials');
                    updateAuthState('authenticated');
                } catch (error) {
                    debugLog('Token refresh failed with error: ' + error.message);
                    if (error.response) {
                        debugLog('Error status: ' + error.response.status);
                        // Allowlist OAuth error fields + scrub credentials
                        // from error_description: some IdPs echo submitted
                        // parameters back, and Node-RED logs often land in
                        // journalctl / log aggregators.
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
                    // See "node.warn instead of node.error" rationale above.
                    node.warn(fullErrorMsg);
                    updateAuthState('error', fullErrorMsg);
                    throw error;
                }
            })().finally(() => {
                node._refreshPromise = null;
            });

            return node._refreshPromise;
        };

        this.getValidToken = async function() {
            debugLog('Checking token validity');

            if (!node.accessToken) {
                debugLog('No access token found, initiating authentication');
                await node.authenticate();
                return node.accessToken;
            }

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
