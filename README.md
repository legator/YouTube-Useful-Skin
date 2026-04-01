# YouTube Custom Player Skin — Chrome Extension

A Chrome extension that replaces the default YouTube player controls with a cinematic skin featuring:

- **Top overlay bar** — video title, channel name, and view count
- **Centered transport controls** — play/pause, volume, closed captions, quality selector, playback speed, theater mode, mini-player, fullscreen
- **Red seek bar** at the bottom with buffer preview, time codes, chapter markers, storyboard hover previews, and scrub tooltip
- **Advanced features** — Picture-in-Picture support, Media Session API integration, chapter navigation
- **Toggle on/off** via the extension popup (no page reload needed)

## Installation (Development)

1. Clone or download this repository.
2. Open **Chrome** → navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `YouTube-Useful-Skin` folder.
5. Navigate to any YouTube video — the custom skin is applied automatically.

## Screenshot

![YouTube Custom Skin Preview](preview.png)

## File Structure

```
YouTube-Useful-Skin/
├── manifest.json               # Extension manifest (Manifest V3)
├── generate-icons.js           # Script to generate PNG icons from SVG
├── content/
│   ├── skin.css                # Main visual styles for the custom skin
│   ├── skin.js                 # Content script entry point, module loader
│   ├── bridge.js               # Page-context bridge (main world)
│   ├── pip.css                 # Picture-in-Picture specific styles
│   ├── bridge/                 # Page-context handlers (access YouTube API)
│   │   ├── captions.js         # Closed captions control
│   │   ├── chapters.js         # Chapter metadata extraction
│   │   ├── fullscreen.js       # Fullscreen toggle & sync
│   │   ├── quality.js          # Quality selection (4K, 1080p, etc.)
│   │   ├── storyboard.js       # Storyboard preview fetch
│   │   └── syncState.js        # Player state synchronization
│   └── skin/                   # UI components (isolated world)
│       ├── buildSkin.js        # DOM construction for overlay
│       ├── constants.js        # Quality labels, speeds, etc.
│       ├── icons.js            # SVG icon definitions
│       ├── mediaSession.js     # Media Session API integration
│       ├── pip.js              # Picture-in-Picture handler
│       ├── storyboard.js       # Storyboard preview rendering
│       └── utils.js            # Helper functions
├── popup/
│   ├── popup.html              # Extension popup UI (enable/disable toggle)
│   └── popup.js                # Popup logic — persists state via chrome.storage
└── icons/
    ├── icon16.png / icon16.svg
    ├── icon48.png / icon48.svg
    └── icon128.png / icon128.svg
```

## Architecture

The extension uses a **dual-context bridge architecture** to interact with YouTube's player:

### Content Script (Isolated World)
- **`skin.js`** — Main entry point that imports modular ES6 components
- **`skin/`** modules — Build UI, handle user interactions, render storyboards
- Communicates with the page context via `window.postMessage()`

### Page Context Bridge (Main World)
- **`bridge.js`** — Runs in the page's main world to access YouTube's player API
- **`bridge/`** handlers — Each feature (quality, captions, fullscreen, etc.) is isolated
- Responds to requests from the content script via message passing

### Key Features
- **Quality Selector** — Switch between Auto, 4K, 1080p, 720p, etc.
- **Playback Speed** — 1×, 1.25×, 1.5×, 2×, up to 3×
- **Closed Captions** — Toggle and manage subtitle tracks
- **Chapter Markers** — Visual chapter points on the seek bar
- **Storyboard Previews** — Hover over the seek bar to see video thumbnails
- **Picture-in-Picture** — Custom PIP with mini controls
- **Media Session API** — Integrates with OS media controls (Windows, macOS, etc.)
- **Fullscreen Sync** — Detects and syncs YouTube's fullscreen state

## How It Works

1. **Content script** (`skin.js` + `skin.css`) runs on all `youtube.com` pages
2. CSS hides YouTube's default player controls (gradient overlays, bottom bar, top bar)
3. **Bridge injection** — `bridge.js` is injected as a module script into the page context
4. **Modular UI** — `buildSkin.js` constructs the custom overlay with controls
5. **Event delegation** — User interactions in the skin trigger bridge calls to YouTube's API
6. **State sync** — Bridge responds with player state (quality, chapters, storyboard URLs, etc.)
7. **Popup toggle** — Stores enabled/disabled state in `chrome.storage.local` and toggles the `ytp-skin-disabled` class

## License

MIT
