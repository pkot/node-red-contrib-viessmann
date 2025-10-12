# Node-RED Viessmann Module: Functional Specification

## 1. Scope

- The module will function as a backend Node-RED integration for Viessmann devices via the official SaaS API.
- It will allow users to:
  - Authenticate (OAuth2 client credentials or device flow).
  - Discover available Viessmann devices (gateways, installations, equipment, features).
  - Read any available data point/parameter.
  - Set writable parameters (e.g., desired temperature, operation modes: on/off, etc.).
- **No user management or account provisioning features.**

---

## 2. Node-RED Node Designs

### a) Configuration Node: `viessmann-config`
- Stores API credentials (client_id, client_secret, etc.) securely.
- Handles authentication/token refresh.
- Provides config for all Viessmann nodes.

**OAuth2 Configuration:**
- **Grant Type**: Client credentials flow
- **Required Scopes**: `IoT User offline_access`
  - `IoT User`: Required for accessing device/installation data
  - `offline_access`: Required for refresh token capability
- **Token Endpoint**: `https://iam.viessmann.com/idp/v3/token`

**External Requirements:**
Users must complete the following in the Viessmann Developer Portal before authentication will succeed:
1. Register an application with correct redirect URI (e.g., `http://localhost:4200/auth/callback`)
2. Configure application with required scopes (`IoT User`, `offline_access`)
3. Obtain Client ID and Client Secret
4. Complete any required user consent/authorization steps

**Inputs:** (credentials via Node-RED credential system)  
**Outputs:** (none; used as shared config)

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

- **Authentication:** Use OAuth2 client credentials flow with required scopes (`IoT User offline_access`); token refresh managed by config node.
  - **Scopes are mandatory**: The Viessmann API requires proper OAuth2 scopes to be specified
  - **External setup required**: Users must configure their application in the Viessmann Developer Portal with correct redirect URIs and scopes before authentication will work
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
  - Client credentials flow is used (not device flow or authorization code flow)
  - **Users must complete external setup** in the Viessmann Developer Portal before authentication will work
  - Required steps include: app registration, scope selection (`IoT User`, `offline_access`), redirect URI configuration, and potentially user consent
  - **Scope parameter is mandatory** for the Viessmann API to accept authentication requests
  - Error messages must guide users to complete missing configuration steps
