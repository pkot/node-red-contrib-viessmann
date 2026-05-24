const { initializeViessmannNode, validateConfigNode, validateViessmannRef, surfaceUnexpectedError, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannDeviceFeaturesNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            if (!validateConfigNode(node, msg)) return;
            const ref = validateViessmannRef(node, msg);
            if (!ref) return;
            const { installationId, gatewaySerial, deviceId } = ref;

            let response;
            try {
                response = await executeApiGet(
                    node,
                    msg,
                    `${node.apiBaseUrl}/iot/v2/features/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices/${encodeURIComponent(deviceId)}/features`,
                    'fetching...',
                    'Failed to fetch device features'
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
    
    RED.nodes.registerType("viessmann-device-features", ViessmannDeviceFeaturesNode);
};
