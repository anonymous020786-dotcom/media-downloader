# MediaDL Browser Extension

Send any link, video, image, page, or magnet link straight to your MediaDL server — no copy/paste.

## Install (Chrome / Edge / Brave / Opera)
1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked** and select this `extension/` folder
4. Pin the MediaDL icon to your toolbar

## Install (Firefox)
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and select `manifest.json`

## Use
- **Right-click** any link / video / image / page → **"Download … with MediaDL"**
- Or click the toolbar icon → paste a URL → **Send to MediaDL**
- Set your server URL in the popup (default `http://localhost:4000`)

The extension calls `POST /api/download/auto`, which auto-detects the media type and queues it. Open **http://localhost:3000/download** to watch progress, preview, and save.
