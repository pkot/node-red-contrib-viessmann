const axios = require('axios');
const { setupDependentNode, extractErrorMessage, truncateForStatus } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannReadNode(config) {
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
            
            // Validate gatewaySerial is a string
            if (typeof msg.gatewaySerial !== 'string') {
                node.status({fill: 'red', shape: 'dot', text: 'invalid gatewaySerial'});
                node.error('Invalid gatewaySerial. Must be a string.', msg);
                return;
            }
            
            // Validate gatewaySerial is not empty after trimming
            const gatewaySerial = msg.gatewaySerial.trim();
            if (gatewaySerial === '') {
                node.status({fill: 'red', shape: 'dot', text: 'invalid gatewaySerial'});
                node.error('Invalid gatewaySerial. Must be a non-empty string.', msg);
                return;
            }
            
            // Check if deviceId is provided
            if (msg.deviceId === null || msg.deviceId === undefined) {
                node.status({fill: 'red', shape: 'dot', text: 'no deviceId'});
                node.error('No deviceId provided. Please provide msg.deviceId.', msg);
                return;
            }
            
            // Validate deviceId is a string
            if (typeof msg.deviceId !== 'string') {
                node.status({fill: 'red', shape: 'dot', text: 'invalid deviceId'});
                node.error('Invalid deviceId. Must be a string.', msg);
                return;
            }
            
            // Validate deviceId is not empty after trimming
            const deviceId = msg.deviceId.trim();
            if (deviceId === '') {
                node.status({fill: 'red', shape: 'dot', text: 'invalid deviceId'});
                node.error('Invalid deviceId. Must be a non-empty string.', msg);
                return;
            }
            
            // Check for feature or datapoint (both are treated the same way)
            const feature = msg.feature || msg.datapoint;
            
            try {
                node.status({fill: 'yellow', shape: 'ring', text: 'reading...'});
                
                // Get valid access token
                const token = await node.config.getValidToken();
                
                let endpoint;
                if (feature) {
                    // Read specific feature
                    endpoint = `${node.apiBaseUrl}/iot/v2/equipment/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}/features/${feature}`;
                } else {
                    // Read all features
                    endpoint = `${node.apiBaseUrl}/iot/v2/equipment/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}/features`;
                }
                
                // Fetch data from Viessmann API
                const response = await axios.get(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });
                
                // Set payload to the data
                msg.payload = response.data.data || response.data;
                
                node.status({fill: 'green', shape: 'dot', text: 'success'});
                node.send(msg);
            } catch (error) {
                const errorMsg = extractErrorMessage(error);
                const statusMsg = truncateForStatus(errorMsg);
                node.status({fill: 'red', shape: 'dot', text: statusMsg});
                node.error('Failed to read data: ' + errorMsg, msg);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-read", ViessmannReadNode);
};
