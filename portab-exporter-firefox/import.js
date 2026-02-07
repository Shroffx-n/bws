// import.js - Full-page import functionality with favicon support

const browserAPI = (() => {
  if (typeof browser !== 'undefined') return browser;
  if (typeof chrome !== 'undefined') return chrome;
  return null;
})();

let currentSession = null;
let selectedTabs = new Set();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

function setupEventListeners() {
  const fileInput = document.getElementById('file-input');
  const uploadArea = document.getElementById('file-upload-area');

  fileInput.addEventListener('change', handleFileSelect);

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--accent-primary)';
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'var(--border-color)';
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--border-color)';

    if (e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });

  document.getElementById('decrypt-button').addEventListener('click', handleDecrypt);
  document.getElementById('import-selected').addEventListener('click', () => handleImport(false));
  document.getElementById('import-all').addEventListener('click', () => handleImport(true));
}

function handleFileSelect() {
  const file = document.getElementById('file-input').files[0];
  if (!file) return;

  const uploadArea = document.getElementById('file-upload-area');
  uploadArea.classList.add('has-file');
  uploadArea.innerHTML = `
    <div class="file-upload-icon">📄</div>
    <div class="file-upload-text">${file.name}</div>
    <div class="file-upload-hint">${(file.size / 1024).toFixed(1)} KB</div>
  `;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const sessionData = JSON.parse(e.target.result);
      processSession(sessionData);
    } catch (error) {
      showStatus("Invalid file format!", "error");
      console.error("Parse error:", error);
    }
  };
  reader.readAsText(file);
}

function processSession(sessionData) {
  if (sessionData.encrypted) {
    currentSession = sessionData;
    document.getElementById('decrypt-section').classList.add('show');
    showSessionInfo(sessionData, true);
  } else {
    currentSession = sessionData;
    showSessionInfo(sessionData, false);
    renderTabList(sessionData);
  }
}

function showSessionInfo(sessionData, isEncrypted) {
  const metadata = sessionData.metadata || {};

  document.getElementById('session-name').textContent = metadata.name || 'Unknown Session';

  if (isEncrypted) {
    document.getElementById('info-windows').textContent = '🔒 Encrypted';
    document.getElementById('info-tabs').textContent = '🔒 Encrypted';
  } else {
    document.getElementById('info-windows').textContent = metadata.window_count || 0;
    document.getElementById('info-tabs').textContent = metadata.tab_count || 0;
  }

  document.getElementById('info-source').textContent = (metadata.source_browser || 'Unknown').toUpperCase();
  document.getElementById('info-created').textContent = metadata.created
    ? new Date(metadata.created).toLocaleDateString()
    : 'Unknown';

  document.getElementById('session-info').classList.add('show');
}

async function handleDecrypt() {
  const password = document.getElementById('decrypt-password').value;

  if (!password) {
    showStatus("Password required!", "error");
    return;
  }

  showStatus("Decrypting...", "info");
  document.getElementById('decrypt-button').disabled = true;

  try {
    const response = await browserAPI.runtime.sendMessage({
      action: "decrypt-session",
      options: { password: password },
      data: { sessionData: currentSession }
    });

    if (response && response.success) {
      currentSession = response.session;
      document.getElementById('decrypt-section').classList.remove('show');
      showSessionInfo(currentSession, false);
      renderTabList(currentSession);
      showStatus("✓ Decrypted successfully!", "success");
    } else {
      showStatus(`Error: ${response?.error || 'Decryption failed'}`, "error");
      document.getElementById('decrypt-button').disabled = false;
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
    console.error("Decrypt error:", error);
    document.getElementById('decrypt-button').disabled = false;
  }
}

function renderTabList(session) {
  const container = document.getElementById('windows-container');
  container.innerHTML = '';

  selectedTabs.clear();

  const windows = session.windows || {};

  Object.keys(windows).forEach((windowKey) => {
    const window = windows[windowKey];

    if (!window || !window.tabs || window.tabs.length === 0) {
      return;
    }

    const windowSection = document.createElement('div');
    windowSection.className = 'window-section';

    // Window header
    const windowHeader = document.createElement('div');
    windowHeader.className = 'window-header';

    const windowCheckbox = document.createElement('input');
    windowCheckbox.type = 'checkbox';
    windowCheckbox.checked = true;
    windowCheckbox.dataset.windowKey = windowKey;
    windowCheckbox.addEventListener('change', (e) => {
      handleWindowCheckbox(windowKey, e.target.checked);
    });

    const windowTitle = document.createElement('div');
    windowTitle.className = 'window-title';
    windowTitle.textContent = `${windowKey.replace('_', ' ').toUpperCase()} (${window.tabs.length} tabs)`;

    windowHeader.appendChild(windowCheckbox);
    windowHeader.appendChild(windowTitle);

    if (window.incognito) {
      const badge = document.createElement('span');
      badge.className = 'window-badge';
      badge.textContent = '🕶️ Incognito';
      windowHeader.appendChild(badge);
    }

    windowSection.appendChild(windowHeader);

    // Tabs
    window.tabs.forEach((tab, tabIndex) => {
      const tabItem = document.createElement('div');
      tabItem.className = 'tab-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.windowKey = windowKey;
      checkbox.dataset.tabIndex = tabIndex;
      checkbox.addEventListener('change', handleTabCheckbox);

      const tabId = `${windowKey}-${tabIndex}`;
      selectedTabs.add(tabId);

      // Favicon
      let faviconElement;
      if (tab.favicon && tab.favicon.startsWith('http')) {
        // Real favicon from session
        faviconElement = document.createElement('img');
        faviconElement.className = 'tab-favicon';
        faviconElement.src = tab.favicon;
        faviconElement.onerror = () => {
          // Replace with fallback
          const fallback = getFallbackFavicon(tab.url);
          faviconElement.src = fallback;
        };
      } else {
        // Generate favicon from URL
        faviconElement = document.createElement('img');
        faviconElement.className = 'tab-favicon';
        faviconElement.src = getFallbackFavicon(tab.url);
      }

      const tabInfo = document.createElement('div');
      tabInfo.className = 'tab-info';

      const tabTitle = document.createElement('div');
      tabTitle.className = 'tab-title';
      tabTitle.textContent = tab.title || 'Untitled';

      const tabUrl = document.createElement('div');
      tabUrl.className = 'tab-url';
      try {
        const url = new URL(tab.url);
        tabUrl.textContent = url.hostname;
      } catch {
        tabUrl.textContent = tab.url.substring(0, 80);
      }

      tabInfo.appendChild(tabTitle);
      tabInfo.appendChild(tabUrl);

      const badges = document.createElement('div');
      badges.className = 'tab-badges';

      if (tab.pinned) {
        const pinBadge = document.createElement('span');
        pinBadge.className = 'badge';
        pinBadge.textContent = '📌';
        pinBadge.title = 'Pinned';
        badges.appendChild(pinBadge);
      }

      if (tab.group_id && session.groups && session.groups[tab.group_id]) {
        const groupBadge = document.createElement('span');
        groupBadge.className = 'badge';
        groupBadge.textContent = '🏷️';
        groupBadge.title = session.groups[tab.group_id].name || 'Tab Group';
        badges.appendChild(groupBadge);
      }

      tabItem.appendChild(checkbox);
      tabItem.appendChild(faviconElement);
      tabItem.appendChild(tabInfo);
      tabItem.appendChild(badges);

      windowSection.appendChild(tabItem);
    });

    container.appendChild(windowSection);
  });

  updateSelectionInfo();
  document.getElementById('tab-list').classList.add('show');
}

// Generate fallback favicon
function getFallbackFavicon(url) {
  try {
    const urlObj = new URL(url);
    // Use Google's favicon service
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    // Return generic icon as data URL
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/%3E%3C/svg%3E';
  }
}

function handleWindowCheckbox(windowKey, checked) {
  const checkboxes = document.querySelectorAll(`input[data-window-key="${windowKey}"][data-tab-index]`);

  checkboxes.forEach(checkbox => {
    checkbox.checked = checked;
    const tabId = `${windowKey}-${checkbox.dataset.tabIndex}`;

    if (checked) {
      selectedTabs.add(tabId);
    } else {
      selectedTabs.delete(tabId);
    }
  });

  updateSelectionInfo();
}

function handleTabCheckbox(e) {
  const windowKey = e.target.dataset.windowKey;
  const tabIndex = e.target.dataset.tabIndex;
  const tabId = `${windowKey}-${tabIndex}`;

  if (e.target.checked) {
    selectedTabs.add(tabId);
  } else {
    selectedTabs.delete(tabId);

    const windowCheckbox = document.querySelector(`input[data-window-key="${windowKey}"]:not([data-tab-index])`);
    if (windowCheckbox) windowCheckbox.checked = false;
  }

  const allTabsInWindow = document.querySelectorAll(`input[data-window-key="${windowKey}"][data-tab-index]`);
  const allChecked = Array.from(allTabsInWindow).every(cb => cb.checked);

  const windowCheckbox = document.querySelector(`input[data-window-key="${windowKey}"]:not([data-tab-index])`);
  if (windowCheckbox) windowCheckbox.checked = allChecked;

  updateSelectionInfo();
}

function updateSelectionInfo() {
  const count = selectedTabs.size;
  const infoElement = document.getElementById('selection-info');
  if (infoElement) {
    infoElement.textContent = `${count} tab${count !== 1 ? 's' : ''} selected`;
  }
}

async function handleImport(importAll) {
  const restoreIncognito = document.getElementById('restore-incognito').checked;

  showStatus("Importing session...", "info");
  document.getElementById('import-selected').disabled = true;
  document.getElementById('import-all').disabled = true;

  try {
    let sessionToImport;

    if (importAll) {
      sessionToImport = currentSession;
    } else {
      sessionToImport = {
        ...currentSession,
        windows: {}
      };

      selectedTabs.forEach(tabId => {
        const [windowKey, tabIndex] = tabId.split('-');
        const tabIndexNum = parseInt(tabIndex);

        if (!sessionToImport.windows[windowKey]) {
          sessionToImport.windows[windowKey] = {
            ...currentSession.windows[windowKey],
            tabs: []
          };
        }

        sessionToImport.windows[windowKey].tabs.push(
          currentSession.windows[windowKey].tabs[tabIndexNum]
        );
      });
    }

    const response = await browserAPI.runtime.sendMessage({
      action: "import-session",
      options: { restoreIncognito: restoreIncognito },
      data: { session: sessionToImport }
    });

    if (response && response.success) {
      showStatus(`✓ ${response.message}`, "success");
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      showStatus(`Error: ${response?.error || 'Import failed'}`, "error");
      document.getElementById('import-selected').disabled = false;
      document.getElementById('import-all').disabled = false;
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
    console.error("Import error:", error);
    document.getElementById('import-selected').disabled = false;
    document.getElementById('import-all').disabled = false;
  }
}

function showStatus(message, type = "info") {
  const banner = document.getElementById('status-banner');
  banner.textContent = message;
  banner.className = `status-banner show ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      banner.classList.remove('show');
    }, 3000);
  }
}
