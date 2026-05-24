const { initializeViessmannNode, validateConfigNode, validateViessmannRef, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannDeviceFeaturesNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            if (!validateConfigNode(node, msg)) return;
            const ref = validateViessmannRef(node, msg);
            if (!ref) return;
            const { installationId, gatewaySerial, deviceId } = ref;
                        
            try {
                const response = await executeApiGet(
                    node,
                    msg,
                    `${node.apiBaseUrl}/iot/v2/features/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices/${encodeURIComponent(deviceId)}/features`,
                    'fetching...',
                    'Failed to fetch device features'
                );
                
                // Set payload to the features data
                msg.payload = response.data.data || [];
                node.send(msg);
            } catch (_error) {
                // Error already handled by executeApiGet
            }
        });
    }
    
    RED.nodes.registerType("viessmann-device-features", ViessmannDeviceFeaturesNode);
};
