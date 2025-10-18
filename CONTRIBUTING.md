# Contributing to node-red-contrib-viessmann

Thank you for your interest in contributing to the Node-RED Viessmann module! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

This project follows a simple code of conduct:
- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain professional communication

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/node-red-contrib-viessmann.git
   cd node-red-contrib-viessmann
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/pkot/node-red-contrib-viessmann.git
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Node-RED (for testing nodes)

### Installation

```bash
# Install dependencies
npm install

# Link the module to Node-RED for local testing
cd ~/.node-red
npm install /path/to/node-red-contrib-viessmann
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (if configured)
npm run test:watch

# Run specific test file
npm test -- test/viessmann-read_spec.js
```

### Local Testing in Node-RED

1. Start Node-RED:
   ```bash
   node-red
   ```
2. Open http://localhost:1880 in your browser
3. Your local nodes will be available in the palette
4. Make changes to the code
5. Restart Node-RED to see changes

## Project Structure

```
node-red-contrib-viessmann/
├── nodes/                      # Node implementations
│   ├── viessmann-config.js    # Configuration node (OAuth2, tokens)
│   ├── viessmann-config.html  # Config node UI and help
│   ├── viessmann-read.js      # Read data node
│   ├── viessmann-read.html    # Read node UI and help
│   ├── viessmann-write.js     # Write data node
│   ├── viessmann-write.html   # Write node UI and help
│   ├── viessmann-device-*.js  # Discovery nodes
│   └── viessmann-helpers.js   # Shared utilities
├── test/                       # Test files
│   ├── viessmann-config_spec.js
│   ├── viessmann-read_spec.js
│   └── ...
├── examples/                   # Example flows
│   ├── 01-complete-discovery-flow.json
│   └── ...
├── scripts/                    # Utility scripts
│   └── get-viessmann-tokens.js
├── README.md                   # Main documentation
├── SPEC.md                     # Functional specification
├── CONTRIBUTING.md            # This file
└── package.json               # Package metadata
```

## Coding Standards

### General Principles

- **Keep it simple**: Prefer clarity over cleverness
- **DRY (Don't Repeat Yourself)**: Extract common code to helpers
- **Single Responsibility**: Each function should do one thing well
- **Error handling**: Always handle errors gracefully with helpful messages

### JavaScript Style

- **Indentation**: 4 spaces (no tabs)
- **Semicolons**: Use them consistently
- **Quotes**: Single quotes for strings, double quotes for JSON
- **Variable naming**: camelCase for variables and functions
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Async/await**: Prefer async/await over callbacks or raw promises

### Node-RED Specific

- **Status updates**: Update node status to show current state
- **Error messages**: Use `node.error()` with helpful, actionable messages
- **Input validation**: Always validate required inputs early
- **Output format**: Follow consistent output structure across nodes
- **Help text**: Provide comprehensive help in HTML files

### Example Code Style

```javascript
// Good: Clear, well-structured, handles errors
async function fetchDeviceData(installationId, gatewaySerial, deviceId) {
    if (!installationId || !gatewaySerial || !deviceId) {
        throw new Error('Missing required parameters');
    }
    
    try {
        const response = await apiClient.get(
            `/installations/${installationId}/gateways/${gatewaySerial}/devices/${deviceId}`
        );
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch device data: ${error.message}`);
    }
}
```

### API Interaction

- **Base URL**: Use `https://api.viessmann-climatesolutions.com`
- **API Version**: Prefer v2 endpoints (`/iot/v2/...`)
- **Timeouts**: Set reasonable timeouts (default: 30 seconds)
- **Retry logic**: Implement exponential backoff for retries
- **Rate limiting**: Respect API rate limits
- **Token refresh**: Handle 401 errors with automatic token refresh

## Testing

### Test Framework

We use **Mocha** and **Chai** for testing, with **Sinon** for mocking and **Nock** for HTTP mocking.

### Test Structure

```javascript
const helper = require('node-red-node-test-helper');
const { expect } = require('chai');
const nock = require('nock');

describe('viessmann-read Node', function() {
    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload();
        helper.stopServer(done);
        nock.cleanAll();
    });

    it('should read a specific feature from a device', function(done) {
        // Test implementation
    });
});
```

### Writing Tests

1. **Test behavior, not implementation**: Focus on what the node does, not how
2. **Use descriptive names**: Test names should explain what is being tested
3. **Arrange, Act, Assert**: Structure tests clearly
4. **Mock external dependencies**: Use nock for HTTP requests
5. **Test error cases**: Don't just test the happy path
6. **Keep tests focused**: One test should verify one thing

### Test Coverage

- **Required**: All new nodes must have tests
- **Aim for**: 80%+ code coverage
- **Must test**: 
  - Happy path functionality
  - Error handling
  - Input validation
  - Edge cases

### Running Specific Tests

```bash
# Run tests for a specific node
npm test -- --grep "viessmann-read"

# Run tests matching a pattern
npm test -- --grep "error handling"
```

## Submitting Changes

### Before Submitting

1. **Run tests**: Ensure all tests pass
   ```bash
   npm test
   ```

2. **Check code style**: Follow the coding standards
   ```bash
   npm run lint  # If configured
   ```

3. **Update documentation**: Update README.md and help text if needed

4. **Update examples**: Add or update example flows if relevant

5. **Test manually**: Test your changes in a real Node-RED instance

### Commit Messages

Use clear, descriptive commit messages:

```
Add support for reading DHW temperature

- Implement new feature for reading DHW sensor data
- Add tests for DHW temperature reading
- Update README with DHW examples
- Add example flow for DHW monitoring
```

**Format:**
- First line: Brief summary (50 chars or less)
- Blank line
- Detailed description with bullet points if needed

### Pull Request Process

1. **Update your branch**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push to your fork**:
   ```bash
   git push origin feature/my-new-feature
   ```

3. **Create Pull Request**:
   - Go to GitHub and create a PR from your branch
   - Fill in the PR template
   - Link any related issues
   - Add screenshots if UI changes

4. **PR Description should include**:
   - What changed and why
   - How to test the changes
   - Screenshots (if applicable)
   - Breaking changes (if any)
   - Related issues

5. **Respond to feedback**:
   - Address review comments
   - Update your branch as needed
   - Be open to suggestions

### PR Review Checklist

- [ ] Tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Examples added/updated (if relevant)
- [ ] No breaking changes (or clearly documented)
- [ ] Commit messages are clear
- [ ] PR description is complete

## Documentation

### README.md

Update the main README when:
- Adding new nodes
- Changing node behavior
- Adding new features
- Updating configuration requirements

### In-Node Help Text

Each node's HTML file should include comprehensive help:
- **Inputs**: Document all input properties
- **Outputs**: Document output structure
- **Details**: Explain what the node does
- **Examples**: Show practical usage
- **Error Handling**: List possible errors
- **API Endpoints**: Document which API endpoints are used

### Example Flows

Add example flows when:
- Demonstrating new features
- Showing common use cases
- Helping users understand complex workflows

Examples should:
- Be self-contained (include all necessary nodes)
- Include comments explaining key steps
- Use realistic but generic parameter values
- Follow naming convention: `##-descriptive-name.json`

## Release Process

Releases are managed by the maintainers. The process typically includes:

1. **Version bump** following [Semantic Versioning](https://semver.org/):
   - MAJOR: Breaking changes
   - MINOR: New features, backwards compatible
   - PATCH: Bug fixes, backwards compatible

2. **Update CHANGELOG.md** with changes

3. **Tag release** in Git:
   ```bash
   git tag -a v0.2.0 -m "Release v0.2.0"
   git push origin v0.2.0
   ```

4. **Publish to npm**:
   ```bash
   npm publish
   ```

## Need Help?

- **Questions**: Open a GitHub Discussion
- **Bug reports**: Open a GitHub Issue
- **Security issues**: Email the maintainer directly (see package.json)
- **Feature requests**: Open a GitHub Issue with [Feature Request] prefix

## Additional Resources

- [Node-RED Creating Nodes](https://nodered.org/docs/creating-nodes/)
- [Viessmann API Documentation](https://api.viessmann-climatesolutions.com/)
- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertions](https://www.chaijs.com/)
- [Semantic Versioning](https://semver.org/)

## License

By contributing, you agree that your contributions will be licensed under the same MIT License that covers this project.

---

Thank you for contributing to node-red-contrib-viessmann! 🎉
