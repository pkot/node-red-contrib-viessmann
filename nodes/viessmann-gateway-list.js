const { initializeViessmannNode, validateConfigNode, validateInstallationId, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannGatewayListNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;
        
        node.on('input', async function(msg) {
            const installationId = validateInstallationId(node, msg);
            
            if (!validateConfigNode(node, msg) || !installationId) {
                return;
            }
                        
            try {
                const response = await executeApiGet(
                    node,
                    msg,
                    `${node.apiBaseUrl}/iot/v2/equipment/installations/${installationId}/gateways`,
                    'fetching...',
                    'Failed to fetch gateways'
                );
                
                // Set payload to the gateways data
                msg.payload = response.data.data || [];
                node.send(msg);
            } catch (error) {
                // Error already handled by executeApiGet
            }
        });
    }
    
    RED.nodes.registerType("viessmann-gateway-list", ViessmannGatewayListNode);
};
