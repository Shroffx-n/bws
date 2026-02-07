// background.js - Firefox version with full security and import/export support
// ============================================================================
// MESSAGE HANDLER
// ============================================================================

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  // Validate sender
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
    'export-pinned': exportPinnedTabs,
    'export-selected-tabs': exportSelectedTabs,  // NEW
    'import-session': importSession,
    'decrypt-session': decryptSession
  };

  const handler = actions[message.action];

  if (!handler) {
    sendResponse({ success: false, error: "Unknown action" });
    return;
  }

  // Execute with timeout (30 seconds)
  Promise.race([
    handler(message.options || {}, message.data || null),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Operation timeout")), 30000)
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

  return true;
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
           !url.startsWith('javascript:') &&
           !url.startsWith('data:') &&
           url.length > 0;
  } catch {
    return false;
  }
}

// Sanitize URL (remove tracking parameters)
function sanitizeURL(url) {
  try {
    const urlObj = new URL(url);

    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
      '_ga', '_gid', 'ref', 'source'
    ];

    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    return urlObj.toString();
  } catch {
    return url;
  }
}

// Generate SHA-256 hash
async function generateHash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate HMAC signature
async function generateHMAC(data, key) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataBuffer = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Encrypt data using AES-GCM
async function encryptData(data, password) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from password
  const passwordBuffer = encoder.encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataBuffer
  );

  // Convert to base64
  const encryptedArray = new Uint8Array(encrypted);
  const base64Encrypted = btoa(String.fromCharCode(...encryptedArray));
  const base64Salt = btoa(String.fromCharCode(...salt));
  const base64IV = btoa(String.fromCharCode(...iv));

  return {
    encrypted: base64Encrypted,
    salt: base64Salt,
    iv: base64IV
  };
}

// Decrypt data using AES-GCM
async function decryptData(encrypted_b64, salt_b64, iv_b64, password) {
  try {
    const encoder = new TextEncoder();

    // Decode base64
    const encrypted = Uint8Array.from(atob(encrypted_b64), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(salt_b64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(iv_b64), c => c.charCodeAt(0));

    // Derive key from password
    const passwordBuffer = encoder.encode(password);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error("Decryption failed - invalid password or corrupted file");
  }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

// Create session object from windows
function createSession(windows, metadata) {
  const windowsObj = {};
  const groupsObj = {};

  windows.forEach((window, index) => {
    const windowKey = `window_${index + 1}`;

    const validTabs = window.tabs.filter(tab => isValidURL(tab.url));

    if (validTabs.length === 0) return;

    windowsObj[windowKey] = {
      active: window.focused,
      incognito: window.incognito,
      tabs: validTabs.map((tab, tabIndex) => {
        let url = tab.url;
        let title = tab.title || "Untitled";
        let favicon = null;

        // Extract favicon (handle both Firefox and Chrome)
        if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
          favicon = tab.favIconUrl;
        } else if (tab.favIconUrl && tab.favIconUrl.startsWith('data:')) {
          // Skip data URLs (too large for JSON)
          favicon = null;
        }

        // Apply privacy mode
        if (metadata.privacyMode) {
          url = sanitizeURL(url);
          title = "[Private]";
          favicon = null; // Don't save favicon in privacy mode
        }

        // Apply secure mode
        if (metadata.secureMode) {
          title = "[Secure - Hidden]";
          favicon = null; // Don't save favicon in secure mode
        }

        const tabData = {
          id: `tab_${tabIndex + 1}`,
          url: url,
          title: title,
          pinned: tab.pinned || false,
          group_id: null
        };

        // Only add favicon if it exists
        if (favicon) {
          tabData.favicon = favicon;
        }

        return tabData;
      })
    };
  });

  // Count tabs
  let actualTabCount = 0;
  Object.values(windowsObj).forEach(window => {
    actualTabCount += window.tabs.length;
  });

  return {
    version: "1.0",
    format: metadata.secureMode ? "sportab" : "portab",
    metadata: {
      created: new Date().toISOString(),
      name: metadata.name || "Browser Session",
      source_browser: typeof browser !== 'undefined' ? 'firefox' : 'chrome',
      source_os: navigator.platform || "unknown",
      tab_count: actualTabCount,
      window_count: Object.keys(windowsObj).length,
      privacy_mode: metadata.privacyMode || false,
      secure_mode: metadata.secureMode || false
    },
    windows: windowsObj,
    groups: groupsObj
  };
}

// Create session from selected tabs
function createSessionFromSelectedTabs(selectedTabsData, metadata) {
  const windowsObj = {};
  const groupsObj = {};

  // Group tabs by window
  const tabsByWindow = {};

  selectedTabsData.forEach(item => {
    const windowIndex = item.windowIndex;
    if (!tabsByWindow[windowIndex]) {
      tabsByWindow[windowIndex] = [];
    }
    tabsByWindow[windowIndex].push(item.tab);
  });

  // Create window objects
  Object.keys(tabsByWindow).forEach((windowIndex, idx) => {
    const windowKey = `window_${idx + 1}`;
    const tabs = tabsByWindow[windowIndex];

    // Filter valid tabs
    const validTabs = tabs.filter(tab => isValidURL(tab.url));

    if (validTabs.length === 0) return;

    windowsObj[windowKey] = {
      active: idx === 0, // First window is active
      incognito: false, // Selected tabs lose incognito context
      tabs: validTabs.map((tab, tabIndex) => {
        let url = tab.url;
        let title = tab.title || "Untitled";

        // Apply privacy mode
        if (metadata.privacyMode) {
          url = sanitizeURL(url);
          title = "[Private]";
        }

        // Apply secure mode
        if (metadata.secureMode) {
          title = "[Secure - Hidden]";
        }

        return {
          id: `tab_${tabIndex + 1}`,
          url: url,
          title: title,
          pinned: tab.pinned || false,
          group_id: null
        };
      })
    };
  });

  // Count tabs
  let actualTabCount = 0;
  Object.values(windowsObj).forEach(window => {
    actualTabCount += window.tabs.length;
  });

  return {
    version: "1.0",
    format: metadata.secureMode ? "sportab" : "portab",
    metadata: {
      created: new Date().toISOString(),
      name: metadata.name || "Selected Tabs Session",
      source_browser: "firefox",
      source_os: navigator.platform || "unknown",
      tab_count: actualTabCount,
      window_count: Object.keys(windowsObj).length,
      privacy_mode: metadata.privacyMode || false,
      secure_mode: metadata.secureMode || false
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
      privacyMode: options.privacyMode || false,
      secureMode: options.secureMode || false
    });

    const extension = options.secureMode ? 'sportab' : 'portab';
    const filename = `session_current_${getTimestamp()}.${extension}`;

    await downloadSession(session, filename, options);

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
      privacyMode: options.privacyMode || false,
      secureMode: options.secureMode || false
    });

    const extension = options.secureMode ? 'sportab' : 'portab';
    const filename = `session_all_${getTimestamp()}.${extension}`;

    await downloadSession(session, filename, options);

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
      privacyMode: options.privacyMode || false,
      secureMode: options.secureMode || false
    });

    const extension = options.secureMode ? 'sportab' : 'portab';
    const filename = `session_pinned_${getTimestamp()}.${extension}`;

    await downloadSession(session, filename, options);

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

// Export selected tabs (NEW FUNCTION)
async function exportSelectedTabs(options = {}, data = null) {
  try {
    console.log("Exporting selected tabs...");

    if (!data || !data.selectedTabs || data.selectedTabs.length === 0) {
      return {
        success: false,
        error: "No tabs selected"
      };
    }

    const selectedTabsData = data.selectedTabs;

    const session = createSessionFromSelectedTabs(selectedTabsData, {
      name: "Selected Tabs Session",
      tabCount: selectedTabsData.length,
      windowCount: new Set(selectedTabsData.map(t => t.windowIndex)).size,
      privacyMode: options.privacyMode || false,
      secureMode: options.secureMode || false
    });

    const extension = options.secureMode ? 'sportab' : 'portab';
    const filename = `session_selected_${getTimestamp()}.${extension}`;

    await downloadSession(session, filename, options);

    return {
      success: true,
      message: `Exported ${session.metadata.tab_count} selected tabs!`,
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

// Download session (with optional encryption)
async function downloadSession(sessionData, filename, options = {}) {
  let url = null;

  try {
    let finalData;

    if (options.secureMode && options.password) {
      // Encrypt the session
      const jsonString = JSON.stringify(sessionData, null, 2);
      const encrypted = await encryptData(jsonString, options.password);

      // Create encrypted wrapper
      finalData = {
        version: "1.0",
        format: "sportab",
        encrypted: true,
        algorithm: "AES-GCM",
        salt: encrypted.salt,
        iv: encrypted.iv,
        data: encrypted.encrypted,
        signature: await generateHMAC(encrypted.encrypted, options.password)
      };
    } else {
      // Add signature to unencrypted file
      const jsonString = JSON.stringify(sessionData, null, 2);
      sessionData.signature = await generateHash(jsonString);
      finalData = sessionData;
    }

    // Validate session data
    if (!finalData || typeof finalData !== 'object') {
      throw new Error("Invalid session data");
    }

    const outputString = JSON.stringify(finalData, null, 2);

    // Check file size (warn if >10MB)
    const sizeInMB = new Blob([outputString]).size / (1024 * 1024);
    if (sizeInMB > 10) {
      console.warn(`Large session file: ${sizeInMB.toFixed(2)} MB`);
    }

    const blob = new Blob([outputString], { type: 'application/json' });
    url = URL.createObjectURL(blob);

    const downloadId = await browser.downloads.download({
      url: url,
      filename: filename,
      saveAs: true,
      conflictAction: 'uniquify'
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

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

// Decrypt encrypted session
async function decryptSession(options, data) {
  try {
    const sessionData = data.sessionData;
    const password = options.password;

    if (!sessionData.encrypted) {
      throw new Error("Session is not encrypted");
    }

    // Verify signature
    const isValid = await verifyHMAC(
      sessionData.data,
      sessionData.signature,
      password
    );

    if (!isValid) {
      throw new Error("Invalid password or corrupted file");
    }

    // Decrypt
    const decryptedJson = await decryptData(
      sessionData.data,
      sessionData.salt,
      sessionData.iv,
      password
    );

    const decrypted = JSON.parse(decryptedJson);

    return {
      success: true,
      session: decrypted
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Verify HMAC signature
async function verifyHMAC(data, signature, key) {
  try {
    const calculated = await generateHMAC(data, key);
    return calculated === signature;
  } catch {
    return false;
  }
}

// Import session
async function importSession(options, data) {
  try {
    const session = data.session;
    const restoreIncognito = options.restoreIncognito || false;

    // Validate session
    if (!session || !session.windows) {
      throw new Error("Invalid session data");
    }

    // Validate URLs
    for (const windowKey in session.windows) {
      const window = session.windows[windowKey];
      for (const tab of window.tabs) {
        if (!isValidURL(tab.url)) {
          throw new Error(`Invalid URL detected: ${tab.url}`);
        }
      }
    }

    // Create windows and tabs
    let createdWindows = 0;
    let createdTabs = 0;

    for (const windowKey in session.windows) {
      const windowData = session.windows[windowKey];
      const urls = windowData.tabs.map(tab => tab.url);

      if (urls.length === 0) continue;

      // Determine if window should be incognito
      const isIncognito = windowData.incognito && restoreIncognito;

      // Create window
      const newWindow = await browser.windows.create({
        url: urls,
        incognito: isIncognito,
        focused: windowData.active || false
      });

      createdWindows++;
      createdTabs += urls.length;

      // Apply pinned state
      const tabs = await browser.tabs.query({ windowId: newWindow.id });
      for (let i = 0; i < windowData.tabs.length && i < tabs.length; i++) {
        if (windowData.tabs[i].pinned) {
          await browser.tabs.update(tabs[i].id, { pinned: true });
        }
      }
    }

    return {
      success: true,
      message: `Restored ${createdWindows} windows with ${createdTabs} tabs`,
      windowCount: createdWindows,
      tabCount: createdTabs
    };

  } catch (error) {
    console.error("Import failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

console.log("Portab background script (Firefox) loaded");
