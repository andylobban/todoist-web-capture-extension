# Chrome Web Store listing copy draft

## Name
Todoist Web Capture Extension

## Short description
Save the current page to Todoist in one click.

## Detailed description
Todoist Web Capture Extension cuts the browser-capture flow down to one deliberate click.

### What it does
- Saves the current page title straight to Todoist
- Adds the source URL automatically
- Lets you sign in once, then capture pages without opening a tiny web-app window first
- Shows clear signed-in, saving, success, and failure states

### Designed for speed
The default action is intentionally opinionated: click means save. No required pre-submit form, no project picker, no extra ceremony.

### V1 scope
- Todoist sign-in
- One-click toolbar save
- Context-menu save
- Minimal settings for account state and one low-risk preference

### Data use
This extension sends the current page title and URL to Todoist only when you trigger a save.
It stores Todoist auth tokens in Chrome extension storage so the action can work across sessions.
It does not inject content scripts or request broad site access.
