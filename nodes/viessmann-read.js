module.exports = function(RED) {
    function ViessmannReadNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the config node
        this.config = RED.nodes.getNode(config.config);
        
        node.on('input', function(msg) {
            // TODO: Validate required inputs (msg.deviceId)
            // TODO: Read data from Viessmann API
            // TODO: Handle optional msg.feature or msg.datapoint
            // TODO: Set msg.payload to the value(s) read from the device
            
            node.send(msg);
        });
    }
    
    RED.nodes.registerType("viessmann-read", ViessmannReadNode);
};
