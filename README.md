# KiloProxy

A small Chrome (Manifest V3) extension for saving proxies and switching between them with one click. No server, no analytics; everything stays in `chrome.storage.local`.

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** and select this folder.

## Use

- **Add:** paste `host:port:user:pass` (or `user:pass@host:port`, `host:port`) and the fields fill in. Save it.
- **Connect:** click a saved proxy. The toolbar badge shows `ON`.
- **Disconnect:** click **Go direct**.
- **Edit / delete:** use the ✎ and ✕ buttons on a row.

Switching logins on the same host drops to direct first, so the new login re-authenticates instead of reusing old sockets. Local addresses bypass the proxy.

## Layout

```
manifest.json
src/background.js     proxy apply + auth + badge
src/lib/parse.js      proxy string parser
src/lib/store.js      storage helpers
src/popup/            popup UI (html, css, js)
```

Note: Chrome can't answer authentication for SOCKS proxies, so only HTTP/HTTPS are offered.
