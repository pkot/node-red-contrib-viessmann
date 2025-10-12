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

## License

MIT License - see [LICENSE](LICENSE) file for details

## Author

Paweł Kot

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
