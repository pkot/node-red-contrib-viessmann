module.exports = function(RED) {
    function ViessmannConfigNode(config) {
        RED.nodes.createNode(this, config);
        
        // TODO: Implement OAuth2 authentication
        // TODO: Handle token refresh
        // TODO: Store credentials securely
    }
    
    RED.nodes.registerType("viessmann-config", ViessmannConfigNode, {
        credentials: {
            clientId: { type: "text" },
            clientSecret: { type: "password" }
        }
    });
};
