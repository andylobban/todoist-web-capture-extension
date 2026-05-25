# QA checklist — Todoist Web Capture Extension V1

## Auth
- [ ] Signed-out click opens the onboarding popup.
- [ ] `Sign in with Todoist` completes Chrome identity flow successfully.
- [ ] Cancelling auth shows a recoverable error.
- [ ] Sign out clears session and returns the action to signed-out state.

## Capture
- [ ] Toolbar click on a normal HTTPS page creates one Todoist task.
- [ ] Task `content` matches the page title.
- [ ] Task `description` includes the source URL.
- [ ] Context-menu action creates the same payload.
- [ ] Duplicate click during an in-flight save does not create a second task.
- [ ] Immediate repeat click within five seconds shows success rather than double-saving.

## Edge cases
- [ ] `chrome://` pages show the unsupported-page message.
- [ ] Extension pages show the unsupported-page message.
- [ ] A page with no title falls back to the hostname or `Untitled page`.
- [ ] Expired token path forces sign-in again cleanly.
- [ ] Network failure shows `Couldn’t save to Todoist. Try again.`

## Settings
- [ ] Settings page loads current auth state.
- [ ] `Open Todoist after saving` persists across browser restarts.
- [ ] Enabling `Open Todoist after saving` opens the newly created Todoist task URL.

## Submission readiness
- [ ] Placeholder metadata client URL in `background.js` has been replaced.
- [ ] Hosted metadata document matches the final Chrome extension ID.
- [ ] Store icon assets are present and crisp at 16/32/48/128/128 store size.
- [ ] Store listing copy has been finalised.
- [ ] Screenshots show real product surfaces, not mocks detached from the UI.
