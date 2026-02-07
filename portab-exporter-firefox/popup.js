// popup.js - Complete UI handler for Portab Session Manager

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let state = {
  isIncognito: false,
  currentView: 'export-main', // or 'export-detail', 'import-main', 'import-detail'

  // Export state
  exportTabs: [],
  exportSelectedTabs: new Set(),

  // Import state
  importSession: null,
  importSelectedTabs: new Set(),
  currentFile: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await detectIncognito();
  setupEventListeners();
  console.log("Portab popup initialized");
});

// Detect if opened in incognito/private window
async function detectIncognito() {
  try {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const currentWindow = await api.windows.getCurrent();
    state.isIncognito = currentWindow.incognito;

    if (state.isIncognito) {
      document.getElementById('incognito-badge').classList.add('show');
      document.getElementById('privacy-mode').checked = true;
    }
  } catch (error) {
    console.error("Could not detect incognito mode:", error);
  }
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', handleTabSwitch);
  });

  // Export options
  document.getElementById('secure-mode').addEventListener('change', handleSecureModeToggle);

  // Export buttons
  document.getElementById('export-current').addEventListener('click', handleExportCurrent);
  document.getElementById('export-all').addEventListener('click', handleExportAll);
  document.getElementById('export-selected').addEventListener('click', handleExportSelectedClick);
  document.getElementById('export-pinned').addEventListener('click', handleExportPinned);

  // Export detail view
  document.getElementById('export-back-button').addEventListener('click', () => {
    switchView('export-main');
  });
  document.getElementById('export-selected-confirm').addEventListener('click', handleExportSelectedConfirm);

  // Import file upload
  const fileInput = document.getElementById('file-input');
  const fileUploadArea = document.getElementById('file-upload-area');

  fileInput.addEventListener('change', handleFileSelect);
  fileUploadArea.addEventListener('dragover', handleDragOver);
  fileUploadArea.addEventListener('dragleave', handleDragLeave);
  fileUploadArea.addEventListener('drop', handleDrop);

  // Import decrypt
  document.getElementById('decrypt-button').addEventListener('click', handleDecrypt);

  // Import detail view
  document.getElementById('import-back-button').addEventListener('click', () => {
    resetImport();
    switchView('import-main');
  });
  document.getElementById('import-selected-confirm').addEventListener('click', handleImportSelected);
  document.getElementById('import-all-confirm').addEventListener('click', handleImportAll);
}

// ============================================================================
// TAB SWITCHING
// ============================================================================

function handleTabSwitch(e) {
  const tabName = e.target.dataset.tab;

  // Update active tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');

  // Update active content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Reset views
  if (tabName === 'export') {
    switchView('export-main');
  } else {
    switchView('import-main');
  }

  hideStatus();
}

// ============================================================================
// VIEW SWITCHING
// ============================================================================

function switchView(viewName) {
  state.currentView = viewName;

  // Export views
  const exportMainView = document.getElementById('export-main-view');
  const exportDetailView = document.getElementById('export-detail-view');

  // Import views
  const importMainView = document.getElementById('import-main-view');
  const importDetailView = document.getElementById('import-detail-view');

  // Hide all
  exportMainView.classList.remove('hidden');
  exportDetailView.classList.remove('active');
  importMainView.classList.remove('hidden');
  importDetailView.classList.remove('active');

  // Show appropriate view
  switch(viewName) {
    case 'export-main':
      exportMainView.classList.remove('hidden');
      exportDetailView.classList.remove('active');
      break;
    case 'export-detail':
      exportMainView.classList.add('hidden');
      exportDetailView.classList.add('active');
      break;
    case 'import-main':
      importMainView.classList.remove('hidden');
      importDetailView.classList.remove('active');
      break;
    case 'import-detail':
      importMainView.classList.add('hidden');
      importDetailView.classList.add('active');
      break;
  }
}

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

// Toggle secure mode password field
function handleSecureModeToggle(e) {
  const passwordField = document.getElementById('password-field');
  if (e.target.checked) {
    passwordField.classList.add('show');
    document.getElementById('password-input').focus();
  } else {
    passwordField.classList.remove('show');
  }
}

// Get export options
function getExportOptions() {
  const secureMode = document.getElementById('secure-mode').checked;
  const password = document.getElementById('password-input').value;

  if (secureMode && !password) {
    showStatus("Password required for secure mode!", "error");
    return null;
  }

  if (secureMode && password.length < 8) {
    showStatus("Password must be at least 8 characters!", "error");
    return null;
  }

  return {
    privacyMode: document.getElementById('privacy-mode').checked,
    secureMode: secureMode,
    password: secureMode ? password : null
  };
}

// Export current window
async function handleExportCurrent() {
  const options = getExportOptions();
  if (!options) return;

  showStatus("Exporting current window...", "info");
  disableExportButtons(true);

  try {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const response = await api.runtime.sendMessage({
      action: "export-current",
      options: options
    });

    if (response.success) {
      const fileType = options.secureMode ? "encrypted .sportab" : ".portab";
      showStatus(`✓ Exported ${response.tabCount} tabs as ${fileType} file!`, "success");
    } else {
      showStatus(`Error: ${response.error}`, "error");
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  } finally {
    disableExportButtons(false);
  }
}

// Export all windows
async function handleExportAll() {
  const options = getExportOptions();
  if (!options) return;

  showStatus("Exporting all windows...", "info");
  disableExportButtons(true);

  try {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const response = await api.runtime.sendMessage({
      action: "export-all",
      options: options
    });

    if (response.success) {
      const fileType = options.secureMode ? "encrypted .sportab" : ".portab";
      showStatus(`✓ Exported ${response.windowCount} windows (${response.tabCount} tabs) as ${fileType} file!`, "success");
    } else {
      showStatus(`Error: ${response.error}`, "error");
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  } finally {
    disableExportButtons(false);
  }
}

// Export pinned tabs
async function handleExportPinned() {
  const options = getExportOptions();
  if (!options) return;

  showStatus("Exporting pinned tabs...", "info");
  disableExportButtons(true);

  try {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const response = await api.runtime.sendMessage({
      action: "export-pinned",
      options: options
    });

    if (response.success) {
      const fileType = options.secureMode ? "encrypted .sportab" : ".portab";
      showStatus(`✓ Exported ${response.tabCount} pinned tabs as ${fileType} file!`, "success");
    } else {
      showStatus(`Error: ${response.error}`, "error");
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  } finally {
    disableExportButtons(false);
  }
}

// Handle "Export Selected Tabs" click
async function handleExportSelectedClick() {
  showStatus("Loading tabs...", "info");

  try {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const windows = await api.windows.getAll({ populate: true });

    state.exportTabs = windows;
    state.exportSelectedTabs.clear();

    renderExportTabList(windows);
    switchView('export-detail');
    hideStatus();
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  }
}

// Render export tab list
function renderExportTabList(windows) {
  const container = document.getElementById('export-tab-list');
  container.innerHTML = '';

  const api = typeof browser !== 'undefined' ? browser : chrome;
  const isChrome = typeof chrome !== 'undefined' && chrome.tabGroups;

  windows.forEach((window, windowIndex) => {
    const windowSection = document.createElement('div');
    windowSection.className = 'window-section';

    // Window header
    const windowHeader = document.createElement('div');
    windowHeader.className = 'window-header';

    const windowCheckbox = document.createElement('input');
    windowCheckbox.type = 'checkbox';
    windowCheckbox.dataset.windowIndex = windowIndex;
    windowCheckbox.addEventListener('change', (e) => {
      handleWindowCheckboxChange(windowIndex, e.target.checked);
    });

    const windowTitle = document.createElement('div');
    windowTitle.className = 'window-title';
    windowTitle.textContent = `Window ${windowIndex + 1} (${window.tabs.length} tabs)`;

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
      checkbox.dataset.windowIndex = windowIndex;
      checkbox.dataset.tabIndex = tabIndex;
      checkbox.addEventListener('change', handleTabCheckboxChange);

      const favicon = document.createElement('img');
      favicon.className = 'tab-icon';
      favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
      favicon.onerror = () => {
        favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
      };

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
        tabUrl.textContent = tab.url.substring(0, 50);
      }

      tabInfo.appendChild(tabTitle);
      tabInfo.appendChild(tabUrl);

      const badges = document.createElement('div');
      badges.className = 'tab-badges';

      // Pin badge
      if (tab.pinned) {
        const pinBadge = document.createElement('span');
        pinBadge.className = 'pin-badge show';
        pinBadge.textContent = '📌';
        pinBadge.title = 'Pinned';
        badges.appendChild(pinBadge);
      }

      // Group badge (Chrome only)
      if (isChrome && tab.groupId !== -1) {
        const groupBadge = document.createElement('div');
        groupBadge.className = 'group-badge show';

        // Get group color (you'll need to fetch this from tab groups API)
        const groupColors = {
          'grey': '#5f6368',
          'blue': '#1a73e8',
          'red': '#d93025',
          'yellow': '#f9ab00',
          'green': '#1e8e3e',
          'pink': '#e91e63',
          'purple': '#9334e6',
          'cyan': '#12b5cb',
          'orange': '#fa903e'
        };

        groupBadge.style.backgroundColor = groupColors['blue']; // Default
        groupBadge.title = 'Tab Group';
        badges.appendChild(groupBadge);
      }

      tabItem.appendChild(checkbox);
      tabItem.appendChild(favicon);
      tabItem.appendChild(tabInfo);
      tabItem.appendChild(badges);

      windowSection.appendChild(tabItem);
    });

    container.appendChild(windowSection);
  });

  updateExportSelectionInfo();
}

// Handle window checkbox change
function handleWindowCheckboxChange(windowIndex, checked) {
  const checkboxes = document.querySelectorAll(`input[type="checkbox"][data-window-index="${windowIndex}"][data-tab-index]`);

  checkboxes.forEach(checkbox => {
    checkbox.checked = checked;
    const tabId = `${windowIndex}-${checkbox.dataset.tabIndex}`;

    if (checked) {
      state.exportSelectedTabs.add(tabId);
    } else {
      state.exportSelectedTabs.delete(tabId);
    }
  });

  updateExportSelectionInfo();
}

// Handle tab checkbox change
function handleTabCheckboxChange(e) {
  const windowIndex = e.target.dataset.windowIndex;
  const tabIndex = e.target.dataset.tabIndex;
  const tabId = `${windowIndex}-${tabIndex}`;

  if (e.target.checked) {
    state.exportSelectedTabs.add(tabId);
  } else {
    state.exportSelectedTabs.delete(tabId);

    // Uncheck window checkbox if not all tabs selected
    const windowCheckbox = document.querySelector(`input[type="checkbox"][data-window-index="${windowIndex}"]:not([data-tab-index])`);
    if (windowCheckbox) {
      windowCheckbox.checked = false;
    }
  }

  // Check if all tabs in window are selected
  const allTabsInWindow = document.querySelectorAll(`input[type="checkbox"][data-window-index="${windowIndex}"][data-tab-index]`);
  const allChecked = Array.from(allTabsInWindow).every(cb => cb.checked);

  const windowCheckbox = document.querySelector(`input[type="checkbox"][data-window-index="${windowIndex}"]:not([data-tab-index])`);
  if (windowCheckbox) {
    windowCheckbox.checked = allChecked;
  }

  updateExportSelectionInfo();
}

// Update export selection info
function updateExportSelectionInfo() {
  const count = state.exportSelectedTabs.size;
  document.getElementById('export-selection-info').textContent = `${count} tab${count !== 1 ? 's' : ''} selected`;

  const exportButton = document.getElementById('export-selected-confirm');
  exportButton.disabled = count === 0;

  const footer = document.getElementById('export-footer');
  footer.classList.add('show');
}

// Confirm export selected tabs
async function handleExportSelectedConfirm() {
  if (state.exportSelectedTabs.size === 0) {
    showStatus("No tabs selected!", "error");
    return;
  }

  const options = getExportOptions();
  if (!options) return;

  showStatus("Exporting selected tabs...", "info");
  document.getElementById('export-selected-confirm').disabled = true;

  try {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    // Build selected tabs data
    const selectedTabsData = [];

    state.exportSelectedTabs.forEach(tabId => {
      const [windowIndex, tabIndex] = tabId.split('-').map(Number);
      const window = state.exportTabs[windowIndex];
      const tab = window.tabs[tabIndex];

      selectedTabsData.push({
        windowIndex,
        tabIndex,
        tab: tab
      });
    });

    const response = await api.runtime.sendMessage({
      action: "export-selected-tabs",
      options: options,
      data: { selectedTabs: selectedTabsData }
    });

    if (response.success) {
      const fileType = options.secureMode ? "encrypted .sportab" : ".portab";
      showStatus(`✓ Exported ${state.exportSelectedTabs.size} selected tabs as ${fileType} file!`, "success");

      // Go back to main view after 1.5 seconds
      setTimeout(() => {
        switchView('export-main');
        state.exportSelectedTabs.clear();
      }, 1500);
    } else {
      showStatus(`Error: ${response.error}`, "error");
      document.getElementById('export-selected-confirm').disabled = false;
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
    document.getElementById('export-selected-confirm').disabled = false;
  }
}


// ============================================================================
// UI HELPERS
// ============================================================================

function showStatus(message, type = "info") {
  const statusDiv = document.getElementById('status-message');
  statusDiv.textContent = message;
  statusDiv.className = `status-message show ${type}`;

  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(hideStatus, 3000);
  }
}

function hideStatus() {
  const statusDiv = document.getElementById('status-message');
  statusDiv.classList.remove('show');
}

function disableExportButtons(disabled) {
  document.getElementById('export-current').disabled = disabled;
  document.getElementById('export-all').disabled = disabled;
  document.getElementById('export-selected').disabled = disabled;
  document.getElementById('export-pinned').disabled = disabled;
}

function resetFileUpload() {
  const uploadArea = document.getElementById('file-upload-area');
  uploadArea.classList.remove('has-file');
  uploadArea.innerHTML = `
    <div class="file-upload-icon">📂</div>
    <div class="file-upload-text">Click to select file</div>
    <div class="file-upload-hint">or drag and drop .portab or .sportab file</div>
  `;
  document.getElementById('file-input').value = '';
}

function resetImport() {
  state.importSession = null;
  state.importSelectedTabs.clear();
  state.currentFile = null;

  resetFileUpload();

  document.getElementById('session-info').classList.remove('show');
  document.getElementById('decrypt-section').classList.remove('show');
  document.getElementById('decrypt-password').value = '';
  document.getElementById('decrypt-button').disabled = false;
  document.getElementById('import-selected-confirm').disabled = false;
  document.getElementById('import-all-confirm').disabled = false;

  hideStatus();
}

document.getElementById("open-import").addEventListener("click", () => {
  chrome.windows.create({
    url: chrome.runtime.getURL("import.html"),
    type: "popup",
    width: 450,
    height: 720
  });
  window.close(); // optional but recommended
});

console.log("Portab popup script loaded");
