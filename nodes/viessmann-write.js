const {
    initializeViessmannNode,
    validateConfigNode,
    validateViessmannRef,
    validateFeature,
    validateCommand,
    validateParams,
    surfaceUnexpectedError,
    executeApiPost
} = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannWriteNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            if (!validateConfigNode(node, msg)) return;
            const ref = validateViessmannRef(node, msg);
            if (!ref) return;
            const { installationId, gatewaySerial, deviceId } = ref;

            const feature = validateFeature(node, msg);
            if (!feature) return;
            const command = validateCommand(node, msg);
            if (!command) return;
            const params = validateParams(node, msg);
            if (!params) return;

            const endpoint = `${node.apiBaseUrl}/iot/v2/features/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices/${encodeURIComponent(deviceId)}/features/${encodeURIComponent(feature)}/commands/${encodeURIComponent(command)}`;

            try {
                await executeApiPost(node, msg, endpoint, params, 'writing...', 'Failed to write data');
            } catch (_apiError) {
                return;
            }

            try {
                msg.payload = {
                    success: true,
                    installationId,
                    gatewaySerial,
                    deviceId,
                    feature,
                    command,
                    params
                };
                node.send(msg);
            } catch (error) {
                surfaceUnexpectedError(node, msg, error);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-write", ViessmannWriteNode);
};
