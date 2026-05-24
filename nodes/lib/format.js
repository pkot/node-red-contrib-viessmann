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

/**
 * Truncate long text for status display.
 */
function truncateForStatus(text, maxLength = 30) {
    if (typeof text !== 'string') {
        text = String(text);
    }
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}

module.exports = {
    extractErrorMessage,
    actionableStatusHint,
    truncateForStatus
};
