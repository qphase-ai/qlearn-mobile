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

## Layout

- Routes live in `src/app/` (every file is a screen; `_layout.tsx` defines navigators).
  Keep non-route code outside `src/app/`.
- `ios/` and `android/` are generated (CNG). Configure native behaviour in `app.json`.
- Plans follow the superpowers format in `docs/superpowers/plans/`.
