const {
    initializeViessmannNode,
    validateConfigNode,
    validateViessmannRef,
    validateFeature,
    validateCommand,
    validateParams,
    surfaceUnexpectedError,
    executeApiPost
} = require('./viessmann-helpers');
const { validateWriteAgainstSchema } = require('./lib/feature-schema');

module.exports = function(RED) {
    function ViessmannWriteNode(config) {
        initializeViessmannNode(RED, this, config);
        const node = this;

        node.on('input', async function(msg) {
            if (!validateConfigNode(node, msg)) return;
            const ref = validateViessmannRef(node, msg);
            if (!ref) return;
            const { installationId, gatewaySerial, deviceId } = ref;

            const feature = validateFeature(node, msg);
            if (!feature) return;
            const command = validateCommand(node, msg);
            if (!command) return;
            const params = validateParams(node, msg);
            if (!params) return;

            const featureUrl = `${node.apiBaseUrl}/iot/v2/features/installations/${encodeURIComponent(installationId)}/gateways/${encodeURIComponent(gatewaySerial)}/devices/${encodeURIComponent(deviceId)}/features/${encodeURIComponent(feature)}`;
            const endpoint = `${featureUrl}/commands/${encodeURIComponent(command)}`;

            // Optional client-side schema validation. When the config node has
            // validateBeforeWrite set, we GET the feature (the client cache
            // dedupes/reuses), then validate msg.params against the declared
            // command schema. Failures produce a structured local error rather
            // than an opaque 400 from the API.
            if (node.config.validateBeforeWrite) {
                try {
                    const featureResp = await node.config.client.get(featureUrl);
                    const featureData = featureResp && featureResp.data && featureResp.data.data;
                    const validation = validateWriteAgainstSchema(featureData, command, params);
                    if (!validation.valid) {
                        const summary = validation.errors.join('; ');
                        node.status({fill: 'red', shape: 'dot', text: 'invalid for schema'});
                        node.error('Schema validation failed: ' + summary, msg);
                        return;
                    }
                } catch (schemaFetchError) {
                    // Soft-fail: the GET produced its own node.error+status, but
                    // we don't want to block the write because the schema
                    // pre-check itself failed - let the POST attempt run and
                    // surface the server's response.
                    node.warn('Schema pre-check failed (' + (schemaFetchError && schemaFetchError.message ? schemaFetchError.message : 'unknown') + '); attempting write anyway');
                }
            }

            try {
                await executeApiPost(node, msg, endpoint, params, 'writing...', 'Failed to write data');
            } catch (_apiError) {
                return;
            }

            try {
                msg.payload = {
                    success: true,
                    installationId,
                    gatewaySerial,
                    deviceId,
                    feature,
                    command,
                    params
                };
                node.send(msg);
            } catch (error) {
                surfaceUnexpectedError(node, msg, error);
            }
        });
    }
    
    RED.nodes.registerType("viessmann-write", ViessmannWriteNode);
};
