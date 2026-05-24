/**
 * Input validators for Viessmann node input messages.
 *
 * Each validator returns the validated value (or `null` on failure) and emits
 * a `node.status` + `node.error(msg)` side effect on failure so the caller's
 * Catch node routes correctly. Callers should check the return value and
 * short-circuit on `null`.
 */

function validateConfigNode(node, msg) {
    if (!node.config) {
        node.status({fill: 'red', shape: 'dot', text: 'no config'});
        node.error('No configuration node found. Please configure the Viessmann config node.', msg);
        return false;
    }
    return true;
}

function validateInstallationId(node, msg) {
    if (msg.installationId === null || msg.installationId === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no installationId'});
        node.error('No installationId provided. Please provide msg.installationId.', msg);
        return null;
    }
    const installationId = Number(msg.installationId);
    if (!Number.isInteger(installationId) || installationId <= 0) {
        node.status({fill: 'red', shape: 'dot', text: 'invalid installationId'});
        node.error('Invalid installationId. Must be a positive integer.', msg);
        return null;
    }
    return installationId;
}

function validateGatewaySerial(node, msg) {
    if (msg.gatewaySerial === null || msg.gatewaySerial === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no gatewaySerial'});
        node.error('No gatewaySerial provided. Please provide msg.gatewaySerial.', msg);
        return null;
    }
    if (typeof msg.gatewaySerial !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid gatewaySerial'});
        node.error('Invalid gatewaySerial. Must be a string.', msg);
        return null;
    }
    const gatewaySerial = msg.gatewaySerial.trim();
    if (gatewaySerial === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid gatewaySerial'});
        node.error('Invalid gatewaySerial. Must be a non-empty string.', msg);
        return null;
    }
    return gatewaySerial;
}

function validateDeviceId(node, msg) {
    if (msg.deviceId === null || msg.deviceId === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no deviceId'});
        node.error('No deviceId provided. Please provide msg.deviceId.', msg);
        return null;
    }
    if (typeof msg.deviceId !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid deviceId'});
        node.error('Invalid deviceId. Must be a string.', msg);
        return null;
    }
    const deviceId = msg.deviceId.trim();
    if (deviceId === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid deviceId'});
        node.error('Invalid deviceId. Must be a non-empty string.', msg);
        return null;
    }
    return deviceId;
}

function validateFeature(node, msg) {
    // ?? so msg.feature = null also falls through to datapoint.
    const raw = msg.feature ?? msg.datapoint;
    if (raw === null || raw === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no feature'});
        node.error('No feature/datapoint provided. Please provide msg.feature or msg.datapoint.', msg);
        return null;
    }
    if (typeof raw !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid feature'});
        node.error('Invalid feature/datapoint. Must be a string.', msg);
        return null;
    }
    const value = raw.trim();
    if (value === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid feature'});
        node.error('Invalid feature/datapoint. Must be a non-empty string.', msg);
        return null;
    }
    return value;
}

function validateCommand(node, msg) {
    if (msg.command === null || msg.command === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no command'});
        node.error('No command provided. Please provide msg.command.', msg);
        return null;
    }
    if (typeof msg.command !== 'string') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid command'});
        node.error('Invalid command. Must be a string.', msg);
        return null;
    }
    const value = msg.command.trim();
    if (value === '') {
        node.status({fill: 'red', shape: 'dot', text: 'invalid command'});
        node.error('Invalid command. Must be a non-empty string.', msg);
        return null;
    }
    return value;
}

function isPlainObject(value) {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function validateParams(node, msg) {
    if (msg.params === null || msg.params === undefined) {
        node.status({fill: 'red', shape: 'dot', text: 'no params'});
        node.error('No params provided. Please provide msg.params.', msg);
        return null;
    }
    if (typeof msg.params !== 'object' || Array.isArray(msg.params) || !isPlainObject(msg.params)) {
        node.status({fill: 'red', shape: 'dot', text: 'invalid params'});
        node.error('Invalid params. msg.params must be a plain object (e.g., {temperature: 22}).', msg);
        return null;
    }
    if (Object.keys(msg.params).length === 0 && typeof node.warn === 'function') {
        node.warn('Posting empty msg.params - the Viessmann command will be called with no body.');
    }
    return msg.params;
}

function viessmannRefSource(msg) {
    if (!msg.viessmann || typeof msg.viessmann !== 'object' || Array.isArray(msg.viessmann)) {
        return msg;
    }
    return Object.assign({}, msg, {
        installationId: msg.viessmann.installationId,
        gatewaySerial: msg.viessmann.gatewaySerial,
        deviceId: msg.viessmann.deviceId
    });
}

function validateViessmannRef(node, msg) {
    const source = viessmannRefSource(msg);

    const installationId = validateInstallationId(node, source);
    if (installationId === null) return null;
    const gatewaySerial = validateGatewaySerial(node, source);
    if (gatewaySerial === null) return null;
    const deviceId = validateDeviceId(node, source);
    if (deviceId === null) return null;

    return { installationId, gatewaySerial, deviceId };
}

module.exports = {
    validateConfigNode,
    validateInstallationId,
    validateGatewaySerial,
    validateDeviceId,
    validateFeature,
    validateCommand,
    validateParams,
    viessmannRefSource,
    validateViessmannRef
};
