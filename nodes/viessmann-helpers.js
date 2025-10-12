/**
 * Helper functions for Viessmann nodes
 */

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
    createStatusUpdater,
    setupDependentNode,
    extractErrorMessage,
    truncateForStatus
};
