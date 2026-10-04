# Q-Learn Mobile

The official iOS and Android client for **Q-Learn**, the adaptive multi-agent AI platform for quantum computing education. Built with React Native + Expo.

Q-Learn Mobile is a **second client of the existing platform**, not a separate product:

```
Web (Next.js) ─┐                    ┌─ Supabase (Auth · Postgres · Realtime)
               ├─ FastAPI backend ──┼─ AI agents (server-side LLMs, RAG)
Mobile (Expo) ─┘   (Q-Learn repo)   └─ Quantum execution (Vercel Sandbox · Qiskit Aer)
```

The backend, database, auth, curriculum, AI tutor and quantum execution all live in [`qphase-ai/Q-Learn`](https://github.com/qphase-ai/Q-Learn). This repo contains only the mobile client. It talks to the same FastAPI API and the same Supabase project as the web app, so **one account works on both**.

- Architecture audit and roadmap: [`docs/architecture-audit.md`](docs/architecture-audit.md)
- Current plan: [`docs/superpowers/plans/2026-10-04-phase-6-polish-release.md`](docs/superpowers/plans/2026-10-04-phase-6-polish-release.md)
- Release checklist: [`docs/release.md`](docs/release.md)

## Status

- **Phase 1 (Foundation)**, done: Expo SDK 57 app, navigation shell, theme, Supabase Auth (email, Google, password reset), secure session persistence, typed API client, CI and EAS profiles.
- **Phase 2 (Learn)**: curriculum browsing (course → level → lesson) from the legacy API or the CMS, a native lesson renderer for every CMS block type (math via KaTeX in an Expo DOM component), progress shared with the web, lesson search, "continue learning" on Home, and authored simulations run on the Q-Learn quantum backend.

- **Phase 4 (AI Tutor)**: streamed answers from the existing Q-Learn tutor (Markdown, math, citations), persistent conversations, and "ask about this lesson / this circuit" entry points. Phase 3 (graded practice) waits on a server-side quiz API.

- **Phase 5 (Build)**: a touch-first circuit editor. You can tap to place gates, long-press and drag to move them, edit angles, undo and redo, use example templates, run on the Q-Learn quantum backend, ask the tutor about the circuit, and open lesson circuits in the builder. It sends the same canonical `CircuitSpec` as the web.

- **Phase 6 (Polish)**, done: lessons you've opened stay readable offline, and a lesson completed offline is queued and shown as "waiting to sync" until the server saves it. `qlearn://` deep links open the right screen, even after signing in first. There is an opt-in daily study reminder (local notification). Release readiness: OTA updates with `expo-updates`, store submit config, permissions and the iOS privacy manifest.

Next: Phase 3 (graded practice) when the Q-Learn quiz API lands, and the other backend items in the audit (§13): remote push, saved circuits, universal links. See the roadmap in the audit (§18).

## Tech stack

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript · Expo Router · TanStack Query (server state, persisted offline cache) · Zustand (client state) · Supabase JS (Auth + Realtime) · Expo SecureStore · expo-sqlite · expo-network · expo-notifications (local only) · expo-updates · Reanimated · Gesture Handler · Jest + React Native Testing Library

## Getting started

Prerequisites: Node 22, npm, and the Expo Go app or a development build on a device or simulator.

```bash
npm install
cp .env.example .env.local     # then fill in the values (see below)
npm start                      # scan the QR code with Expo Go, or press i / a
```

The app adds no custom native code, so it should run in **Expo Go**. Local study reminders are expected to work there too, but that hasn't been checked on a device yet. Over-the-air updates are off in Expo Go and development. For checks that need native behaviour (notification taps from a cold start, gestures, the OAuth return on Android), use a development build (`npx eas-cli@latest build --profile development`).

### Environment variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Q-Learn FastAPI base URL. On a device or Android emulator, use your machine's LAN IP, not `localhost` |
| `EXPO_PUBLIC_SUPABASE_URL` | Same value as the web's `NEXT_PUBLIC_SUPABASE_URL` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same value as the web's `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon / publishable key) |
| `EXPO_PUBLIC_CONTENT_SOURCE` | `legacy` (FastAPI courses) or `cms` (Payload via the web's `/api/cms/*`). Used from Phase 2 |
| `EXPO_PUBLIC_CONTENT_URL` | Web app origin serving `/api/cms/*`. Required when the source is `cms` |

> Every `EXPO_PUBLIC_*` value is compiled into the app binary. **Never** put a Supabase service key, LLM key, database URL, Vercel token or any other secret here. Privileged operations stay on the backend.

For EAS builds, set the variables per environment (`development`, `preview`, `production`) with `npx eas-cli@latest env:create`. The profiles in `eas.json` select the environment.

### One-time Supabase configuration

OAuth and password-reset links return to the app through deep links. Add these under **Supabase → Authentication → URL Configuration → Redirect URLs** for the shared project:

- `qlearn://auth/callback`
- `qlearn://reset-password`
- For Expo Go development: `exp://**` (or your specific `exp://<ip>:8081/--/*` URLs)

Google sign-in uses the Google provider already enabled for the web. No mobile-specific Google client is needed for the browser-based flow.

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the Metro dev server |
| `npm run lint` | ESLint (`eslint-config-expo`) |
| `npm run type-check` | `tsc --noEmit` |
| `npm test` | Jest unit, component and integration tests |
| `npm run doctor` | `expo-doctor` dependency and config checks |

Always add dependencies with `npx expo install <pkg>` so versions match the Expo SDK.

## Project structure

```
src/
  app/              Expo Router routes only
    (auth)/         login, signup, forgot-password (shown when signed out)
    (tabs)/         Home, Learn, Build, AI Tutor, Profile (shown when signed in)
    reset-password  recovery deep link · auth/callback: OAuth deep link
    +native-intent  captures incoming links for replay after sign-in
  components/ui/    design-system primitives (Button, TextField, Card, state views…)
  components/<domain>/  domain UI (learning, lessons, circuit, tutor, profile, …)
  features/         per-domain hooks and logic (auth, learning, circuit, tutor, profile,
                    linking: deep-link validation + pending href,
                    notifications: local study reminders)
  lib/api/          typed FastAPI client + one function per endpoint
  lib/supabase/     Supabase client (SecureStore session, PKCE) and polyfills
  lib/storage/      chunked SecureStore adapter
  lib/query/        TanStack Query client, offline persistence, onlineManager wiring
  stores/           Zustand stores (client state only)
  types/contracts   backend contract types (mirrors the web/backend schemas)
  constants/theme   design tokens ported from the web design system
plugins/            local Expo config plugins (withoutPushEntitlement)
docs/               architecture audit, implementation plans, release checklist
```

Data flow: `screen → feature hook (TanStack Query) → endpoint function → apiClient → FastAPI`. Screens never call `fetch` directly.

## Architecture rules

1. The app is a **client**. No direct database access for privileged operations, no LLM calls, and no Qiskit or code execution on the device.
2. Reuse existing Q-Learn APIs and contracts. If mobile needs a missing capability, propose the smallest backend addition in the Q-Learn repo (see the audit, §13). Don't invent endpoints here.
3. Server state goes in TanStack Query. Zustand holds genuine client state only.
4. Auth tokens live only in SecureStore, through supabase-js.
5. Realtime goes through Supabase broadcast channels using the backend's channel names. Subscribe before POSTing.
6. Never fake success for operations that need the backend, and never ship correct answers to the client.

## Deep links

Scheme: `qlearn://`. Supported links:

| Link | Opens |
|---|---|
| `qlearn://` | Home |
| `qlearn://learn` · `build` · `tutor` · `profile` | That tab |
| `qlearn://lesson/<id>` · `qlearn://level/<id>` | The lesson or level (optional `?courseId=`) |
| `qlearn://auth/callback` · `qlearn://reset-password` | Google sign-in and password reset (Supabase redirects) |

Ids are checked against the content id shapes (UUIDs, or Payload ids for the CMS source). Anything else shows a "link not supported" screen. A link opened while signed out is remembered for 15 minutes and opened once after sign-in (email, Google or a restored session). Auth callback and reset links are never stored.

Not supported yet: `qlearn://circuit/<id>` (no `GET /circuits/{id}`), `qlearn://quiz/<id>` (no quiz API), and universal `https://` links (the web domain must host the association files). See the audit, §13.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs lint, type-check and tests, and bundles both platforms on every PR. `eas.json` defines the `development`, `preview` and `production` build profiles. No signing credentials are committed. They are managed by EAS.

## Releasing

Builds, store submission, OTA updates (`eas update`) and rollback are in [`docs/release.md`](docs/release.md), with the one-time account steps (`eas init`, `eas update:configure`, store credentials). Until those run, `expo-updates` is built in but disabled.

> The bundle identifier / package `ai.qphase.qlearn` is a placeholder. Confirm it before the first store submission, because it can't be changed afterwards.
