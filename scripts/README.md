# Scripts

## `get-viessmann-tokens.js` — PKCE bootstrap CLI

Mints the initial access + refresh tokens for the `viessmann-config` node by
running the OAuth2 Authorization Code with PKCE flow against Viessmann's IAM
endpoint. The Node-RED runtime never performs interactive authentication
itself — this script is the one-time bootstrap step.

### Prerequisites

1. A Viessmann Developer Portal account at
   [developer.viessmann.com](https://developer.viessmann.com/).
2. A registered client there. Note its **Client ID**. Viessmann's developer
   flow is a public PKCE client, so **no Client Secret is issued**.
3. The client's redirect URI must be `http://localhost:4200/` (or whatever
   port you set via `VIESSMANN_CALLBACK_PORT` below — they must match).

### Run

If the package is installed in the current project (or globally), the
bin entry is on PATH:

```bash
npx viessmann-get-tokens
```

To run it without installing first (npx downloads on demand), the package
name must be supplied explicitly because the bin name and package name
differ:

```bash
npx --package node-red-contrib-viessmann viessmann-get-tokens
```

Or from a Node-RED install:

```bash
cd ~/.node-red
node node_modules/node-red-contrib-viessmann/scripts/get-viessmann-tokens.js
```

The script prompts for your Client ID, opens your browser to Viessmann's
login, captures the redirect on a loopback callback server, exchanges the
code for tokens, and writes them to **`./viessmann-tokens.json`** (mode
`0600` on POSIX) in the current directory.

Open that file, copy the `accessToken` and `refreshToken` values into the
`viessmann-config` node in Node-RED, then delete the file.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VIESSMANN_CALLBACK_PORT` | `4200` | Port the local callback server binds to. Useful when 4200 is taken (Angular dev's default). Integer 1–65535; invalid values abort early. The redirect URI registered on the Developer Portal must match this port. |
| `VIESSMANN_SCOPE` | `IoT offline_access` | OAuth scope. `offline_access` is what makes refresh tokens issuable; drop it and you only get the 1-hour access token. |

### Security notes

- The callback server binds to `127.0.0.1` (loopback only) and rejects any
  request whose `Host` header is not `localhost:<port>` / `127.0.0.1:<port>`.
- A cryptographically random `state` parameter is generated and validated on
  the callback to block LAN/CSRF code-injection.
- The token-exchange request has a 30s timeout.
- The output file is created with `0o600` and an atomic write-then-rename so
  there is no window where the file exists with permissive permissions.
- On Windows, default NTFS ACLs apply — the script prints a reminder.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Port 4200 is already in use.` | Another process holds the port. Set `VIESSMANN_CALLBACK_PORT` to a free port and re-register the redirect URI on the Developer Portal. |
| `No authorization callback received within 5 minutes; aborting.` | You closed the browser or didn't complete the login. Re-run. |
| `Invalid authorization callback (missing code or state mismatch)` | The callback was tampered with or didn't originate from this script. Re-run and don't share the localhost URL. |
| `Token exchange failed: invalid_grant` | The authorization code expired (they last ~20 seconds) or was reused. Re-run. |

### Manual fallback

If the script can't run (no Node, no browser, sandboxed environment), you
can do the PKCE flow by hand against the same IAM endpoint
(`https://iam.viessmann-climatesolutions.com/idp/v3/authorize` and `/token`)
following the standard
[OAuth 2.0 PKCE flow](https://datatracker.ietf.org/doc/html/rfc7636).
The script's source is short and shows exactly which fields are needed.
