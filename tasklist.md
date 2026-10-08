# KiloProxy: task list & handoff

Written so a new session can continue cold. Repo: `Cryptoistaken/KiloProxyExt`, branch `main`. The owner has explicitly asked for pushes straight to `main` every time so far; confirm before changing that habit.

## State: v2.1.0, working and verified

- [x] v2.0 rewrite: saved profiles, modular code (replaced the original single-popup version)
- [x] v2.1 redesign: dark "mission control" UI (power orb, HUD readout, ruled sections, state-tinted theme: idle / switching / live / fault)
- [x] Code split into `src/{background,popup,shared}`; pure view-model in `popup/status.js`
- [x] New K-monogram brand mark; toolbar icon swaps on/off (`icons/`, reproducible via `tools/make-icons.mjs`)
- [x] Fault states surfaced in UI + toolbar: proxy refused the login; another extension controls the proxy
- [x] Popup draft persistence, two-tap delete, uptime readout, startup reconcile of Chrome's proxy setting
- [x] 11 unit tests (`npm test`) and an e2e flow (`node tools/e2e/flow.mjs`), all passing
- [x] README with preview screenshot

## Run things

| What | Command |
| --- | --- |
| Unit tests | `npm test` |
| E2E (real Chromium + local proxy that answers 407) | `node tools/e2e/flow.mjs` |
| Regenerate icons | `npm i --no-save sharp && node tools/make-icons.mjs` |

E2E needs `playwright-core` and a Chromium build. Defaults point at the VM this was built on; override with `PLAYWRIGHT_CORE=<path to node_modules/playwright-core>` and `CHROME_PATH=<chrome binary>`. It starts proxies on `127.0.0.1:18080/18081` (login `demo:s3cret`), loads the repo as an unpacked extension, and writes screenshots to `tools/e2e/shots/` (gitignored). Always look at the screenshots: they caught a bug the assertions missed.

## Gotchas (learned the hard way)

1. **Proxy auth must stay a synchronous `["blocking"]` `onAuthRequired` listener.** The original author found async variants never answer in MV3; the e2e confirms the sync one works.
2. After the first successful login Chrome caches proxy credentials and stops firing `onAuthRequired`. The cold-start race (worker asleep when the challenge arrives) therefore only matters right after a browser restart; `runtime.onStartup` pre-arms credentials for that.
3. After a full browser restart Chrome may drop the extension's proxy setting (seen with `--load-extension`). `sync()` in `background/index.js` detects this (`proxy.inspect`) and re-applies without the direct gap.
4. `chrome.action.setIcon` paths must be absolute (`chrome.runtime.getURL`). Relative ones resolve against `src/background/` and fail with "Failed to fetch".
5. Chrome popups cap at 600px tall. Home measures 597px with six proxies (`.list` max-height 179px); adding vertical content breaks this. The e2e asserts it.
6. Switching profiles deliberately goes direct for 250ms first so same-host logins don't reuse old sockets. Startup reconcile deliberately does not.
7. UI copy is uppercased via CSS `text-transform`, so `innerText` returns uppercase; use `textContent` in tests. The delete confirm window is 3s.
8. Harness quirks: a service worker can't message itself (send from an extension page); use `*.example.test` hosts (Chrome bypasses loopback); `chrome.runtime.reload()` makes Playwright lose the worker in headless mode.

Storage keys (`shared/store.js`): `profiles`, `activeId`, `lastId`, `since`, `fault`, `draft`.

## Next up (nothing is blocking; pick what the owner wants)

- [ ] Try it in a real desktop Chrome (so far only headless Chromium + screenshots)
- [ ] Pick a LICENSE (owner's choice; none added)
- [ ] CI: GitHub Action running `npm test`
- [ ] Optional features, only if asked: opt-in exit-IP / latency check, keyboard shortcut to toggle, import/export profiles (passwords are plaintext, so warn), editable bypass list, no-auth SOCKS5
- [ ] Chrome Web Store packaging (zip, 1280×800 screenshots, privacy policy) if the owner wants to publish
- [ ] If anyone sees a login prompt right after browser start, revisit the cold-start race (test `asyncBlocking` with the callback form on the target Chrome before changing anything)
