# Eden YouTube Link Uploader

Automatically saves a list of YouTube URLs to your Eden.so library using browser automation (Playwright).

## Requirements

- [Node.js](https://nodejs.org/) v16 or newer

## Setup (one time)

```bash
# Install dependencies
npm install

# Install Chromium browser
npm run setup
```

## Configuration

Open `eden_upload.js` and edit the `CONFIG` section at the top:

```js
const CONFIG = {
  email: 'YOUR_EMAIL@example.com',   // ← your Eden login email
  password: 'YOUR_PASSWORD',          // ← your Eden password

  urls: `
https://www.youtube.com/watch?v=ABC
https://www.youtube.com/watch?v=XYZ
  `.trim().split('\n')...,

  delayBetweenLinks: 4000,  // ms to wait between each link (increase if Eden is slow)
  headless: false,           // false = watch it run, true = run invisibly
  dryRun: false,             // true = test mode, won't actually save anything
};
```

**Tip:** Copy your URLs from the YouTube Playlist Extractor's bulk output box and paste them into the `urls` template literal.

## Usage

```bash
node eden_upload.js
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Login fails | Check your email/password. Try `headless: false` to watch what happens. |
| "Add" button not found | Eden may have updated their UI. Open `beta.eden.so`, right-click the Add button → Inspect, and update `SELECTORS.addButton` in the script. |
| Links save too fast / errors | Increase `delayBetweenLinks` to `6000` or `8000`. |
| Script crashes mid-way | Check `eden_error.png` for a screenshot of what the browser saw. Re-run — already-saved links won't duplicate in Eden. |

## Notes

- The script opens a real browser window (when `headless: false`) so you can watch it work.
- If Eden's UI changes, you may need to update the selectors in the `SELECTORS` object.
- Eden may rate-limit rapid saves — if you have 100+ links, consider increasing `delayBetweenLinks`.
