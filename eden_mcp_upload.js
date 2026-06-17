/**
 * Eden YouTube Link Uploader — MCP edition
 *
 * Replaces the old Playwright + Gmail-magic-code automation with a direct
 * connection to the Eden MCP server (https://mcp.eden.so/mcp). You authorize
 * once in the browser (OAuth), then your links are saved by calling Eden's own
 * `eden_save_links_to_board` tool — no headless browser, no UI selectors.
 *
 * USAGE:
 *   npm install
 *   # put your YouTube URLs in links.txt (one per line), then:
 *   npm start
 *
 * The first run prints your workspaces and boards so you can pick where links
 * land. Set the chosen ids and run again:
 *   EDEN_WORKSPACE_ID=... EDEN_BOARD_ID=... npm start
 *
 * OPTIONS (env):
 *   DRY_RUN=1            connect + show the plan, but save nothing
 *   EDEN_WORKSPACE_ID    target workspace (auto-selected if you have only one)
 *   EDEN_BOARD_ID        target board (auto-selected if it's the only board)
 *   EDEN_LIST=1          print every tool the Eden MCP server exposes, then exit
 *   EDEN_SETUP=1         print your workspaces + boards (ids to copy), then exit
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectEden } from './lib/eden-oauth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load a local .env (KEY=VALUE per line) so you can store EDEN_WORKSPACE_ID /
// EDEN_BOARD_ID once. Real environment variables take precedence.
(function loadDotEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
})();

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const SAVE_TOOL = 'eden_save_links_to_board';
const BATCH_SIZE = 25; // urls per save call

function log(msg, type = 'info') {
  const icons = { info: '→', success: '✓', error: '✗', warn: '⚠' };
  console.log(`[${new Date().toLocaleTimeString()}] ${icons[type] || '·'} ${msg}`);
}

function loadLinks() {
  // CLI args win; otherwise read links.txt (ignore blanks and # comments).
  const args = process.argv.slice(2).filter((a) => a.startsWith('http'));
  if (args.length) return args;

  const file = path.join(__dirname, 'links.txt');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && /^https?:\/\//.test(l));
}

/** Call an Eden tool, throwing on isError, returning the raw result. */
async function callTool(client, name, args) {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) {
    const text = (res.content || []).map((c) => c.text).filter(Boolean).join(' ');
    throw new Error(text || `${name} returned isError`);
  }
  return res;
}

/** Best-effort parse of a tool result into a JS value (structured or JSON text). */
function resultData(res) {
  if (res.structuredContent && typeof res.structuredContent === 'object') return res.structuredContent;
  const text = (res.content || []).map((c) => c.text).filter(Boolean).join('\n');
  try { return JSON.parse(text); } catch { return text; }
}

/** Normalize Eden list responses (which may be {workspaces:[]}, {items:[]}, or a bare array). */
function asArray(data, ...keys) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const k of keys) if (Array.isArray(data[k])) return data[k];
    for (const v of Object.values(data)) if (Array.isArray(v)) return v;
  }
  return [];
}

async function getWorkspaces(client) {
  return asArray(resultData(await callTool(client, 'eden_list_workspaces', {})), 'workspaces');
}

async function getTopLevelItems(client, workspaceId) {
  // Omit parentId entirely for top-level items — the tool's schema rejects an
  // explicit null even though its description says "parentId === null".
  const res = await callTool(client, 'eden_list_workspace_items', { workspaceId, limit: 100 });
  return asArray(resultData(res), 'items');
}

const isBoard = (it) => /board|canvas|folder|stack/i.test(it?.type || '') || (!it?.url && !it?.type);

async function resolveWorkspace(client) {
  if (process.env.EDEN_WORKSPACE_ID) return process.env.EDEN_WORKSPACE_ID;
  const ws = await getWorkspaces(client);
  if (ws.length === 1) {
    log(`Workspace: ${ws[0].name || ws[0].slug || ws[0].id} (${ws[0].id})`, 'success');
    return ws[0].id;
  }
  log(ws.length ? 'You belong to multiple workspaces — pick one:' : 'No workspaces found.', 'warn');
  ws.forEach((w) => console.log(`   EDEN_WORKSPACE_ID=${w.id}   # ${w.name || w.slug || ''} (${w.role || ''})`));
  console.log('\n  Re-run with EDEN_WORKSPACE_ID=<id> set.\n');
  return null;
}

async function resolveBoard(client, workspaceId) {
  if (process.env.EDEN_BOARD_ID) return process.env.EDEN_BOARD_ID;
  const items = await getTopLevelItems(client, workspaceId);
  const boards = items.filter(isBoard);
  if (boards.length === 1) {
    log(`Board: ${boards[0].title || boards[0].id} (${boards[0].id})`, 'success');
    return boards[0].id;
  }
  log(boards.length ? 'Multiple boards found — pick where links should land:' : 'No boards found at the top level.', 'warn');
  (boards.length ? boards : items).forEach((b) =>
    console.log(`   EDEN_BOARD_ID=${b.id}   # ${b.title || '(untitled)'} [${b.type || '?'}]`));
  console.log('\n  Re-run with EDEN_BOARD_ID=<id> set.\n');
  return null;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  const listMode = process.env.EDEN_LIST === '1';
  const setupMode = process.env.EDEN_SETUP === '1';
  const infoMode = listMode || setupMode;

  const urls = loadLinks();
  if (!urls.length && !infoMode) {
    log('No links found. Add YouTube URLs to links.txt (one per line) or pass them as arguments.', 'error');
    process.exit(1);
  }

  log(infoMode
    ? 'Connecting to Eden MCP...'
    : `Connecting to Eden MCP (${urls.length} link${urls.length === 1 ? '' : 's'} queued)...`);
  const client = await connectEden();
  log('Connected to Eden.', 'success');

  try {
    if (listMode) {
      const { tools } = await client.listTools();
      log(`Eden exposes ${tools.length} tools:`, 'info');
      for (const t of tools) {
        const props = Object.keys(t.inputSchema?.properties || {});
        console.log(`\n• ${t.name}(${props.join(', ')})`);
        if (t.description) console.log(`    ${t.description.split('\n')[0]}`);
      }
      console.log();
      return;
    }

    if (setupMode) {
      const ws = await getWorkspaces(client);
      log(`You belong to ${ws.length} workspace(s):`, 'info');
      for (const w of ws) {
        console.log(`\n• ${w.name || w.slug || '(unnamed)'}  —  EDEN_WORKSPACE_ID=${w.id}`);
        const items = await getTopLevelItems(client, w.id);
        const boards = items.filter(isBoard);
        if (!boards.length) { console.log('    (no top-level boards)'); continue; }
        for (const b of boards) console.log(`    board: ${b.title || '(untitled)'}  —  EDEN_BOARD_ID=${b.id}`);
      }
      console.log('\n  Copy the ids you want and run:');
      console.log('    EDEN_WORKSPACE_ID=<id> EDEN_BOARD_ID=<id> npm start\n');
      return;
    }

    // Verify the save tool exists before resolving targets.
    const { tools } = await client.listTools();
    if (!tools.some((t) => t.name === SAVE_TOOL)) {
      log(`Eden did not expose "${SAVE_TOOL}". Run with EDEN_LIST=1 to see what's available.`, 'error');
      process.exitCode = 1;
      return;
    }

    const workspaceId = await resolveWorkspace(client);
    if (!workspaceId) { process.exitCode = 2; return; }

    const boardId = await resolveBoard(client, workspaceId);
    if (!boardId) { process.exitCode = 2; return; }

    if (DRY_RUN) {
      log('=== DRY RUN — nothing will be saved ===', 'warn');
      log(`Would call ${SAVE_TOOL} → workspace ${workspaceId}, board ${boardId}`);
      urls.forEach((u, i) => log(`  [${i + 1}/${urls.length}] ${u}`));
      return;
    }

    const batches = chunk(urls, BATCH_SIZE);
    let saved = 0;
    const failed = [];
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      log(`Saving batch ${b + 1}/${batches.length} (${batch.length} link${batch.length === 1 ? '' : 's'})...`);
      try {
        await callTool(client, SAVE_TOOL, { workspaceId, boardId, urls: batch });
        saved += batch.length;
        log(`  Saved ${batch.length}.`, 'success');
      } catch (err) {
        log(`  Batch failed: ${err.message}`, 'error');
        failed.push(...batch);
      }
    }

    console.log('\n─────────────────────────────');
    log(`Done! ${saved} saved, ${failed.length} failed.`, failed.length === 0 ? 'success' : 'warn');
    if (failed.length) { log('Failed URLs:', 'error'); failed.forEach((u) => console.log('  ' + u)); }
    console.log('─────────────────────────────\n');
    process.exitCode = failed.length === 0 ? 0 : 1;
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  log(`Fatal: ${err.message}`, 'error');
  process.exit(1);
});
