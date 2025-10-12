const axios = require('axios');
const { setupDependentNode, extractErrorMessage, truncateForStatus } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannGatewayListNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the config node
        this.config = RED.nodes.getNode(config.config);
        
        // Viessmann API base URL
        this.apiBaseUrl = 'https://api.viessmann-climatesolutions.com';
        
        // Setup dependent node status and registration
        setupDependentNode(node);
        
        node.on('input', async function(msg) {
            // Check if config node is available
            if (!node.config) {
                node.status({fill: 'red', shape: 'dot', text: 'no config'});
                node.error('No configuration node found. Please configure the Viessmann config node.', msg);
                return;
            }
            
            // Check if installationId is provided
            if (!msg.installationId) {
                node.status({fill: 'red', shape: 'dot', text: 'no installationId'});
                node.error('No installationId provided. Please provide msg.installationId.', msg);
                return;
            }
            
            // Validate installationId is a number
            const installationId = parseInt(msg.installationId, 10);
            if (isNaN(installationId) || installationId <= 0) {
                node.status({fill: 'red', shape: 'dot', text: 'invalid installationId'});
                node.error('Invalid installationId. Must be a positive number.', msg);
                return;
            }
            
            try {
                node.status({fill: 'yellow', shape: 'ring', text: 'fetching...'});
                
                // Get valid access token
                const token = await node.config.getValidToken();
                
                // Fetch gateways from Viessmann API
                const response = await axios.get(`${node.apiBaseUrl}/iot/v2/equipment/installations/${installationId}/gateways`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });
                
                // Set payload to the gateways data
                msg.payload = response.data.data || [];
                
                node.status({fill: 'green', shape: 'dot', text: 'success'});
                node.send(msg);
            } catch (error) {
                const errorMsg = extractErrorMessage(error);
                const statusMsg = truncateForStatus(errorMsg);
                node.status({fill: 'red', shape: 'dot', text: statusMsg});
                node.error('Failed to fetch gateways: ' + errorMsg, msg);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-gateway-list", ViessmannGatewayListNode);
};
