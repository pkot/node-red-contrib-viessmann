const { defineGetNode } = require('./lib/define-get-node');
const { validateConfigNode, validateViessmannRef } = require('./lib/validators');

module.exports = function(RED) {
    defineGetNode(RED, {
        type: 'viessmann-device-features',
        getContext: (node, msg) => {
            if (!validateConfigNode(node, msg)) return null;
            return validateViessmannRef(node, msg);
        },
        url: ({ installationId, gatewaySerial, deviceId }) =>
            `/iot/v2/features/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices/${encodeURIComponent(deviceId)}/features`,
        statusText: 'fetching...',
        errorPrefix: 'Failed to fetch device features'
    });
};
