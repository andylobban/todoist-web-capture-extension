# Chrome Web Store submission pack

## Included in this workspace
- Extension source and load-unpacked scaffold
- Base icon set in `icons/`
- Listing copy draft in `store/listing-copy.md`
- QA checklist in `docs/qa-checklist.md`
- Todoist metadata client template in `docs/todoist-client-metadata.example.json`

## Still required before submission
1. Replace the placeholder Todoist metadata client URL in `background.js`.
2. Host the metadata JSON over public HTTPS and update its redirect URI to the final extension ID.
3. Capture final screenshots at 1280×800 or 640×400.
4. Produce a 440×280 promo tile if you want richer listing placement.
5. Decide whether a hosted privacy-policy page is needed for the final listing inputs.

## Suggested screenshot set
1. Signed-out onboarding popup
2. Signed-in browser state before save
3. Success state after save
4. Context-menu action on a page
5. Minimal settings page showing connected account and one preference

## Packaging note
Use `npm run package` to create `dist/todoist-better-extension.zip` after swapping the placeholder client metadata URL.
