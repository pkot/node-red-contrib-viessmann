const { initializeViessmannNode, validateConfigNode, validateInstallationId, surfaceUnexpectedError, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannGatewayListNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            const installationId = validateInstallationId(node, msg);
            if (!validateConfigNode(node, msg) || !installationId) return;

            let response;
            try {
                response = await executeApiGet(
                    node,
                    msg,
                    `${node.apiBaseUrl}/iot/v2/equipment/installations/${encodeURIComponent(installationId)}/gateways`,
                    'fetching...',
                    'Failed to fetch gateways'
                );
            } catch (_apiError) {
                return;
            }

            try {
                msg.payload = response.data.data || [];
                node.send(msg);
            } catch (error) {
                surfaceUnexpectedError(node, msg, error);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-gateway-list", ViessmannGatewayListNode);
};
