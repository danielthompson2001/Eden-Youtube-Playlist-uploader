/**
 * Eden.so YouTube Link Uploader — with Auto Login
 *
 * SETUP (one time):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * USAGE:
 *   node eden_upload.js
 *
 *   1. Browser opens, logs in to Eden automatically via Gmail
 *   2. Navigate to your DOAC project page
 *   3. Press Enter — script uploads all links
 */

const { chromium } = require('playwright');
const { google } = require('googleapis');
const fs = require('fs');

const CREDENTIALS_FILE = 'gmail_credentials.json';
const TOKEN_FILE = 'gmail_token.json';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const EDEN_EMAIL = 'danielthompson5611@gmail.com';

const CONFIG = {
  urls: `

  `.trim().split('\n').map(u => u.trim()).filter(u => u.startsWith('http')),

  dryRun: false,
};

// ─────────────────────────────────────────────────────────────────────────────

const EDEN_URL  = 'https://beta.eden.so';

function log(msg, type = 'info') {
  const icons = { info: '→', success: '✓', error: '✗', warn: '⚠' };
  console.log(`[${new Date().toLocaleTimeString()}] ${icons[type] || '·'} ${msg}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForEnter(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', () => { process.stdin.pause(); resolve(); });
  });
}

// ── AUTO LOGIN ────────────────────────────────────────────────────────────────

async function autoLogin(edenPage) {
  // Intercept the API call to see what's being sent
  await edenPage.route('**/auth/send-magic-code', async route => {
    const req = route.request();
    log(`API call: ${req.method()} ${req.url()}`);
    log(`Body: ${req.postData()}`);
    await route.continue();
  });

  // Fill email using type() so React onChange fires
  const emailInput = edenPage.locator('input[type="email"], input[placeholder*="email" i]');
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.click({ clickCount: 3 });
  await sleep(200);
  await emailInput.fill('');
  await sleep(100);
  await emailInput.type(EDEN_EMAIL, { delay: 50 });
  await sleep(500);

  const filled = await emailInput.inputValue().catch(() => '');
  log(`Email field: "${filled}"`);
  log(`Email ready: ${EDEN_EMAIL}`, 'success');

  // Click the submit button once only
  const sendBtn = edenPage.locator('button[type="submit"]');
  await sendBtn.waitFor({ timeout: 5000 });
  // Record exact click time BEFORE clicking
  const requestTime = Date.now();
  await sendBtn.click();
  log(`Clicked: Send the magic code at ${new Date(requestTime).toLocaleTimeString()}`);

  // Wait for page to transition
  await sleep(3000);
  await edenPage.waitForLoadState('networkidle').catch(() => {});

  // Wait for the code entry screen
  log('Waiting for code entry screen...');
  try {
    await edenPage.waitForSelector(
      'input[type="text"], input[type="number"], input[inputmode="numeric"], input[autocomplete="one-time-code"]',
      { timeout: 30000 }
    );
    log('Code entry screen appeared.', 'success');
  } catch {
    log('Code screen not detected — proceeding to Gmail poll anyway...', 'warn');
  }

  log('Waiting 10 seconds for email to arrive...');
  await sleep(10000);

  const code = await getCodeFromGmail(requestTime);
  if (!code) {
    log('Could not find code automatically.', 'warn');
    await waitForEnter('\n  👉  Enter the magic code into Eden manually, then press Enter once logged in...\n\n');
    return;
  }

  await enterCode(edenPage, code);
}

async function enterCode(edenPage, code) {
  log(`Entering code: ${code}`);
  await edenPage.bringToFront();

  // Eden uses a hidden input (opacity-0, pointer-events-none) behind styled divs.
  // We can't click it directly — instead focus it via JS then type with keyboard.
  log('Focusing hidden OTP input via JS...');
  await edenPage.waitForSelector('#code, input[autocomplete="one-time-code"]', { timeout: 20000 });
  await sleep(300);

  // Focus the hidden input directly via JavaScript
  await edenPage.evaluate(() => {
    const input = document.querySelector('#code') || document.querySelector('input[autocomplete="one-time-code"]');
    if (input) input.focus();
  });
  await sleep(300);

  // Type each digit — the hidden input captures keystrokes even though it's invisible
  for (const digit of code) {
    await edenPage.keyboard.press(digit);
    await sleep(150);
  }

  await sleep(1000);
  await edenPage.keyboard.press('Enter');
  await edenPage.waitForLoadState('networkidle').catch(() => {});
  await sleep(2000);
  log('Logged in to Eden!', 'success');
}

async function getCodeFromGmail(requestedAt = Date.now()) {
  // Use Gmail API with saved OAuth token — no browser needed
  if (!fs.existsSync(TOKEN_FILE) || !fs.existsSync(CREDENTIALS_FILE)) {
    log('Gmail token not found — run node eden_setup_gmail.js first, or enter the code manually.', 'warn');
    return null;
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE));
  const { client_id, client_secret } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/callback');
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE)));

  // Auto-refresh token if expired
  oAuth2Client.on('tokens', tokens => {
    const existing = JSON.parse(fs.readFileSync(TOKEN_FILE));
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ ...existing, ...tokens }, null, 2));
  });

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  log('Polling Gmail API for magic code...');

  // Use Unix timestamp in query so Gmail returns fresh results, not cached ones
  const afterTimestamp = Math.floor((requestedAt - 5000) / 1000);
  const seenIds = new Set();

  for (let attempt = 0; attempt < 20; attempt++) {
    process.stdout.write(`\r  Checking Gmail... attempt ${attempt + 1}/20`);
    await sleep(3000);

    try {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'from:eden subject:"login code"',
        maxResults: 5,
      });

      log(`  Gmail returned ${(res.data.messages || []).length} messages`);
      log(`  Raw response: ${JSON.stringify(res.data).substring(0, 200)}`);

      const messages = res.data.messages || [];
      if (messages.length === 0) {
        log('  No messages found — check Gmail query');
        continue;
      }

      // Fetch ALL returned messages and find the absolute newest
      const fetched = await Promise.all(
        messages.map(m => gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' }))
      );

      // Sort by internalDate — newest first
      fetched.sort((a, b) => parseInt(b.data.internalDate) - parseInt(a.data.internalDate));

      // Log all found emails for debugging
      for (const f of fetched) {
        const t = new Date(parseInt(f.data.internalDate)).toLocaleTimeString();
        log(`  Found email from ${t}`);
      }

      // Take the single newest email only
      const newest = fetched[0];
      const receivedMs = parseInt(newest.data.internalDate);
      const sentTime = new Date(receivedMs).toLocaleTimeString();

      // Recursively extract all text from payload parts
      function extractText(payload) {
        let text = '';
        if (payload.body?.data) {
          text += Buffer.from(payload.body.data, 'base64').toString('utf8');
        }
        if (payload.parts) {
          for (const p of payload.parts) text += extractText(p);
        }
        return text;
      }

      const fullBody = extractText(newest.data.payload);


      // Find all 6-digit numbers in the body
      const allCodes = [...fullBody.matchAll(/\b(\d{6})\b/g)].map(m => m[1]);
      log(`  All 6-digit numbers found: ${allCodes.join(', ')}`);

      // Filter out hex colour codes (preceded by #) and template placeholders
      const excluded = new Set(['666666', '999999', '000000', '111111', '123456']);
      const realCodes = allCodes.filter(c => {
        if (excluded.has(c)) return false;
        // Skip if this number appears as a CSS hex colour (#272523 etc)
        if (fullBody.includes('#' + c)) return false;
        return true;
      });
      log(`  Candidate codes: ${realCodes.join(', ')}`);

      if (realCodes.length > 0) {
        // The real code is the one closest to "code below" in the email
        // Try matching it contextually first
        const contextMatch = fullBody.match(/code below[^\d]*(\d{6})/i) ||
                             fullBody.match(/verification code[^\d]*(\d{6})/i) ||
                             fullBody.match(/paste.*?(\d{6})/i);
        // Real code is always the last candidate — previous session codes appear first in HTML
        const code = contextMatch ? contextMatch[1] : realCodes[realCodes.length - 1];
        console.log('');
        log(`Found magic code: ${code} (sent ${sentTime})`, 'success');
        return code;
      }
    } catch (err) {
      log(`Gmail API error: ${err.message}`, 'warn');
    }
  }
  console.log('');
  log('Could not find code in Gmail after 60 seconds.', 'warn');
  return null;
}

// ── UPLOAD ────────────────────────────────────────────────────────────────────

async function openPasteLinkDialog(page) {
  await page.keyboard.press('Escape');
  await sleep(300);

  const x = await page.evaluate(() => window.innerWidth * 0.55);
  const y = 150;

  log(`  Right-clicking at (${Math.round(x)}, ${y})...`);
  await page.mouse.click(x, y, { button: 'right' });
  await sleep(700);

  const pasteLinkItem = page.locator('text="Paste Link"');
  try {
    await pasteLinkItem.waitFor({ timeout: 4000 });
  } catch {
    await page.keyboard.press('Escape');
    await sleep(300);
    log('  Retrying right-click slightly lower...', 'warn');
    await page.mouse.click(x, 220, { button: 'right' });
    await sleep(700);
    await pasteLinkItem.waitFor({ timeout: 5000 });
  }

  await pasteLinkItem.click();
  await sleep(700);
  await page.locator('dialog[open] input[placeholder="Paste a link..."]').waitFor({ timeout: 5000 });
}

async function saveLink(page, url, index, total) {
  log(`[${index + 1}/${total}] Saving: ${url}`);

  if (CONFIG.dryRun) {
    log(`  DRY RUN — would save: ${url}`, 'warn');
    await sleep(500);
    return true;
  }

  try {
    await openPasteLinkDialog(page);
    const input = page.locator('dialog[open] input[placeholder="Paste a link..."]');
    await input.click();
    await input.fill(url);
    await sleep(400);
    await input.press('Enter');
    await page.locator('dialog[open]').waitFor({ state: 'hidden', timeout: 15000 });
    await sleep(1500);
    log(`  Saved!`, 'success');
    return true;
  } catch (err) {
    if (err.message.includes('closed')) { log('Browser closed.', 'warn'); process.exit(0); }
    log(`  Failed: ${err.message}`, 'error');
    try { await page.keyboard.press('Escape'); } catch {}
    await sleep(1000);
    return false;
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  const { urls } = CONFIG;
  if (urls.length === 0) { log('No URLs in CONFIG.urls', 'error'); process.exit(1); }
  if (CONFIG.dryRun) log('=== DRY RUN — nothing will be saved ===', 'warn');

  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const edenPage = await context.newPage();
  const results = { success: 0, failed: 0, failedUrls: [] };

  browser.on('disconnected', () => {
    console.log('\n─────────────────────────────');
    log(`Browser closed. ${results.success} saved, ${results.failed} failed.`, 'warn');
    if (results.failedUrls.length > 0) results.failedUrls.forEach(u => console.log('  ' + u));
    console.log('─────────────────────────────\n');
    process.exit(0);
  });

  try {
    log('Opening Eden...');
    await edenPage.goto(EDEN_URL, { waitUntil: 'networkidle' });

    // Wait a beat for any redirects/auth checks to settle
    await sleep(3000);
    await edenPage.waitForLoadState('networkidle');

    // Detect login state
    const needsEmail = await edenPage.locator('input[type="email"], input[placeholder*="email" i]').isVisible().catch(() => false);
    const codeBoxes  = await edenPage.locator('input[type="text"], input[type="number"], input[inputmode="numeric"]').count().catch(() => 0);
    const hasCodeText = await edenPage.locator('text="magic code"').isVisible().catch(() => false);
    const needsCode  = codeBoxes >= 4 || hasCodeText;

    log(`State — needsEmail: ${needsEmail}, codeBoxes: ${codeBoxes}, hasCodeText: ${hasCodeText}`);

    if (needsEmail) {
      log('Login required — auto-filling email...');
      await autoLogin(edenPage);
    } else if (needsCode) {
      log(`Code entry screen detected (${codeBoxes} boxes) — fetching from Gmail...`, 'warn');
      const requestTime = Date.now();
      log('Waiting 10 seconds for Eden to send the email...');
      await sleep(10000);
      const code = await getCodeFromGmail(requestTime);
      if (code) {
        await enterCode(edenPage, code);
      } else {
        log('Could not find code automatically — please enter it manually in the browser.', 'warn');
        await waitForEnter('\n  👉  Enter the magic code in the browser, then press Enter here once logged in...\n\n');
      }
    } else {
      log('Already logged in!', 'success');
    }

    await waitForEnter('\n  👉  Navigate to your DOAC project page so white space is visible below the title, then press Enter to start uploading...\n\n');

    log(`Starting upload of ${urls.length} links...`, 'success');

    const MAX_RETRIES = 3;
    for (let i = 0; i < urls.length; i++) {
      let ok = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 1) log(`  Retry ${attempt - 1} of ${MAX_RETRIES - 1} for: ${urls[i]}`, 'warn');
        ok = await saveLink(edenPage, urls[i], i, urls.length);
        if (ok) break;
        await sleep(2000);
      }
      if (ok) results.success++;
      else { results.failed++; results.failedUrls.push(urls[i]); log(`  Giving up on: ${urls[i]}`, 'error'); }
    }

  } catch (err) {
    if (!err.message.includes('closed')) {
      log(`Unexpected error: ${err.message}`, 'error');
      try { await edenPage.screenshot({ path: 'eden_error.png' }); log('Screenshot saved to eden_error.png'); } catch {}
    }
  } finally {
    try { await browser.close(); } catch {}
  }

  console.log('\n─────────────────────────────');
  log(`Done! ${results.success} saved, ${results.failed} failed.`, results.failed === 0 ? 'success' : 'warn');
  if (results.failedUrls.length > 0) {
    log('Failed URLs:', 'error');
    results.failedUrls.forEach(u => console.log('  ' + u));
  }
  console.log('─────────────────────────────\n');
}

main();
