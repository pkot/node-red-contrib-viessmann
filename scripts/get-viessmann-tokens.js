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

// Start a temporary HTTP server to capture the callback
function startCallbackServer(port = 4200) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${port}`);
            const code = url.searchParams.get('code');
            
            if (code) {
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
                res.end('No authorization code received');
            }
        });
        
        server.listen(port, () => {
            console.log(`\nCallback server started on http://localhost:${port}/`);
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
                } catch (err) {
                    reject(new Error(`Failed to parse response: ${data}`));
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
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
        
        // Build authorization URL
        const redirectUri = 'http://localhost:4200/';
        const scope = 'IoT User offline_access';
        const authUrl = `https://iam.viessmann-climatesolutions.com/idp/v3/authorize?` +
            `response_type=code&` +
            `client_id=${encodeURIComponent(clientId)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `scope=${encodeURIComponent(scope)}&` +
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
        
        // Try to open browser
        const open = (url) => {
            const { exec } = require('child_process');
            const start = process.platform === 'darwin' ? 'open' : 
                         process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${start} "${url}"`);
        };
        
        setTimeout(() => {
            try {
                open(authUrl);
            } catch (err) {
                console.log('\nCould not open browser automatically. Please open the URL manually.');
            }
        }, 1000);
        
        // Start callback server and wait for code
        const code = await startCallbackServer(4200);
        console.log('\n✓ Authorization code received');
        
        // Exchange code for tokens
        console.log('\n' + '='.repeat(70));
        console.log('STEP 2: Exchanging Code for Tokens');
        console.log('='.repeat(70));
        console.log('\nRequesting access and refresh tokens...');
        
        const tokens = await exchangeCodeForTokens(clientId, code, codeVerifier, redirectUri);
        
        console.log('\n✓ Tokens received successfully!');
        console.log('\n' + '='.repeat(70));
        console.log('YOUR TOKENS');
        console.log('='.repeat(70));
        console.log('\nCopy these values into your Node-RED Viessmann config node:\n');
        console.log('Client ID:');
        console.log('  ' + clientId);
        console.log('\nAccess Token (expires in ' + (tokens.expires_in / 3600) + ' hours):');
        console.log('  ' + tokens.access_token);
        console.log('\nRefresh Token (expires in 180 days):');
        console.log('  ' + tokens.refresh_token);
        console.log('\n' + '='.repeat(70));
        console.log('\nIMPORTANT: Store these tokens securely!');
        console.log('The refresh token will be used to automatically renew access tokens.');
        console.log('='.repeat(70) + '\n');
        
    } catch (err) {
        console.error('\nError:', err.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
