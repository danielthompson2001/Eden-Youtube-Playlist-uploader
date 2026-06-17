/**
 * Eden Gmail OAuth Setup
 * Run this once to authorise Gmail access.
 * It will save a token file that eden_upload.js uses automatically.
 *
 * BEFORE RUNNING:
 *   1. Go to console.cloud.google.com
 *   2. Enable Gmail API
 *   3. Create OAuth 2.0 Client ID (Desktop app)
 *   4. Download the JSON and save as gmail_credentials.json in this folder
 *
 * USAGE:
 *   node eden_setup_gmail.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const http = require('http');
const url = require('url');

const CREDENTIALS_FILE = 'gmail_credentials.json';
const TOKEN_FILE = 'gmail_token.json';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function log(msg, type = 'info') {
  const icons = { info: '→', success: '✓', error: '✗', warn: '⚠' };
  console.log(`[${new Date().toLocaleTimeString()}] ${icons[type] || '·'} ${msg}`);
}

async function main() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    log(`Missing ${CREDENTIALS_FILE} — please download it from Google Cloud Console.`, 'error');
    log('Steps: console.cloud.google.com → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Desktop) → Download JSON → rename to gmail_credentials.json', 'info');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/callback');

  // Generate auth URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  log('Opening browser for Gmail authorisation...');
  log(`If browser does not open, visit this URL manually:\n  ${authUrl}`, 'info');

  // Open browser
  const { exec } = require('child_process');
  exec(`open "${authUrl}"`);

  // Start local server to catch the redirect
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const qs = url.parse(req.url, true).query;
      if (qs.code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>✓ Authorised! You can close this tab and return to the terminal.</h2>');
        server.close();
        resolve(qs.code);
      } else if (qs.error) {
        res.writeHead(400);
        res.end(`Error: ${qs.error}`);
        server.close();
        reject(new Error(qs.error));
      }
    });
    server.listen(3000, () => log('Waiting for authorisation on http://localhost:3000...'));
    setTimeout(() => { server.close(); reject(new Error('Timed out after 2 minutes')); }, 120000);
  });

  // Exchange code for token
  const { tokens } = await oAuth2Client.getToken(code);
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  log(`Token saved to ${TOKEN_FILE}`, 'success');
  log('Gmail authorisation complete! You can now run: node eden_upload.js', 'success');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
