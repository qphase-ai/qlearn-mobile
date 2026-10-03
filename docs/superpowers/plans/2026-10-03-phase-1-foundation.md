# Q-Learn Mobile Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first milestone from `docs/architecture-audit.md` §20: a student signs in on mobile with their existing Q-Learn account (same Supabase project as the web) and sees their server profile from `GET /api/v1/auth/me`. The foundation (navigation shell, theme, API client, session management, CI, EAS profiles) carries Phases 2–6.

**Architecture:** Expo Router root `Stack` with `Stack.Protected` guards driven by an `AuthProvider`, which wraps the supabase-js session. supabase-js persists the session in SecureStore through a chunked adapter, and an expo-crypto polyfill makes PKCE use S256. A single `apiClient` unwraps the FastAPI envelope, raises a typed `ApiError`, injects the live access token, and on a 401 does one refresh and retries once. Screens call TanStack Query hooks, never `fetch`. Zustand holds only the theme preference, persisted in expo-sqlite's kv-store.

**Tech Stack:** Expo SDK 57 (RN 0.86, React 19.2), Expo Router 57, TypeScript 6, @supabase/supabase-js 2, TanStack Query 5, Zustand 5, expo-secure-store, expo-sqlite, expo-web-browser, expo-linking, expo-crypto, jest-expo + @testing-library/react-native.

**Spec:** `docs/architecture-audit.md`

## Global Constraints

- No backend changes in this phase. Only implemented endpoints are called (`/health`, `/api/v1/auth/me`).
- Only `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (+ the content flags, unused until Phase 2) reach the client. No secrets.
- The session is never written to AsyncStorage or SQLite. It goes to SecureStore only.
- No `fetch` in components or screens. Server state goes in TanStack Query, never Zustand.
- No invented features: Learn, Build and Tutor tabs show honest "coming in Phase N" states, and there is no fake streak, XP or recommendations.
- Colors come from `src/constants/theme.ts` tokens (ported from `frontend/src/app/globals.css`). Never hardcode them in components.
- `npm run lint`, `npm run type-check` and `npm test` stay green after every task.

---

## File Structure

New files:
- `app.json`, `eas.json`, `jest.config.js`, `eslint.config.js`, `.env.example`, `.github/workflows/ci.yml`
- `src/lib/env.ts`: validated public config
- `src/lib/storage/secure-storage.ts`: chunked SecureStore adapter for supabase-js
- `src/lib/storage/kv.ts`: expo-sqlite kv-store wrapper for non-secret persistence
- `src/lib/supabase/polyfills.ts`, `src/lib/supabase/client.ts`
- `src/lib/api/errors.ts`, `src/lib/api/client.ts`, `src/lib/api/endpoints/{auth,health}.ts`
- `src/types/contracts.ts`: backend contract types (copied from `frontend/src/types/index.ts`)
- `src/features/auth/{AuthProvider.tsx,auth-api.ts,validation.ts,redirects.ts}`
- `src/features/profile/hooks.ts`, `src/features/health/hooks.ts`
- `src/lib/query/client.ts`: QueryClient defaults (retry policy keyed on ApiError)
- `src/stores/preferences-store.ts`
- `src/constants/theme.ts`, `src/hooks/use-theme.ts`
- `src/components/ui/*`: Screen, Text, Button, TextField, Card, StateViews (Loading/Error/Empty), Banner
- `src/app/_layout.tsx`, `src/app/(auth)/*`, `src/app/(tabs)/*`, `src/app/reset-password.tsx`, `src/app/auth/callback.tsx`, `src/app/+not-found.tsx`
- Tests under `src/**/__tests__/`

---

### Task 1: Project foundation
- [x] Generate a reference `create-expo-app --template default@sdk-57` and keep only config, assets and the `src/app` convention
- [x] `app.json`: name `Q-Learn`, scheme `qlearn`, iOS and Android only, plugins (router, splash, secure-store, sqlite, web-browser), typed routes, React Compiler
- [x] Install deps with `expo install` (SDK-resolved). Pin `react-dom` to the RN React version (peer conflict)
- [x] `tsconfig` strict, with the `@/*` alias to `src/*`

### Task 2: Config and secure storage
- [x] `env.ts`: read `EXPO_PUBLIC_*` statically (Metro inlines only literal access). Validate URLs, and throw an actionable error when values are missing
- [x] `secure-storage.ts`: `getItem/setItem/removeItem`. Values above 1800 bytes are split across `key.0..n` with a `key.__chunks` count. Overwrites remove stale chunks. Keys are sanitised to `[A-Za-z0-9._-]`
- [x] Tests: round trip, chunking, shrink cleanup, removal, key sanitising

### Task 3: Supabase client
- [x] `polyfills.ts`: if missing, install `crypto.getRandomValues` and `crypto.subtle.digest('SHA-256')` backed by expo-crypto
- [x] `client.ts`: `createClient(url, anonKey, {auth: {storage: secureStorage, persistSession, autoRefreshToken, detectSessionInUrl: false, flowType: 'pkce'}})`. Start and stop auto-refresh on AppState changes

### Task 4: API client
- [x] `errors.ts`: `ApiError {status, code, message, details}` with codes from the backend plus `NETWORK_ERROR`, `TIMEOUT`, `RATE_LIMITED`, `UNKNOWN`. `toUserMessage(err)` gives student-safe copy and never leaks internals
- [x] `client.ts`: `apiRequest<T>(path, {method, body, auth=true, timeoutMs=15000, signal})`. Unwraps `{success, data}`. Bearer comes from `getSession()`. On 401: `refreshSession()` once and retry, then call `onUnauthorized` (sign-out hook)
- [x] Endpoints: `getMe()`, `getHealth()` (no envelope)
- [x] Tests: success unwrap, envelope error mapping, non-JSON error, network failure, timeout, 401 refresh-and-retry success, 401 twice signs out, unauthenticated requests send no header

### Task 5: Auth feature
- [x] `auth-api.ts`: `signIn`, `signUp(email, password, displayName)` (returns `needsConfirmation`), `signOut`, `sendPasswordReset`, `updatePassword`, `signInWithGoogle` (WebBrowser auth session + `exchangeCodeForSession`), `completeAuthFromUrl` (code or error params)
- [x] `validation.ts`: email and password rules. New passwords need 8+ characters, stricter than the Supabase default of 6; sign-in does no length check. Tests
- [x] `AuthProvider`: `{session, user, isLoading}` from `getSession()` + `onAuthStateChange`. Hides the splash once the session is known. Registers the API client's unauthorized handler. Clears the query cache on sign-out

### Task 6: Theme and UI primitives
- [x] `theme.ts`: light and dark tokens from the web (`background, surface, elevated, foreground, muted, border, cyan, purple, green, success, warning, error`), spacing, radii, type scale, gate palette (Phase 5)
- [x] `preferences-store.ts` (Zustand + kv persist): `themePreference: 'system'|'light'|'dark'`
- [x] UI primitives with 44pt min touch targets and accessibility roles and labels. Component tests for Button and StateViews

### Task 7: Navigation and screens
- [x] Root layout: GestureHandlerRootView → SafeAreaProvider → QueryClientProvider → AuthProvider → ThemeProvider → `Stack` with `Stack.Protected guard={!!session}` for `(tabs)` and `!session` for `(auth)`. `reset-password` and `auth/callback` are always reachable
- [x] Auth screens: login (email + Google), signup, forgot-password (sends reset email), reset-password (sets a new password from the recovery link)
- [x] Tabs: Home (greeting from `/auth/me`, API status, honest roadmap cards), Learn/Build/Tutor (coming-next states), Profile (email, role, verified, theme switch, sign out)
- [x] Offline/error/retry states on every query

### Task 8: Quality gates and delivery
- [x] `eslint.config.js` (eslint-config-expo flat), `jest.config.js` (jest-expo preset)
- [x] `.github/workflows/ci.yml`: `npm ci`, lint, type-check, test on push and PR
- [x] `eas.json`: development (dev client, internal), preview (internal), production (auto-increment). `APP_ENV` per profile. No credentials
- [x] README (setup, env, Supabase redirect URLs, scripts), AGENTS.md / CLAUDE.md (repo rules)
- [x] `expo-doctor`, `expo export` smoke bundle for iOS and Android
