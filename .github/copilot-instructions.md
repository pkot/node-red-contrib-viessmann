# Copilot Instructions for Node-RED Module Development

## Introduction
This document provides guidelines for building a Node-RED module for the Viessmann SaaS API. It covers best practices in Node.js and Node-RED, test-driven development, package conventions, security, API interactions, and the contribution workflow.

## Node.js and Node-RED Best Practices
- Write clean, readable code using consistent naming conventions.
- Structure your code using modules to promote reusability.
- Use async/await for asynchronous operations to improve readability.

## Test-Driven Development
- Write tests for every new feature or bug fix before implementing the functionality.
- Use tools like Mocha and Chai for unit testing.
- Ensure all tests pass before merging code.

## Package Conventions
- Follow Semantic Versioning (semver) for versioning your packages.
- Use descriptive names for your packages that reflect their functionality.
- Include a clear README with installation and usage instructions.

## Security
- Validate all inputs to prevent injection attacks.
- Use HTTPS for all API interactions.
- Regularly update dependencies to patch known vulnerabilities.

## API Interactions
- Refer to the Viessmann API documentation for endpoints and data formats.
- Handle errors gracefully and provide meaningful error messages to users.
- Implement caching strategies to reduce API calls and improve performance.

## Contribution Workflow
1. Fork the repository and clone it to your local machine.
2. Create a new branch for your feature or bug fix.
3. Make your changes and write tests for any new functionality.
4. Submit a pull request for review, linking to any relevant issues.

By following these guidelines, contributors can ensure a high-quality and maintainable Node-RED module that integrates seamlessly with the Viessmann SaaS API.