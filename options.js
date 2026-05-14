const accountStatus = document.getElementById('account-status');
const signInButton = document.getElementById('sign-in');
const signOutButton = document.getElementById('sign-out');
const openAfterSave = document.getElementById('open-after-save');
const clientIdUrl = document.getElementById('client-id-url');
const status = document.getElementById('status');

signInButton.addEventListener('click', () => runAction(async () => {
  const response = await chrome.runtime.sendMessage({ type: 'todoist.signIn' });
  if (!response?.ok) throw new Error(response?.error || 'Couldn’t sign in to Todoist. Try again.');
  status.textContent = 'Signed in.';
  await hydrate();
}));

signOutButton.addEventListener('click', () => runAction(async () => {
  const response = await chrome.runtime.sendMessage({ type: 'todoist.signOut' });
  if (!response?.ok) throw new Error(response?.error || 'Couldn’t sign out.');
  status.textContent = 'Signed out.';
  await hydrate();
}));

openAfterSave.addEventListener('change', async () => {
  const response = await chrome.runtime.sendMessage({
    type: 'todoist.setSettings',
    payload: { openTodoistAfterSave: openAfterSave.checked }
  });
  if (!response?.ok) {
    status.textContent = response?.error || 'Couldn’t save settings.';
    return;
  }
  status.textContent = 'Settings saved.';
});

hydrate();

async function hydrate() {
  const response = await chrome.runtime.sendMessage({ type: 'todoist.getStatus' });
  if (!response?.ok) {
    status.textContent = response?.error || 'Couldn’t load settings.';
    return;
  }
  accountStatus.textContent = response.signedIn ? 'Signed in to Todoist.' : 'Not signed in.';
  openAfterSave.checked = Boolean(response.openTodoistAfterSave);
  clientIdUrl.textContent = response.clientIdMetadataUrl;
  signInButton.disabled = response.signedIn;
  signOutButton.disabled = !response.signedIn;
}

async function runAction(fn) {
  signInButton.disabled = true;
  signOutButton.disabled = true;
  try {
    await fn();
  } catch (error) {
    status.textContent = error?.message || 'Something went wrong.';
  } finally {
    await hydrate();
  }
}
