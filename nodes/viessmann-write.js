module.exports = function(RED) {
    function ViessmannWriteNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Get the config node
        this.config = RED.nodes.getNode(config.config);
        
        /**
         * Update node status based on config auth state
         */
        this.updateStatus = function() {
            if (!node.config) {
                node.status({fill: 'red', shape: 'dot', text: 'no config'});
                return;
            }
            
            switch (node.config.authState) {
                case 'authenticated':
                    node.status({fill: 'green', shape: 'dot', text: 'connected'});
                    break;
                case 'authenticating':
                    node.status({fill: 'yellow', shape: 'ring', text: 'authenticating...'});
                    break;
                case 'error':
                    const errorText = node.config.authError || 'auth failed';
                    node.status({fill: 'red', shape: 'dot', text: errorText});
                    break;
                case 'disconnected':
                default:
                    node.status({fill: 'grey', shape: 'ring', text: 'disconnected'});
                    break;
            }
        };
        
        // Register with config node to receive auth state updates
        if (node.config) {
            node.config.registerDependent(node);
            node.updateStatus();
        } else {
            node.status({fill: 'red', shape: 'dot', text: 'no config'});
        }
        
        // Unregister when node is closed
        node.on('close', function() {
            if (node.config) {
                node.config.unregisterDependent(node);
            }
        });
        
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
