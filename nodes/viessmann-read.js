const { initializeViessmannNode, validateConfigNode, validateViessmannRef, surfaceUnexpectedError, executeApiGet } = require('./viessmann-helpers');
const { formatFeatureStatus } = require('./lib/format');

module.exports = function(RED) {
    function ViessmannReadNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            if (!validateConfigNode(node, msg)) return;
            const ref = validateViessmannRef(node, msg);
            if (!ref) return;
            const { installationId, gatewaySerial, deviceId } = ref;

            const feature = msg.feature || msg.datapoint;
            const endpoint = feature
                ? `${node.apiBaseUrl}/iot/v2/features/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices/${encodeURIComponent(deviceId)}/features/${encodeURIComponent(feature)}`
                : `${node.apiBaseUrl}/iot/v2/features/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices/${encodeURIComponent(deviceId)}/features`;

            let response;
            try {
                response = await executeApiGet(node, msg, endpoint, 'reading...', 'Failed to read data');
            } catch (_apiError) {
                return;
            }

            try {
                // For single feature reads, API returns { data: {...} }
                // For all features reads, API returns { data: [...] }
                // If the response shape is unexpected (missing data.data),
                // surface a node.warn so users notice rather than silently
                // handing the caller the whole envelope.
                if (response.data && response.data.data !== undefined && response.data.data !== null) {
                    msg.payload = response.data.data;
                } else {
                    node.warn('Unexpected response shape: response.data.data missing, returning envelope');
                    msg.payload = response.data;
                }

                // For single-feature reads, derive a compact status string
                // from feature.properties via the pure formatFeatureStatus
                // helper. For all-features reads (no `feature` requested)
                // there's nothing to summarize - just show 'success'.
                const statusText = feature ? formatFeatureStatus(msg.payload && msg.payload.properties) : null;
                node.status({fill: 'green', shape: 'dot', text: statusText || 'success'});

                node.send(msg);
            } catch (error) {
                surfaceUnexpectedError(node, msg, error);
            }
        });
    }

    RED.nodes.registerType("viessmann-read", ViessmannReadNode);
};
