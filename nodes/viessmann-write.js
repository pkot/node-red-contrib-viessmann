const { initializeViessmannNode, validateConfigNode, validateInstallationId, validateGatewaySerial, validateDeviceId, executeApiPost } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannWriteNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;
        
        node.on('input', async function(msg) {
            const installationId = validateInstallationId(node, msg);
            const gatewaySerial = validateGatewaySerial(node, msg);
            const deviceId = validateDeviceId(node, msg);
            
            if (!validateConfigNode(node, msg) || !installationId || !gatewaySerial || !deviceId) {
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
                const endpoint = `${node.apiBaseUrl}/iot/v2/equipment/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}/features/${feature}/commands/${msg.command}`;
                
                await executeApiPost(
                    node,
                    msg,
                    endpoint,
                    msg.params,
                    'writing...',
                    'Failed to write data'
                );
                
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
                
                node.send(msg);
            } catch (error) {
                // Error already handled by executeApiPost
            }
        });
    }
    
    RED.nodes.registerType("viessmann-write", ViessmannWriteNode);
};
