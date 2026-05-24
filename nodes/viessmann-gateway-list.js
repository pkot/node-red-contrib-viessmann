const { defineGetNode } = require('./lib/define-get-node');
const { validateConfigNode, validateInstallationId } = require('./lib/validators');

module.exports = function(RED) {
    defineGetNode(RED, {
        type: 'viessmann-gateway-list',
        getContext: (node, msg) => {
            if (!validateConfigNode(node, msg)) return null;
            const installationId = validateInstallationId(node, msg);
            if (!installationId) return null;
            return { installationId };
        },
        url: ({ installationId }) =>
            `/iot/v2/equipment/installations/${encodeURIComponent(installationId)}/gateways`,
        statusText: 'fetching...',
        errorPrefix: 'Failed to fetch gateways'
    });
};
