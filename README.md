# node-red-contrib-viessmann

A Node-RED module for integrating Viessmann heating devices via the official Viessmann SaaS API.

## Features

- **OAuth2 Authentication**: Secure authentication with Viessmann API using client credentials or device flow
- **Device Discovery**: List all accessible installations, gateways, devices, and their features
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
Stores API credentials (client_id, client_secret) securely and handles authentication/token refresh. This configuration is shared across all Viessmann nodes.

#### Required Setup - Viessmann Developer Portal

**Before using this module, you MUST complete the following steps:**

1. **Register at the Viessmann Developer Portal**
   - Visit [Viessmann Developer Portal](https://developer.viessmann.com/)
   - Log in with your Viessmann account (the same account you use for the ViCare app)

2. **Create an Application**
   - In the Developer Portal, create a new application (or use an existing one)
   - Give it a meaningful name (e.g., "Node-RED Integration")

3. **Configure Application Settings** ⚠️ **CRITICAL**
   - **Redirect URI**: Set to `http://localhost:4200/auth/callback` (or as specified in Viessmann documentation)
   - **Scopes**: You MUST select the following scopes:
     - `IoT User` - Required for accessing your device data
     - `offline_access` - Required for token refresh capability
   - Some applications may require additional configuration (reCAPTCHA settings, etc.) - follow the Developer Portal instructions

4. **Get Your Credentials**
   - After creating/configuring your application, note your **Client ID** and **Client Secret**
   - Keep these credentials secure - you'll need them to configure the Node-RED config node

5. **Complete User Authorization (if required)**
   - Depending on your application type, you may need to complete a manual authorization/consent step
   - This typically involves authorizing your application to access your Viessmann account data
   - Check the Developer Portal for any pending authorization requests or instructions

#### Configuration in Node-RED

1. **Name** (optional): A friendly name for this configuration
2. **Client ID** (required): Your Viessmann API client ID from the Developer Portal
3. **Client Secret** (required): Your Viessmann API client secret from the Developer Portal
4. **OAuth2 Scopes** (required): Space-separated scopes - default is `IoT User offline_access`
   - **Do not change this** unless you know what you're doing
   - Must match the scopes configured in your Developer Portal application
5. **Enable Debug Logging** (optional): Enable for troubleshooting authentication issues

#### Authentication Details
- Uses OAuth2 client credentials flow
- Automatically handles token refresh before expiration
- Tokens are cached in memory and automatically renewed when needed
- Token endpoint: `https://iam.viessmann.com/idp/v3/token`

#### Common Authentication Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Unauthorized client` or `invalid_client` | Incorrect credentials or app not properly configured | Verify your Client ID and Client Secret match exactly what's shown in the Developer Portal |
| `Invalid scope` | Scope mismatch | Ensure you selected `IoT User` and `offline_access` scopes when creating your app in the Developer Portal |
| `Access denied` | Missing authorization/consent | Complete any pending authorization steps in the Developer Portal; ensure your Viessmann account is linked to the application |
| `unauthorized_client` | Application configuration issue | Check that your app has correct redirect URIs and scopes configured in the Developer Portal |

#### References
- [Viessmann API Authentication Documentation](https://api.viessmann-climatesolutions.com/documentation/static/authentication)
- [Viessmann Developer Portal](https://developer.viessmann.com/)

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

### Data Read Node: `viessmann-read`
Reads specific data points from a selected device.

**Inputs:**
- `msg.deviceId` (required)
- `msg.feature` or `msg.datapoint` (optional: what to read)

**Outputs:**
- `msg.payload`: Value(s) read from the device/feature

### Data Write Node: `viessmann-write`
Sets values for writable device parameters.

**Inputs:**
- `msg.deviceId` (required)
- `msg.feature` or `msg.datapoint` (required)
- `msg.value` (required: new value to set)

**Outputs:**
- `msg.payload`: API response or success/failure status

## Usage

1. Add a `viessmann-config` node and configure your API credentials
2. Use `viessmann-device-list` to discover available devices
3. Use `viessmann-read` to read data from devices
4. Use `viessmann-write` to control device parameters

## Development

This module is under active development. See [SPEC.md](SPEC.md) for detailed functional specifications.

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
