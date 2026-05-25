# Tests

## Stack

| Tool | Role |
|---|---|
| **mocha** | Test runner. Mocha is the source of truth — there is no jest. |
| **chai** (BDD `expect`) | Assertions. Use `expect(x).to.equal(y)` style. |
| **sinon** | Stubs, spies, fake timers when needed. |
| **nock** | HTTP mocking. Every test that exercises an axios call must mock it via nock. |
| **node-red-node-test-helper** | Spins up a real Node-RED runtime per test. Use for integration tests; bypass for pure helpers. |
| **c8** | Coverage runner (V8-native). Configured in `.c8rc.json`. |

## Running

```bash
npm test           # mocha + c8 coverage, enforces threshold
npm run test:nocov # mocha only, faster, no coverage; use for debugging
npm run lint
```

To run a single file or pattern (mocha treats extra positional args as
*additional* globs to the `test/**/*_spec.js` set, not as a replacement —
use `npx mocha` directly to scope down):

```bash
npx mocha test/viessmann-read_spec.js          # one file
npx mocha --grep "validateViessmannRef"        # by pattern (uses default glob)
npx c8 mocha test/viessmann-read_spec.js       # one file with coverage
```

## Coverage

`.c8rc.json` enforces these floors. `npm test` exits non-zero if any drop:

| Metric | Floor |
|---|---|
| Statements | 70% |
| Branches | 70% |
| Functions | 70% |
| Lines | 70% |

Current numbers are well above (94 / 87 / 96 / 94 as of this writing).
`coverage/index.html` is the local browse-able report.

## Layout

```
test/
├── support/
│   └── fixtures.js                  # SHARED FIXTURES — use these first
├── client_spec.js                   # ViessmannClient (pure, no Node-RED helper)
├── feature-schema_spec.js           # Schema validator (pure)
├── format-feature-status_spec.js    # formatFeatureStatus (pure, table-driven)
├── viessmann-helpers_spec.js        # Validators, format, runtime helpers (pure)
├── viessmann-config_spec.js         # Config node (integration via test-helper)
├── viessmann-device-list_spec.js    # ...
├── viessmann-device-features_spec.js
├── viessmann-gateway-devices_spec.js
├── viessmann-gateway-list_spec.js
├── viessmann-read_spec.js
└── viessmann-write_spec.js
```

Pure-function specs sit at the top of the list and run without spinning up
Node-RED. Integration specs (`viessmann-*_spec.js`) use the helper.

## Fixtures

`test/support/fixtures.js` exports the things every spec used to inline:

| Export | Purpose |
|---|---|
| `DEFAULT_CLIENT_ID`, `DEFAULT_ACCESS_TOKEN`, `DEFAULT_REFRESH_TOKEN` | Stable test credential strings. |
| `makeCredentials(nodeId?, overrides?)` | Build the `{ [nodeId]: {...} }` object that `helper.load(...)` wants. Default `nodeId='c1'`. |
| `makeFlow(nodeType, opts)` | Two-node flow (`c1` config + `n1` consumer), optional `n2` helper sink. |
| `mockTokenRefresh(bodyOverride?)` | `nock` interceptor for `POST /idp/v3/token`. |
| `mockApiGet(path, status, body, headers?)` | `nock` interceptor for an API GET. |
| `mockApiPost(path, status, body, headers?)` | Same for POST. |
| `captureNodeStatus(node)` | Wraps `node.status` and returns the captured calls array. |
| `useNodeRedHelper(helper)` | Registers the start/stop/cleanAll hooks on the current `describe` block. Call once per spec. |

Use them. Don't paste the 8-line "default credentials" block into a new
spec.

## Writing a new test

Most consumer-node tests follow this shape:

```javascript
const helper = require('node-red-node-test-helper');
const { expect } = require('chai');
const nock = require('nock');
const myNode = require('../nodes/viessmann-X.js');
const configNode = require('../nodes/viessmann-config.js');
const { makeCredentials, useNodeRedHelper } = require('./support/fixtures');

helper.init(require.resolve('node-red'));

describe('viessmann-X Node', function() {
    useNodeRedHelper(helper);

    it('does the thing', function(done) {
        const flow = [
            { id: 'c1', type: 'viessmann-config' },
            { id: 'n1', type: 'viessmann-X', config: 'c1', wires: [['n2']] },
            { id: 'n2', type: 'helper' }
        ];

        nock('https://api.viessmann-climatesolutions.com')
            .get('/iot/v2/...')
            .reply(200, { data: [/* ... */] });

        helper.load([configNode, myNode], flow, makeCredentials(), function() {
            const n1 = helper.getNode('n1');
            const n2 = helper.getNode('n2');

            n2.on('input', function(msg) {
                try {
                    expect(msg.payload).to.be.an('array');
                    done();
                } catch (err) { done(err); }
            });

            n1.receive({ /* msg */ });
        });
    });
});
```

For pure helpers, skip the test-helper entirely:

```javascript
const { expect } = require('chai');
const { formatFeatureStatus } = require('../nodes/lib/format');

describe('formatFeatureStatus', function() {
    it('renders value+unit', function() {
        expect(formatFeatureStatus({ value: { value: 21.5, unit: 'celsius' } }))
            .to.equal('21.5celsius');
    });
});
```

## Patterns to follow

- **Mock at the boundary.** `nock` for HTTP. Don't stub `axios` or
  `node.config.client.get` — the existing tests prove the whole stack works
  end-to-end, including retry/refresh/abort logic.
- **One assertion intent per test.** Use table-driven tests for combinatorial
  cases (see `format-feature-status_spec.js`).
- **`done(err)` not `throw`** inside async callbacks — assertion failures
  in `.then`/`.catch` and event handlers must be caught or Mocha will hang.
  Wrap the body in `try { ... done(); } catch (err) { done(err); }`.
- **Tests that assert "this never gets called"** — use `helper.unload()` and
  check side-effect counters, not `setTimeout(... done())` to "give it time".
- **HTTP-date tests** — use future offsets ≥ 60 seconds. 2s windows are
  flaky on slow CI.
- **`nock.cleanAll()` in afterEach** is handled by `useNodeRedHelper`; don't
  duplicate it.

## What NOT to do

- ❌ Don't add `nock` mocks for hosts you don't intend to hit. Dead mocks
  are silently ignored and rot. (See issue #65 history.)
- ❌ Don't seed `tokenExpiry` to `Date.now() + 1h` to skip refresh —
  tests should reflect real behavior; if you need a fresh token, mock the
  refresh endpoint.
- ❌ Don't write integration tests for things a pure unit test covers.
  9 integration tests for `formatFeatureStatus` collapsed to 1 unit + 1
  smoke after PR #138.
