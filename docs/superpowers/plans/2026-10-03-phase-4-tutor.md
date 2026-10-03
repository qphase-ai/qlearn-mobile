# Q-Learn Mobile Phase 4 (AI Tutor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students chat with the existing Q-Learn AI Tutor on mobile: streamed answers with citations, persistent conversations, and questions asked in the context of a lesson or a circuit. All model routing, RAG and conversation memory stay server-side.

**Architecture:** Same contract as the web (`frontend/src/stores/tutorStore.ts`): mint `session_id` → subscribe to `tutor:{session_id}` (`token`, `complete`) → `POST /api/v1/tutor/chat` (202) → tokens stream over Supabase Realtime. Mobile improves on the web in one respect the backend already supports: it **reuses one `session_id` per conversation**, so the server-side history (last 20 rows) gives the model real context. The web mints a new session per message. The persisted conversation is server state (`GET /tutor/sessions/{id}` in TanStack Query). The in-flight stream is transient hook state, and the device-local conversation index (`id`, title, updated time) is Zustand persisted in kv, because there is no list endpoint (audit §13).

**Tech Stack:** no new dependencies.

## Global Constraints

- No LLM, prompt or RAG logic on the device. The client sends exactly what the user typed plus the contract fields (`lesson_id`, `circuit_context`).
- Subscribe before POST, and wait for the channel to join. No polling. `GET /tutor/sessions/{id}` is used only to load a conversation, and to recover once if `complete` never arrives (the app was backgrounded or the socket dropped).
- Token updates are batched (~50 ms) to avoid a re-render per token. Streaming text renders as plain text, and the final answer renders as Markdown + math (one DOM component per math chunk, not per token).
- `circuit_context` is Qiskit source, the format the backend's `TUTOR_CIRCUIT_BLOCK` expects. It uses a port of the web's `circuitSpecToQiskitSource`.
- Backend failure detail is never shown. `complete {error}` becomes a friendly message with retry.
- Online-only: an offline send fails visibly. Nothing is queued or faked.

---

### Task 1: Tutor data layer
- [x] `lib/api/endpoints/tutor.ts`: `sendTutorMessage`, `getTutorSession` (404 means a new, empty conversation)
- [x] `features/circuit/qiskit.ts`: port of `circuitSpecToQiskitSource` + tests
- [x] `stores/tutor-store.ts`: active session, local conversation index (max 30), pending context (lesson / circuit). Tests
- [x] `features/tutor/useTutorChat.ts`: send → subscribe → POST → batched tokens → complete/error → cache update + index. Timeout recovery via one refetch. Tests

### Task 2: UI
- [x] `(tabs)/tutor.tsx`: message list, composer, suggested prompts, context chip, new chat, history
- [x] `tutor/history.tsx`: device-local conversation list
- [x] Components: `ChatBubble` (Markdown for finished assistant turns, with a "Thinking…" state while waiting), `CitationChips`, `ErrorBubble`
- [x] Entry points: "Ask the tutor" on the lesson screen (lesson context) and "Ask about this circuit" on circuit and simulation blocks (circuit context)

### Task 3: Docs and verification
- [x] Audit: the backend ignores `lesson_id` (smallest fix: load the lesson title and concepts into the tutor's `concept` slot). The conversation list still needs `GET /tutor/sessions`
- [x] lint, type-check, tests, iOS + Android export, screenshots
