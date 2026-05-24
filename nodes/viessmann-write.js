const { initializeViessmannNode, validateConfigNode, validateViessmannRef, executeApiPost } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannWriteNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            if (!validateConfigNode(node, msg)) return;
            const ref = validateViessmannRef(node, msg);
            if (!ref) return;
            const { installationId, gatewaySerial, deviceId } = ref;
                        
            // Check for feature or datapoint (both are treated the same way)
            const feature = msg.feature || msg.datapoint;
            if (!feature) {
                node.status({fill: 'red', shape: 'dot', text: 'no feature'});
                node.error('No feature/datapoint provided. Please provide msg.feature or msg.datapoint.', msg);
                return;
            }
            
            // Check if command is provided
            if (!msg.command) {
                node.status({fill: 'red', shape: 'dot', text: 'no command'});
                node.error('No command provided. Please provide msg.command.', msg);
                return;
            }
            
            // Check if params is provided and is an object
            if (!msg.params) {
                node.status({fill: 'red', shape: 'dot', text: 'no params'});
                node.error('No params provided. Please provide msg.params.', msg);
                return;
            }

            if (typeof msg.params !== 'object' || Array.isArray(msg.params)) {
                node.status({fill: 'red', shape: 'dot', text: 'invalid params'});
                node.error('Invalid params. msg.params must be a plain object (e.g., {temperature: 22}).', msg);
                return;
            }
            
            try {
                const endpoint = `${node.apiBaseUrl}/iot/v2/features/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices/${encodeURIComponent(deviceId)}/features/${encodeURIComponent(feature)}/commands/${encodeURIComponent(msg.command)}`;
                
                await executeApiPost(
                    node,
                    msg,
                    endpoint,
                    msg.params,
                    'writing...',
                    'Failed to write data'
                );
                
                // Set payload to success status
                msg.payload = {
                    success: true,
                    installationId: installationId,
                    gatewaySerial: gatewaySerial,
                    deviceId: deviceId,
                    feature: feature,
                    command: msg.command,
                    params: msg.params
                };
                
                node.send(msg);
            } catch (_error) {
                // Error already handled by executeApiPost
            }
        });
    }
    
    RED.nodes.registerType("viessmann-write", ViessmannWriteNode);
};
