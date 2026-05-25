# Contributing to node-red-contrib-viessmann

Thanks for considering a contribution. This document covers the workflow.
For the operational details (testing, project layout, conventions) see:

- [test/README.md](test/README.md) — test framework, fixtures, coverage
- [AGENTS.md](AGENTS.md) — project layout, conventions, patterns
- [scripts/README.md](scripts/README.md) — token-bootstrap CLI
- [SPEC.md](SPEC.md) — intent and architecture

## Code of Conduct

- Be respectful and inclusive.
- Focus on constructive feedback.
- Help others learn.
- Keep communication professional.

## Development setup

### Prerequisites

- Node.js **>= 20.19.0** (matches `engines.node` in `package.json`).
- npm 10+ (bundled with Node 20+).
- Node-RED 4.x for local manual testing.

### Getting started

```bash
git clone https://github.com/pkot/node-red-contrib-viessmann.git
cd node-red-contrib-viessmann
npm ci
npm run lint
npm test
```

For local manual testing in Node-RED:

```bash
cd ~/.node-red
npm install /path/to/node-red-contrib-viessmann
node-red
# Open http://localhost:1880, the Viessmann nodes appear in the palette.
```

Restart Node-RED after code changes (or use `--watch`).

## Coding standards

- 4-space indent, single quotes, semicolons, `async/await` over raw promises.
- camelCase for vars/functions; UPPER_SNAKE_CASE for true module constants.
- Validate inputs at the boundary (`lib/validators.js`); error with
  `node.error(text, originatingMsg)` so a Catch node routes correctly.
- HTTP work goes through `node.config.client` (the `ViessmannClient` in
  `nodes/lib/client.js`) — don't import `axios` in a consumer node.
- New behavior needs a test. See [test/README.md](test/README.md).
- Update each node's `*.html` help block when its `msg` contract changes.
  Each node's HTML is the source of truth for per-node I/O.

See [AGENTS.md](AGENTS.md) for the project's conventions in more depth —
where things live, which patterns to use, and the most common
"don't do this" cases.

## Submitting changes

### Before opening a PR

```bash
npm run lint
npm test
```

Both must pass. Test the change manually in Node-RED if it's user-facing.

### Commits

- First line: brief summary, imperative ("Add X", not "Added X").
- Blank line.
- Body explains *why*, not what the diff already shows.
- Group related changes; avoid mixing concerns in a single commit.

### Pull request

```bash
git checkout -b fix/issue-N-short-name      # or feat/, chore/, docs/
git push origin fix/issue-N-short-name
gh pr create --base main
```

PR body should cover:

- **Summary** — what changed
- **Why** — root cause if it's a fix
- **Test plan** — what you verified, what you didn't
- **Linked issue** if any

PRs get a Copilot review by default. Address substantive comments; merge
through advisory ones. CI must be green.

## Documentation

- **`README.md`** — install + per-node API reference. Update when adding a
  node, changing `msg` contracts, or renaming the package's public surface.
- **Per-node `*.html`** — help block in the Node-RED editor; the source
  of truth for what each node consumes / emits.
- **`SPEC.md`** — design decisions and architecture. Update if you change
  an architectural invariant (e.g., move where transport lives).
- **`FEATURES.md`** — non-authoritative catalog of Viessmann features.
  Update when the upstream catalog meaningfully changes.
- **Example flows** under `examples/` — add when introducing a new common
  user pattern; name `NN-descriptive-name.json`.

## Release process

Releases are managed by the maintainer.

1. Version bump per [SemVer](https://semver.org/) (MAJOR / MINOR / PATCH).
2. Tag (`git tag -a v0.X.Y -m "..."`).
3. `npm publish` — runs `prepack` (lint + tests) automatically.

## Need help?

- Bug reports / feature requests → [GitHub Issues](https://github.com/pkot/node-red-contrib-viessmann/issues)
- Security issues → contact the maintainer directly (see `package.json`).

## License

By contributing you agree your contributions are licensed under the same MIT
license as the project.
