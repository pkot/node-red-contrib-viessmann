const axios = require('axios');
const { setupDependentNode } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannDeviceListNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the config node
        this.config = RED.nodes.getNode(config.config);
        
        // Viessmann API base URL
        this.apiBaseUrl = 'https://api.viessmann-climatesolutions.com';
        
        // Setup dependent node status and registration
        setupDependentNode(node);
        
        node.on('input', async function(msg) {
            // Check if config node is available
            if (!node.config) {
                node.status({fill: 'red', shape: 'dot', text: 'no config'});
                node.error('No configuration node found. Please configure the Viessmann config node.', msg);
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
                const errorMsg = error.response?.data?.error || error.message;
                node.status({fill: 'red', shape: 'dot', text: errorMsg});
                node.error('Failed to fetch installations: ' + errorMsg, msg);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-device-list", ViessmannDeviceListNode);
};
