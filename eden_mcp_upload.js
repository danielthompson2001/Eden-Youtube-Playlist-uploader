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
 *   EDEN_BOARD_ID        target board (defaults to the DOAC board, DEFAULT_BOARD_ID)
 *   EDEN_LIST=1          print every tool the Eden MCP server exposes, then exit
 *   EDEN_SETUP=1         print your workspaces + boards (ids to copy), then exit
 *   EDEN_FORCE=1         save even links that are already on the target board
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
// Board links land on when EDEN_BOARD_ID isn't set: "DOAC" in Daniel's Workplace.
const DEFAULT_BOARD_ID = '69090383-589f-4e3c-a97d-c0b76bd62daf';
const BATCH_SIZE = 25; // urls per save call (Eden caps at 40)
const PAGE_SIZE = 500; // max items per eden_list_workspace_items page
const FORCE = process.env.EDEN_FORCE === '1' || process.env.EDEN_FORCE === 'true';

function log(msg, type = 'info') {
  const icons = { info: '→', success: '✓', error: '✗', warn: '⚠' };
  console.log(`[${new Date().toLocaleTimeString()}] ${icons[type] || '·'} ${msg}`);
}

/**
 * Identity key for duplicate detection. YouTube URLs collapse to their video id
 * (watch?v=, youtu.be/, /shorts/, /embed/, /live/ all match); anything else is
 * compared as the URL without a trailing slash.
 */
function urlKey(raw) {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/) || [])[1];
    }
    if (id) return `youtube:${id}`;
    return u.href.replace(/\/+$/, '');
  } catch {
    return raw.trim();
  }
}

/** Drop repeats (by urlKey), keeping the first occurrence. */
function dedupe(urls) {
  const seen = new Set();
  return urls.filter((u) => {
    const k = urlKey(u);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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

/** Best-effort parse of a tool result into a JS value (structured or JSON text). */
function resultData(res) {
  if (res.structuredContent && typeof res.structuredContent === 'object') return res.structuredContent;
  const text = (res.content || []).map((c) => c.text).filter(Boolean).join('\n');
  try { return JSON.parse(text); } catch { return text; }
}

/**
 * Call an Eden tool and return its parsed payload. Throws on a protocol-level
 * isError AND on Eden's in-band failure shape `{ ok: false, status, message }`.
 */
async function callTool(client, name, args) {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) {
    const text = (res.content || []).map((c) => c.text).filter(Boolean).join(' ');
    throw new Error(text || `${name} returned isError`);
  }
  const data = resultData(res);
  if (data && typeof data === 'object' && data.ok === false) {
    throw new Error(`${name} failed${data.status ? ` (${data.status})` : ''}: ${data.message || 'no message'}`);
  }
  return data;
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
  return asArray(await callTool(client, 'eden_list_workspaces', {}), 'workspaces');
}

/** List workspace items matching `filter`, following `nextCursor` through every page. */
async function listAllItems(client, workspaceId, filter = {}) {
  const items = [];
  let cursor;
  do {
    const data = await callTool(client, 'eden_list_workspace_items', {
      workspaceId, limit: PAGE_SIZE, ...filter, ...(cursor ? { cursor } : {}),
    });
    items.push(...asArray(data, 'items'));
    cursor = data?.nextCursor || undefined;
  } while (cursor);
  return items;
}

/** Every board (item type "canvas") in the workspace, at any depth. */
const getBoards = (client, workspaceId) => listAllItems(client, workspaceId, { type: 'canvas' });

/** urlKeys of the link cards already sitting on a board. */
async function getBoardUrlKeys(client, workspaceId, boardId) {
  const children = await listAllItems(client, workspaceId, { parentId: boardId });
  return new Set(children.filter((it) => it?.url).map((it) => urlKey(it.url)));
}

/** Count from a field that may be a number or an array (Eden returns either shape). */
const countOf = (v) => (typeof v === 'number' ? v : Array.isArray(v) ? v.length : undefined);

/** Human-readable list of skipped entries (bare URLs or `{ url, reason }` objects). */
const describeSkipped = (v) => (Array.isArray(v) ? v : []).map((s) =>
  typeof s === 'string' ? s : [s?.url, s?.reason || s?.message].filter(Boolean).join(' — ') || JSON.stringify(s));

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
  if (DEFAULT_BOARD_ID) {
    log(`Board: DOAC default (${DEFAULT_BOARD_ID}) — set EDEN_BOARD_ID to use another board`, 'success');
    return DEFAULT_BOARD_ID;
  }
  const boards = await getBoards(client, workspaceId);
  if (boards.length === 1) {
    log(`Board: ${boards[0].title || boards[0].id} (${boards[0].id})`, 'success');
    return boards[0].id;
  }
  if (!boards.length) {
    log('No boards found in this workspace. Create one in Eden, then re-run.', 'warn');
    return null;
  }
  log('Multiple boards found — pick where links should land:', 'warn');
  boards.forEach((b) => console.log(`   EDEN_BOARD_ID=${b.id}   # ${b.title || '(untitled)'}`));
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

  const loaded = loadLinks();
  let urls = dedupe(loaded);
  if (!urls.length && !infoMode) {
    log('No links found. Add YouTube URLs to links.txt (one per line) or pass them as arguments.', 'error');
    process.exit(1);
  }
  if (urls.length < loaded.length) {
    log(`Ignoring ${loaded.length - urls.length} duplicate link(s) in your list.`, 'warn');
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
        const boards = await getBoards(client, w.id);
        if (!boards.length) { console.log('    (no boards)'); continue; }
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

    // Eden creates a new card every time a URL is saved, so skip links that are
    // already on the board — this also makes re-running after a partial failure safe.
    if (!FORCE) {
      const existing = await getBoardUrlKeys(client, workspaceId, boardId);
      const fresh = urls.filter((u) => !existing.has(urlKey(u)));
      if (fresh.length < urls.length) {
        log(`Skipping ${urls.length - fresh.length} link(s) already on this board (EDEN_FORCE=1 to save anyway).`, 'warn');
      }
      urls = fresh;
      if (!urls.length) { log('Nothing new to save.', 'success'); return; }
    }

    if (DRY_RUN) {
      log('=== DRY RUN — nothing will be saved ===', 'warn');
      log(`Would call ${SAVE_TOOL} → workspace ${workspaceId}, board ${boardId}`);
      urls.forEach((u, i) => log(`  [${i + 1}/${urls.length}] ${u}`));
      return;
    }

    const batches = chunk(urls, BATCH_SIZE);
    let saved = 0;
    let skipped = 0;
    const skippedDetails = [];
    const failed = [];
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      log(`Saving batch ${b + 1}/${batches.length} (${batch.length} link${batch.length === 1 ? '' : 's'})...`);
      try {
        const data = await callTool(client, SAVE_TOOL, { workspaceId, boardId, urls: batch });
        const nSkipped = countOf(data?.itemsSkipped) ?? 0;
        const nCreated = countOf(data?.itemsCreated) ?? batch.length - nSkipped;
        saved += nCreated;
        skipped += nSkipped;
        skippedDetails.push(...describeSkipped(data?.itemsSkipped));
        log(`  Saved ${nCreated}${nSkipped ? `, Eden skipped ${nSkipped}` : ''}.`, nSkipped ? 'warn' : 'success');
      } catch (err) {
        log(`  Batch failed: ${err.message}`, 'error');
        failed.push(...batch);
      }
    }

    const ok = failed.length === 0 && skipped === 0;
    console.log('\n─────────────────────────────');
    log(`Done! ${saved} saved, ${skipped} skipped by Eden, ${failed.length} failed.`, ok ? 'success' : 'warn');
    if (skippedDetails.length) { log('Skipped by Eden (could not make a card):', 'warn'); skippedDetails.forEach((u) => console.log('  ' + u)); }
    if (failed.length) { log('Failed URLs (safe to re-run — saved links are skipped):', 'error'); failed.forEach((u) => console.log('  ' + u)); }
    console.log('─────────────────────────────\n');
    process.exitCode = ok ? 0 : 1;
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  log(`Fatal: ${err.message}`, 'error');
  process.exit(1);
});
