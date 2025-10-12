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
   https://iam.viessmann-climatesolutions.com/idp/v3/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:4200/&scope=IoT%20User%20offline_access&code_challenge=YOUR_CODE_CHALLENGE&code_challenge_method=S256
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
