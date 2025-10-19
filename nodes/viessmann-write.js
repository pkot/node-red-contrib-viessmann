const axios = require('axios');
const { initializeViessmannNode, validateConfigNode, extractErrorMessage, truncateForStatus } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannWriteNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;
        
        node.on('input', async function(msg) {
            // Check if config node is available
            if (!validateConfigNode(node, msg)) {
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
            if (!feature) {
                node.status({fill: 'red', shape: 'dot', text: 'no feature'});
                node.error('No feature/datapoint provided. Please provide msg.feature or msg.datapoint.', msg);
                return;
            }
            
            // Check if command is provided
            if (!msg.command) {
                node.status({fill: 'red', shape: 'dot', text: 'no command'});
                node.error('No command provided. Please provide msg.command.', msg);
                return;
            }
            
            // Check if params is provided
            if (!msg.params) {
                node.status({fill: 'red', shape: 'dot', text: 'no params'});
                node.error('No params provided. Please provide msg.params.', msg);
                return;
            }
            
            try {
                node.status({fill: 'yellow', shape: 'ring', text: 'writing...'});
                
                // Get valid access token
                const token = await node.config.getValidToken();
                
                // Execute command on the feature
                const endpoint = `${node.apiBaseUrl}/iot/v2/equipment/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}/features/${feature}/commands/${msg.command}`;
                
                await axios.post(endpoint, msg.params, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                
                // Set payload to success status
                msg.payload = {
                    success: true,
                    installationId: installationId,
                    gatewaySerial: gatewaySerial,
                    deviceId: deviceId,
                    feature: feature,
                    command: msg.command,
                    params: msg.params
                };
                
                node.status({fill: 'green', shape: 'dot', text: 'success'});
                node.send(msg);
            } catch (error) {
                const errorMsg = extractErrorMessage(error);
                const statusMsg = truncateForStatus(errorMsg);
                node.status({fill: 'red', shape: 'dot', text: statusMsg});
                node.error('Failed to write data: ' + errorMsg, msg);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-write", ViessmannWriteNode);
};
