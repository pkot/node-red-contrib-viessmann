/**
 * Formatting helpers - user-facing message construction.
 */

/**
 * Extract a user-facing message from an axios error.
 *
 * Distinguishes axios's three failure shapes:
 *   - error.response  : the server replied with an HTTP status.
 *                       Prefer data.error_description (OAuth-style),
 *                       then data.message (Viessmann 401 body uses this),
 *                       then data.error (older API shape),
 *                       then a string body.
 *   - error.request   : a request was sent but no response arrived
 *                       (DNS, TCP reset, timeout, etc.). Include error.code
 *                       when present so the user can diagnose.
 *   - otherwise       : a setup error - fall back to error.message.
 *
 * Appends a short actionable hint for well-known statuses (401/403/404).
 */
function extractErrorMessage(error) {
    if (error === null || error === undefined) {
        return 'Unknown error';
    }
    if (typeof error !== 'object') {
        return String(error);
    }
    if (error.response) {
        const { status, data } = error.response;
        const detail = data?.error_description
            || data?.message
            || data?.error
            || (typeof data === 'string' ? data : '');
        if (status !== undefined) {
            const base = detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`;
            const hint = actionableStatusHint(status);
            return hint ? `${base} - ${hint}` : base;
        }
        return detail || error.message || 'Unknown error';
    }
    if (error.request) {
        return error.code
            ? `No response from server (${error.code})`
            : 'No response from server';
    }
    return error.message || 'Unknown error';
}

/**
 * For statuses where the user's fix is well-known, return a short hint.
 * Returns '' for statuses with no actionable guidance.
 */
function actionableStatusHint(status) {
    switch (status) {
        case 403:
            return 'token lacks scope (regenerate tokens if scopes changed)';
        case 404:
            return 'check installationId/gatewaySerial/deviceId';
        case 401:
            return 'token expired or invalid (the client refreshes automatically; if this persists, regenerate tokens)';
        default:
            return '';
    }
}

function truncateForStatus(text, maxLength = 30) {
    if (typeof text !== 'string') {
        text = String(text);
    }
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Property keys we render into a viessmann-read node's status icon when
 * present, in display order. Order matters: `/`-joined values use this
 * sequence, so e.g. a feature with both `value` and `unit` reads as
 * "21.5celsius" / "active".
 *
 * Adding a new known property is a single-line change here.
 */
const STATUS_PROPERTY_NAMES = ['value', 'status', 'temperature', 'strength', 'active', 'hours', 'starts'];

/**
 * Build a status-icon text from a feature's `properties` object. Returns
 * the `/`-joined value string when any STATUS_PROPERTY_NAMES key has a
 * non-null value; null otherwise (caller should fall back to 'success').
 *
 * Pure - no Node-RED side effects. Unit-testable with table data.
 *
 * @param {object} properties - feature.properties from the API response
 * @returns {string|null}
 */
function formatFeatureStatus(properties) {
    if (!properties || typeof properties !== 'object') return null;
    const parts = [];
    for (const name of STATUS_PROPERTY_NAMES) {
        const slot = properties[name];
        if (!slot) continue;
        const value = slot.value;
        if (value === null || value === undefined) continue;
        const unit = slot.unit;
        parts.push(unit ? `${value}${unit}` : String(value));
    }
    return parts.length > 0 ? parts.join('/') : null;
}

module.exports = {
    extractErrorMessage,
    actionableStatusHint,
    truncateForStatus,
    formatFeatureStatus,
    STATUS_PROPERTY_NAMES
};
