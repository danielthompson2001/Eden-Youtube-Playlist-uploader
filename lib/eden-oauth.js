/**
 * Eden MCP OAuth client.
 *
 * Connects to the Eden remote MCP server (https://mcp.eden.so/mcp), handling the
 * full OAuth 2.0 authorization-code + PKCE flow with dynamic client registration.
 *
 * Credentials (registered client + tokens) are cached under ~/.eden-mcp so you
 * only authorize in the browser once; later runs refresh silently.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';

export const EDEN_MCP_URL = 'https://mcp.eden.so/mcp';

const CALLBACK_PORT = Number(process.env.EDEN_CALLBACK_PORT || 8788);
const CALLBACK_PATH = '/callback';
const REDIRECT_URL = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;

const STORE_DIR = process.env.EDEN_STORE_DIR || path.join(os.homedir(), '.eden-mcp');
const CLIENT_FILE = path.join(STORE_DIR, 'client.json');
const TOKENS_FILE = path.join(STORE_DIR, 'tokens.json');
const VERIFIER_FILE = path.join(STORE_DIR, 'verifier.txt');
const DISCOVERY_FILE = path.join(STORE_DIR, 'discovery.json');

// Eden only serves OAuth discovery at the ROOT well-known paths. The MCP SDK's
// default RFC 9728 discovery first probes the path-aware variant
// (…/.well-known/oauth-protected-resource/mcp), which Eden rejects (connection
// reset / 404). We pre-seed discovery from the known-good root URLs so the SDK
// skips that probe entirely — needed for the second (finishAuth) transport,
// which has no WWW-Authenticate hint to fall back on.
const PRM_URL = 'https://mcp.eden.so/.well-known/oauth-protected-resource';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return undefined; }
}

function writeJson(file, data) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start ""'
    : 'xdg-open';
  exec(`${cmd} "${url}"`, (err) => {
    if (err) {
      console.log('\n  Could not open a browser automatically. Open this URL manually:\n');
      console.log('   ' + url + '\n');
    }
  });
}

/**
 * File-backed OAuthClientProvider — persists the dynamically-registered client
 * and tokens so the browser consent only happens once.
 */
class FileOAuthClientProvider {
  get redirectUrl() { return REDIRECT_URL; }

  get clientMetadata() {
    return {
      client_name: 'Eden YouTube Uploader',
      redirect_uris: [REDIRECT_URL],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'read write',
    };
  }

  state() {
    const s = Math.random().toString(36).slice(2) + Date.now().toString(36);
    this._state = s;
    return s;
  }

  clientInformation() { return readJson(CLIENT_FILE); }
  saveClientInformation(info) { writeJson(CLIENT_FILE, info); }

  tokens() { return readJson(TOKENS_FILE); }
  saveTokens(tokens) { writeJson(TOKENS_FILE, tokens); }

  saveDiscoveryState(state) { writeJson(DISCOVERY_FILE, state); }

  async discoveryState() {
    const cached = readJson(DISCOVERY_FILE);
    if (cached) return cached;
    try {
      const resourceMetadata = await (await fetch(PRM_URL)).json();
      const authorizationServerUrl = resourceMetadata.authorization_servers[0];
      const asMetaUrl = authorizationServerUrl.replace(/\/+$/, '') + '/.well-known/oauth-authorization-server';
      const authorizationServerMetadata = await (await fetch(asMetaUrl)).json();
      const state = {
        authorizationServerUrl,
        authorizationServerMetadata,
        resourceMetadata,
        resourceMetadataUrl: PRM_URL,
      };
      writeJson(DISCOVERY_FILE, state);
      return state;
    } catch {
      // Fall back to the SDK's own discovery if pre-seeding fails.
      return undefined;
    }
  }

  saveCodeVerifier(verifier) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(VERIFIER_FILE, verifier, { mode: 0o600 });
  }
  codeVerifier() {
    const v = (() => { try { return fs.readFileSync(VERIFIER_FILE, 'utf8'); } catch { return ''; } })();
    if (!v) throw new Error('Missing PKCE code verifier');
    return v;
  }

  redirectToAuthorization(authorizationUrl) {
    console.log('\n  → Opening your browser to authorize Eden access...');
    openBrowser(authorizationUrl.toString());
  }

  invalidateCredentials(scope) {
    const targets = scope === 'all'
      ? [CLIENT_FILE, TOKENS_FILE, VERIFIER_FILE, DISCOVERY_FILE]
      : scope === 'client' ? [CLIENT_FILE]
      : scope === 'tokens' ? [TOKENS_FILE]
      : scope === 'verifier' ? [VERIFIER_FILE]
      : scope === 'discovery' ? [DISCOVERY_FILE]
      : [];
    for (const f of targets) { try { fs.unlinkSync(f); } catch {} }
  }
}

/** Spin up a one-shot localhost server to capture the OAuth redirect's ?code=. */
function waitForAuthCode() {
  let resolveCode, rejectCode;
  const codePromise = new Promise((res, rej) => { resolveCode = res; rejectCode = rej; });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT_URL);
    if (url.pathname !== CALLBACK_PATH) { res.writeHead(404).end(); return; }

    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><title>Eden</title>
      <body style="font-family:system-ui;text-align:center;padding-top:4rem">
      <h2>${error ? 'Authorization failed' : 'Authorized ✓'}</h2>
      <p>${error ? error : 'You can close this tab and return to the terminal.'}</p></body>`);

    if (error) rejectCode(new Error(`OAuth error: ${error}`));
    else if (code) resolveCode(code);
    else rejectCode(new Error('No authorization code in callback'));
  });

  const ready = new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(CALLBACK_PORT, () => res());
  });

  return {
    ready,
    code: codePromise,
    close: () => new Promise((r) => server.close(() => r())),
  };
}

/**
 * Connect to the Eden MCP server, performing interactive OAuth on first run
 * (or when the saved refresh token is no longer valid).
 *
 * @returns {Promise<Client>} a connected MCP client
 */
export async function connectEden() {
  const provider = new FileOAuthClientProvider();
  const client = new Client(
    { name: 'eden-youtube-uploader', version: '2.0.0' },
    { capabilities: {} },
  );

  const connectOnce = () =>
    client.connect(new StreamableHTTPClientTransport(new URL(EDEN_MCP_URL), { authProvider: provider }));

  try {
    await connectOnce();
    return client;
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err;
  }

  // Interactive authorization required. The browser was opened by
  // provider.redirectToAuthorization(); capture the code on localhost.
  const callback = waitForAuthCode();
  await callback.ready;

  let code;
  try {
    code = await callback.code;
  } finally {
    await callback.close();
  }

  // Exchange the code for tokens on a fresh transport, then connect with them.
  const authedTransport = new StreamableHTTPClientTransport(new URL(EDEN_MCP_URL), { authProvider: provider });
  await authedTransport.finishAuth(code);
  await client.connect(authedTransport);
  return client;
}
