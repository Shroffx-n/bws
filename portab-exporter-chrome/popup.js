// popup.js - Chrome version with privacy mode and incognito detection

let isIncognito = false;

// Detect if opened in incognito window
async function detectIncognito() {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    isIncognito = currentWindow.incognito;

    if (isIncognito) {
      // Show incognito badge
      document.getElementById('incognito-badge').classList.add('show');

      // Auto-enable privacy mode
      document.getElementById('privacy-mode').checked = true;
    }
  } catch (error) {
    console.error("Could not detect incognito mode:", error);
  }
}

// Show status message
function showStatus(message, type = "info") {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = 'info show';

  if (type === "success") {
    statusDiv.classList.add('success');
  } else if (type === "error") {
    statusDiv.classList.add('error');
  }

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

// Disable all buttons
function setButtonsDisabled(disabled) {
  document.getElementById('export-current').disabled = disabled;
  document.getElementById('export-all').disabled = disabled;
  document.getElementById('export-pinned').disabled = disabled;
}

// Get export options
function getExportOptions() {
  return {
    privacyMode: document.getElementById('privacy-mode').checked
  };
}

// Export current window
async function exportCurrentWindow() {
  showStatus("Exporting current window...");
  setButtonsDisabled(true);

  try {
    const response = await chrome.runtime.sendMessage({
      action: "export-current",
      options: getExportOptions()
    });

    if (response.success) {
      showStatus(response.message, "success");
    } else {
      showStatus(`Error: ${response.error}`, "error");
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
    console.error(error);
  } finally {
    setButtonsDisabled(false);
  }
}

// Export all windows
async function exportAllWindows() {
  showStatus("Exporting all windows...");
  setButtonsDisabled(true);

  try {
    const response = await chrome.runtime.sendMessage({
      action: "export-all",
      options: getExportOptions()
    });

    if (response.success) {
      showStatus(response.message, "success");
    } else {
      showStatus(`Error: ${response.error}`, "error");
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
    console.error(error);
  } finally {
    setButtonsDisabled(false);
  }
}

// Export pinned tabs
async function exportPinnedTabs() {
  showStatus("Exporting pinned tabs...");
  setButtonsDisabled(true);

  try {
    const response = await chrome.runtime.sendMessage({
      action: "export-pinned",
      options: getExportOptions()
    });

    if (response.success) {
      showStatus(response.message, "success");
    } else {
      showStatus(`Error: ${response.error}`, "error");
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
    console.error(error);
  } finally {
    setButtonsDisabled(false);
  }
}

// Event listeners
document.getElementById('export-current').addEventListener('click', exportCurrentWindow);
document.getElementById('export-all').addEventListener('click', exportAllWindows);
document.getElementById('export-pinned').addEventListener('click', exportPinnedTabs);

// Initialize
detectIncognito();

console.log("Portab popup (Chrome) loaded");
