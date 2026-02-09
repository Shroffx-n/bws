# Browser Window Session

> Transport an entire browser window across browsers, devices, and operating systems.

BWS introduces a **portable, browser-agnostic session file format** that lets you export one or more browser windows (tabs, groups, metadata) into a single file and reopen them later — on another browser, another OS, or another device — with minimal friction.

---

## Why?
This project was started with the hope of fixing one of my own and maybe other's problem with browsers and tab sessions-

#### Story Time

My personal use-case; sending research material to my peers, saving up some info about my projects to use them across my phone or laptop, finding a few project ideas and research and transporting them across OSes(dual boot)

Conventionally, you can use a bookmark or a similar manager, but most are pretty janky, and at times I've experienced Chrome and others deleting some bookmarks on their own (I have a lot of bookmarks, so maybe that's the case)

But to the crux, if you want to truly transport an "entire browser window", there is no such solution (which I believe should be in-built in browsers themselves).

> There is currently **no clean way to share an entire browser window**  
> across browsers and operating systems.

This feels like something browsers *should* support natively — but they don’t.

So instead of waiting, I built a **file format**, with the hope of **standardizing it**.  
Maybe a browser comapany(Google👀) picks it up someday 🤞

## Core Idea

A **single file** that contains information about:
- One or more browser windows
- Ordered tabs per window
- Tab groups
- Metadata:
  - Titles
  - Favicons
  - Pinned tabs
  - Timestamps
  - Source browser / OS

That file can be:

- **Exported from a browser**
- **Double-clicked at the OS level to reopen automatically**
- **Shared, archived, versioned, or scripted**

#### Logically- 
> If a browser had a share button for an entire window, then a .portab or .sportab would be generated in the browser backend and unpacked at the recipient.

[Skip to How to Use](#how_to_use)

## 📦 File Formats

### `.portab`
Standard portable browser session file. (Has hash mapping for end-to-end encryption)

### `.sportab`
Secure Portab file:
- Password Encrypted
- Tamper-resistant
- Designed for sharing sensitive research or private sessions

##  Features

### 📄 File-based Sessions
- Single portable file per session
- Human-readable (JSON-based)
- Extensible by design

### 🪟 Export Windows
- Export:
  - Current window
  - All open windows
- Uses browser-native APIs to fetch:
  - Tabs
  - Order
  - Groups
  - Metadata
- Maintains original tab ordering

### 🧭 Selected Tabs
- Option to export **only selected tabs**
- Useful for curated research handoffs

### 🧩 Tab Groups
- Abstract, browser-agnostic grouping
- Preserved across browsers (best-effort mapping)

### 📌 Pinned Tabs
- Pinned tabs are preserved and restored where supported

### 🕵️ Incognito Windows
- Incognito sessions can be preserved **optionally**
- Titles and URLs can be:
  - Hidden
  - Redacted
  - User-modifiable during export
- Designed to prevent accidental data leaks

### 🔐 Encryption (`.sportab`)
- Password-based encryption
- Prevents unauthorized reading
- Prevents unauthorized tampering

### 🧾 Hash Matching & Integrity
- End-to-end hash verification
- Ensures:
  - File integrity
  - Trusted session restoration
- Enables basic version management & diffing

### 👀 Session Preview
- Preview session contents before opening
- Shows:
  - Number of windows
  - Number of tabs
  - Groups
- Safety prompt for large sessions

---

## How It Works

### Browser Extension
- Uses built-in browser APIs to:
  - Extract tab + window metadata
  - Serialize into `.portab` / `.sportab`
- Same extension can:
  - Import session files
  - Open selected or full sessions

---

### System-wide Installer
- Registers `.portab` / `.sportab` as OS-level file types
- Double-clicking a file:
  1. Triggers OS prompt
  2. Lets user select target browser
  3. Opens all tabs in a new window
> [!Note] Can also delegate to the browser extension for fine-grained control

---

## ✅ What Works Right Now

### Browser Extension
- Tested on:
  - Mozilla Firefox
  - Chrome / Edge (Chromium-based browsers)
- Export functionality
- Import functionality

### Secure Sessions
- `.sportab` password encryption
- `.sportab` decryption
- Hash verification

### Import Preview (Extension)
- Select and preview tabs to open from .portab file

### Incognito Mode (Extension)
- Detects browser incognito mode (when given permission)
- Masks Title and Link fields in .portab and .sportab file.
- Option to reopen in incognito window

---

## ❌ What Does Not Work (*Yet* )

- Scroll position restoration
- Safari (limited browser APIs)
- Full mobile export (import-only planned)
- Perfect tab group parity across all browsers (Inter-chromium-based browsers work)
- Native OS launcher on all platforms (WIP)

## Platform Support

### Desktop
- Linux
- Windows
- macOS (planned)

### Mobile (Planned / Partial)
- Android: Import & open via browser intents / helper app (both import and export)
- iOS: Import via helper app / Shortcuts (restricted)

---

## How is it Different

| Feature | Bookmarks | Session Managers | Browser Sync | Portab |
|------|-----------|------------------|--------------|--------|
| Transport full window | ❌ | ⚠️ | ❌ | ✅ |
| Cross-browser | ⚠️(only those supporting sync from other browsers) | ❌ | ⚠️ | ✅ |
| Cross-OS | ⚠️ | ⚠️ | ⚠️ | ✅ |
| Portable file | ❌ | ❌ | ❌ | ✅ |
| One-click restore | ❌ | ❌ | ❌ | ✅ |
| Vendor-neutral | ❌ | ❌ | ❌ | ✅ |
---
# How_to_Use
Currently only prototypes are available; for Chrome(works across most chromium-builds) and Mozilla Firefox
- Step 1- Download repo
```javascript
git clone https://github.com/Shroffx-n/bws.git
```
> [!NOTE]
> Alternatively just download repo as zip from 'Code' Button 

- Step 2- Choose browser of choice; Chrome/Mozilla
- Step 3- Enter the following in address bar,
     - For Mozilla, 
         - `about:debugging#/runtime/this-firefox`
     - For chrome,
         - `chrome://extensions/`
- Step 4- Load extension
     - For Mozilla, 
         - Click on 'Load Temporary Add-On'
         - Select `manifest.json` from `portab-exporter-firefox`
     - For Chrome,
         - Turn on Developer Mode (Right-hand Top Corner)
         - Click 'Load Unpacked' (Left-hand Top)
         - Select `portab-exporter-chrome`
> [!IMPORTANT]
> Select folder name, NOT manifest.json for chrome

- Step 5- Extension should be loaded. Explore the extension and lemme know !

## Extension in Use

https://github.com/user-attachments/assets/bc654473-ac06-4584-9e4f-1f22e3d0f44a


## Contributing

Contributions welcome; Need help for-
- OS-level launchers
- Mobile helpers and ecosystem integration
- File format review & feedback
- Testing
- Any ideas/suggestions are welcomed!
---
How to help- 
- Raise issue in github repo itself
- Fork repo and put forth merge request
- Comment on SNS post(reddit/hn)
- DM personally

> [!NOTE]
> Though Open-Souced, I would really appreciate if you could include credits when using/re-using this project :)

> Message for any issues!

## 📜 License

MIT / Apache-2.0 

## 📣 Project Status

🚧 Early development  
🧪 Actively prototyping  
💬 Feedback and criticism encouraged
