# YouTube Custom Player Skin — Chrome Extension

A Chrome extension that replaces the default YouTube player controls with a custom cinematic skin featuring a **liquid glass UI** design.

## Features

### Main Player
- **Top overlay bar** — video title, channel name, and view count
- **Centered transport controls** — play/pause, volume slider, skip ±10 s, chapter prev/next
- **Bottom bar** — seek bar with buffer fill, draggable thumb, chapter markers, storyboard hover previews, and scrub tooltip
- **Closed Captions** — toggle and select subtitle track via inline menu
- **Audio track / language selection** — badge appears automatically when a video has multiple audio tracks; opens a menu to switch language
- **Quality selector** — switch between Auto, 4K, 1440p, 1080p, 720p, etc.
- **Playback speed** — presets (1×, 1.25×, 1.35×, 1.5×, 1.75×, 2×, 2.5×, 3×) plus a custom numeric input
- **Chapter list** — floating panel with pin/drag support; seek bar chapter markers; auto-scroll highlight
- **Live stream support** — hides skip/chapter controls; LIVE button turns red at live edge, grey when seeked back; uses YouTube's `isAtLiveHead()` API for accurate detection
- **Theater mode & Fullscreen** — buttons with state sync against YouTube's native player
- **Picture-in-Picture** — Document PiP with full custom skin (play, volume, seek, CC, quality, speed, chapters, language, live button)
- **Media Session API** — integrates with OS media controls (Windows, macOS, etc.)
- **Toggle on/off** — via the extension popup, no page reload needed

### Design
- **Liquid glass aesthetic** — `backdrop-filter` blur/saturate/brightness, translucent tinted surfaces, iridescent active states, and spring-eased animations throughout the main skin and PiP overlay
- CSS custom properties (`--glass-bg`, `--glass-blur`, `--iridescent`, `--spring`, …) keep the glass recipe consistent and easy to tweak

### Security
- Unique per-session nonce for bridge `postMessage` communication, preventing rogue scripts from sending commands to the bridge

## Installation

### From source (development)

1. Clone or download this repository.
2. Run `npm install` then `npm run build` to produce the optimised `dist/` folder.
3. Open **Chrome** → navigate to `chrome://extensions`.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the **`dist/`** folder.
6. Navigate to any YouTube video — the custom skin is applied automatically.

> **After updating the extension**, click the reload (↺) button on `chrome://extensions` and refresh the YouTube tab to clear the module cache.

### Load unbuilt (quick dev iteration)

Skip the build step and load the repo root directly as an unpacked extension. All source modules are loaded as-is; changes take effect after reloading the extension.

## Screenshot

![YouTube Custom Skin Preview](image.png)

## File Structure

```
YouTube-Useful-Skin/
├── manifest.json               # Extension manifest (Manifest V3) — source
├── package.json                # npm build dependencies (esbuild, javascript-obfuscator)
├── build.js                    # Build script — bundles, obfuscates, minifies → dist/
├── generate-icons.js           # Script to generate PNG icons from SVG
├── content/
│   ├── skin.css                # Main visual styles (liquid glass design system)
│   ├── skin.js                 # Content script entry point — imports modules, wires player
│   ├── bridge.js               # Page-context bridge (main world), nonce-authenticated
│   ├── pip.css                 # Picture-in-Picture styles (liquid glass)
│   ├── bridge/                 # Page-context handlers (have access to YouTube's player API)
│   │   ├── audioTrack.js       # Audio track listing & selection (protobuf VSS-ID parser)
│   │   ├── captions.js         # Closed captions control
│   │   ├── chapters.js         # Chapter metadata extraction
│   │   ├── fullscreen.js       # Fullscreen toggle & sync
│   │   ├── quality.js          # Quality selection
│   │   ├── storyboard.js       # Storyboard preview URL fetch
│   │   ├── syncState.js        # Player state sync (quality, captions, isAtLiveHead)
│   │   └── volume.js           # Volume persistence via YouTube API
│   └── skin/                   # UI components (isolated world)
│       ├── buildSkin.js        # DOM construction for the overlay
│       ├── constants.js        # Quality labels, speed options, timing constants
│       ├── icons.js            # SVG icon definitions
│       ├── mediaSession.js     # Media Session API integration
│       ├── pip.js              # Document Picture-in-Picture handler + language/audio menu
│       ├── storyboard.js       # Storyboard spec parser & frame calculator
│       └── utils.js            # Helper functions (qs, ce, fmtTime)
├── popup/
│   ├── popup.html              # Extension popup UI (enable/disable toggle)
│   └── popup.js                # Popup logic — persists state via chrome.storage
├── icons/
│   ├── icon16.png / icon16.svg
│   ├── icon48.png / icon48.svg
│   └── icon128.png / icon128.svg
└── dist/                       # Built output (load this folder as unpacked extension)
    ├── manifest.json
    ├── content/
    │   ├── skin.js             # Bundled + obfuscated
    │   ├── bridge.js           # Bundled + obfuscated
    │   ├── skin.css            # Minified
    │   └── pip.css             # Minified
    └── popup/ + icons/
```

## Architecture

The extension uses a **dual-context bridge architecture** to interact with YouTube's private player API.

### Content Script (Isolated World)
- **`skin.js`** — Entry point; imports all ES6 modules via dynamic `import()`, wires up the overlay
- **`skin/`** modules — Build UI, handle user interactions, render storyboards, manage PiP
- Communicates with the page context via `window.postMessage()` with a per-session nonce

### Page Context Bridge (Main World)
- **`bridge.js`** — Injected into the page's main world so it can call `movie_player` API methods
- **`bridge/`** handlers — Each feature is its own module; validates the nonce before responding
- Replies to the content script via `window.postMessage()`

### Audio Track / Language Selection
YouTube encodes audio track metadata as protobuf-serialised VSS IDs embedded in the player response. `bridge/audioTrack.js` decodes these using a full varint parser (handles multi-byte lengths) to extract track labels and IDs, then exposes them via the bridge. The PiP and main-skin language badges are only shown when more than one track is available.

### Live Stream Detection
The LIVE button colour is driven by **`ytP.isAtLiveHead()`** — YouTube's own internal API — polled via the bridge every 2 seconds. This is more reliable than estimating latency from `video.seekable` ranges, which vary with HLS/DASH buffer depth.

- Red = at live edge (or bridge hasn't replied yet — safe default)
- Grey = seeked back more than a couple of seconds behind the live edge

### Build Pipeline
`npm run build` (via `build.js`) produces a production-ready `dist/` folder:
1. **Bundle** — esbuild inlines all `skin/` and `bridge/` sub-modules into two IIFE files
2. **Obfuscate** — javascript-obfuscator renames identifiers to hex names and base64-encodes strings (`selfDefending: false` to satisfy Chrome's CSP)
3. **Minify CSS** — esbuild minifies `skin.css` and `pip.css`
4. **Copy statics** — icons and `popup.html`/`popup.js` are copied as-is
5. **Generate manifest** — `dist/manifest.json` references only the two bundled JS files

## License

MIT
