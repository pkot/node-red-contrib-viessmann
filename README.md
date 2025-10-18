# node-red-contrib-viessmann

A Node-RED module for integrating Viessmann heating devices via the official Viessmann SaaS API.

## Features

- **OAuth2 Authentication**: Secure authentication with Viessmann API using client credentials or device flow
- **Installation Discovery**: List all accessible Viessmann installations for your account
- **Gateway Discovery**: List all gateways for a specific installation
- **Device Discovery**: List all devices attached to a specific gateway
- **Feature Discovery**: List all available features/services for a specific device
- **Read Data**: Read specific data points from Viessmann devices (e.g., temperature, state)
- **Write Data**: Set writable parameters (e.g., temperature setpoint, operation modes)

## Installation

Install directly from npm:

```bash
npm install node-red-contrib-viessmann
```

Or install via Node-RED's palette manager.

## Nodes

### Configuration Node: `viessmann-config`
Stores API credentials and tokens securely and handles automatic token refresh. This configuration is shared across all Viessmann nodes.

#### Authentication with Viessmann API

The Viessmann API uses **OAuth2 with PKCE flow**, which requires browser-based authentication. You cannot authenticate directly from Node-RED - you must generate tokens first.

#### Quick Start - Generating Tokens

**Option 1: Use the Helper Script (Recommended)**

Run the provided token generator script:

```bash
cd ~/.node-red
node node_modules/node-red-contrib-viessmann/scripts/get-viessmann-tokens.js
```

The script will:
1. Ask for your Client ID
2. Open your browser for Viessmann login
3. Automatically capture the authorization code
4. Exchange it for access and refresh tokens
5. Display the tokens to copy into Node-RED

**Option 2: Manual Token Generation**

If you prefer to generate tokens manually, follow these steps:

1. **Get your Client ID** from the [Viessmann Developer Portal](https://developer.viessmann.com/)
   - Log in with your Viessmann account
   - Go to "My Dashboard" → "Your clients"
   - Create a new client or use an existing one
   - Note your Client ID
   - Set redirect URI to: `http://localhost:4200/`

2. **Generate PKCE codes** using [this tool](https://developer.pingidentity.com/en/tools/pkce-code-generator.html)
   - Save both the Code Verifier and Code Challenge

3. **Authorize in browser** - Visit this URL (replace CLIENT_ID and CODE_CHALLENGE):
   ```
   https://iam.viessmann-climatesolutions.com/idp/v3/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:4200/&scope=IoT%20offline_access&code_challenge=YOUR_CODE_CHALLENGE&code_challenge_method=S256
   ```
   - Log in with your Viessmann account
   - After authorization, copy the `code` parameter from the redirect URL
   - **Note:** The code expires in 20 seconds!

4. **Exchange code for tokens** using curl (replace values):
   ```bash
   curl -X POST "https://iam.viessmann-climatesolutions.com/idp/v3/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:4200/&grant_type=authorization_code&code_verifier=YOUR_CODE_VERIFIER&code=YOUR_AUTH_CODE"
   ```

5. **Copy the tokens** from the JSON response:
   - `access_token` - valid for 1 hour
   - `refresh_token` - valid for 180 days

#### Configuration in Node-RED

1. **Name** (optional): A friendly name for this configuration
2. **Client ID** (required): Your Client ID from the Viessmann Developer Portal
3. **Access Token** (required): The access token from token generation
4. **Refresh Token** (recommended): The refresh token for automatic token renewal
5. **Enable Debug Logging** (optional): Enable for troubleshooting

#### Token Management

- **Access tokens** expire after 1 hour
- If you provide a **refresh token**, new access tokens are automatically obtained when needed
- **Refresh tokens** are valid for 180 days
- Tokens persist across Node-RED restarts
- When the refresh token expires, regenerate tokens using the helper script

#### Troubleshooting

If you encounter errors:
- **"No access token configured"**: Generate tokens using the helper script
- **"Token refresh failed"**: Your refresh token may have expired (180 days). Generate new tokens.
- **API errors**: Ensure your access token hasn't expired. Enable debug logging for details.

For more information, see the [Viessmann API Authentication Documentation](https://api.viessmann-climatesolutions.com/documentation/static/authentication).

**Additional Resources:**
- [Viessmann API Documentation](https://api.viessmann-climatesolutions.com/documentation) (requires login to Viessmann Developer Portal)

### Device Discovery Node: `viessmann-device-list`
Lists all accessible Viessmann installations for the authenticated account.

**Inputs:**
- `msg.payload` (optional): Can accept filter options (currently unused)

**Outputs:**
- `msg.payload`: Array of installation objects with the following structure:
  ```json
  [
    {
      "id": 123456,
      "description": "My Home",
      "address": {
        "street": "Main Street 1",
        "city": "Berlin",
        "postalCode": "10115",
        "country": "DE"
      },
      "registeredAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
  ```

**Error Handling:**
- Emits an error if the config node is not configured
- Emits an error if the API request fails
- Error details are available in the debug panel

**Example Usage:**
1. Add a `viessmann-device-list` node to your flow
2. Connect it to a `viessmann-config` node
3. Trigger the node with an inject node
4. View the list of installations in the debug panel

**API Endpoint:**
- Uses `GET /iot/v2/equipment/installations` from the Viessmann API
- Base URL: `https://api.viessmann-climatesolutions.com`

### Gateway List Node: `viessmann-gateway-list`
Lists all gateways for a specific Viessmann installation.

**Inputs:**
- `msg.installationId` (required): The installation ID to list gateways for

**Outputs:**
- `msg.payload`: Array of gateway objects with the following structure:
  ```json
  [
    {
      "serial": "7571381573112225",
      "version": "1.2.3.4",
      "gatewayType": "VitoconnectOPTO2",
      "aggregatedStatus": "WorksProperly",
      "description": "My description",
      "installationId": 518,
      "autoUpdate": false,
      "firmwareUpdateFailureCounter": 435,
      "targetRealm": "DC",
      "otaOngoing": false,
      "createdAt": "2025-09-18T13:56:08.9374248+00:00",
      "producedAt": "2025-09-18T13:56:08.9374519+00:00",
      "registeredAt": "2025-09-18T13:56:08.9375793+00:00",
      "lastStatusChangedAt": "2025-09-18T13:56:08.9374752+00:00"
    }
  ]
  ```

**Error Handling:**
- Emits an error if the config node is not configured
- Emits an error if `msg.installationId` is not provided
- Emits an error if the API request fails (e.g., installation not found)
- Error details are available in the debug panel

**Example Usage:**
1. Use `viessmann-device-list` to get installation IDs
2. Pass the installation ID in `msg.installationId` to `viessmann-gateway-list`
3. View the list of gateways in the debug panel

**API Endpoint:**
- Uses `GET /iot/v2/equipment/installations/{installationId}/gateways` from the Viessmann API
- Base URL: `https://api.viessmann-climatesolutions.com`

### Gateway Devices Node: `viessmann-gateway-devices`
Lists all devices attached to a specific gateway in a Viessmann installation.

**Inputs:**
- `msg.installationId` (required): The installation ID (number)
- `msg.gatewaySerial` (required): The gateway serial number (string)

**Outputs:**
- `msg.payload`: Array of device objects with the following structure:
  ```json
  [
    {
      "id": "0",
      "gatewaySerial": "7571381573112225",
      "boilerSerial": "123456789012",
      "boilerSerialEditor": "User",
      "bmuSerial": "123456789012",
      "bmuSerialEditor": "User",
      "createdAt": "2025-09-18T13:56:08.9193723+00:00",
      "editedAt": "2025-09-18T13:56:08.9193938+00:00",
      "modelId": "MODEL_7",
      "status": "Offline",
      "deviceType": "heating",
      "roles": ["type:boiler", "type:E3"],
      "isBoilerSerialEditable": false,
      "brand": null,
      "translationKey": null
    }
  ]
  ```

**Error Handling:**
- Emits an error if the config node is not configured
- Emits an error if `msg.installationId` is not provided or invalid
- Emits an error if `msg.gatewaySerial` is not provided or invalid
- Emits an error if the API request fails (e.g., gateway not found)
- Error details are available in the debug panel

**Example Usage:**
1. Use `viessmann-device-list` to get installation IDs
2. Use `viessmann-gateway-list` to get gateway serial numbers for an installation
3. Pass both `msg.installationId` and `msg.gatewaySerial` to `viessmann-gateway-devices`
4. View the list of devices attached to the gateway in the debug panel

**API Endpoint:**
- Uses `GET /iot/v2/equipment/installations/{installationId}/gateways/{gatewaySerial}/devices` from the Viessmann API
- Base URL: `https://api.viessmann-climatesolutions.com`

### Device Features Node: `viessmann-device-features`
Lists all available features/services for a specific device on a gateway.

**Inputs:**
- `msg.installationId` (required): The installation ID (number)
- `msg.gatewaySerial` (required): The gateway serial number (string)
- `msg.deviceId` (required): The device ID (string)

**Outputs:**
- `msg.payload`: Array of feature objects with the following structure:
  ```json
  [
    {
      "feature": "heating.circuits.0.temperature",
      "gatewayId": "7571381573112225",
      "deviceId": "0",
      "isEnabled": true,
      "isReady": true,
      "properties": {
        "value": {
          "type": "number",
          "value": 21.5,
          "unit": "celsius"
        }
      },
      "commands": {},
      "timestamp": "2025-10-18T14:30:00.000Z"
    },
    {
      "feature": "heating.circuits.0.operating.modes.active",
      "gatewayId": "7571381573112225",
      "deviceId": "0",
      "isEnabled": true,
      "isReady": true,
      "properties": {
        "value": {
          "type": "string",
          "value": "dhw"
        }
      },
      "commands": {
        "setMode": {
          "uri": "/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.operating.modes.active/commands/setMode",
          "name": "setMode",
          "isExecutable": true,
          "params": {
            "mode": {
              "type": "string",
              "required": true,
              "constraints": {
                "enum": ["standby", "dhw", "dhwAndHeating"]
              }
            }
          }
        }
      },
      "timestamp": "2025-10-18T14:30:00.000Z"
    }
  ]
  ```

**Feature Structure:**
Each feature object contains:
- `feature`: The feature identifier (e.g., "heating.circuits.0.temperature")
- `gatewayId`: Associated gateway serial number
- `deviceId`: Associated device ID
- `isEnabled`: Whether the feature is enabled
- `isReady`: Whether the feature is ready
- `properties`: Object containing feature properties with values, types, and units
- `commands`: Object containing available commands for writable features (empty for read-only features)
- `timestamp`: ISO 8601 timestamp of last update

**Error Handling:**
- Emits an error if the config node is not configured
- Emits an error if `msg.installationId` is not provided or invalid
- Emits an error if `msg.gatewaySerial` is not provided or invalid
- Emits an error if `msg.deviceId` is not provided or invalid
- Emits an error if the API request fails (e.g., device not found)
- Error details are available in the debug panel

**Example Usage:**
1. Use `viessmann-device-list` to get installation IDs
2. Use `viessmann-gateway-list` to get gateway serial numbers for an installation
3. Use `viessmann-gateway-devices` to get device IDs for a gateway
4. Pass `msg.installationId`, `msg.gatewaySerial`, and `msg.deviceId` to `viessmann-device-features`
5. View the list of available features/services in the debug panel
6. Use the feature identifiers with `viessmann-read` or `viessmann-write` nodes to interact with specific features

**API Endpoint:**
- Uses `GET /iot/v2/equipment/installations/{installationId}/gateways/{gatewaySerial}/devices/{deviceId}/features` from the Viessmann API
- Base URL: `https://api.viessmann-climatesolutions.com`

### Data Read Node: `viessmann-read`
Reads specific data points from a selected device.

**Inputs:**
- `msg.installationId` (required): The installation ID (number)
- `msg.gatewaySerial` (required): The gateway serial number (string)
- `msg.deviceId` (required): The device ID (string)
- `msg.feature` or `msg.datapoint` (optional): The specific feature to read. If not provided, all features are returned.

**Outputs:**
- `msg.payload`: When a specific feature is requested, returns a single feature object with the following structure:
  ```json
  {
    "feature": "heating.circuits.0.temperature",
    "gatewayId": "7571381573112225",
    "deviceId": "0",
    "isEnabled": true,
    "isReady": true,
    "properties": {
      "value": {
        "type": "number",
        "value": 21.5,
        "unit": "celsius"
      }
    },
    "commands": {},
    "timestamp": "2025-10-18T14:30:00.000Z"
  }
  ```

  When no feature is specified, returns an array of all feature objects (same structure as `viessmann-device-features`):
  ```json
  [
    {
      "feature": "heating.circuits.0.temperature",
      "gatewayId": "7571381573112225",
      "deviceId": "0",
      "isEnabled": true,
      "isReady": true,
      "properties": {
        "value": {
          "type": "number",
          "value": 21.5,
          "unit": "celsius"
        }
      },
      "commands": {},
      "timestamp": "2025-10-18T14:30:00.000Z"
    },
    {
      "feature": "heating.circuits.0.operating.modes.active",
      "gatewayId": "7571381573112225",
      "deviceId": "0",
      "isEnabled": true,
      "isReady": true,
      "properties": {
        "value": {
          "type": "string",
          "value": "dhw"
        }
      },
      "commands": {
        "setMode": {
          "uri": "/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.operating.modes.active/commands/setMode",
          "name": "setMode",
          "isExecutable": true,
          "params": {
            "mode": {
              "type": "string",
              "required": true,
              "constraints": {
                "enum": ["standby", "dhw", "dhwAndHeating"]
              }
            }
          }
        }
      },
      "timestamp": "2025-10-18T14:30:00.000Z"
    }
  ]
  ```

**Feature Object Structure:**
Each feature object contains:
- `feature`: The feature identifier (e.g., "heating.circuits.0.temperature")
- `gatewayId`: Associated gateway serial number
- `deviceId`: Associated device ID
- `isEnabled`: Whether the feature is enabled
- `isReady`: Whether the feature is ready
- `properties`: Object containing feature properties with values, types, and units
- `commands`: Object containing available commands for writable features (empty for read-only features)
- `timestamp`: ISO 8601 timestamp of last update

**Error Handling:**
- Emits an error if the config node is not configured
- Emits an error if `msg.installationId` is not provided or invalid
- Emits an error if `msg.gatewaySerial` is not provided or invalid
- Emits an error if `msg.deviceId` is not provided or invalid
- Emits an error if the API request fails (e.g., device/feature not found, network error)
- Error details are available in the debug panel

**Example Usage:**

*Reading a specific feature:*
1. Use `viessmann-device-list` to get installation IDs
2. Use `viessmann-gateway-list` to get gateway serial numbers for an installation
3. Use `viessmann-gateway-devices` to get device IDs for a gateway
4. Use `viessmann-device-features` to list available features (optional, to discover feature names)
5. Pass `msg.installationId`, `msg.gatewaySerial`, `msg.deviceId`, and `msg.feature` to `viessmann-read`
6. The node returns the data for the specified feature in `msg.payload`

Example flow:
```javascript
// Set the identifiers
msg.installationId = 123456;
msg.gatewaySerial = "7571381573112225";
msg.deviceId = "0";
msg.feature = "heating.circuits.0.temperature";
// Returns: { feature: "heating.circuits.0.temperature", properties: { value: { value: 21.5, unit: "celsius" } }, ... }
```

*Reading all features:*
1. Follow steps 1-3 above
2. Pass only `msg.installationId`, `msg.gatewaySerial`, and `msg.deviceId` to `viessmann-read` (without `msg.feature`)
3. The node returns an array of all features in `msg.payload`

Example flow:
```javascript
// Set the identifiers
msg.installationId = 123456;
msg.gatewaySerial = "7571381573112225";
msg.deviceId = "0";
// Returns: [ { feature: "...", ... }, { feature: "...", ... }, ... ]
```

**API Endpoints:**
- Specific feature: `GET /iot/v2/equipment/installations/{installationId}/gateways/{gatewaySerial}/devices/{deviceId}/features/{feature}`
- All features: `GET /iot/v2/equipment/installations/{installationId}/gateways/{gatewaySerial}/devices/{deviceId}/features`
- Base URL: `https://api.viessmann-climatesolutions.com`

### Data Write Node: `viessmann-write`
Sets values for writable Viessmann device parameters by executing commands on features.

**Inputs:**
- `msg.installationId` (required): The installation ID (number)
- `msg.gatewaySerial` (required): The gateway serial number (string)
- `msg.deviceId` (required): The device ID (string)
- `msg.feature` or `msg.datapoint` (required): The feature to write to (string, e.g., "heating.circuits.0.operating.modes.active")
- `msg.command` (required): The command to execute on the feature (string, e.g., "setMode", "setTemperature")
- `msg.params` (required): Parameters for the command (object, e.g., `{ mode: "dhw" }`, `{ temperature: 22 }`)

**Outputs:**
- `msg.payload`: Success status object with the following structure:
  ```json
  {
    "success": true,
    "installationId": 123456,
    "gatewaySerial": "7571381573112225",
    "deviceId": "0",
    "feature": "heating.circuits.0.operating.modes.active",
    "command": "setMode",
    "params": {
      "mode": "dhw"
    }
  }
  ```

**Understanding Commands and Parameters:**

To write data to a Viessmann device, you need to execute a command on a writable feature. Each feature may have one or more commands available, and each command requires specific parameters.

**Discovering Available Commands:**

Use the `viessmann-device-features` or `viessmann-read` node to discover which commands are available for a feature. The response includes a `commands` object that lists all executable commands and their required parameters:

```json
{
  "feature": "heating.circuits.0.operating.modes.active",
  "commands": {
    "setMode": {
      "uri": "/installations/123456/gateways/7571381573112225/devices/0/features/heating.circuits.0.operating.modes.active/commands/setMode",
      "name": "setMode",
      "isExecutable": true,
      "params": {
        "mode": {
          "type": "string",
          "required": true,
          "constraints": {
            "enum": ["standby", "dhw", "dhwAndHeating"]
          }
        }
      }
    }
  }
}
```

**Common Commands:**

- **`setMode`**: Change operation mode (e.g., standby, dhw, dhwAndHeating)
  - Parameters: `{ mode: "dhw" }`
- **`setTemperature`**: Set target temperature
  - Parameters: `{ temperature: 22 }`
- **`activate`**: Activate a feature
  - Parameters: May vary by feature
- **`deactivate`**: Deactivate a feature
  - Parameters: May vary by feature

**Error Handling:**
- Emits an error if the config node is not configured
- Emits an error if `msg.installationId` is not provided or invalid
- Emits an error if `msg.gatewaySerial` is not provided or invalid
- Emits an error if `msg.deviceId` is not provided or invalid
- Emits an error if `msg.feature` or `msg.datapoint` is not provided
- Emits an error if `msg.command` is not provided
- Emits an error if `msg.params` is not provided
- Emits an error if the API request fails (e.g., command not found, invalid parameters, network error)
- Error details are available in the debug panel

**Example Usage:**

*Setting operation mode to DHW (Domestic Hot Water):*
1. Use `viessmann-device-list` to get installation IDs
2. Use `viessmann-gateway-list` to get gateway serial numbers for an installation
3. Use `viessmann-gateway-devices` to get device IDs for a gateway
4. Use `viessmann-device-features` or `viessmann-read` to discover available features and commands
5. Pass all required parameters to `viessmann-write`

Example flow:
```javascript
// Discover available commands first
msg.installationId = 123456;
msg.gatewaySerial = "7571381573112225";
msg.deviceId = "0";
// Pass to viessmann-read or viessmann-device-features to get commands

// Then execute a command
msg.installationId = 123456;
msg.gatewaySerial = "7571381573112225";
msg.deviceId = "0";
msg.feature = "heating.circuits.0.operating.modes.active";
msg.command = "setMode";
msg.params = { mode: "dhw" };
// Returns: { success: true, installationId: 123456, ... }
```

*Setting a temperature setpoint:*
```javascript
msg.installationId = 123456;
msg.gatewaySerial = "7571381573112225";
msg.deviceId = "0";
msg.feature = "heating.circuits.0.temperature";
msg.command = "setTemperature";
msg.params = { temperature: 22 };
return msg;
```

**API Endpoint:**
- Uses `POST /iot/v2/equipment/installations/{installationId}/gateways/{gatewaySerial}/devices/{deviceId}/features/{feature}/commands/{command}` from the Viessmann API
- Base URL: `https://api.viessmann-climatesolutions.com`

## Usage

1. Add a `viessmann-config` node and configure your API credentials
2. Use `viessmann-device-list` to discover available installations
3. Use `viessmann-gateway-list` to list gateways for a specific installation
4. Use `viessmann-gateway-devices` to list devices attached to a gateway
5. Use `viessmann-device-features` to list all available features/services for a device
6. Use `viessmann-read` to read data from device features
7. Use `viessmann-write` to control device parameters

## Examples

Practical example flows are available in the [examples/](examples/) directory:

- **[Complete Discovery Flow](examples/01-complete-discovery-flow.json)** - Discover installations, gateways, devices, and features
- **[Read DHW Temperature](examples/02-read-dhw-temperature.json)** - Read domestic hot water temperature sensors
- **[Control DHW On/Off](examples/03-control-dhw-onoff.json)** - Turn domestic hot water on and off
- **[Control Heating On/Off](examples/04-control-heating-onoff.json)** - Control heating circuit operating modes

See the [examples README](examples/README.md) for detailed instructions on importing and using these flows.

## Available Features

The Viessmann API provides hundreds of features for monitoring and controlling your heating system. See [FEATURES.md](FEATURES.md) for a comprehensive list of available features including:

- **Device features**: Information, status, configuration, sensors, maintenance
- **Gateway features**: Connection status, device lists, WiFi information
- **Heating features**: Boiler, buffer, burners, circuits, DHW, power consumption, and more

Not all features are available on all devices. Use the `viessmann-device-features` node to discover what your specific device supports.

## Development

### For Contributors

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup instructions
- Coding standards and best practices
- Testing guidelines
- Pull request process
- Documentation requirements

### Test Strategy

The module uses **Mocha** and **Chai** for unit testing with **Sinon** for mocking and **Nock** for HTTP mocking.

**Running tests:**
```bash
npm test
```

**Test coverage:**
- All nodes have comprehensive unit tests
- Tests cover happy path, error handling, and edge cases
- HTTP requests are mocked to avoid requiring real API access
- Tests use the `node-red-node-test-helper` for Node-RED specific testing

**Key test areas:**
- Authentication and token refresh
- API request handling
- Input validation
- Error handling and messaging
- Node status updates

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed testing guidelines.

### Code Style

The project follows standard JavaScript conventions:
- **Indentation**: 4 spaces
- **Async operations**: async/await preferred
- **Error handling**: Always provide helpful, actionable error messages
- **Node status**: Keep users informed with status updates
- **Documentation**: Update help text when changing node behavior

### Project Structure

```
node-red-contrib-viessmann/
├── nodes/                      # Node implementations
│   ├── viessmann-config.js    # OAuth2 configuration
│   ├── viessmann-read.js      # Read node
│   ├── viessmann-write.js     # Write node
│   └── ...                    # Other nodes
├── test/                       # Unit tests
├── examples/                   # Example flows
├── scripts/                    # Utility scripts
├── README.md                   # This file
├── SPEC.md                     # Functional specification
├── FEATURES.md                 # API features reference
└── CONTRIBUTING.md             # Contribution guidelines
```

### Functional Specification

See [SPEC.md](SPEC.md) for detailed functional specifications including:
- Node designs and requirements
- Authentication flow
- API integration patterns
- Error handling strategies

## Continuous Integration

This project uses GitHub Actions for continuous integration. The CI workflow automatically:

- Runs on all pushes and pull requests to `main` and `feature/**` branches
- Sets up Node.js version 20 (as specified in `package.json` engines field)
- Installs dependencies using `npm ci`
- Runs the linter (if `npm run lint` is configured)
- Runs the test suite (if `npm test` is configured)
- Runs the build process (if `npm run build` is configured)

The workflow will fail if any configured step fails. If linter or test scripts are not yet configured, the workflow will pass with a warning message encouraging their addition.

To run these checks locally:
```bash
npm install
npm run lint   # if configured
npm test       # if configured
npm run build  # if configured
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Author

Paweł Kot

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
