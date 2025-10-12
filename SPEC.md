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

- **Authentication:** Use OAuth2 (client credentials or device flow as supported); token refresh managed by config node.
- **API Version:** Prioritize v2 endpoints where available, fallback to v1 if needed.
- **Error Handling:** All nodes must emit errors via Node-RED convention (`node.error()`), provide informative feedback.
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
- **OAuth2 Flow:** If device flow is used, user interaction may be required for first-time setup; clarify which OAuth2 grant is preferred.
