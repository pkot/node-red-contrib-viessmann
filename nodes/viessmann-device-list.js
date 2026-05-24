const { defineGetNode } = require('./lib/define-get-node');
const { validateConfigNode } = require('./lib/validators');

module.exports = function(RED) {
    defineGetNode(RED, {
        type: 'viessmann-device-list',
        getContext: (node, msg) => (validateConfigNode(node, msg) ? {} : null),
        url: () => '/iot/v2/equipment/installations',
        statusText: 'fetching...',
        errorPrefix: 'Failed to fetch installations'
    });
};
