# Renderer guidance

- This app must remain usable both as a responsive website and as the Electron renderer.
- Use `features/platform/platformClient.ts` for cloud calls and `lib/api.ts` for local timetable
  calls. Do not mix the two base URLs.
- Module navigation must be derived from server capabilities. UI checks improve experience but are
  never security controls.
- Electron credentials and tokens must stay behind `window.electron.platform`; never store bearer
  or refresh tokens in local storage.
- Prefer feature folders with an API client, schemas/types, hooks/store, components, and tests.
- Preserve keyboard access, form labels, responsive layouts, RTL logical properties, and loading,
  empty, error, unauthorized, and offline states.
