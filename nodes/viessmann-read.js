const { initializeViessmannNode, validateConfigNode, validateInstallationId, validateGatewaySerial, validateDeviceId, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannReadNode(config) {
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
            
            try {
                let endpoint;
                if (feature) {
                    // Read specific feature
                    endpoint = `${node.apiBaseUrl}/iot/v2/features/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}/features/${feature}`;
                } else {
                    // Read all features
                    endpoint = `${node.apiBaseUrl}/iot/v2/features/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}/features`;
                }
                
                const response = await executeApiGet(
                    node,
                    msg,
                    endpoint,
                    'reading...',
                    'Failed to read data'
                );
                
                // Set payload to the data
                // For single feature reads, API returns { data: {...} }
                // For all features reads, API returns { data: [...] }
                msg.payload = response.data.data || response.data;
                node.send(msg);
            } catch (error) {
                // Error already handled by executeApiGet
            }
        });
    }
    
    RED.nodes.registerType("viessmann-read", ViessmannReadNode);
};
