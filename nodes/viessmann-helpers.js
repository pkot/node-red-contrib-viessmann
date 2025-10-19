/**
 * Helper functions for Viessmann nodes
 */

/**
 * Viessmann API base URL constant
 */
const VIESSMANN_API_BASE_URL = 'https://api.viessmann-climatesolutions.com';

/**
 * Initialize a Viessmann node with common setup
 * @param {object} RED - The Node-RED runtime
 * @param {object} node - The Node-RED node instance (this)
 * @param {object} config - The node configuration
 */
function initializeViessmannNode(RED, node, config) {
    RED.nodes.createNode(node, config);
    
    // Get the config node
    node.config = RED.nodes.getNode(config.config);
    
    // Viessmann API base URL
    node.apiBaseUrl = VIESSMANN_API_BASE_URL;
    
    // Setup dependent node status and registration
    setupDependentNode(node);
}

/**
 * Validate that config node is available
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {boolean} True if config is valid, false otherwise
 */
function validateConfigNode(node, msg) {
    if (!node.config) {
        node.status({fill: 'red', shape: 'dot', text: 'no config'});
        node.error('No configuration node found. Please configure the Viessmann config node.', msg);
        return false;
    }
    return true;
}

/**
 * Create a status update function for dependent nodes
 * @param {object} node - The Node-RED node instance
 * @returns {function} Status update function
 */
function createStatusUpdater(node) {
    return function() {
        if (!node.config) {
            node.status({fill: 'red', shape: 'dot', text: 'no config'});
            return;
        }
        
        switch (node.config.authState) {
            case 'authenticated':
                node.status({fill: 'green', shape: 'dot', text: 'connected'});
                break;
            case 'authenticating':
                node.status({fill: 'yellow', shape: 'ring', text: 'authenticating...'});
                break;
            case 'error':
                const errorText = node.config.authError || 'auth failed';
                node.status({fill: 'red', shape: 'dot', text: errorText});
                break;
            case 'disconnected':
            default:
                node.status({fill: 'grey', shape: 'ring', text: 'disconnected'});
                break;
        }
    };
}

/**
 * Setup dependent node registration with config node
 * @param {object} node - The Node-RED node instance
 */
function setupDependentNode(node) {
    // Create and assign status update function
    node.updateStatus = createStatusUpdater(node);
    
    // Register with config node to receive auth state updates
    if (node.config) {
        node.config.registerDependent(node);
        node.updateStatus();
    } else {
        node.status({fill: 'red', shape: 'dot', text: 'no config'});
    }
    
    // Unregister when node is closed
    node.on('close', function() {
        if (node.config) {
            node.config.unregisterDependent(node);
        }
    });
}

/**
 * Extract error message from axios error
 * @param {Error} error - The error object
 * @returns {string} Extracted error message
 */
function extractErrorMessage(error) {
    return error.response?.data?.error || error.message;
}

/**
 * Truncate long text for status display
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length (default: 30)
 * @returns {string} Truncated text
 */
function truncateForStatus(text, maxLength = 30) {
    if (typeof text !== 'string') {
        text = String(text);
    }
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Validate installationId parameter
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {number|null} Validated installationId or null if invalid
 */
function validateInstallationId(node, msg) {
    if (msg.installationId === null || msg.installationId === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no installationId'});
        node.error('No installationId provided. Please provide msg.installationId.', msg);
        return null;
    }
    
    const installationId = Number(msg.installationId);
    if (!Number.isInteger(installationId) || installationId <= 0) {
        node.status({fill: 'red', shape: 'dot', text: 'invalid installationId'});
        node.error('Invalid installationId. Must be a positive integer.', msg);
        return null;
    }
    
    return installationId;
}

/**
 * Validate gatewaySerial parameter
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {string|null} Validated gatewaySerial or null if invalid
 */
function validateGatewaySerial(node, msg) {
    if (msg.gatewaySerial === null || msg.gatewaySerial === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no gatewaySerial'});
        node.error('No gatewaySerial provided. Please provide msg.gatewaySerial.', msg);
        return null;
    }
    
    if (typeof msg.gatewaySerial !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid gatewaySerial'});
        node.error('Invalid gatewaySerial. Must be a string.', msg);
        return null;
    }
    
    const gatewaySerial = msg.gatewaySerial.trim();
    if (gatewaySerial === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid gatewaySerial'});
        node.error('Invalid gatewaySerial. Must be a non-empty string.', msg);
        return null;
    }
    
    return gatewaySerial;
}

/**
 * Validate deviceId parameter
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @returns {string|null} Validated deviceId or null if invalid
 */
function validateDeviceId(node, msg) {
    if (msg.deviceId === null || msg.deviceId === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no deviceId'});
        node.error('No deviceId provided. Please provide msg.deviceId.', msg);
        return null;
    }
    
    if (typeof msg.deviceId !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid deviceId'});
        node.error('Invalid deviceId. Must be a string.', msg);
        return null;
    }
    
    const deviceId = msg.deviceId.trim();
    if (deviceId === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid deviceId'});
        node.error('Invalid deviceId. Must be a non-empty string.', msg);
        return null;
    }
    
    return deviceId;
}

/**
 * Execute an API GET request with standard error handling
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @param {string} url - The API endpoint URL
 * @param {string} statusText - Text to show during operation (default: 'fetching...')
 * @param {string} errorPrefix - Prefix for error messages (default: 'Failed to fetch data')
 * @returns {Promise<object>} Response data
 */
async function executeApiGet(node, msg, url, statusText = 'fetching...', errorPrefix = 'Failed to fetch data') {
    const axios = require('axios');
    
    try {
        node.status({fill: 'yellow', shape: 'ring', text: statusText});
        
        // Get valid access token
        const token = await node.config.getValidToken();
        
        node.debug(`Executing GET ${url}`);
        
        // Fetch data from Viessmann API
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        node.status({fill: 'green', shape: 'dot', text: 'success'});
        return response;
    } catch (error) {
        // Check if error is 401 Unauthorized (invalid token)
        if (error.response && error.response.status === 401) {
            node.debug('Received 401 error, attempting to refresh token and retry');
            
            try {
                // Attempt to refresh the token
                await node.config.refreshAccessToken();
                
                // Get the new token
                const newToken = await node.config.getValidToken();
                
                node.debug(`Retrying GET ${url} with refreshed token`);
                
                // Retry the request with the new token
                const response = await axios.get(url, {
                    headers: {
                        'Authorization': `Bearer ${newToken}`,
                        'Accept': 'application/json'
                    }
                });
                
                node.status({fill: 'green', shape: 'dot', text: 'success'});
                return response;
            } catch (refreshError) {
                // If refresh fails, throw the original error
                node.debug(`Token refresh failed: ${refreshError.message}`);
                const errorMsg = extractErrorMessage(error);
                const statusMsg = truncateForStatus(errorMsg);
                node.status({fill: 'red', shape: 'dot', text: statusMsg});
                node.error(`${errorPrefix}: ${errorMsg}`, msg);
                throw error;
            }
        }
        
        const errorMsg = extractErrorMessage(error);
        const statusMsg = truncateForStatus(errorMsg);
        node.status({fill: 'red', shape: 'dot', text: statusMsg});
        node.error(`${errorPrefix}: ${errorMsg}`, msg);
        throw error;
    }
}

/**
 * Execute an API POST request with standard error handling
 * @param {object} node - The Node-RED node instance
 * @param {object} msg - The incoming message
 * @param {string} url - The API endpoint URL
 * @param {object} data - The data to post
 * @param {string} statusText - Text to show during operation (default: 'writing...')
 * @param {string} errorPrefix - Prefix for error messages (default: 'Failed to write data')
 * @returns {Promise<object>} Response data
 */
async function executeApiPost(node, msg, url, data, statusText = 'writing...', errorPrefix = 'Failed to write data') {
    const axios = require('axios');
    
    try {
        node.status({fill: 'yellow', shape: 'ring', text: statusText});
        
        // Get valid access token
        const token = await node.config.getValidToken();
        
        node.debug(`Executing POST ${url} with data: ${JSON.stringify(data)}`);

        // Post data to Viessmann API
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        node.status({fill: 'green', shape: 'dot', text: 'success'});
        return response;
    } catch (error) {
        // Check if error is 401 Unauthorized (invalid token)
        if (error.response && error.response.status === 401) {
            node.debug('Received 401 error, attempting to refresh token and retry');
            
            try {
                // Attempt to refresh the token
                await node.config.refreshAccessToken();
                
                // Get the new token
                const newToken = await node.config.getValidToken();
                
                node.debug(`Retrying POST ${url} with refreshed token`);
                
                // Retry the request with the new token
                const response = await axios.post(url, data, {
                    headers: {
                        'Authorization': `Bearer ${newToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                
                node.status({fill: 'green', shape: 'dot', text: 'success'});
                return response;
            } catch (refreshError) {
                // If refresh fails, throw the original error
                node.debug(`Token refresh failed: ${refreshError.message}`);
                const errorMsg = extractErrorMessage(error);
                const statusMsg = truncateForStatus(errorMsg);
                node.status({fill: 'red', shape: 'dot', text: statusMsg});
                node.error(`${errorPrefix}: ${errorMsg}`, msg);
                throw error;
            }
        }
        
        const errorMsg = extractErrorMessage(error);
        const statusMsg = truncateForStatus(errorMsg);
        node.status({fill: 'red', shape: 'dot', text: statusMsg});
        node.error(`${errorPrefix}: ${errorMsg}`, msg);
        throw error;
    }
}

module.exports = {
    VIESSMANN_API_BASE_URL,
    initializeViessmannNode,
    validateConfigNode,
    createStatusUpdater,
    setupDependentNode,
    extractErrorMessage,
    truncateForStatus,
    validateInstallationId,
    validateGatewaySerial,
    validateDeviceId,
    executeApiGet,
    executeApiPost
};
