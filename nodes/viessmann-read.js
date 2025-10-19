const { initializeViessmannNode, validateConfigNode, validateInstallationId, validateGatewaySerial, validateDeviceId, executeApiGet } = require('./viessmann-helpers');

module.exports = function(RED) {
    function ViessmannReadNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;
        
        node.on('input', async function(msg) {
            const installationId = validateInstallationId(node, msg);
            const gatewaySerial = validateGatewaySerial(node, msg);
            const deviceId = validateDeviceId(node, msg);
            
            if (!validateConfigNode(node, msg) || !installationId || !gatewaySerial || !deviceId) {
                return;
            }
            
            // Check for feature or datapoint (both are treated the same way)
            const feature = msg.feature || msg.datapoint;
            
            try {
                let endpoint;
                if (feature) {
                    // Read specific feature
                    endpoint = `${node.apiBaseUrl}/iot/v2/features/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}/features/${feature}`;
                } else {
                    // Read all features
                    endpoint = `${node.apiBaseUrl}/iot/v2/features/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}/features`;
                }
                
                const response = await executeApiGet(
                    node,
                    msg,
                    endpoint,
                    'reading...',
                    'Failed to read data'
                );
                
                // Set payload to the data
                // For single feature reads, API returns { data: {...} }
                // For all features reads, API returns { data: [...] }
                msg.payload = response.data.data || response.data;
                
                // Set status based on the read result
                if (feature && msg.payload.properties) {
                    // Collect values from all available property paths
                    // Order matters: check most specific/common properties first
                    const propertyNames = ['value', 'status', 'temperature', 'strength', 'active', 'hours', 'starts'];
                    const statusParts = [];
                    
                    for (const propName of propertyNames) {
                        const valueObj = msg.payload.properties[propName];
                        if (valueObj && valueObj.value !== null && valueObj.value !== undefined) {
                            const value = valueObj.value;
                            const unit = valueObj.unit;
                            const part = unit ? `${value}${unit}` : String(value);
                            statusParts.push(part);
                        }
                    }
                    
                    if (statusParts.length > 0) {
                        // Single feature read - show all values separated by /
                        const statusText = statusParts.join('/');
                        node.status({fill: 'green', shape: 'dot', text: statusText});
                    } else {
                        // No value property - show success
                        node.status({fill: 'green', shape: 'dot', text: 'success'});
                    }
                } else {
                    // All features read - show success
                    node.status({fill: 'green', shape: 'dot', text: 'success'});
                }
                
                node.send(msg);
            } catch (error) {
                // Error already handled by executeApiGet
            }
        });
    }
    
    RED.nodes.registerType("viessmann-read", ViessmannReadNode);
};
