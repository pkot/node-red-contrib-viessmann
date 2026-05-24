const { defineGetNode } = require('./lib/define-get-node');
const {
    validateConfigNode,
    validateInstallationId,
    validateGatewaySerial,
    viessmannRefSource
} = require('./lib/validators');

module.exports = function(RED) {
    defineGetNode(RED, {
        type: 'viessmann-gateway-devices',
        getContext: (node, msg) => {
            if (!validateConfigNode(node, msg)) return null;
            // Accept the msg.viessmann bundle or legacy individual fields.
            const source = viessmannRefSource(msg);
            const installationId = validateInstallationId(node, source);
            if (!installationId) return null;
            const gatewaySerial = validateGatewaySerial(node, source);
            if (!gatewaySerial) return null;
            return { installationId, gatewaySerial };
        },
        url: ({ installationId, gatewaySerial }) =>
            `/iot/v2/equipment/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices`,
        statusText: 'fetching...',
        errorPrefix: 'Failed to fetch gateway devices'
    });
};
