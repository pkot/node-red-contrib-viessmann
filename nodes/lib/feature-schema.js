/**
 * Feature/command schema validation.
 *
 * Viessmann's feature objects declare their writable commands in
 * `feature.commands`, each with a `params` schema (type, required,
 * constraints). This module validates a proposed write against that
 * schema before the POST hits the server, so users get actionable
 * "Unknown parameter X" / "out of range" errors locally instead of an
 * opaque 400 from upstream.
 *
 * The check is opt-in: `viessmann-write` only performs it when the
 * config node sets `validateBeforeWrite`.
 *
 * Pure functions only - the consumer of these results decides how to
 * surface them (typically node.error + node.status).
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors   - human-readable reasons; empty when valid
 */

/**
 * Validate a proposed write against a Viessmann feature object.
 *
 * @param {object} featureData   The `data` body of a /iot/v2/features/.../{feature} GET
 * @param {string} commandName   The command to call (e.g. 'setMode')
 * @param {object} params        msg.params (already known to be a plain object)
 * @returns {ValidationResult}
 */
function validateWriteAgainstSchema(featureData, commandName, params) {
    const errors = [];

    if (!featureData || typeof featureData !== 'object') {
        errors.push('No feature schema available to validate against');
        return { valid: false, errors };
    }

    const commands = featureData.commands;
    if (!commands || typeof commands !== 'object') {
        errors.push(`Feature "${featureData.feature || '<unknown>'}" declares no commands`);
        return { valid: false, errors };
    }

    const command = commands[commandName];
    if (!command) {
        errors.push(`Command "${commandName}" is not declared for feature "${featureData.feature || '<unknown>'}"`);
        return { valid: false, errors };
    }

    if (command.isExecutable === false) {
        errors.push(`Command "${commandName}" is currently not executable on this device`);
    }

    const declared = command.params || {};

    for (const key of Object.keys(params)) {
        if (!Object.prototype.hasOwnProperty.call(declared, key)) {
            errors.push(`Unknown parameter "${key}" for command "${commandName}"`);
        }
    }

    for (const [key, spec] of Object.entries(declared)) {
        const value = params[key];
        if (value === undefined) {
            if (spec.required) {
                errors.push(`Missing required parameter "${key}"`);
            }
            continue;
        }
        const typeError = checkParamType(key, value, spec.type);
        if (typeError) {
            errors.push(typeError);
            continue;
        }
        const constraintErrors = checkParamConstraints(key, value, spec.constraints || {});
        for (const e of constraintErrors) errors.push(e);
    }

    return { valid: errors.length === 0, errors };
}

function checkParamType(key, value, expectedType) {
    if (!expectedType) return '';
    switch (expectedType) {
        case 'string':
            return typeof value === 'string' ? '' : `Parameter "${key}" must be a string`;
        case 'number':
            return typeof value === 'number' && Number.isFinite(value) ? '' : `Parameter "${key}" must be a finite number`;
        case 'integer':
            return Number.isInteger(value) ? '' : `Parameter "${key}" must be an integer`;
        case 'boolean':
            return typeof value === 'boolean' ? '' : `Parameter "${key}" must be a boolean`;
        case 'array':
            return Array.isArray(value) ? '' : `Parameter "${key}" must be an array`;
        case 'object':
            return value !== null && typeof value === 'object' && !Array.isArray(value)
                ? ''
                : `Parameter "${key}" must be an object`;
        default:
            // Unknown declared type - don't reject; let server decide.
            return '';
    }
}

function checkParamConstraints(key, value, constraints) {
    const out = [];
    if (Array.isArray(constraints.enum) && !constraints.enum.includes(value)) {
        out.push(`Parameter "${key}" must be one of: ${constraints.enum.join(', ')}`);
    }
    if (typeof constraints.min === 'number' && typeof value === 'number' && value < constraints.min) {
        out.push(`Parameter "${key}" must be >= ${constraints.min}`);
    }
    if (typeof constraints.max === 'number' && typeof value === 'number' && value > constraints.max) {
        out.push(`Parameter "${key}" must be <= ${constraints.max}`);
    }
    if (typeof constraints.minLength === 'number' && typeof value === 'string' && value.length < constraints.minLength) {
        out.push(`Parameter "${key}" must be at least ${constraints.minLength} characters`);
    }
    if (typeof constraints.maxLength === 'number' && typeof value === 'string' && value.length > constraints.maxLength) {
        out.push(`Parameter "${key}" must be at most ${constraints.maxLength} characters`);
    }
    return out;
}

module.exports = {
    validateWriteAgainstSchema
};
