# YouTube Custom Player Skin — Chrome Extension

A Chrome extension that replaces the default YouTube player controls with a cinematic skin featuring:

- **Top overlay bar** — video title, channel name, and view count
- **Centred transport controls** — play/pause (circle), volume, CC, HD quality, theater mode, mini-player, fullscreen, and stop
- **Red seek bar** at the bottom with buffer preview, time codes, and scrub tooltip
- **Toggle on/off** via the extension popup (no page reload needed)

## Installation

1. Clone or download this repository.
2. Open **Chrome** → navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `YouTubeSkin` folder.
5. Navigate to any YouTube video — the custom skin is applied automatically.

## File Structure

```
YouTubeSkin/
├── manifest.json          # Extension manifest (MV3)
├── content/
│   ├── skin.css           # All visual styles for the custom skin
│   └── skin.js            # DOM injection, event wiring, seek bar logic
├── popup/
│   ├── popup.html         # Extension popup UI (enable/disable toggle)
│   └── popup.js           # Popup logic — persists state via chrome.storage
├── icons/
│   ├── icon16.png         # Toolbar icon
│   ├── icon48.png         # Extensions page icon
│   └── icon128.png        # Chrome Web Store icon
└── generate-icons.js      # (Dev) Script that generated the PNG icons
```

## How It Works

- A **content script** (`skin.js` + `skin.css`) runs on all `youtube.com` pages.
- The CSS hides YouTube's default player chrome (gradient overlays, bottom bar, top bar).
- The JS injects a new overlay with custom buttons that delegate to YouTube's existing player API (`video.play()`, `video.pause()`, `.ytp-subtitles-button.click()`, etc.).
- The progress bar is a fully custom seek bar that responds to click + drag.
- The popup stores an enabled/disabled flag in `chrome.storage.local` and sends a message to the content script to toggle the `ytp-skin-disabled` class.

## License

MIT
