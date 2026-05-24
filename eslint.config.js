const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                AbortController: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'no-console': 'off'
        }
    },
    {
        // Mocha globals apply to spec files and to shared test helpers
        // under test/support/ that call hooks like beforeEach.
        files: ['test/**/*_spec.js', 'test/support/**/*.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                before: 'readonly',
                after: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly'
            }
        }
    },
    {
        ignores: ['node_modules/', 'coverage/', '.nyc_output/']
    }
];
