const { initializeViessmannNode, validateConfigNode, validateInstallationId, validateGatewaySerial, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannGatewayDevicesNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;
        
        node.on('input', async function(msg) {
            const installationId = validateInstallationId(node, msg);
            const gatewaySerial = validateGatewaySerial(node, msg);
            
            if (!validateConfigNode(node, msg) || !installationId || !gatewaySerial) {
                return;
            }
                        
            try {
                const response = await executeApiGet(
                    node,
                    msg,
                    `${node.apiBaseUrl}/iot/v2/equipment/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices`,
                    'fetching...',
                    'Failed to fetch gateway devices'
                );
                
                // Set payload to the devices data
                msg.payload = response.data.data || [];
                node.send(msg);
            } catch (_error) {
                // Error already handled by executeApiGet
            }
        });
    }
    
    RED.nodes.registerType("viessmann-gateway-devices", ViessmannGatewayDevicesNode);
};
