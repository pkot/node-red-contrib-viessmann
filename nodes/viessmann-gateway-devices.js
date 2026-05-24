const { initializeViessmannNode, validateConfigNode, validateInstallationId, validateGatewaySerial, viessmannRefSource, surfaceUnexpectedError, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannGatewayDevicesNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            if (!validateConfigNode(node, msg)) return;
            // Accept the new msg.viessmann bundle or legacy individual fields.
            const source = viessmannRefSource(msg);
            const installationId = validateInstallationId(node, source);
            if (!installationId) return;
            const gatewaySerial = validateGatewaySerial(node, source);
            if (!gatewaySerial) return;

            let response;
            try {
                response = await executeApiGet(
                    node,
                    msg,
                    `${node.apiBaseUrl}/iot/v2/equipment/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices`,
                    'fetching...',
                    'Failed to fetch gateway devices'
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
    
    RED.nodes.registerType("viessmann-gateway-devices", ViessmannGatewayDevicesNode);
};
