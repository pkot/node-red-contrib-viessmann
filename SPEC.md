# Node-RED Viessmann Module: Functional Specification

## 1. Scope

- The module will function as a backend Node-RED integration for Viessmann devices via the official SaaS API.
- It will allow users to:
  - Use a Viessmann account that has been authenticated out-of-band via the OAuth2 Authorization Code with PKCE flow (see §2a). The runtime never performs the browser-based login itself.
  - Discover available Viessmann devices (gateways, installations, equipment, features).
  - Read any available data point/parameter.
  - Set writable parameters (e.g., desired temperature, operation modes: on/off, etc.).
- **No user management or account provisioning features.**

---

## 2. Node-RED Node Designs

### a) Configuration Node: `viessmann-config`
- Stores the public client ID and the pre-obtained access/refresh tokens securely via Node-RED's credential system.
- Owns the runtime token lifecycle: validates the stored access token, refreshes it via the refresh token, and surfaces auth state to dependent nodes.
- Provides config for all Viessmann nodes.
- **Does not perform interactive authentication itself.** Token bootstrap is an out-of-band step handled by `scripts/get-viessmann-tokens.js` (see §2.0).

**OAuth2 Configuration:**
- **Grant Type at runtime**: Refresh token grant (the access token is renewed using the stored refresh token).
- **Grant Type at bootstrap**: Authorization Code with PKCE (run via `scripts/get-viessmann-tokens.js`).
- **Public client**: no `client_secret` (PKCE replaces it).
- **Scopes**: `IoT offline_access` (the `offline_access` scope is what makes refresh tokens issuable).
- **IAM endpoint**: `https://iam.viessmann-climatesolutions.com/idp/v3/token`

**External Requirements:**
Users must obtain credentials from the Viessmann Developer Portal:
1. Create a client/application in the Developer Portal.
2. Obtain a Client ID. Viessmann's developer flow is now a public PKCE client - **no Client Secret is issued**.
3. Set the client's redirect URI to `http://localhost:4200/` so the bootstrap script's local callback can complete.
4. Run the bootstrap script (§2.0) to obtain access + refresh tokens, then paste them into the config node.

Refer to the [Viessmann API Authentication Documentation](https://api.viessmann-climatesolutions.com/documentation/static/authentication) for further detail.

**Inputs:** (credentials via Node-RED credential system)
**Outputs:** (none; used as shared config)

### 2.0 Token Bootstrap CLI: `scripts/get-viessmann-tokens.js`
- A standalone Node.js script that performs the Authorization Code with PKCE flow against Viessmann's IAM.
- Generates a code verifier/challenge, opens the user's browser, captures the redirect on a local loopback callback server, and exchanges the authorization code for access and refresh tokens.
- Prints both tokens to stdout for the user to paste into the `viessmann-config` node.
- This step is **not** part of the Node-RED runtime: it is a one-time setup the user runs from a terminal.

### b) Device Discovery Node: `viessmann-device-list`
- Lists all accessible installations, gateways, devices, and their features.

**Inputs:** (msg.payload unused or can accept filter options)  
**Outputs:**  
- `msg.payload`: Array of discovered devices/features with IDs and metadata.

### c) Data Read Node: `viessmann-read`
- Reads specific data points from a selected device (e.g., temperature, state).

**Inputs:**  
- `msg.deviceId` (required)
- `msg.feature` or `msg.datapoint` (optional: what to read)
- Optionally, configuration for polling interval

**Outputs:**  
- `msg.payload`: Value(s) read from the device/feature

### d) Data Write Node: `viessmann-write`
- Sets values for writable device parameters (e.g., temperature setpoint, operation mode).

**Inputs:**  
- `msg.deviceId` (required)
- `msg.feature` or `msg.datapoint` (required)
- `msg.value` (required: new value to set)

**Outputs:**  
- `msg.payload`: API response or success/failure status

---

## 3. Key Implementation Decisions

- **Authentication:** Authorization Code with PKCE for bootstrap (via `scripts/get-viessmann-tokens.js`); refresh-token grant at runtime (in `viessmann-config`). Default scopes: `IoT offline_access`. Concurrent refresh attempts are de-duplicated via an in-flight promise so the IdP's refresh-token rotation cannot race-invalidate the stored token.
  - **Scopes are configurable**: Users can modify scopes if needed for their specific use case
  - **External setup required**: Users must obtain a Client ID from the Viessmann Developer Portal and run the bootstrap CLI before the Node-RED config node can authenticate
  - **Error handling**: Provide specific, actionable error messages that guide users to fix configuration issues
- **API Version:** Prioritize v2 endpoints where available, fallback to v1 if needed.
- **Error Handling:** All nodes must emit errors via Node-RED convention (`node.error()`), provide informative feedback with troubleshooting guidance.
- **Security:** Store credentials securely using Node-RED’s credential system.
- **Extensibility:** The module should be able to easily add more nodes for new Viessmann API endpoints as they become available.
- **Testing:** Test all nodes using mocks/stubs for the Viessmann API.

---

## 4. Out of Scope

- User account creation, linking, or management.
- Frontend/dashboard UI components (backend only).
- Non-Viessmann devices.

---

## Obstacles / Considerations

- **API Quotas & Rate Limits:** The module must respect Viessmann API limits.
- **Device/Feature Variability:** Not all devices will expose the same features or writable parameters; dynamic discovery & validation is required.
- **OAuth2 Flow & External Setup:**
  - Authorization Code with PKCE is used for bootstrap; refresh-token grant at runtime
  - **Users must obtain a Client ID** from the Viessmann Developer Portal and run `scripts/get-viessmann-tokens.js` to mint the initial access + refresh tokens before the Node-RED config node can authenticate
  - Refer to Viessmann API documentation for detailed setup requirements
  - Error messages guide users to fix configuration issues
