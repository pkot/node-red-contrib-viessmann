const { initializeViessmannNode, validateConfigNode, validateInstallationId, validateGatewaySerial, validateDeviceId, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannDeviceFeaturesNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;
        
        node.on('input', async function(msg) {
            // Check if config node is available
            if (!validateConfigNode(node, msg)) {
                return;
            }
            
            // Validate installationId
            const installationId = validateInstallationId(node, msg);
            if (installationId === null) {
                return;
            }
            
            // Validate gatewaySerial
            const gatewaySerial = validateGatewaySerial(node, msg);
            if (gatewaySerial === null) {
                return;
            }
            
            // Validate deviceId
            const deviceId = validateDeviceId(node, msg);
            if (deviceId === null) {
                return;
            }
            
            try {
                const response = await executeApiGet(
                    node,
                    msg,
                    `${node.apiBaseUrl}/iot/v2/equipment/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}/features`,
                    'fetching...',
                    'Failed to fetch device features'
                );
                
                // Set payload to the features data
                msg.payload = response.data.data || [];
                node.send(msg);
            } catch (error) {
                // Error already handled by executeApiGet
            }
        });
    }
    
    RED.nodes.registerType("viessmann-device-features", ViessmannDeviceFeaturesNode);
};
