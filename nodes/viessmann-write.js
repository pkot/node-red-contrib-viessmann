module.exports = function(RED) {
    function ViessmannWriteNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the config node
        this.config = RED.nodes.getNode(config.config);
        
        node.on('input', function(msg) {
            // TODO: Validate required inputs (msg.deviceId, msg.feature/msg.datapoint, msg.value)
            // TODO: Write data to Viessmann API
            // TODO: Set msg.payload to API response or success/failure status
            
            node.send(msg);
        });
    }
    
    RED.nodes.registerType("viessmann-write", ViessmannWriteNode);
};
