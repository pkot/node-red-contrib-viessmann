# node-red-contrib-viessmann

[![CI](https://github.com/pkot/node-red-contrib-viessmann/actions/workflows/ci.yml/badge.svg)](https://github.com/pkot/node-red-contrib-viessmann/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Node-RED module for integrating Viessmann heating devices via the official Viessmann SaaS API.

## Features

- **OAuth2 Authentication**: Authorization Code with PKCE for token bootstrap (via the bundled CLI), refresh-token grant at runtime; tokens stored securely via Node-RED credentials
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

## Quick start

1. **Get a Client ID** from the [Viessmann Developer Portal](https://developer.viessmann.com/) (My Dashboard → Your clients). Set redirect URI to `http://localhost:4200/`. No client secret is issued.

2. **Mint tokens** via the bundled CLI:

   ```bash
   npx --package node-red-contrib-viessmann viessmann-get-tokens
   ```

   This writes `viessmann-tokens.json` (mode 0600) in the current directory.
   For options, env vars, and a manual fallback, see [scripts/README.md](scripts/README.md).

3. **Drag a `viessmann-config` node** into your flow, paste in the Client ID + tokens from the file, then delete the file.

4. **Wire your flow** using the discovery / read / write nodes. Per-node `msg` shapes and API endpoints → [nodes/README.md](nodes/README.md).

## Nodes at a glance

| Node | Purpose |
|---|---|
| `viessmann-config` | OAuth2 credentials + token refresh (shared by all other nodes) |
| `viessmann-device-list` | List accessible installations |
| `viessmann-gateway-list` | List gateways for an installation |
| `viessmann-gateway-devices` | List devices attached to a gateway |
| `viessmann-device-features` | List features available on a device |
| `viessmann-read` | Read a feature value (or all features) |
| `viessmann-write` | Execute a command on a writable feature |

Detailed inputs / outputs / error behavior / endpoints → [nodes/README.md](nodes/README.md).

## Examples

Example flows live in [examples/](examples/):

- **[Complete Discovery Flow](examples/01-complete-discovery-flow.json)** — installations → gateways → devices → features
- **[Read DHW Temperature](examples/02-read-dhw-temperature.json)**
- **[Control DHW On/Off](examples/03-control-dhw-onoff.json)**
- **[Control Heating On/Off](examples/04-control-heating-onoff.json)**

See [examples/README.md](examples/README.md) for the import walkthrough.

## Available features

The Viessmann API exposes hundreds of features organised under `device.*`, `gateway.*`, and `heating.*` namespaces. Feature availability varies by model, firmware, and installation — the authoritative list for **your** device is what the `viessmann-device-features` node returns at runtime. For the canonical reference, see Viessmann's [Developer Portal](https://developer.viessmann.com/) (account required).

## Development

These docs live on GitHub (not shipped to npm to keep the published
tarball small):

- Setup, coding standards, PR process → [CONTRIBUTING.md](https://github.com/pkot/node-red-contrib-viessmann/blob/main/CONTRIBUTING.md)
- Test framework, fixtures, coverage → [test/README.md](https://github.com/pkot/node-red-contrib-viessmann/blob/main/test/README.md)
- Token bootstrap CLI details → [scripts/README.md](scripts/README.md)
- Intent and architecture decisions → [SPEC.md](https://github.com/pkot/node-red-contrib-viessmann/blob/main/SPEC.md)
- Conventions / patterns for coding agents → [AGENTS.md](https://github.com/pkot/node-red-contrib-viessmann/blob/main/AGENTS.md)

## Building from source

```bash
git clone https://github.com/pkot/node-red-contrib-viessmann.git
cd node-red-contrib-viessmann
npm install
npm pack          # runs lint + tests, produces a .tgz
```

Install the resulting tarball on a Node-RED server:

```bash
cd ~/.node-red
npm install /path/to/node-red-contrib-viessmann-0.1.0.tgz
```

Restart Node-RED; the Viessmann nodes appear in the palette.

## Continuous integration

`.github/workflows/ci.yml` runs on push and PR against `main`, matrix-testing on Node 20.x / 22.x / 24.x (minimum `engines.node` is 20.19.0). Node 26 is excluded for now because yargs (a transitive `c8` dep) trips on its stricter ESM resolution.

To reproduce locally:

```bash
npm run lint
npm test
```

## License

MIT — see [LICENSE](LICENSE).

## Author

Paweł Kot

## Contributing

Bug reports, feature requests, and pull requests welcome. See [CONTRIBUTING.md](https://github.com/pkot/node-red-contrib-viessmann/blob/main/CONTRIBUTING.md) for the workflow.
