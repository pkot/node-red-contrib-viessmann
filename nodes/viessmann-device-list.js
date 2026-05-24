const { initializeViessmannNode, validateConfigNode, surfaceUnexpectedError, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannDeviceListNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            if (!validateConfigNode(node, msg)) return;

            let response;
            try {
                response = await executeApiGet(
                    node,
                    msg,
                    `${node.apiBaseUrl}/iot/v2/equipment/installations`,
                    'fetching...',
                    'Failed to fetch installations'
                );
            } catch (_apiError) {
                // executeApiGet already surfaced this via node.error.
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
    
    RED.nodes.registerType("viessmann-device-list", ViessmannDeviceListNode);
};
