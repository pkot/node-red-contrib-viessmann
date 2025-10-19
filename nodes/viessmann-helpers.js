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

module.exports = {
    VIESSMANN_API_BASE_URL,
    initializeViessmannNode,
    validateConfigNode,
    createStatusUpdater,
    setupDependentNode,
    extractErrorMessage,
    truncateForStatus
};
