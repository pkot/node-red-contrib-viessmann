const { setupDependentNode } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannWriteNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the config node
        this.config = RED.nodes.getNode(config.config);
        
        // Setup dependent node status and registration
        setupDependentNode(node);
        
        node.on('input', function(msg) {
            // Check if config node is available
            if (!node.config) {
                node.status({fill: 'red', shape: 'dot', text: 'no config'});
                node.error('No configuration node found. Please configure the Viessmann config node.', msg);
                return;
            }
            
            // TODO: Validate required inputs (msg.deviceId, msg.feature/msg.datapoint, msg.value)
            // TODO: Write data to Viessmann API
            // TODO: Set msg.payload to API response or success/failure status
            
            node.send(msg);
        });
    }
    
    RED.nodes.registerType("viessmann-write", ViessmannWriteNode);
};
