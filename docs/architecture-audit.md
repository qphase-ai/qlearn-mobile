# Q-Learn Mobile — Architecture Audit

**Date:** 2026-10-03
**Audited:** `qphase-ai/Q-Learn` @ `21dcca0` (backend, frontend, cms, docs)
**Status:** Accepted as the basis for Phase 1. Re-audit before each later phase, because the backend surface is still growing.

Q-Learn Mobile is a **second client** of the existing platform. This audit records what the platform actually implements today, compares it with what the docs claim, and derives the mobile architecture from the implementation rather than the docs.

> **Headline finding.** The docs describe ~15 API groups (`docs/api.md`). The backend implements **five**: auth profile, curriculum + progress, circuit execution, AI tutor, and an internal CMS hook. Quizzes, mastery, recommendations, saved circuits, profiles, streaks and payments have **no API**. Some have ORM models, and some exist only as client-side placeholders in the web app. The mobile roadmap below is constrained by this, and §13 lists the smallest backend additions that would unblock each phase.

---

## 1. Existing architecture summary

```
Web (Next.js 14, Vercel) ──┐                         ┌── Payload CMS (Next.js 16, cms/) ── schema `payload`
                           ├── FastAPI (Railway) ────┤
Mobile (Expo, this repo) ──┘    Router→Service→Model  ├── Supabase Postgres ── schema `public` (Alembic)
                                                      ├── Supabase Realtime (broadcast; API publishes)
                                                      ├── Vercel Sandbox microVM (Qiskit Aer)
                                                      └── LLM via ChatLiteLLM (server only)
```

- **Auth:** Supabase Auth runs on the client. FastAPI only *verifies* the access token (HS256 secret or JWKS ES256/RS256) and upserts a `public.users` row (`AuthService._sync_user`).
- **Content vs learner state:** Payload owns what a lesson *is*. FastAPI owns what a learner *did*. They meet only at `content_refs` (lesson ids = `content_refs.id`).
- **Async work:** circuit execution and tutor answers return `202`, run as FastAPI `BackgroundTasks`, and publish their results over Supabase Realtime **broadcast**. The API never exposes WebSockets (`AGENTS.md` invariant).
- **Response envelope:** `{success: true, data, message}` / `{success: false, error: {code, message, details}}` (`schemas/common.py`, `exceptions.py`).

## 2. Existing API inventory (implemented)

| Method & path | Auth | Request | Response `data` | Notes |
|---|---|---|---|---|
| `GET /health` | — | — | *(no envelope)* `{status, service}` | Liveness |
| `GET /api/v1/auth/me` | Bearer | — | `UserResponse {id, email, role, is_active, is_verified}` | Lazily provisions the local user |
| `GET /api/v1/courses` | Bearer | — | `CourseSummary[]` | Legacy content source (published only) |
| `GET /api/v1/courses/{id}` | Bearer | — | `CourseDetail` (modules → lessons, `order_index`) | |
| `GET /api/v1/lessons/{id}` | Bearer | — | `LessonDetail {id, module_id, title, content(md), lesson_type, is_pro, concepts[]}` | |
| `GET /api/v1/search/lessons?q=&limit=` | Bearer | — | `LessonSearchResult[] {lesson_id, lesson_title, lesson_type, is_pro, module_id, module_title, course_id, course_title, snippet}` | **Added upstream after this audit** (Q-Learn `129ebf5`). Legacy content only. The web falls back to title matching for CMS |
| `GET /api/v1/progress` | Bearer | — | `ProgressItem[] {lesson_id, status, completion_pct}` | All rows for the user, no pagination |
| `PUT /api/v1/lessons/{id}/progress` | Bearer | `{status, completion_pct}` | `ProgressItem` | 404 unless `id` is a `content_refs` lesson |
| `POST /api/v1/circuits/{circuit_id}/execute` | Bearer | `{circuit: CircuitSpec, shots=1024, name}` | `202 {execution_id, status:"pending"}` | Client mints `circuit_id`; validates before persisting; result via Realtime |
| `POST /api/v1/tutor/chat` | Bearer | `{message, session_id, lesson_id?, circuit_context?}` | `202 {session_id, status}` | Client mints `session_id`; tokens via Realtime |
| `GET /api/v1/tutor/sessions/{id}` | Bearer | — | `{session_id, messages[{role, content, citations[]}]}` | 404 if not owner |
| `POST /api/v1/internal/content-refs` | `X-CMS-Secret` | — | — | Server-to-server only. **Never call from mobile** |

Curriculum when `NEXT_PUBLIC_CONTENT_SOURCE=cms` is served by the **web app's** route handlers (anonymous, cached, revalidated on publish):

| `GET {web}/api/cms/courses` · `/api/cms/courses/{id}` · `/api/cms/lessons/{id}` | Same envelope. Same `CourseSummary`/`CourseDetail`/`LessonDetail` shapes, plus `LessonDetail.blocks[]` |

## 3. Existing authentication flow

1. Client calls `supabase.auth.signInWithPassword` / `signUp` (with `options.data.display_name`) / `signInWithOAuth({provider:'google'})`.
2. Client sends `Authorization: Bearer <access_token>` to FastAPI. The token is read fresh via `supabase.auth.getSession()` on every call, so it is never a stale copy (`frontend/src/lib/supabase.ts#getAccessToken`).
3. FastAPI verifies the token (`aud=authenticated`) and syncs `public.users`. The role (`student|instructor|admin`) lives there, not in Supabase.
4. Email confirmation may be on. `signUp` can return no session, and the UI must say "check your email".
5. Google OAuth on the web redirects to `/auth/callback`, where supabase-js exchanges the code.
6. **Not implemented on the web:** forgot or reset password, profile editing.

**Mobile implication:** use the same Supabase project and anon key, so the same accounts work on both clients. Mobile adds PKCE OAuth through the system browser and a password-reset flow (`resetPasswordForEmail` + deep link). Both use only built-in Supabase Auth features, and neither needs a backend change. Both need the redirect URLs `qlearn://auth/callback` and `qlearn://reset-password` added to **Supabase → Auth → URL Configuration**. That is a dashboard change, not code.

## 4. Existing Supabase integration

- Clients use Supabase **only** for Auth and Realtime subscriptions. They never query tables (`public` has no client-facing RLS contract). Privileged access is the service key in FastAPI.
- Realtime contract (`backend/app/services/realtime_service.py`), all broadcast:
  - `circuit:{circuit_id}`, event `result`. Payload: `{status, probabilities, measurements, statevector, qasm, execution_time_ms, error_message}`
  - `tutor:{session_id}`, event `token`. Payload: `{token}`
  - `tutor:{session_id}`, event `complete`. Payload: `{message_id, content, citations}` or `{error}`
- Clients must **subscribe before POSTing**, because there is no replay (`circuitStore.runSimulation`, `tutorStore.sendMessage`).

## 5. Existing curriculum/content model

- **CMS (target):** `Curriculum → Level → Module → Lesson → blocks[]`. The block registry is closed: `heading, text, markdown, math, image, code, callout, circuit, quiz, simulation` (`cms/src/blocks/lessonBlocks.ts`; TS union in `frontend/src/types/index.ts#LessonBlock`).
- The web maps this onto the legacy shape (`frontend/src/lib/cms.ts`). Curriculum becomes a course, and **each Level becomes a "module"** (labelled "Level N"). A level's lessons are flattened across its modules. Lesson id is `contentRefId`, or `payload:<id>` when the lesson was never registered (such a lesson renders but can't record progress).
- **Legacy:** `courses → modules → lessons(content markdown) → concepts`, served by FastAPI.
- The switch is `NEXT_PUBLIC_CONTENT_SOURCE` (`legacy` | `cms`). Learner state always stays on FastAPI.

## 6. Existing learning/progress APIs

Only `GET /progress` and `PUT /lessons/{id}/progress`. Everything else on the web dashboard is **derived on the client** (`frontend/src/lib/curriculum.ts`): module completion, sequential "locks", "Level N" labels, and the next lesson (`useCourseBootstrap`). `xp`, `streak` and `masteryScores` live in a localStorage Zustand store and are never sent to the server.

**Discrepancy (web):** the web never reads `GET /progress`. Its completion map is its own persisted localStorage copy, written on "Mark complete". Lessons completed on mobile (or another browser) are saved on the server but don't show as completed on the web until it hydrates from `GET /progress`. Mobile reads `GET /progress` as the source of truth. Suggested web fix: load `GET /progress` into `lessonProgress` on bootstrap. `skill_mastery` (BKT) exists as a table with **no API**.

## 7. Existing assessment APIs

**None.** The tables `quiz_questions`, `quiz_attempts`, `coding_challenges` and `challenge_attempts` exist but have no routes. The web quiz uses `frontend/src/lib/quiz-generator.ts`, a **client-side placeholder that ships correct answers to the client**. CMS `quiz` blocks also include `correctAnswer` in the public payload. The mobile app will not copy either pattern (see §13 and §19).

## 8. Existing AI Tutor APIs

`POST /tutor/chat` (202) plus Realtime tokens, and `GET /tutor/sessions/{id}`. Retrieval (RAG), model routing (LiteLLM fallbacks) and history (the last 20 rows of the session) all run on the server. The web mints a **new `session_id` for every message**, which throws away conversation context. Mobile should keep one `session_id` per conversation, and the backend already supports that. There is no endpoint to **list** sessions, so mobile cannot show a conversation history list yet.

**Discrepancy (backend):** `lesson_id` is accepted by `POST /tutor/chat` and passed to `run_and_stream`, but never used: retrieval and the prompt only see the question, the history and `circuit_context`. So "ask about this lesson" gets no lesson grounding from the server. Mobile still sends `lesson_id` (it's the contract), and its lesson starter prompts name the lesson in the visible question text. Smallest backend fix: in `run_and_stream`, load the lesson title and concept names into the existing `concept` prompt slot (`TUTOR_DEFAULT_CONCEPT`), with no API change.

## 9. Existing circuit APIs

`POST /circuits/{id}/execute` only. It upserts the circuit, so the row is effectively saved, but no endpoint lists or gets circuits or executions. The canonical format is `CircuitSpec {qubits, classical_bits, gates[{type, targets[], control?, params?, classical?}]}`. Gate set: `H X Y Z S T I RX RY RZ U P SX U3 CX CZ SWAP RXX RYY RZZ M`. Server-side validation runs before compile and execute. The result arrives only via the `circuit:{id}` broadcast.

## 10. Existing realtime events

See §4. There are no progress, achievement or notification events. Broadcast channels are **public**: anyone holding the anon key and the channel UUID can listen. The UUIDs are client-generated v4, so they are unguessable, but this is a risk (§19).

## 11. Existing TypeScript types that can be reused

`frontend/src/types/index.ts` mirrors the backend Pydantic schemas: `CourseSummary, CourseDetail, ModuleWithLessons, LessonSummary, LessonDetail, ConceptOut, ProgressItem, LessonBlock (+ CmsMedia), GateSpec, CircuitSpec, SimulationResult, Citation`. They are **copied** into `src/types/contracts.ts` here, with the source path noted, and are the first candidate for `@qlearn/types` (§29 of the brief). Pure, framework-free logic that can be ported later with tests: `curriculum.ts` derivations, `gates.ts` definitions, and `circuit-spec.ts` (`circuitSpecToQasm`; the serializer core minus React Flow).

## 12. Existing frontend code that should NOT be copied

| Web code | Why not |
|---|---|
| React Flow circuit canvas (`components/circuit`, `circuitStore` node model) | DOM library. Mobile builds a native SVG + gesture editor that emits the same `CircuitSpec` |
| `lib/quiz-generator.ts`, `quizStore` | Client-side answers. A placeholder, not a contract |
| `learningStore` persisted `xp`/`streak`/`masteryScores` | Local-only fake learner model. The backend is the source of truth |
| `authStore` persisting the JWT to localStorage + the `qlearn-auth` cookie | Web-specific workaround. Mobile keeps the session in SecureStore through supabase-js only |
| `tutorStore` new-session-per-message | Loses context (see §8) |
| Server state in Zustand (`courses`, `activeLesson`, …) | Mobile uses TanStack Query for server state |
| `lib/cms.ts` Payload mapping | Server-only, and duplicating it would fork the content contract. Mobile consumes the web's `/api/cms/*` output instead |
| Tailwind/Radix/shadcn components, IDE shell | Web-only UI |

## 13. Missing backend capabilities required by mobile

Each item is the *smallest compatible addition*. None is needed for Phase 1. Each is proposed in the Q-Learn repo when its phase starts, and none is implemented here.

| Phase | Gap | Smallest addition |
|---|---|---|
| 2 | CMS content outside the web app | **None for now.** Mobile reads `{EXPO_PUBLIC_CONTENT_URL}/api/cms/*`. Later: move the mapping to a shared package or FastAPI if the web stops being a good BFF |
| 2 | "What next" / recommendations | `GET /api/v1/learning/next` derived on the server (reuses the progress logic). Until then, mobile derives from progress exactly as the web does, labelled as derived |
| 3 | Quizzes without client-side answers | `GET /lessons/{id}/quiz` (questions without answers) + `POST /quiz/attempts` → `{is_correct, explanation, mastery_delta}` using the existing tables + BKT |
| 3 | Mastery | `GET /api/v1/skills/mastery` over `skill_mastery` |
| 4 | Conversation list | `GET /api/v1/tutor/sessions` (id, first message, updated_at), paginated |
| 4/5 | Missed broadcasts while the app is backgrounded | `GET /api/v1/circuits/executions/{id}`. The tutor already has `GET /tutor/sessions/{id}`. Used **only** for reconnect recovery, never polling |
| 5 | Saved circuits | `GET /api/v1/circuits` (+ `GET /{id}`) over the existing `circuits` table |
| 6 | Push | `POST /api/v1/devices` (Expo push token) + server-side sender on real events |
| — | Profile editing | `PATCH /api/v1/users/me/profile` over `user_profiles` |

## 14. Recommended mobile architecture

```
Screen (src/app, Expo Router)
  → feature hook (src/features/*/hooks)           TanStack Query for server state
    → typed endpoint fn (src/lib/api/endpoints)   one function per backend route
      → apiClient (src/lib/api/client.ts)         base URL, Bearer from supabase session,
                                                  envelope unwrap, ApiError, timeout,
                                                  one refresh-and-retry on 401
        → FastAPI
Realtime: src/lib/realtime/*  subscribe-before-POST helpers, same channel names as the web
Auth:     src/features/auth   AuthProvider (supabase session) + Stack.Protected guards
Client state: src/stores      Zustand: preferences (theme). Later: circuit editor, tutor draft
Persistence: SecureStore (session, chunked) · expo-sqlite kv-store (prefs, later query cache)
```

Principles: the backend is the source of truth, and there is no learner model on the device. No LLM, Qiskit or privileged Supabase access in the client. Server state lives only in TanStack Query.

## 15. Recommended folder structure

The SDK 57 template puts routes in `src/app` (not a root `app/`). We follow the template so Expo tooling and typed routes work with no extra configuration.

```
src/
  app/                    routes only
    _layout.tsx           providers + root Stack with Protected guards
    (auth)/               login, signup, forgot-password
    (tabs)/               index (Home), learn, build, tutor, profile
    reset-password.tsx    recovery deep link
    auth/callback.tsx     OAuth deep-link landing
    lesson/[id] module/[id] level/[id] quiz/[id] circuit/[id]   (Phase 2+)
  components/ui/          design-system primitives
  components/<domain>/    domain UI (home, learning, quiz, circuit, tutor, profile)
  features/<domain>/      hooks, query keys, domain logic per feature
  lib/api/                client + endpoints
  lib/supabase/           client + polyfills
  lib/storage/            secure storage adapter, kv
  lib/realtime/           channel helpers
  stores/  hooks/  types/  constants/  utils/
docs/                     audit, plans, decisions
```

## 16. Dependency list (SDK 57, versions resolved by `expo install`)

| Package | Why |
|---|---|
| expo, expo-router, react-native-screens, safe-area-context | Template base, navigation |
| react-native-gesture-handler, react-native-reanimated, react-native-worklets | Gestures and UI-thread animation (circuit editor, transitions) |
| @supabase/supabase-js | Same Auth and Realtime as the web |
| expo-secure-store | Session at rest (Keychain/Keystore) |
| expo-crypto | WebCrypto polyfill (`getRandomValues`, SHA-256) so Supabase PKCE uses S256, not `plain` |
| expo-web-browser, expo-linking | OAuth in the system browser, deep links |
| expo-sqlite | kv-store for preferences now. Offline cache in Phase 6 |
| @tanstack/react-query | Server state |
| zustand | Client state |
| @expo/vector-icons | Tab and UI icons |
| jest-expo, @testing-library/react-native | Tests |

Deferred until their phase: `react-native-svg` (5), `expo-notifications` (6), a markdown or math renderer (2, chosen when the lesson renderer is built).

## 17. Environment variables

| Var | Public? | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | yes | FastAPI base (`https://…railway.app`) |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Same project as the web |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon / publishable key (RLS-bound). **Never** the service key |
| `EXPO_PUBLIC_CONTENT_SOURCE` | yes | `legacy` (default) or `cms`. Mirrors the web flag |
| `EXPO_PUBLIC_CONTENT_URL` | yes | Web origin serving `/api/cms/*` (only when `cms`) |
| `APP_ENV` | build-time | `development` / `preview` / `production`. Set per EAS profile |

Everything else (LLM keys, service key, DB URL, Vercel token, CMS secrets) stays server-side and must never appear here. Everything prefixed `EXPO_PUBLIC_` is bundled into the app binary.

## 18. Implementation phases

1. **Foundation:** Expo app, navigation shell, theme, Supabase Auth (email, Google, reset), session restore and refresh, auth guards, API client, `/auth/me` round trip, CI, EAS profiles. *(Done, `qlearn-mobile#1`)*
2. **Learn:** curriculum (legacy + CMS), level and lesson screens, block renderer, progress read/write, lesson search, Home "continue learning", authored simulations run via `/execute` + Realtime. *(Plan: `docs/superpowers/plans/2026-10-03-phase-2-learn.md`)* The content contract has no separate "module" layer to show: the CMS's Level → Module → Lesson tree is flattened by the web's `/api/cms/*` mapping into course → level (as `ModuleWithLessons`) → lesson, so mobile has `level/[id]` and `lesson/[id]` routes but no `module/[id]`.
4. **Tutor**, delivered before Phase 3, which is blocked on the quiz API: streamed chat on `/tutor/chat` + Realtime, **one session per conversation** (server history gives context), a device-local conversation index (no list endpoint yet), lesson and circuit context (`circuit_context` = Qiskit source), and recovery from missed `complete` events via `GET /tutor/sessions/{id}`. *(Plan: `docs/superpowers/plans/2026-10-03-phase-4-tutor.md`)*
3. **Practice:** quiz UI on the backend quiz API (blocked on §13). Until then, CMS inline quiz blocks render as an **ungraded self-check**, exactly as on the web. Their answers are already in the public CMS payload, and nothing is written to the learner model.
5. **Build:** native SVG circuit editor → `CircuitSpec` → `/execute` → Realtime result. Port `gates.ts` and `circuit-spec.ts` with tests.
6. **Polish:** offline cache (SQLite query persistence), notifications, deep links, performance, EAS release.

## 19. Risks and architectural concerns

1. **Docs vs implementation drift.** `docs/api.md` lists APIs that don't exist, and `docs/security.md` says HS256 only, but the code also supports JWKS. Mobile codes against the implementation.
2. **Answer leakage.** The CMS quiz blocks' `correctAnswer` is publicly readable. Scored practice must wait for a server-graded quiz API.
3. **Realtime delivery on mobile.** Backgrounding drops the socket, and broadcasts aren't replayed. Mitigations: subscribe before POST, and add the recovery GETs in §13.
4. **Public broadcast channels.** Results are readable by anyone with the channel UUID. Acceptable short-term. Recommend Realtime Authorization (private channels) later. That change would affect both clients.
5. **Web as content BFF.** Mobile depends on the web deployment for CMS content. This is acceptable while it avoids duplicating `lib/cms.ts`. Revisit if web uptime or caching becomes a problem.
6. **SecureStore size limits.** Supabase sessions can exceed ~2 KB. Mitigated by the chunked adapter (`src/lib/storage/secure-storage.ts`).
7. **PKCE on Hermes.** Hermes has no `crypto.subtle`, so supabase-js would silently fall back to `plain`. Mitigated by the expo-crypto polyfill.
8. **Supabase redirect allow-list.** OAuth and reset deep links fail until the redirect URLs are added in the dashboard.
9. **No server-side learner model API yet.** Home recommendations, mastery and streaks can't be truthful until §13 lands. Mobile will show only data the backend has, and won't invent gamification.
10. **Rate limiting.** slowapi appears in the docs, but no middleware is installed in `main.py`. The client still handles `429` gracefully.

## 20. Exact first milestone

_Implemented in Phase 1. Verified by lint, type-check, 62 Jest tests and an iOS + Android `expo export` bundle. On-device sign-in against the shared Supabase project still needs real credentials and the redirect-URL configuration above._

**"A student can sign in on mobile with their existing Q-Learn account and see their server profile."**

Done means:

- [x] Expo SDK 57 app boots on iOS and Android with a 5-tab shell (Home, Learn, Build, Tutor, Profile) behind an auth guard
- [x] Email sign-in, sign-up (incl. the email-confirmation case), sign-out, forgot/reset password, and Google OAuth against the same Supabase project as the web
- [x] Session persisted in SecureStore (chunked), restored on launch, auto-refreshed while the app is foregrounded
- [x] A typed API client calls `GET /api/v1/auth/me` with the live access token. 401 triggers one refresh-and-retry, then sign-out. Errors are mapped to student-friendly messages
- [x] Home and Profile render the `/auth/me` profile with loading, error, retry and offline states. Learn, Build and Tutor show honest "coming next" states
- [x] Light/dark theme derived from the web design tokens, with a user preference persisted
- [x] `npm run lint`, `npm run type-check` and `npm test` pass in CI. `eas.json` defines development, preview and production profiles (no credentials)
