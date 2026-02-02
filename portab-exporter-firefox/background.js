// background.js - Firefox version with security improvements

// Message listener with sender validation
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  // Validate sender is our own extension
  if (!sender.id || sender.id !== browser.runtime.id) {
    console.warn("Rejected message from unknown sender:", sender);
    return;
  }

  // Validate message structure
  if (!message || !message.action) {
    sendResponse({ success: false, error: "Invalid message format" });
    return;
  }

  // Action router
  const actions = {
    'export-current': exportCurrentWindow,
    'export-all': exportAllWindows,
    'export-pinned': exportPinnedTabs
  };

  const handler = actions[message.action];

  if (!handler) {
    sendResponse({ success: false, error: "Unknown action" });
    return;
  }

  // Execute with timeout (30 seconds)
  Promise.race([
    handler(message.options || {}),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Export timeout")), 30000)
    )
  ])
  .then(sendResponse)
  .catch(error => {
    console.error(`Action ${message.action} failed:`, error);
    sendResponse({
      success: false,
      error: error.message || "Unknown error"
    });
  });

  return true;  // Keep message channel open for async response
});

// Generate timestamp for filenames
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Validate URL
function isValidURL(url) {
  try {
    new URL(url);
    return !url.startsWith('about:') &&
           !url.startsWith('moz-extension:') &&
           !url.startsWith('chrome:') &&
           !url.startsWith('chrome-extension:') &&
           url.length > 0;
  } catch {
    return false;
  }
}

// Sanitize URL (remove tracking parameters)
function sanitizeURL(url) {
  try {
    const urlObj = new URL(url);

    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid'
    ];

    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    return urlObj.toString();
  } catch {
    return url;  // Return original if parsing fails
  }
}

// Create session object from windows
function createSession(windows, metadata) {
  const windowsObj = {};
  const groupsObj = {};  // Empty for Firefox (no native groups)

  windows.forEach((window, index) => {
    const windowKey = `window_${index + 1}`;

    // Filter valid tabs
    const validTabs = window.tabs.filter(tab => isValidURL(tab.url));

    // Skip windows with no valid tabs
    if (validTabs.length === 0) return;

    windowsObj[windowKey] = {
      active: window.focused,
      tabs: validTabs.map((tab, tabIndex) => {
        let url = tab.url;
        let title = tab.title || "Untitled";

        // Apply privacy mode if enabled
        if (metadata.privacyMode) {
          url = sanitizeURL(url);
          title = "[Private]";
        }

        return {
          id: `tab_${tabIndex + 1}`,
          url: url,
          title: title,
          pinned: tab.pinned || false,
          group_id: null  // Firefox has no native groups
        };
      })
    };
  });

  // Count actual tabs after filtering
  let actualTabCount = 0;
  Object.values(windowsObj).forEach(window => {
    actualTabCount += window.tabs.length;
  });

  return {
    version: "1.0",
    format: "portab",
    metadata: {
      created: new Date().toISOString(),
      name: metadata.name || "Browser Session",
      source_browser: "firefox",
      source_os: navigator.platform || "unknown",
      tab_count: actualTabCount,
      window_count: Object.keys(windowsObj).length,
      privacy_mode: metadata.privacyMode || false
    },
    windows: windowsObj,
    groups: groupsObj
  };
}

// Export current window
async function exportCurrentWindow(options = {}) {
  try {
    console.log("Exporting current window...");

    const currentWindow = await browser.windows.getCurrent({ populate: true });

    // Validate window has tabs
    if (!currentWindow.tabs || currentWindow.tabs.length === 0) {
      return {
        success: false,
        error: "No tabs found in current window"
      };
    }

    const session = createSession([currentWindow], {
      name: "Current Window Session",
      tabCount: currentWindow.tabs.length,
      windowCount: 1,
      privacyMode: options.privacyMode || false
    });

    const filename = `session_current_${getTimestamp()}.portab`;
    await downloadSessionViaBlob(session, filename);

    return {
      success: true,
      message: `Exported ${session.metadata.tab_count} tabs successfully!`,
      tabCount: session.metadata.tab_count,
      filename: filename
    };

  } catch (error) {
    console.error("Export failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export all windows
async function exportAllWindows(options = {}) {
  try {
    console.log("Exporting all windows...");

    const allWindows = await browser.windows.getAll({ populate: true });

    if (!allWindows || allWindows.length === 0) {
      return {
        success: false,
        error: "No windows found"
      };
    }

    let totalTabs = 0;
    allWindows.forEach(win => {
      totalTabs += win.tabs.length;
    });

    const session = createSession(allWindows, {
      name: "All Windows Session",
      tabCount: totalTabs,
      windowCount: allWindows.length,
      privacyMode: options.privacyMode || false
    });

    const filename = `session_all_${getTimestamp()}.portab`;
    await downloadSessionViaBlob(session, filename);

    return {
      success: true,
      message: `Exported ${session.metadata.window_count} windows (${session.metadata.tab_count} tabs)!`,
      windowCount: session.metadata.window_count,
      tabCount: session.metadata.tab_count,
      filename: filename
    };

  } catch (error) {
    console.error("Export failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export only pinned tabs
async function exportPinnedTabs(options = {}) {
  try {
    console.log("Exporting pinned tabs...");

    const allWindows = await browser.windows.getAll({ populate: true });

    const pinnedWindows = allWindows.map(win => ({
      ...win,
      tabs: win.tabs.filter(tab => tab.pinned)
    })).filter(win => win.tabs.length > 0);

    if (pinnedWindows.length === 0) {
      return {
        success: false,
        error: "No pinned tabs found"
      };
    }

    let totalPinned = 0;
    pinnedWindows.forEach(win => {
      totalPinned += win.tabs.length;
    });

    const session = createSession(pinnedWindows, {
      name: "Pinned Tabs Session",
      tabCount: totalPinned,
      windowCount: pinnedWindows.length,
      privacyMode: options.privacyMode || false
    });

    const filename = `session_pinned_${getTimestamp()}.portab`;
    await downloadSessionViaBlob(session, filename);

    return {
      success: true,
      message: `Exported ${session.metadata.tab_count} pinned tabs!`,
      tabCount: session.metadata.tab_count,
      filename: filename
    };

  } catch (error) {
    console.error("Export failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Download session file using blob URL
async function downloadSessionViaBlob(sessionData, filename) {
  let url = null;

  try {
    // Validate session data
    if (!sessionData || typeof sessionData !== 'object') {
      throw new Error("Invalid session data");
    }

    const jsonString = JSON.stringify(sessionData, null, 2);

    // Check file size (warn if >10MB)
    const sizeInMB = new Blob([jsonString]).size / (1024 * 1024);
    if (sizeInMB > 10) {
      console.warn(`Large session file: ${sizeInMB.toFixed(2)} MB`);
    }

    const blob = new Blob([jsonString], { type: 'application/json' });
    url = URL.createObjectURL(blob);

    const downloadId = await browser.downloads.download({
      url: url,
      filename: filename,
      saveAs: true,
      conflictAction: 'uniquify'  // Auto-rename if file exists
    });

    console.log(`Download started: ${filename} (ID: ${downloadId})`);

    // Wait for download to start before revoking
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error("Download failed:", error);
    throw error;
  } finally {
    // Always clean up blob URL
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}

console.log("Portab background script (Firefox) loaded");
