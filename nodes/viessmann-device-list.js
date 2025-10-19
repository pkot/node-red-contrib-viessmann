const axios = require('axios');
const { initializeViessmannNode, validateConfigNode, extractErrorMessage, truncateForStatus } = require('./viessmann-helpers');

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
                node.status({fill: 'yellow', shape: 'ring', text: 'fetching...'});
                
                // Get valid access token
                const token = await node.config.getValidToken();
                
                // Fetch installations from Viessmann API
                const response = await axios.get(`${node.apiBaseUrl}/iot/v2/equipment/installations`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });
                
                // Set payload to the installations data
                msg.payload = response.data.data || [];
                
                node.status({fill: 'green', shape: 'dot', text: 'success'});
                node.send(msg);
            } catch (error) {
                const errorMsg = extractErrorMessage(error);
                const statusMsg = truncateForStatus(errorMsg);
                node.status({fill: 'red', shape: 'dot', text: statusMsg});
                node.error('Failed to fetch installations: ' + errorMsg, msg);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-device-list", ViessmannDeviceListNode);
};
