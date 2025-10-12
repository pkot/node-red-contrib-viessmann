const axios = require('axios');
const { setupDependentNode, extractErrorMessage, truncateForStatus } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannGatewayDevicesNode(config) {
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
            if (msg.installationId === null || msg.installationId === undefined) {
                node.status({fill: 'red', shape: 'dot', text: 'no installationId'});
                node.error('No installationId provided. Please provide msg.installationId.', msg);
                return;
            }
            
            // Validate installationId is a valid positive number
            const installationId = Number(msg.installationId);
            if (!Number.isInteger(installationId) || installationId <= 0) {
                node.status({fill: 'red', shape: 'dot', text: 'invalid installationId'});
                node.error('Invalid installationId. Must be a positive integer.', msg);
                return;
            }
            
            // Check if gatewaySerial is provided
            if (msg.gatewaySerial === null || msg.gatewaySerial === undefined) {
                node.status({fill: 'red', shape: 'dot', text: 'no gatewaySerial'});
                node.error('No gatewaySerial provided. Please provide msg.gatewaySerial.', msg);
                return;
            }
            
            // Validate gatewaySerial is a non-empty string
            const gatewaySerial = String(msg.gatewaySerial).trim();
            if (gatewaySerial === '') {
                node.status({fill: 'red', shape: 'dot', text: 'invalid gatewaySerial'});
                node.error('Invalid gatewaySerial. Must be a non-empty string.', msg);
                return;
            }
            
            try {
                node.status({fill: 'yellow', shape: 'ring', text: 'fetching...'});
                
                // Get valid access token
                const token = await node.config.getValidToken();
                
                // Fetch devices from Viessmann API
                const response = await axios.get(`${node.apiBaseUrl}/iot/v2/equipment/installations/${installationId}/gateways/${gatewaySerial}/devices`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });
                
                // Set payload to the devices data
                msg.payload = response.data.data || [];
                
                node.status({fill: 'green', shape: 'dot', text: 'success'});
                node.send(msg);
            } catch (error) {
                const errorMsg = extractErrorMessage(error);
                const statusMsg = truncateForStatus(errorMsg);
                node.status({fill: 'red', shape: 'dot', text: statusMsg});
                node.error('Failed to fetch gateway devices: ' + errorMsg, msg);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-gateway-devices", ViessmannGatewayDevicesNode);
};
