const axios = require('axios');

module.exports = function(RED) {
    function ViessmannDeviceListNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the config node
        this.config = RED.nodes.getNode(config.config);
        
        // Viessmann API base URL
        this.apiBaseUrl = 'https://api.viessmann-climatesolutions.com';
        
        node.on('input', async function(msg) {
            // Check if config node is available
            if (!node.config) {
                node.error('No configuration node found. Please configure the Viessmann config node.', msg);
                return;
            }
            
            try {
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
                
                node.send(msg);
            } catch (error) {
                node.error('Failed to fetch installations: ' + (error.response?.data?.error || error.message), msg);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-device-list", ViessmannDeviceListNode);
};
