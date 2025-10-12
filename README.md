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

**Configuration:**
1. **Name** (optional): A friendly name for this configuration
2. **Client ID** (required): Your Viessmann API client ID
3. **Client Secret** (required): Your Viessmann API client secret

**How to obtain API credentials:**
1. Visit the [Viessmann Developer Portal](https://developer.viessmann.com/)
2. Register or log in to your developer account
3. Create a new application to receive your client ID and client secret
4. The credentials will be stored securely using Node-RED's credential system

**Authentication Details:**
- Uses OAuth2 client credentials flow
- Automatically handles token refresh before expiration
- Tokens are cached in memory and automatically renewed when needed
- Token endpoint: `https://iam.viessmann.com/idp/v3/token`

### Device Discovery Node: `viessmann-device-list`
Lists all accessible Viessmann installations, gateways, devices, and their features.

**Outputs:**
- `msg.payload`: Array of discovered devices/features with IDs and metadata

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
- Sets up Node.js version 14 (as specified in `package.json` engines field)
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
