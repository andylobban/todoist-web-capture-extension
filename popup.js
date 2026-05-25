const signedOutView = document.getElementById('signed-out-view');
const signedInView = document.getElementById('signed-in-view');
const signInButton = document.getElementById('sign-in');
const openSettingsButton = document.getElementById('open-settings');
const captureForm = document.getElementById('capture-form');
const taskTitleInput = document.getElementById('task-title');
const projectSelect = document.getElementById('project-id');
const labelsList = document.getElementById('labels-list');
const dueDateInput = document.getElementById('due-date');
const prioritySelect = document.getElementById('priority');
const descriptionInput = document.getElementById('description');
const pageUrl = document.getElementById('page-url');
const saveTaskButton = document.getElementById('save-task');
const status = document.getElementById('status');

let popupState = null;

signInButton.addEventListener('click', async () => {
  await runBusy(signInButton, 'Signing in…', async () => {
    const response = await chrome.runtime.sendMessage({ type: 'todoist.signIn' });
    if (!response?.ok) throw new Error(response?.error || 'Couldn’t sign in to Todoist. Try again.');
    status.textContent = 'Signed in. Loading capture form…';
    await hydrate();
  });
});

openSettingsButton.addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
});

captureForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await runBusy(saveTaskButton, 'Saving to Todoist…', async () => {
    const response = await chrome.runtime.sendMessage({
      type: 'todoist.createTask',
      payload: {
        title: taskTitleInput.value.trim(),
        projectId: projectSelect.value || null,
        labels: getSelectedLabels(),
        dueDate: dueDateInput.value || null,
        priority: prioritySelect.value ? Number(prioritySelect.value) : null,
        description: descriptionInput.value.trim() || null
      }
    });
    if (!response?.ok) throw new Error(response?.error || 'Couldn’t save to Todoist. Try again.');
    status.textContent = 'Saved to Todoist.';
    window.close();
  });
});

hydrate();

async function hydrate() {
  const response = await chrome.runtime.sendMessage({ type: 'todoist.getPopupState' });
  if (!response?.ok) {
    showSignedOut();
    status.textContent = response?.error || 'Couldn’t load the extension.';
    return;
  }

  popupState = response;
  if (!response.signedIn) {
    showSignedOut();
    status.textContent = response.unsupportedReason || '';
    return;
  }

  showSignedIn();
  populateProjects(response.projects || []);
  populateLabels(response.labels || []);
  taskTitleInput.value = response.defaultTitle || '';
  descriptionInput.value = '';
  dueDateInput.value = '';
  prioritySelect.value = '';
  pageUrl.textContent = response.pageUrl || '';

  const unsupportedReason = response.unsupportedReason || '';
  saveTaskButton.disabled = Boolean(unsupportedReason);
  taskTitleInput.disabled = Boolean(unsupportedReason);
  projectSelect.disabled = Boolean(unsupportedReason);
  dueDateInput.disabled = Boolean(unsupportedReason);
  prioritySelect.disabled = Boolean(unsupportedReason);
  descriptionInput.disabled = Boolean(unsupportedReason);
  setCheckboxesDisabled(Boolean(unsupportedReason));
  status.textContent = unsupportedReason;
}

function showSignedOut() {
  signedOutView.hidden = false;
  signedInView.hidden = true;
}

function showSignedIn() {
  signedOutView.hidden = true;
  signedInView.hidden = false;
}

function populateProjects(projects) {
  projectSelect.innerHTML = '<option value="">Inbox</option>';
  for (const project of projects) {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    projectSelect.append(option);
  }
}

function populateLabels(labels) {
  labelsList.innerHTML = '';
  if (!labels.length) {
    labelsList.className = 'checkbox-list empty-state';
    labelsList.textContent = 'No tags yet.';
    return;
  }

  labelsList.className = 'checkbox-list';
  for (const label of labels) {
    const wrapper = document.createElement('label');
    wrapper.className = 'checkbox-pill';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = label.name;

    const text = document.createElement('span');
    text.textContent = label.name;

    wrapper.append(input, text);
    labelsList.append(wrapper);
  }
}

function getSelectedLabels() {
  return Array.from(labelsList.querySelectorAll('input[type="checkbox"]:checked'), (input) => input.value);
}

function setCheckboxesDisabled(disabled) {
  for (const input of labelsList.querySelectorAll('input[type="checkbox"]')) {
    input.disabled = disabled;
  }
}

async function runBusy(button, message, fn) {
  const previous = button.textContent;
  button.disabled = true;
  status.textContent = message;
  try {
    await fn();
  } catch (error) {
    status.textContent = error?.message || 'Something went wrong.';
  } finally {
    button.disabled = false;
    button.textContent = previous;
  }
}
