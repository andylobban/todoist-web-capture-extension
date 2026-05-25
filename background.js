const TODOIST_AUTHORIZE_URL = 'https://app.todoist.com/oauth/authorize';
const TODOIST_TOKEN_URL = 'https://api.todoist.com/oauth/access_token';
const TODOIST_TASKS_URL = 'https://api.todoist.com/api/v1/tasks';
const TODOIST_PROJECTS_URL = 'https://api.todoist.com/api/v1/projects';
const TODOIST_LABELS_URL = 'https://api.todoist.com/api/v1/labels';
const POPUP_PATH = 'popup.html';
const CONFIG = {
  clientIdMetadataUrl: 'https://andylobban.github.io/todoist-web-capture-extension/todoist-client-metadata.json',
  openTodoistAfterSaveDefault: false,
  requestTimeoutMs: 12000,
  recentDuplicateWindowMs: 5000
};
const TOKEN_KEY = 'todoistTokens';
const SETTINGS_KEY = 'settings';
const LAST_SAVE_KEY = 'lastSaveByTab';
const inFlightByTab = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
  chrome.contextMenus.create({
    id: 'save-page-to-todoist',
    title: 'Save page to Todoist',
    contexts: ['page']
  });
  await updateActionAvailability();
});

chrome.runtime.onStartup?.addListener(() => {
  updateActionAvailability();
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && (changes[TOKEN_KEY] || changes[SETTINGS_KEY])) {
    await updateActionAvailability();
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  await handleSaveFromTab(tab);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-page-to-todoist') {
    await handleSaveFromTab(tab);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'todoist.signIn') {
      await signIn();
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === 'todoist.signOut') {
      await clearTokens();
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === 'todoist.getStatus') {
      const [tokens, settings] = await Promise.all([getTokens(), getSettings()]);
      sendResponse({
        ok: true,
        signedIn: Boolean(tokens?.refreshToken),
        openTodoistAfterSave: settings.openTodoistAfterSave,
        clientIdMetadataUrl: CONFIG.clientIdMetadataUrl
      });
      return;
    }
    if (message?.type === 'todoist.getPopupState') {
      const state = await getPopupState();
      sendResponse({ ok: true, ...state });
      return;
    }
    if (message?.type === 'todoist.createTask') {
      const task = await createTaskFromForm(message.payload ?? {});
      sendResponse({ ok: true, task });
      return;
    }
    if (message?.type === 'todoist.setSettings') {
      const settings = await saveSettings(message.payload ?? {});
      sendResponse({ ok: true, settings });
      return;
    }
    sendResponse({ ok: false, error: 'Unknown message type' });
  })().catch((error) => {
    sendResponse({ ok: false, error: normaliseErrorMessage(error) });
  });
  return true;
});

async function handleSaveFromTab(tab) {
  const activeTab = tab ?? await getActiveTab();
  if (!activeTab?.id) {
    await setActionFeedback('ERR', '#b42318', 'This page can’t be saved here.');
    return;
  }

  const unsupportedReason = getUnsupportedReason(activeTab.url);
  if (unsupportedReason) {
    await setActionFeedback('ERR', '#b42318', unsupportedReason);
    return;
  }

  const tokens = await ensureValidTokens();
  if (!tokens?.accessToken) {
    await setActionFeedback('', '#000000', 'Sign in to Todoist to save pages.');
    return;
  }

  if (inFlightByTab.has(activeTab.id)) {
    await setActionFeedback('…', '#0b57d0', 'Already saving this page…');
    return;
  }

  const tabKey = String(activeTab.id);
  const lastSaveByTab = await getLastSaveByTab();
  const now = Date.now();
  if (lastSaveByTab[tabKey] && now - lastSaveByTab[tabKey] < CONFIG.recentDuplicateWindowMs) {
    await setActionFeedback('OK', '#1f883d', 'Saved to Todoist');
    return;
  }

  inFlightByTab.set(activeTab.id, now);
  await setActionFeedback('…', '#0b57d0', 'Saving to Todoist…');

  try {
    const payload = buildTaskPayload(activeTab);
    const response = await fetchWithTimeout(TODOIST_TASKS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401) {
        await clearTokens();
        throw new Error('Sign in to Todoist to save pages.');
      }
      throw new Error('Couldn’t save to Todoist. Try again.');
    }

    const createdTask = await response.json();
    lastSaveByTab[tabKey] = now;
    await chrome.storage.session.set({ [LAST_SAVE_KEY]: lastSaveByTab });
    await setActionFeedback('OK', '#1f883d', 'Saved to Todoist');

    const settings = await getSettings();
    if (settings.openTodoistAfterSave && createdTask?.url) {
      await chrome.tabs.create({ url: createdTask.url });
    }
  } catch (error) {
    await setActionFeedback('ERR', '#b42318', normaliseErrorMessage(error));
  } finally {
    inFlightByTab.delete(activeTab.id);
  }
}

function getUnsupportedReason(url) {
  if (!url) return 'This page can’t be saved here.';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
    return 'This page can’t be saved from Chrome pages or restricted tabs.';
  }
  return null;
}

function buildTaskPayload(tab) {
  const title = cleanTitle(tab.title, tab.url);
  return {
    content: buildMarkdownLinkedTitle(title, tab.url)
  };
}

function cleanTitle(title, url) {
  const trimmed = (title || '').replace(/\s+/g, ' ').trim();
  if (trimmed) return trimmed.slice(0, 500);
  try {
    return new URL(url).hostname;
  } catch {
    return 'Untitled page';
  }
}

async function signIn() {
  const redirectUri = chrome.identity.getRedirectURL('provider_cb');
  const verifier = createRandomString(64);
  const state = createRandomString(32);
  const challenge = await sha256Base64Url(verifier);
  const authUrl = new URL(TODOIST_AUTHORIZE_URL);
  authUrl.searchParams.set('client_id', CONFIG.clientIdMetadataUrl);
  authUrl.searchParams.set('scope', 'data:read_write');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('redirect_uri', redirectUri);

  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });

  const callback = new URL(callbackUrl);
  const returnedState = callback.searchParams.get('state');
  const code = callback.searchParams.get('code');
  if (returnedState !== state || !code) {
    throw new Error('Couldn’t sign in to Todoist. Try again.');
  }

  const response = await fetchWithTimeout(TODOIST_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CONFIG.clientIdMetadataUrl,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  });
  if (!response.ok) {
    throw new Error('Couldn’t sign in to Todoist. Try again.');
  }
  const tokens = await response.json();
  await persistTokens(tokens);
  await updateActionAvailability();
  await setActionFeedback('OK', '#1f883d', 'You’re ready. Click the extension to save this page.');
}

async function ensureValidTokens() {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) {
    return null;
  }
  if (tokens.accessToken && (!tokens.expiresAt || tokens.expiresAt > Date.now() + 60_000)) {
    return tokens;
  }
  return refreshTokens(tokens.refreshToken);
}

async function refreshTokens(refreshToken) {
  const response = await fetchWithTimeout(TODOIST_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CONFIG.clientIdMetadataUrl,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  if (!response.ok) {
    await clearTokens();
    return null;
  }
  const tokens = await response.json();
  await persistTokens(tokens);
  await updateActionAvailability();
  return getTokens();
}

async function persistTokens(tokens) {
  const record = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null,
    tokenType: tokens.token_type ?? 'Bearer'
  };
  await chrome.storage.local.set({ [TOKEN_KEY]: record });
}

async function clearTokens() {
  await chrome.storage.local.remove(TOKEN_KEY);
  await chrome.storage.session.remove(LAST_SAVE_KEY);
  await updateActionAvailability();
}

async function getTokens() {
  const data = await chrome.storage.local.get(TOKEN_KEY);
  return data[TOKEN_KEY] ?? null;
}

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return {
    openTodoistAfterSave: CONFIG.openTodoistAfterSaveDefault,
    ...(data[SETTINGS_KEY] ?? {})
  };
}

async function saveSettings(partial) {
  const settings = {
    ...(await getSettings()),
    ...partial
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

async function getLastSaveByTab() {
  const data = await chrome.storage.session.get(LAST_SAVE_KEY);
  return data[LAST_SAVE_KEY] ?? {};
}

async function updateActionAvailability() {
  const tokens = await getTokens();
  const signedIn = Boolean(tokens?.refreshToken);
  await chrome.action.setTitle({ title: signedIn ? 'Save page to Todoist' : 'Sign in to Todoist to save pages in one click' });
  if (!signedIn) {
    await chrome.action.setBadgeText({ text: '' });
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] ?? null;
}

async function setActionFeedback(text, color, title) {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  await chrome.action.setTitle({ title });
  clearTimeout(setActionFeedback.timeoutId);
  setActionFeedback.timeoutId = setTimeout(async () => {
    await chrome.action.setBadgeText({ text: '' });
    await updateActionAvailability();
  }, 2200);
}
setActionFeedback.timeoutId = null;

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function normaliseErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return 'Couldn’t save to Todoist. Try again.';
}

async function getPopupState() {
  const [tokens, settings, activeTab] = await Promise.all([
    ensureValidTokens(),
    getSettings(),
    getActiveTab()
  ]);

  const unsupportedReason = getUnsupportedReason(activeTab?.url);
  if (!tokens?.accessToken) {
    return {
      signedIn: false,
      openTodoistAfterSave: settings.openTodoistAfterSave,
      clientIdMetadataUrl: CONFIG.clientIdMetadataUrl,
      unsupportedReason
    };
  }

  const [projects, labels] = await Promise.all([
    fetchTodoistCollection(TODOIST_PROJECTS_URL, tokens.accessToken),
    fetchTodoistCollection(TODOIST_LABELS_URL, tokens.accessToken)
  ]);

  return {
    signedIn: true,
    openTodoistAfterSave: settings.openTodoistAfterSave,
    clientIdMetadataUrl: CONFIG.clientIdMetadataUrl,
    unsupportedReason,
    defaultTitle: cleanTitle(activeTab?.title, activeTab?.url),
    pageUrl: activeTab?.url ?? '',
    projects: projects
      .map((project) => ({ id: project.id, name: project.name }))
      .filter((project) => project.id && project.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
    labels: labels
      .map((label) => ({ id: label.id, name: label.name }))
      .filter((label) => label.name)
      .sort((a, b) => a.name.localeCompare(b.name))
  };
}

async function createTaskFromForm(form) {
  const activeTab = await getActiveTab();
  const unsupportedReason = getUnsupportedReason(activeTab?.url);
  if (unsupportedReason) {
    throw new Error(unsupportedReason);
  }

  const tokens = await ensureValidTokens();
  if (!tokens?.accessToken) {
    throw new Error('Sign in to Todoist to save pages.');
  }

  const title = (form.title || '').trim() || cleanTitle(activeTab?.title, activeTab?.url);
  const payload = {
    content: buildMarkdownLinkedTitle(title, activeTab.url)
  };

  if (form.description) payload.description = form.description;
  if (form.projectId) payload.project_id = form.projectId;
  if (Array.isArray(form.labels) && form.labels.length) payload.labels = form.labels;
  if (Number.isInteger(form.priority)) payload.priority = form.priority;
  if (form.dueDate) payload.due_date = form.dueDate;

  const response = await fetchWithTimeout(TODOIST_TASKS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 401) {
      await clearTokens();
      throw new Error('Sign in to Todoist to save pages.');
    }
    throw new Error(await readTodoistError(response, 'Couldn’t save to Todoist. Try again.'));
  }

  const createdTask = await response.json();
  await setActionFeedback('OK', '#1f883d', 'Saved to Todoist');

  const settings = await getSettings();
  if (settings.openTodoistAfterSave && createdTask?.url) {
    await chrome.tabs.create({ url: createdTask.url });
  }

  return createdTask;
}

async function fetchTodoistCollection(url, accessToken) {
  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    if (response.status === 401) {
      await clearTokens();
      throw new Error('Sign in to Todoist to save pages.');
    }
    throw new Error(await readTodoistError(response, 'Couldn’t load Todoist data. Try again.'));
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function readTodoistError(response, fallbackMessage) {
  try {
    const text = await response.text();
    if (!text) return fallbackMessage;
    const parsed = JSON.parse(text);
    return parsed.error || parsed.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function buildMarkdownLinkedTitle(title, url) {
  return `[${escapeMarkdownText(title)}](${encodeUrlForMarkdown(url)})`;
}

function escapeMarkdownText(text) {
  return String(text || '').replace(/[\\\[\]]/g, '\\$&');
}

function encodeUrlForMarkdown(url) {
  return encodeURI(String(url || '')).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function createRandomString(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
}

async function sha256Base64Url(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = Array.from(new Uint8Array(digest));
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
