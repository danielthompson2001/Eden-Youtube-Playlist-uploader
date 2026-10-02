# Eden YouTube Link Uploader (MCP edition)

Saves a list of YouTube links to your [Eden.so](https://eden.so) library by talking
to the **Eden MCP server** (`https://mcp.eden.so/mcp`) directly.

The old version drove a headless Chromium browser, logged in by scraping a magic
code out of Gmail, and right-clicked "Paste Link" for every URL. This version
throws all of that away: you authorize once via OAuth in your browser, then each
link is saved by calling Eden's own MCP tool. No browser automation, no Gmail
token, no UI selectors to break.

## Setup

Requires Node 18+.

```bash
npm install
```

## Use it

1. Copy the template and add your YouTube URLs, one per line (blank lines and
   `#` comments are ignored). You can also pass URLs as CLI arguments.

   ```bash
   cp links.example.txt links.txt
   ```
2. Run it:

   ```bash
   npm start
   ```

3. On the first run a browser tab opens asking you to authorize Eden access.
   Approve it and return to the terminal — the script saves each link and prints
   a summary. Your authorization is cached in `~/.eden-mcp/`, so later runs don't
   prompt again.

Preview without saving anything:

```bash
npm run dry-run
```

## Choosing where links land

By default links are saved to the **DOAC** board (`69090383-589f-4e3c-a97d-c0b76bd62daf`),
so `npm start` needs no setup. To use a different board, discover its id:

```bash
EDEN_SETUP=1 npm start
```

That prints your workspaces and boards. Put the ids you want in a `.env` file
(copy `.env.example`):

```
EDEN_WORKSPACE_ID=...
EDEN_BOARD_ID=...
```

Then `npm start` saves to that board with no extra flags. If you have only one
workspace, it's auto-selected and you can leave `EDEN_WORKSPACE_ID` blank.

## How it works

- `lib/eden-oauth.js` — connects to the Eden MCP server using the MCP TypeScript
  SDK, handling OAuth 2.0 (authorization-code + PKCE) with dynamic client
  registration. Registered-client info and tokens are cached under `~/.eden-mcp`.
  It also pre-seeds OAuth discovery from Eden's root well-known endpoints, since
  the SDK's default path-aware discovery probe isn't served by Eden.
- `eden_mcp_upload.js` — loads your links, resolves the target workspace/board,
  and saves the URLs in batches via Eden's `eden_save_links_to_board` tool. Eden
  classifies each URL (YouTube/Twitter/etc. become platform cards).
  Duplicate links in your list are dropped, and links already on the target
  board are skipped (YouTube URLs match by video id), so re-running after a
  partial failure won't create duplicate cards. Links Eden can't turn into a
  card are reported as skipped.

## Environment variables

| Variable             | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `DRY_RUN=1`          | Connect and show the plan, but save nothing.                  |
| `EDEN_WORKSPACE_ID`  | Target workspace (auto-selected if you have only one).        |
| `EDEN_BOARD_ID`      | Target board (defaults to the DOAC board).                    |
| `EDEN_SETUP=1`       | Print your workspaces + boards (with ids to copy), then exit. |
| `EDEN_LIST=1`        | Print every tool the Eden MCP server exposes, then exit.      |
| `EDEN_FORCE=1`       | Save links even if they're already on the target board.       |
| `EDEN_AUTH_TIMEOUT`  | Seconds to wait for browser authorization (default `300`).    |
| `EDEN_CALLBACK_PORT` | Local OAuth redirect port (default `8788`).                   |
| `EDEN_STORE_DIR`     | Where to cache OAuth credentials (default `~/.eden-mcp`).     |

## Using Eden from Claude Code instead

This repo also ships an `.mcp.json` that registers the Eden MCP server with
Claude Code. Open the repo in Claude Code, run `/mcp` to authorize Eden, then
just ask Claude to save your links — it calls the same Eden tools directly.

## Legacy

The original Playwright/Gmail implementation is preserved in `legacy/` for
reference. It is no longer the default entry point.
