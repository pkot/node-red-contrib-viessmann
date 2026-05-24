#!/usr/bin/env node

/**
 * Viessmann Token Generator
 * 
 * This script helps you generate access and refresh tokens for the Viessmann API
 * using the OAuth2 PKCE flow.
 * 
 * Usage: node get-viessmann-tokens.js
 */

const crypto = require('crypto');
const readline = require('readline');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Bound the token-exchange request so a hung connection doesn't leave the script waiting forever.
const HTTP_TIMEOUT_MS = 30000;

// Default destination for the written tokens file. CWD keeps the file
// discoverable next to wherever the user ran the script from.
const DEFAULT_TOKEN_FILE = 'viessmann-tokens.json';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

// Generate code verifier and challenge for PKCE
function generatePKCE() {
    // Generate a random code verifier (43-128 characters)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Generate code challenge (SHA256 hash of verifier, base64url encoded)
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    
    return { codeVerifier, codeChallenge };
}

// Start a temporary HTTP server to capture the callback.
// Binds to loopback only and validates the OAuth state parameter to prevent
// LAN/co-tenant code injection and local CSRF (see issue #69).
function startCallbackServer(port, expectedState) {
    return new Promise((resolve, reject) => {
        const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);

        const server = http.createServer((req, res) => {
            // Reject anything that didn't come through our loopback origin.
            if (!allowedHosts.has(req.headers.host)) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Invalid Host header');
                return;
            }

            const url = new URL(req.url, `http://127.0.0.1:${port}`);
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');

            if (code && state && state === expectedState) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <body>
                            <h1>Authorization Successful!</h1>
                            <p>Authorization code received. You can close this window.</p>
                            <p>Returning to the terminal...</p>
                        </body>
                    </html>
                `);
                server.close();
                resolve(code);
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Invalid authorization callback (missing code or state mismatch)');
            }
        });

        server.listen(port, '127.0.0.1', () => {
            console.log(`\nCallback server started on http://127.0.0.1:${port}/`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\nError: Port ${port} is already in use.`);
                console.error('Please close any applications using this port and try again.');
            }
            reject(err);
        });
    });
}

// Exchange authorization code for tokens
function exchangeCodeForTokens(clientId, code, codeVerifier, redirectUri) {
    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({
            client_id: clientId,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
            code: code
        });
        
        const options = {
            hostname: 'iam.viessmann-climatesolutions.com',
            path: '/idp/v3/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(response);
                    } else {
                        reject(new Error(`Token exchange failed: ${response.error_description || response.error || data}`));
                    }
                } catch (_err) {
                    reject(new Error(`Failed to parse response: ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(HTTP_TIMEOUT_MS, () => {
            req.destroy(new Error(`Token exchange timed out after ${HTTP_TIMEOUT_MS}ms`));
        });

        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log('='.repeat(70));
    console.log('Viessmann API Token Generator');
    console.log('='.repeat(70));
    console.log('\nThis script will help you generate access and refresh tokens');
    console.log('for use with the Node-RED Viessmann integration.\n');
    
    try {
        // Get client ID
        const clientId = await question('Enter your Viessmann Client ID: ');
        if (!clientId.trim()) {
            console.error('Error: Client ID is required');
            rl.close();
            process.exit(1);
        }
        
        // Generate PKCE codes
        console.log('\nGenerating PKCE code verifier and challenge...');
        const { codeVerifier, codeChallenge } = generatePKCE();
        console.log('✓ Generated');
        
        // Build authorization URL with a cryptographically random state value.
        // The callback server requires the redirected state to match this, which
        // blocks LAN/CSRF code-injection attempts (see issue #69).
        const state = crypto.randomBytes(16).toString('base64url');
        const callbackPort = 4200;
        const redirectUri = `http://localhost:${callbackPort}/`;
        const scope = 'IoT offline_access';
        const authUrl = `https://iam.viessmann-climatesolutions.com/idp/v3/authorize?` +
            `response_type=code&` +
            `client_id=${encodeURIComponent(clientId)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `scope=${encodeURIComponent(scope)}&` +
            `state=${encodeURIComponent(state)}&` +
            `code_challenge=${encodeURIComponent(codeChallenge)}&` +
            `code_challenge_method=S256`;
        
        console.log('\n' + '='.repeat(70));
        console.log('STEP 1: Authorize in Browser');
        console.log('='.repeat(70));
        console.log('\nA browser will open (or copy this URL manually):');
        console.log('\n' + authUrl + '\n');
        console.log('1. Log in with your Viessmann account');
        console.log('2. Authorize the application');
        console.log('3. You will be redirected to localhost (this is expected)');
        console.log('\nStarting local server to capture the authorization code...');
        
        // Try to open browser. Uses execFile (array form) on a real
        // executable on every platform, so no shell parses the URL.
        // encodeURIComponent is no longer the only line of defense
        // against a future regression in the URL builder.
        const open = (url) => {
            const { execFile } = require('child_process');
            const platform = process.platform;
            if (platform === 'darwin') {
                execFile('open', [url], () => { /* best-effort */ });
            } else if (platform === 'win32') {
                // rundll32 url.dll,FileProtocolHandler is the standard
                // Windows URL-opener that bypasses cmd.exe entirely (avoids
                // `&` being treated as a command separator). Has worked
                // unchanged since at least Windows 2000.
                execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], () => { /* best-effort */ });
            } else {
                execFile('xdg-open', [url], () => { /* best-effort */ });
            }
        };
        
        setTimeout(() => {
            try {
                open(authUrl);
            } catch (_err) {
                console.log('\nCould not open browser automatically. Please open the URL manually.');
            }
        }, 1000);
        
        // Start callback server and wait for code
        const code = await startCallbackServer(callbackPort, state);
        console.log('\n✓ Authorization code received');
        
        // Exchange code for tokens
        console.log('\n' + '='.repeat(70));
        console.log('STEP 2: Exchanging Code for Tokens');
        console.log('='.repeat(70));
        console.log('\nRequesting access and refresh tokens...');
        
        const tokens = await exchangeCodeForTokens(clientId, code, codeVerifier, redirectUri);
        
        console.log('\n✓ Tokens received successfully!');

        // Write tokens to a restricted-permission file rather than printing
        // them to stdout. stdout would persist in terminal scrollback,
        // tmux/screen buffers, IDE terminal panes, and any shipped CI logs -
        // and the refresh token has a 180-day life.
        //
        // To avoid a window where an existing world-readable
        // viessmann-tokens.json sits with the new contents under loose
        // permissions, we write to a same-directory 0600 temp file first and
        // atomically renameSync it into place. The rename inherits the
        // temp file's mode.
        const tokenFilePath = path.resolve(process.cwd(), DEFAULT_TOKEN_FILE);
        const tokenFileBody = JSON.stringify({
            clientId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accessTokenExpiresIn: tokens.expires_in,
            generatedAt: new Date().toISOString()
        }, null, 2) + '\n';

        const tmpPath = tokenFilePath + '.tmp-' + crypto.randomBytes(6).toString('hex');
        const isWindows = os.platform() === 'win32';
        // writeFileSync's mode is applied on file create. We use 'wx' so the
        // file is freshly created (never reuses existing perms).
        const fd = fs.openSync(tmpPath, 'wx', 0o600);
        try {
            fs.writeFileSync(fd, tokenFileBody);
        } finally {
            fs.closeSync(fd);
        }
        fs.renameSync(tmpPath, tokenFilePath);

        console.log('\n' + '='.repeat(70));
        console.log('TOKENS WRITTEN');
        console.log('='.repeat(70));
        if (isWindows) {
            console.log('\nWrote ' + tokenFilePath + ' (default Windows ACLs apply).');
            console.log('Consider restricting NTFS permissions on this file if other');
            console.log('users on this machine should not read it.');
        } else {
            console.log('\nWrote ' + tokenFilePath + ' (mode 0600).');
        }
        console.log('Open it to copy the Access Token and Refresh Token into your');
        console.log('Node-RED Viessmann config node, then delete the file.\n');
        console.log('Client ID (no secret, safe to display):');
        console.log('  ' + clientId);
        console.log('\nAccess token expires in ' + (tokens.expires_in / 3600) + ' hours.');
        console.log('Refresh token expires in 180 days (used for automatic renewal).');
        console.log('='.repeat(70) + '\n');
        
    } catch (err) {
        console.error('\nError:', err.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
