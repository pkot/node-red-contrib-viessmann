# AGENTS.md

Project-specific context for coding agents (Claude Code, GitHub Copilot, etc.)
working in this repo. This is **not** a substitute for `CONTRIBUTING.md`; it's
the operational layer that captures conventions and patterns this codebase
has converged on, so an agent doesn't have to re-derive them from scratch
each session.

## Build, lint, test

```bash
npm ci --prefer-offline --no-audit --no-fund   # cold install
npm run lint                                   # eslint, must be clean
npm test                                       # mocha + c8 coverage, enforces 70% floor
npm run test:nocov                             # mocha only; faster, no coverage
```

`prepack` runs lint + tests. Use `npm pack` to build the publishable tarball.

Node version floor is **20.19.0** (`engines.node` in package.json). CI
matrix tests 20.x / 22.x / 24.x — Node 26 is currently excluded due to
an upstream `yargs` ESM-resolution bug under c8.

## Layout — where things live

```
nodes/
├── lib/
│   ├── client.js          # ViessmannClient — HTTP, retry, token refresh,
│   │                        cache, in-flight dedup, throttle, abort
│   ├── validators.js      # Input validators (msg.installationId etc.) +
│   │                        viessmannRefSource + validateViessmannRef
│   ├── format.js          # extractErrorMessage, actionableStatusHint,
│   │                        truncateForStatus, formatFeatureStatus
│   ├── node-runtime.js    # Node-RED glue: initializeViessmannNode,
│   │                        executeApiGet/Post, surfaceUnexpectedError,
│   │                        AbortController tracking
│   ├── define-get-node.js # Declarative factory for read-only nodes
│   └── feature-schema.js  # validateWriteAgainstSchema (opt-in via config)
├── viessmann-config.js    # Config node — token state, client construction
├── viessmann-helpers.js   # 50-line BARREL RE-EXPORT of the above lib/ modules
├── viessmann-device-list.js          # defineGetNode call
├── viessmann-gateway-list.js         # defineGetNode call
├── viessmann-gateway-devices.js      # defineGetNode call
├── viessmann-device-features.js      # defineGetNode call
├── viessmann-read.js      # Hand-rolled (custom payload pipeline)
└── viessmann-write.js     # Hand-rolled (POST + optional schema check)

test/support/fixtures.js   # SHARED TEST FIXTURES — use these
```

`viessmann-helpers.js` is just a re-export. New code can `require('./lib/X')`
directly. Existing imports from `./viessmann-helpers` still work and don't
need to migrate just for the sake of it.

## Architecture in one paragraph

A user's flow injects a `msg` into a consumer node (`viessmann-read`,
`-write`, `-device-list`, etc.). The consumer validates `msg` via
`lib/validators.js` (short-circuit on first failure), then asks the
config node's shared `ViessmannClient` to do the HTTP. The client owns
all transport concerns: axios instance with baseURL+timeout, 401-triggered
token refresh (deduped via an in-flight promise), 429/5xx retry with
`Retry-After` and exponential backoff, TTL cache for GETs, in-flight GET
coalescing, concurrency throttle, AbortController-cancellable. The
consumer wraps the client call in a UI layer (`executeApiGet/Post` in
`lib/node-runtime.js`) that updates `node.status`, surfaces errors via
`node.error(msg, originatingMsg)` so Catch nodes route correctly, and
tracks the AbortController on the node so `node.on('close', ...)` can
cancel in-flight work on redeploy.

## Conventions

### Adding a new node

If it's a read-only GET endpoint shaped like the existing discovery nodes,
use the `defineGetNode` factory:

```javascript
const { defineGetNode } = require('./lib/define-get-node');
const { validateConfigNode, validateXyz } = require('./lib/validators');

module.exports = function(RED) {
    defineGetNode(RED, {
        type: 'viessmann-my-new-node',
        getContext: (node, msg) => {
            if (!validateConfigNode(node, msg)) return null;
            const xyz = validateXyz(node, msg);
            if (!xyz) return null;
            return { xyz };
        },
        url: ({ xyz }) => `/iot/v2/.../${encodeURIComponent(xyz)}`,
        statusText: 'fetching...',
        errorPrefix: 'Failed to fetch X'
    });
};
```

For nodes that POST or that have a non-trivial payload pipeline (status
text derivation, multi-call orchestration), hand-roll the input handler
following the `viessmann-read.js` / `viessmann-write.js` pattern:
validators first, then `executeApiGet/Post` in its own try (catch +
return), then payload-shaping in a second try (catch through
`surfaceUnexpectedError`).

### Adding a new validator

`lib/validators.js`. Match the existing shape:

- Return the validated value (or `null` on failure).
- On failure, call `node.status({fill:'red',...})` and
  `node.error(text, msg)`. The `msg` second arg is what routes a Catch node.
- Trim whitespace, reject non-string types, reject empty strings —
  consistent across all validators.

### Adding a new HTTP behavior

Goes on `ViessmannClient` in `lib/client.js`, not in the consumer node.
The client is the single place transport concerns live. Examples already
there: retry, refresh, cache, dedup, throttle, abort.

### Error messages

- Use `node.error(text, originatingMsg)`. Without `originatingMsg`,
  downstream Catch nodes can't route the error.
- For non-axios errors thrown in payload-processing, call
  `surfaceUnexpectedError(node, msg, error)` — it sets a red status and
  routes correctly.
- `node.warn(...)` for soft anomalies (token expiry missing, params object
  empty, unexpected response shape) — Catch doesn't fire, but the editor
  sidebar surfaces it.
- `node.error(text)` with no msg arg = no Catch routing; intentionally
  avoid this in code that runs in response to an input.

### msg conventions

Two ways to pass installation/gateway/device IDs:

```javascript
// Preferred bundle shape (one upstream node emits it; downstream nodes consume wholesale):
msg.viessmann = { installationId: 1, gatewaySerial: 'GW', deviceId: '0' }

// Legacy individual fields (still supported):
msg.installationId = 1
msg.gatewaySerial = 'GW'
msg.deviceId = '0'
```

`validateViessmannRef(node, msg)` handles both. `viessmannRefSource(msg)`
returns the source object (msg or a clone with _msgid preserved).

### Tests

See `test/README.md` for the full guide. Key conventions:

- mocha + chai BDD + sinon + nock + node-red-node-test-helper. No jest.
- Use `test/support/fixtures.js`; don't paste the credentials block into a
  new spec.
- Pure helpers get table-driven unit tests; consumer nodes get one
  integration test per shape, not nine.
- Wrap assertions in async callbacks in `try { ... done(); } catch (err) { done(err); }`.

## Patterns to use

### Status-icon updates

```javascript
node.status({fill: 'yellow', shape: 'ring', text: 'fetching...'});  // in-flight
node.status({fill: 'green', shape: 'dot', text: 'success'});         // ok
node.status({fill: 'red', shape: 'dot', text: truncateForStatus(msg)}); // error
```

`truncateForStatus` caps at 30 chars with an ellipsis. Use it for any
error text going to status.

### AbortController per request

`executeApiGet/Post` already does this. If you call `node.config.client`
directly (e.g., the write node's pre-flight schema GET), do it manually:

```javascript
const ctrl = new AbortController();
node._inflightAbortControllers.add(ctrl);
try {
    const r = await node.config.client.get(url, { signal: ctrl.signal });
    ...
} finally {
    node._inflightAbortControllers.delete(ctrl);
}
```

### Auth state subscription

```javascript
node.config.on('auth-state', (snapshot) => node.updateStatus(snapshot));
// On close:
node.config.off('auth-state', listener);
```

`setupDependentNode` does this for you; only invoke manually if you have
a special case.

## What NOT to do

- ❌ Don't reach into `node.config.authState` / `node.config.authError`
  directly — use `node.config.getAuthSnapshot()` or subscribe to
  `auth-state`.
- ❌ Don't call `axios` directly from a consumer node. Use
  `node.config.client` (or `executeApiGet/Post` for the UI-wrapped form).
- ❌ Don't duplicate inline validation. Extract to `lib/validators.js`.
- ❌ Don't print tokens to stdout (`scripts/get-viessmann-tokens.js`
  writes to a 0600 file).
- ❌ Don't log full request/response bodies in debug mode —
  `node.config.debugLog(...)` is gated on the user's checkbox but should
  still avoid logging secrets. The token-refresh path explicitly redacts.
- ❌ Don't add unbounded `>=` overrides in `package.json`. Scope to a
  major range (`^x.y.z`) so a future major doesn't break the API
  upstream code expects.
- ❌ Don't make `npm test` slower than 5s. Mock setTimeout if you need to
  exercise retry/backoff logic; don't actually sleep.

## Issue / PR workflow (what worked in practice)

This repo's 46-issue refactor cycle established a working rhythm:

1. **One issue → one branch → one PR**, even for trivial fixes. Squash-merge.
2. PR body has: Summary (what changed), Why (root cause), Internal
   review (code quality / architecture / security / error handling),
   Test plan. Keeps PRs reviewable cold.
3. Copilot PR review is part of the loop. It catches real bugs (e.g.,
   `tokenExpiry = 0` falsy short-circuit, `Number(env) || default` accepting
   garbage, missing TDZ guards on `let` after a closure read). Address
   substantive comments, merge through advisory ones.
4. CI is green-or-fail. No "merge despite red" without a comment.
5. Co-author trailer on commits made with agent assistance:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## Where to find things

- **Decisions** → `SPEC.md` (intent + architecture)
- **User-facing per-node I/O** → each node's `*.html` help (rendered in
  the Node-RED editor sidebar). Source of truth for what `msg` fields
  each node consumes/emits.
- **Feature names** → query the `viessmann-device-features` node at
  runtime; canonical reference is Viessmann's
  [Developer Portal](https://developer.viessmann.com/)
- **Test patterns** → `test/README.md` + `test/support/fixtures.js`
- **Token bootstrap** → `scripts/README.md`
