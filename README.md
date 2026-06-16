# Todoist Web Capture Extension

Todoist Web Capture Extension is a Manifest V3 Chrome extension that saves the current page to Todoist in one click.

## Current status
This repository contains a working V1 scaffold:
- Todoist sign-in flow designed for Todoist public-client metadata + PKCE
- One-click toolbar save of the current page title and URL
- Context-menu save path using the same capture logic
- Gmail message captures simplify the task title to `[subject] - Email to [account]`
- Signed-out onboarding popup
- Minimal settings page with sign-out and an `Open Todoist after saving` preference
- Chrome Web Store support assets including QA notes, listing copy, and privacy-policy draft

The code currently passes the local syntax check and packages successfully into a Chrome extension zip.

## What is still required before release
This project is not yet ready for store submission.

The main remaining release dependency is the placeholder Todoist metadata client URL in `background.js`:

```js
clientIdMetadataUrl: 'https://example.com/todoist/chrome-extension-client.json'
```

Before a public build can be tested end to end, that URL must be replaced with a real public HTTPS metadata document registered for Todoist's public-client OAuth flow.

## Repository structure
- `manifest.json` — Chrome extension manifest
- `background.js` — service worker, auth flow, capture logic, and Todoist API calls
- `popup.html`, `popup.js`, `popup.css` — popup UI and signed-out onboarding
- `options.html`, `options.js`, `options.css` — settings UI
- `icons/` — extension icons
- `docs/qa-checklist.md` — functional QA checklist
- `docs/chrome-web-store-submission-pack.md` — store submission checklist
- `docs/todoist-client-metadata.example.json` — example Todoist metadata client document
- `store/listing-copy.md` — draft Chrome Web Store copy
- `store/privacy-policy.md` — privacy-policy draft
- `scripts/package_extension.py` — packaging helper
- `dist/` — generated packaging output

## Local usage
### Load unpacked
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository folder

### Run checks
```bash
npm run check
```

This verifies the JavaScript files with `node --check`.

### Package the extension
```bash
npm run package
```

This creates `dist/todoist-web-capture-extension.zip`.

## Release path
The practical route from this scaffold to store submission is:
1. Host the Todoist metadata client JSON on public HTTPS.
2. Replace the placeholder metadata URL in `background.js`.
3. Load the extension unpacked and confirm the final Chrome extension ID.
4. Ensure the hosted metadata document includes the exact Chrome redirect URI.
5. Complete the QA checklist with a real Todoist login.
6. Capture store screenshots and finalise listing assets.
7. Package the final build zip.
8. Submit through the Chrome Web Store Developer Dashboard.

A more detailed step-by-step guide is tracked separately for the current project handoff.

## Notes
- This checkout is currently a local managed project folder rather than a cloned remote repository.
- The packaged zip is build output, not the primary source of truth.
- The extension is intentionally narrow in V1: fast capture first, with minimal UI and minimal permissions.
