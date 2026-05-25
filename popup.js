const loadingView = document.getElementById('loading-view');
const signedOutView = document.getElementById('signed-out-view');
const signedInView = document.getElementById('signed-in-view');
const signInButton = document.getElementById('sign-in');
const captureForm = document.getElementById('capture-form');
const taskTitleInput = document.getElementById('task-title');
const projectNameInput = document.getElementById('project-name');
const projectOptions = document.getElementById('project-options');
const labelsInput = document.getElementById('labels-input');
const labelOptions = document.getElementById('label-options');
const dueDateInput = document.getElementById('due-date');
const prioritySelect = document.getElementById('priority');
const descriptionInput = document.getElementById('description');
const pageUrl = document.getElementById('page-url');
const saveTaskButton = document.getElementById('save-task');
const status = document.getElementById('status');

let projectsByName = new Map();

signInButton.addEventListener('click', async () => {
  await runBusy(signInButton, 'Signing in…', async () => {
    const response = await chrome.runtime.sendMessage({ type: 'todoist.signIn' });
    if (!response?.ok) throw new Error(response?.error || 'Couldn’t sign in to Todoist. Try again.');
    await hydrate();
  });
});

captureForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await runBusy(saveTaskButton, 'Saving to Todoist…', async () => {
    const response = await chrome.runtime.sendMessage({
      type: 'todoist.createTask',
      payload: {
        title: taskTitleInput.value.trim(),
        projectId: resolveProjectId(projectNameInput.value),
        labels: parseLabels(labelsInput.value),
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
  showLoading();
  const response = await chrome.runtime.sendMessage({ type: 'todoist.getPopupState' });
  if (!response?.ok) {
    showSignedOut();
    status.textContent = response?.error || 'Couldn’t load the extension.';
    return;
  }

  if (!response.signedIn) {
    showSignedOut();
    status.textContent = response.unsupportedReason || '';
    return;
  }

  showSignedIn();
  populateProjects(response.projects || []);
  populateLabels(response.labels || []);
  taskTitleInput.value = response.defaultTitle || '';
  projectNameInput.value = '';
  labelsInput.value = '';
  descriptionInput.value = '';
  dueDateInput.value = '';
  prioritySelect.value = '';
  pageUrl.textContent = response.pageUrl || '';

  const unsupportedReason = response.unsupportedReason || '';
  setFormDisabled(Boolean(unsupportedReason));
  status.textContent = unsupportedReason;

  if (!unsupportedReason) {
    queueMicrotask(() => saveTaskButton.focus());
  }
}

function showLoading() {
  loadingView.hidden = false;
  signedOutView.hidden = true;
  signedInView.hidden = true;
}

function showSignedOut() {
  loadingView.hidden = true;
  signedOutView.hidden = false;
  signedInView.hidden = true;
}

function showSignedIn() {
  loadingView.hidden = true;
  signedOutView.hidden = true;
  signedInView.hidden = false;
}

function populateProjects(projects) {
  projectsByName = new Map();
  projectOptions.innerHTML = '';

  for (const project of projects) {
    const name = String(project.name || '').trim();
    const id = project.id == null ? '' : String(project.id);
    if (!name || !id) continue;
    projectsByName.set(name.toLowerCase(), id);

    const option = document.createElement('option');
    option.value = name;
    projectOptions.append(option);
  }
}

function populateLabels(labels) {
  labelOptions.innerHTML = '';
  for (const label of labels) {
    const name = String(label.name || '').trim();
    if (!name) continue;
    const option = document.createElement('option');
    option.value = name;
    labelOptions.append(option);
  }
}

function resolveProjectId(name) {
  const value = String(name || '').trim();
  if (!value) return null;
  return projectsByName.get(value.toLowerCase()) || null;
}

function parseLabels(value) {
  return String(value || '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
}

function setFormDisabled(disabled) {
  for (const element of [
    taskTitleInput,
    projectNameInput,
    labelsInput,
    dueDateInput,
    prioritySelect,
    descriptionInput,
    saveTaskButton
  ]) {
    element.disabled = disabled;
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
