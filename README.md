# KiloProxyExt

Manual proxy switcher Chrome extension (Manifest V3). No server needed.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.

## Use

1. Paste a full proxy string up top (`host:port:user:pass`) — fields auto-fill.
   Also accepts `user:pass@host:port` and passwords containing `:`.
2. Click **Connect**. Editing any field after pasting overrides the paste.
3. **Disconnect** returns to a direct connection.

Status dot: green `ON` = connected, gray `OFF` = direct.
Switching logins on the same host drops old sockets first, so the new
user re-authenticates instead of reusing the old login's connections.
