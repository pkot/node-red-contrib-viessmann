module.exports = function(RED) {
    function ViessmannDeviceListNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the config node
        this.config = RED.nodes.getNode(config.config);
        
        node.on('input', function(msg) {
            // TODO: Implement device discovery
            // TODO: Query Viessmann API for installations, gateways, devices, and features
            // TODO: Set msg.payload to array of discovered devices
            
            node.send(msg);
        });
    }
    
    RED.nodes.registerType("viessmann-device-list", ViessmannDeviceListNode);
};
