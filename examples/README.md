# Example Flows

This directory contains example Node-RED flows demonstrating how to use the Viessmann module.

## How to Import Examples

1. Open Node-RED in your browser
2. Click the hamburger menu (☰) in the top right
3. Select **Import**
4. Choose **select a file to import** and browse to one of the JSON files in this directory
5. Click **Import** to add the flow to your workspace

Alternatively, you can copy the JSON content and paste it into the import dialog.

## Before You Start

All examples require:
1. A configured `viessmann-config` node with valid credentials
2. Your actual device parameters (installation ID, gateway serial, device ID)

### Getting Your Device Parameters

Use the **01-complete-discovery-flow.json** to discover your device parameters:
- Installation IDs
- Gateway serial numbers
- Device IDs
- Available features

Once you have these values, update the function nodes in the other examples with your actual parameters.

## Available Examples

### 01-complete-discovery-flow.json
**Complete Discovery Flow**

Demonstrates the full device discovery process:
1. List all installations for your account
2. List all gateways for an installation
3. List all devices on a gateway
4. List all features available on a device

Use this flow first to discover your device parameters and available features.

### 02-read-dhw-temperature.json
**Read DHW Temperature**

Shows how to read Domestic Hot Water (DHW) temperature from your device.

**Features demonstrated:**
- Reading current DHW sensor temperature
- Reading target DHW temperature
- Extracting temperature values from API responses
- Displaying formatted temperature in debug output

**Common DHW temperature features:**
- `heating.dhw.sensors.temperature.dhwCylinder`
- `heating.dhw.sensors.temperature.dhwCylinder.top`
- `heating.dhw.sensors.temperature.hotWaterStorage`
- `heating.dhw.sensors.temperature.outlet`
- `heating.dhw.temperature.main` (target temperature)

### 03-control-dhw-onoff.json
**Control DHW On/Off**

Demonstrates how to turn Domestic Hot Water on and off.

**Features demonstrated:**
- Turning DHW on (various modes: comfort, eco, balanced)
- Turning DHW off
- Using heating circuit modes (DHW only, DHW + heating, standby)
- Reading back current mode to verify the change

**Common DHW operating mode features:**
- `heating.dhw.operating.modes.active`
- `heating.circuits.0.operating.modes.active`

**Common commands:**
- `setMode` with params like `{ mode: "dhw" }`, `{ mode: "off" }`

### 04-control-heating-onoff.json
**Control Heating On/Off**

Shows how to control heating circuit operating modes.

**Features demonstrated:**
- Turning heating on (with DHW)
- Turning heating off (DHW only)
- Setting standby mode (all off)
- Setting target temperature
- Reading back current mode after changes

**Common heating circuit features:**
- `heating.circuits.0.operating.modes.active`
- `heating.circuits.0.heating.curve`

**Common operating modes:**
- `standby` - Everything off
- `dhw` - Only DHW, heating off
- `dhwAndHeating` - Both DHW and heating active
- `forcedReduced` - Reduced heating mode
- `forcedNormal` - Normal heating mode

## Important Notes

### Device-Specific Features

Different Viessmann devices expose different features and commands. The feature names and available modes in these examples are common patterns, but **your device may use different names**.

**Always use the device-features node first** to discover:
- Exact feature names for your device
- Available commands for each feature
- Required parameters and their constraints
- Valid enum values for mode parameters

### Circuit Numbers

Most systems have multiple heating circuits numbered from 0:
- `heating.circuits.0.*` - First heating circuit
- `heating.circuits.1.*` - Second heating circuit
- `heating.circuits.2.*` - Third heating circuit

Replace `0` with your actual circuit number in the examples.

### Rate Limiting

The Viessmann API has rate limits. Avoid:
- Polling too frequently (recommended: no more than once per minute)
- Making too many concurrent requests
- Repeatedly writing the same value

### Error Handling

All examples include debug nodes showing the API responses. Check these for:
- Validation errors (invalid parameters)
- Feature not found errors
- Permission errors
- Rate limit errors

## Customizing Examples

### Update Device Parameters

In each flow, look for function nodes with "TODO" comments. Replace the placeholder values with your actual:
- Installation ID (e.g., 123456)
- Gateway serial (e.g., "7571381573112225")
- Device ID (e.g., "0")
- Feature names (discovered using device-features node)

### Example Parameter Update

```javascript
// Before (placeholder):
msg.installationId = 123456;
msg.gatewaySerial = "7571381573112225";
msg.deviceId = "0";

// After (your actual values):
msg.installationId = 987654;
msg.gatewaySerial = "1234567890123456";
msg.deviceId = "0";
```

## Getting Help

1. **Check the README.md** in the main directory for detailed API documentation
2. **Use the device-features node** to discover what's available on your device
3. **Enable debug logging** in the viessmann-config node for troubleshooting
4. **Check the Viessmann API documentation**: 
   - [Viessmann API Documentation Portal](https://api.viessmann-climatesolutions.com/documentation) (requires login to Viessmann Developer Portal)
   - [Viessmann API Base](https://api.viessmann-climatesolutions.com/)
5. **Report issues** on GitHub: https://github.com/pkot/node-red-contrib-viessmann/issues

## Additional Resources

- [Node-RED Documentation](https://nodered.org/docs/)
- [Viessmann API Documentation](https://api.viessmann-climatesolutions.com/documentation) (requires login to Viessmann Developer Portal)
- [Viessmann Developer Portal](https://developer.viessmann.com/)

## Contributing

Have a useful example flow? Contributions are welcome! Please submit a pull request with:
- A descriptive JSON filename (e.g., `05-my-useful-flow.json`)
- Clear comments in the flow explaining what it does
- Documentation in this README
