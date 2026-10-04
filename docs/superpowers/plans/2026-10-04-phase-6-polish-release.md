# Q-Learn Mobile Phase 6 (Offline, Notifications, Deep Links, Release) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app dependable outside a perfect network and ready for the stores:
- Content a student has already opened stays readable offline.
- Lesson completion made offline syncs when the device reconnects.
- Links open the right screen, even when the student has to sign in first.
- An opt-in daily study reminder.
- The app can be built, updated over the air and submitted with EAS.

**Architecture:**
- **Offline cache:** the TanStack Query cache is persisted with `@tanstack/react-query-persist-client` and an async persister over `expo-sqlite/kv-store`. Only an allowlist of curriculum and progress queries is persisted, and the persisted cache is wiped on sign-out.
- **Connectivity:** `onlineManager` is fed by `expo-network`. Paused mutations (lesson completion) are persisted and resumed through `setMutationDefaults`.
- **Deep links:** Expo Router file routes, plus a small "pending href" that survives the sign-in redirect.
- **Notifications:** local only (`expo-notifications` daily trigger). The backend has no push-token or notification API, so remote push is documented as a backend gap (audit §13), not built.
- **Release:** `expo-updates` with a fingerprint runtime version, EAS channels (already in `eas.json`), and a release checklist.

**Tech Stack (new):** `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister` (5.104.x, matching `@tanstack/react-query`), `expo-network`, `expo-notifications`, `expo-updates`. Install Expo packages with `EXPO_OFFLINE=1 npx expo install <pkg>`, because the proxy blocks api.expo.dev. Install the TanStack packages with `npm install <pkg>@5.104.1`.

**Spec:** `docs/architecture-audit.md` §13 (backend gaps), §14 (mobile architecture), §16 (dependencies), §18 (Phase 6), §19 (risks). Expo docs for SDK 57: `https://docs.expo.dev/versions/v57.0.0/`.

## Global Constraints

- **Never fake backend success.** An offline write is shown as *pending sync*, never as saved. Anything needing the live backend (circuit runs, tutor) is disabled with an explanation while offline. Nothing is queued except lesson completion, which is idempotent (`PUT`).
- **Per-account data.** The persisted cache and pending mutations belong to the signed-in account. Sign-out (including the revoked-session path) wipes both, and so do the scheduled reminders.
- No tokens or secrets in the persisted cache. Persist only the allowlist (Task 1). The `/auth/me` profile and tutor transcripts are not persisted.
- Deep-link params are untrusted input. Routes validate them, and unknown or invalid links land on a friendly not-found screen.
- No new backend endpoints. Gaps go to audit §13 with the smallest backend addition.
- Every task keeps `npm run lint`, `npm run type-check` and `npm test` green, and `npx expo export --platform ios --platform android` bundling. Tests sit in `__tests__/*.test.ts(x)` next to the code.

---

### Task 1: Offline cache and connectivity
**Files:** `src/lib/query/{client.ts,persist.ts,online.ts}`, `src/app/_layout.tsx`, `src/features/auth/AuthProvider.tsx`, `src/features/learning/hooks.ts`, `src/components/OfflineBanner.tsx`, lesson screen and the Run / tutor composers, plus tests

- [x] `online.ts`: `onlineManager.setEventListener` backed by `expo-network` (`addNetworkStateListener`, `getNetworkStateAsync`). Online = `isConnected && isInternetReachable !== false`. Add a `useIsOnline()` hook via `useSyncExternalStore` on `onlineManager`.
- [x] `persist.ts`:
  - An async persister over `expo-sqlite/kv-store`, key `qlearn.query-cache`.
  - `maxAge` 7 days. `buster` = app version from `expo-constants`.
  - `shouldDehydrateQuery` allows only successful queries whose key root is in the learning allowlist: courses, course detail, lesson, progress. Paused mutations are always dehydrated.
  - Export `clearPersistedCache()`.
- [x] `client.ts`:
  - Default `gcTime` must be at least `maxAge` for persisted queries (24 h is fine; document why).
  - `setMutationDefaults(['lesson-progress','complete'], { mutationFn })` so a mutation restored after a restart can still run.
  - `useMarkLessonComplete` uses that `mutationKey`, keeps its optimistic update, and **does not roll back** while paused offline. On a real server rejection it rolls back as today.
- [x] `_layout.tsx`: `PersistQueryClientProvider` replaces `QueryClientProvider`. `onSuccess` calls `queryClient.resumePausedMutations()` and then invalidates progress.
- [x] `AuthProvider`: on `SIGNED_OUT`, clear the client, the mutation cache and the persisted cache.
- [x] UI:
  - `OfflineBanner` at the top of the signed-in stack: "You're offline. Showing saved content."
  - The lesson screen shows "Saved on this device · syncs when you're back online" while the completion mutation `isPaused`.
  - RunPanel Run, simulation Run and the tutor Send are disabled offline, with a one-line reason.
  - Uncached screens offline show the existing error state with an offline message, not a spinner forever.
- [x] Tests:
  - Allowlist dehydration.
  - The mutation pauses offline and resumes online, and stays optimistic while paused.
  - Sign-out wipes the persisted key.
  - The banner and disabled states.

**Implementation notes (deviations and decisions):**
- Online = `isConnected !== false && isInternetReachable !== false`. Both fields are optional in expo-network, so "unknown" counts as online rather than showing a false offline banner at launch. The initial `getNetworkStateAsync()` result is ignored if a change event arrived first.
- Mutations default to `networkMode: 'always'` (sign-in, sign-out, password reset fail fast offline as before). Only the lesson-completion key (`['lesson-progress','complete']`) uses `'online'` through `setMutationDefaults`, so it is the only thing that pauses.
- Only paused lesson-completion mutations are persisted, not every paused mutation: other mutations have no registered mutationFn and couldn't run after a restart.
- The persisted cache is per account: each save carries `ownerId`, nothing is saved while signed out (an empty cache removes the key), and restore discards the cache unless the current Supabase session's user id matches. This runs before hydration, so a queued completion can never resume with another account's token. AuthProvider also wipes the in-memory and on-disk cache on `SIGNED_OUT`, on `INITIAL_SESSION` with no session, and when a different user signs in.
- Buster = app version | runtimeVersion (when a string) | `CACHE_SCHEMA`.
- `onSuccess` only calls `resumePausedMutations()` (which returns at once offline; the client's online subscription resumes later). The progress resync is the completion default's `onSettled` invalidation, so it also runs for restored completions, which have no rollback callbacks. A live completion that the server rejects rolls back only its own row.
- Queued completions are marked "waiting to sync" everywhere progress shows (lesson rows, level/course counts, Continue learning), not only on the lesson screen.
- Offline with nothing cached, data screens show the offline error. The profile card instead says "Account details load when you're back online."

### Task 2: Deep links
**Files:** `src/app/_layout.tsx`, `src/features/linking/{pending-href.ts,…}`, `src/app/+not-found.tsx`, `src/app/(auth)/*` (post-login redirect), plus tests

- [x] Supported links, each resolving to an existing route:
  - `qlearn://lesson/<id>`, `qlearn://level/<id>`
  - `qlearn://learn`, `qlearn://build`, `qlearn://tutor`, `qlearn://profile`, `qlearn://` (home)
  - The auth links already handled (`auth/callback`, `reset-password`) must keep working.
- [x] Pending href:
  - When a signed-out user opens a protected link, remember the path (in memory, plus kv so it survives a cold start; one entry, expires after 15 min).
  - After sign-in (email or Google), `router.replace` to it once, then clear it.
  - Never store or replay the auth callback, reset-password or a link with an unknown root. Clear it on sign-out.
  - Use Expo Router's documented hooks (`usePathname` / `+native-intent` `redirectSystemPath` as appropriate for SDK 57). Read the docs before choosing.
- [x] IDs: only accept ids matching the backend id shape (UUID or the CMS slug/id pattern the content layer already accepts). Otherwise show not-found. Not-found copy explains the link isn't supported yet.
- [x] Not supported (doc only; the audit §13/§14 rows are written in Task 5):
  - `circuit/<id>`: no `GET /circuits/{id}`.
  - `quiz/<id>`: Phase 3 is blocked.
  - Universal links (`https://…`): these need the web domain to host the apple-app-site-association and assetlinks.json files from the Q-Learn frontend. Task 5 records this in audit §13/§14.
- [x] Tests: `expo-router/testing-library` `renderRouter` for each supported link, the signed-out → sign-in → land-on-target flow, the rejection of an invalid id, and pending href expiry.

**Implementation notes (deviations and decisions):**
- Capture uses `src/app/+native-intent.ts` `redirectSystemPath`, which expo-router 57 calls for every system link, cold (`initial: true`, from `getInitialURL`) and warm (from the `Linking` `url` subscription), before routing (`build/getLinkingConfig.js`, `build/link/linking.js`). It never rewrites the path. `usePathname` was not usable: the docs say a blocked `Stack.Protected` screen redirects to the anchor or first available screen, so the target path is gone by the time a layout reads it (it shows only for one render on a cold start). Native-intent has no auth context (per the docs), so `features/linking/pending-href.ts` keeps the auth state the root navigator reports; a link that arrives before the session is read is held and becomes pending only if the session turns out empty.
- Replay: `usePendingHrefReplay` in `RootNavigator` calls `router.replace` once, after the render that flips the guards, for email, Google and restored sessions alike. `(auth)/*` is unchanged.
- Validation (`features/linking/links.ts`) depends on the content source. Legacy: lesson, level and course ids are UUIDs. CMS: lessons are UUIDs (content_refs) or `payload:<doc id>`, and levels and courses are Payload doc ids (`[A-Za-z0-9-]{1,64}`, the web's `/api/cms` check). The lesson and level screens validate their params (including `courseId`) and show "Link not supported" without fetching. `+not-found` uses the same copy.
- Home (`/`) is never stored, either as the pending href or as a launch link. A plain launch arrives as the root URL, so storing it would replace a waiting link. Kv contents are re-validated on read, and an entry dated in the future counts as expired.
- The pending href is cleared only on a `SIGNED_OUT` that follows a signed-in user (which covers the revoked-session path), not by the whole AuthProvider wipe. The wipe also runs on a signed-out launch (`INITIAL_SESSION` with no user). auth-js also emits `SIGNED_OUT` during init, before `INITIAL_SESSION`, when a stored refresh token fails. Clearing in either case would drop a link that has to survive the launch.
- `openAppLink(href)` is there for Task 3. It accepts only links that pass the same allow-list. Signed in, it navigates at once. Otherwise it stores the link for after sign-in.
- Also fixed: signed out, `auth/callback` used to redirect to the protected `/` and stay blank. Now it goes `back()` when it sits on top of a screen, which is the Android OAuth case. A `replace` there would stack a second `(auth)` route (seen in the router state). Opened cold, it replaces to `/login` (signed out) or `/` (signed in), and the guard moves on once the session lands.
- Tests run the real root layout, guards and screens through `renderRouter` (tab screens are stubbed). With RNTL v14, `renderRouter` returns a thenable, so await it and keep the original object for `getPathname`.

### Task 3: Study reminders (local notifications)
**Files:** `src/features/notifications/{reminders.ts,useNotificationRouting.ts}`, `src/stores/preferences-store.ts`, `src/app/(tabs)/profile.tsx`, `app.json`, plus tests

- [ ] Preferences: `reminder: { enabled: boolean; hour: number; minute: number }`, default disabled at 19:00. Persisted (it is client state).
- [ ] `reminders.ts`:
  - `enableReminder(time)`: ask for permission only when the user turns it on (with a rationale first). Create the Android channel `study-reminders`, cancel the previous schedule, and schedule a `DAILY` trigger.
  - `disableReminder()`.
  - `syncReminderSchedule()` on launch, so the OS schedule matches the preference.
  - If permission is denied, keep the toggle off and show how to enable it in Settings (`Linking.openSettings`).
  - Copy is honest and generic ("Time for a little quantum practice"). No streak or progress claims the client can't verify.
- [ ] Tap routing:
  - The notification `data.url` is `/` (Home → continue learning).
  - Handle both the cold-start last response and runtime responses. Route through Task 2's link handling, so a signed-out tap lands after sign-in.
- [ ] Profile: a "Study reminder" card with a toggle and a time picker (hour/minute steppers; no new picker dependency).
- [ ] Sign-out cancels all scheduled reminders and resets the preference.
- [ ] `app.json`: the `expo-notifications` plugin (icon/color from the theme). No push credentials and no `projectId` dependency for local notifications.
- [ ] Tests: schedule/cancel calls with `expo-notifications` mocked, permission denied, launch sync, and tap routing.
- [ ] Audit §13/§14: remote push needs `POST /api/v1/devices` (Expo push token per user) plus server-side sending. This is a smallest-addition proposal and is not built.

### Task 4: Release readiness and performance
**Files:** `app.json`, `eas.json`, `docs/release.md`, `.github/workflows/ci.yml` (only if needed), and list screens (performance)

- [ ] `expo-updates`:
  - Configure the plugin with `runtimeVersion: { policy: 'fingerprint' }` and channels from `eas.json` (preview / production).
  - Check for an update on launch with the default `ON_LOAD` behaviour.
  - The Profile "About" row shows the version, the channel and the update id.
- [ ] `eas.json`: keep the profiles. Add a `submit.production` skeleton without any credentials (ASC app id and service account key are placeholders documented in `docs/release.md`).
- [ ] `app.json`:
  - Review permissions: Android `blockedPermissions` for anything a dependency adds that the app doesn't use (verify with `npx expo config --type introspect`).
  - The iOS privacy manifest reasons required by the SDK. `version` stays as is.
- [ ] Performance:
  - Any unbounded server list rendered with `ScrollView` + `map` becomes `FlatList` (the curriculum level list, search results, tutor history).
  - No speculative memoisation (React Compiler is on).
- [ ] `docs/release.md`: a checklist covering:
  - Confirming the bundle id.
  - Supabase redirect URLs.
  - EAS env vars per environment.
  - Build, submit and OTA commands.
  - Store listing assets.
  - Rollback (`eas update:republish`).
- [ ] Verify `npx expo config` resolves, and that export bundles.

### Task 5: Docs and verification
- [ ] Audit: §13, §14, §16, §18 and §19 updated with Phase 6 status and the remaining backend gaps (push devices, `GET /circuits/{id}`, quiz API, universal-link files on the web).
- [ ] README status, AGENTS (offline and notification invariants), and this plan's boxes ticked.
- [ ] lint, type-check, tests, iOS + Android export, and screenshots of the offline banner, pending-sync and the reminder card.
