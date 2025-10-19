const { initializeViessmannNode, validateConfigNode, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannDeviceListNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;
        
        node.on('input', async function(msg) {
            // Check if config node is available
            if (!validateConfigNode(node, msg)) {
                return;
            }
            
            try {
                const response = await executeApiGet(
                    node,
                    msg,
                    `${node.apiBaseUrl}/iot/v2/equipment/installations`,
                    'fetching...',
                    'Failed to fetch installations'
                );
                
                // Set payload to the installations data
                msg.payload = response.data.data || [];
                node.send(msg);
            } catch (error) {
                // Error already handled by executeApiGet
            }
        });
    }
    
    RED.nodes.registerType("viessmann-device-list", ViessmannDeviceListNode);
};
