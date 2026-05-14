const signInButton = document.getElementById('sign-in');
const openSettingsButton = document.getElementById('open-settings');
const status = document.getElementById('status');

signInButton.addEventListener('click', async () => {
  await runAction(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'todoist.signIn' });
    if (!response?.ok) throw new Error(response?.error || 'Couldn’t sign in to Todoist. Try again.');
    status.textContent = 'You’re ready. Click the extension to save this page.';
    window.close();
  });
});

openSettingsButton.addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
});

async function runAction(fn) {
  signInButton.disabled = true;
  status.textContent = 'Signing in…';
  try {
    await fn();
  } catch (error) {
    status.textContent = error?.message || 'Couldn’t sign in to Todoist. Try again.';
  } finally {
    signInButton.disabled = false;
  }
}
