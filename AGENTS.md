# AGENTS.md — Q-Learn Mobile

Guidance for AI coding agents working in this repository.

Q-Learn Mobile is the React Native + Expo client of the Q-Learn platform. The backend,
database, auth, curriculum, AI agents and quantum execution live in `qphase-ai/Q-Learn`.
Read `docs/architecture-audit.md` before any cross-cutting change.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo,
EAS or React Native API, check the `expo` major version in `package.json` (currently 57)
and read the matching docs (`https://docs.expo.dev/versions/v57.0.0/`, or
`https://docs.expo.dev/llms.txt`).

## Commands

```bash
npx expo install <pkg>   # ALWAYS use this instead of npm install for runtime deps
npm start                # dev server
npm run lint             # eslint
npm run type-check       # tsc --noEmit
npm test                 # jest
```

Run lint, type-check and tests before declaring any task done.

## Invariants — never violate

| Rule | Why |
|---|---|
| The app is a client: no LLM provider calls, no Qiskit or code execution, no privileged DB access | Platform security boundary (Q-Learn `AGENTS.md`) |
| Only `EXPO_PUBLIC_*` public config in the app. Never service keys or secrets | Everything public is in the binary |
| Auth session only in SecureStore via supabase-js (`lib/storage/secure-storage.ts`) | No tokens in AsyncStorage or SQLite |
| Use existing FastAPI endpoints and contracts (`types/contracts.ts`). Don't invent endpoints | Backend is the source of truth |
| Server state in TanStack Query. Zustand only for client state | Explicit state ownership |
| No `fetch` in screens or components: screen → feature hook → `lib/api/endpoints` → `apiClient` | One place for auth, errors, retries |
| Realtime: Supabase broadcast with the backend's channel names. Subscribe before POST. No polling | No replay on broadcast channels |
| Never hardcode correct answers or fake backend success | Integrity of the learner model |
| Colors from `constants/theme.ts` via `useTheme()` | Light/dark consistency with web tokens |
| Offline: only the allowlisted learning queries persist (`lib/query/persist.ts`), stamped with the owner and wiped on sign-out. The only queued write is lesson completion, shown as "waiting to sync", never as saved. Online-only actions are disabled offline | No cross-account data, no fake success |
| Every incoming link goes through `features/linking` (validated, `protectedHref`). Never store auth callback or reset links | Links are untrusted input |
| Notifications are local only. Reminder operations go through `features/notifications/reminders` (serialized). No push token | No push backend yet (audit §13) |
| Release: runtime version is `fingerprint`. Bump `CACHE_SCHEMA` when a persisted query shape changes. Adding a native dep: update `ios.privacyManifests` and `android.blockedPermissions`. Keep `plugins/withoutPushEntitlement` until remote push exists | OTA and store safety (`docs/release.md`) |

## Layout

- Routes live in `src/app/` (every file is a screen; `_layout.tsx` defines navigators).
  Keep non-route code outside `src/app/`.
- `ios/` and `android/` are generated (CNG). Configure native behaviour in `app.json`.
- Plans follow the superpowers format in `docs/superpowers/plans/`.
- Circuit editor: pure domain in `src/features/circuit/editor/` (model ops, `toCircuitSpec`, which
  must stay a key-for-key port of the web's `nodesToCircuitSpec`, validation, geometry and drag
  worklets), state in `src/stores/circuit-editor-store.ts`, UI in `src/components/circuit/editor/`.
  Gesture callbacks run on the UI thread: only worklets and shared values inside them, and reach
  JS via `scheduleOnRN`.
- Lesson rendering: `src/components/lessons/LessonRenderer.tsx` holds the closed block registry
  (mirrors `cms/src/blocks/lessonBlocks.ts` and the web's `components/learn/blocks`). Add a
  block type in all three together. Markdown is native; only chunks with math use the DOM
  component `MathMarkdown.tsx` (`'use dom'`). Keep DOM components to that one job.
