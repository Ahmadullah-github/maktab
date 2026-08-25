# Electron security checklist

This checklist maps the production desktop runtime to Electron's maintained
[security guidance](https://www.electronjs.org/docs/latest/tutorial/security). A checked item must
have automated evidence or an explicit manual verification. Revisit the checklist on every
Electron major upgrade.

| Electron guidance | Maktab control | Evidence |
| --- | --- | --- |
| Use a current Electron release | Electron is exact-pinned to 43.4.1. | `npm ls electron` and lockfile |
| Do not load untrusted remote code | The packaged renderer is served by the authenticated loopback API; scripts are local-only. | Packaged smoke test and CSP response |
| Disable Node integration for renderers | `nodeIntegration: false`. | `apps/desktop/main.js`, syntax/security review |
| Enable context isolation | `contextIsolation: true`; only the frozen `window.maktab` bridge is exposed. | Main/preload review and packaged smoke test |
| Enable process sandboxing | `sandbox: true`. | Main-process configuration review |
| Handle permission requests | The default session denies every permission request. | Main-process configuration review |
| Do not disable web security | `webSecurity: true`. | Main-process configuration review |
| Define a restrictive CSP | Scripts, network access, frames, objects, workers, forms, and base URLs are restricted to the packaged origin. Inline style attributes are the sole exception; third-party runtime style elements are externalized or replaced with the CSP-safe scroll-lock adapter. | Local API tests and full packaged-workflow CSP assertion |
| Do not allow insecure content | `allowRunningInsecureContent: false`. | Main-process configuration review |
| Do not enable experimental Chromium features | `experimentalFeatures: false`. | Main-process configuration review |
| Avoid and constrain `<webview>` | `webviewTag: false`; `will-attach-webview` is denied defensively. | Main-process configuration review |
| Limit navigation | Main-frame navigation is restricted to the exact dynamic renderer origin. | URL-policy unit tests |
| Limit new windows | Every `window.open` request is denied. | URL-policy and packaged smoke tests |
| Validate `shell.openExternal` destinations | Desktop v1 has an explicit empty allowlist and does not call `shell.openExternal`. | URL-policy tests and source syntax review |
| Do not weaken new-window options through renderer APIs | No BrowserWindow construction API is exposed to the renderer. | Preload review |
| Validate IPC senders | Every handler requires the active BrowserWindow, its main frame, and exact renderer origin. | IPC contract tests |
| Expose narrow APIs instead of Electron primitives | The preload exposes named business operations; `ipcRenderer`, filesystem, process, and Electron objects are not exposed. | Preload review and packaged smoke test |
| Avoid privileged `file://` rendering | The renderer uses a token-protected loopback HTTP origin; the file-protocol privilege fuse is disabled. | Packaged smoke and fuse inspection |
| Review Electron fuses | RunAsNode, Node options, CLI inspect, file privileges, and browser snapshot are disabled; cookie encryption, ASAR integrity, and ASAR-only loading are enabled. | `npm run check:packaged-desktop` |
| Keep external native resources trustworthy | Solver and better-sqlite3 hashes are embedded inside integrity-protected ASAR and verified before API startup. | Resource-integrity unit, packaged checks, and `npm run test:packaged-tamper` |
| Protect verification trust roots | License and update public-key rings are validated during packaging and embedded inside the integrity-protected ASAR; private keys remain release-service-only. | Packaging hook, lease key-overlap tests, and ASAR integrity inspection |

Manual release acceptance must additionally confirm native printing, QA activation and safeStorage
persistence, timetable generation, and application startup on clean Windows 10 and Windows 11 x64
machines. Record that evidence in `WINDOWS_RUNTIME_ACCEPTANCE.md`.
