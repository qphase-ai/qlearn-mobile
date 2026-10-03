# Q-Learn Mobile Phase 2 (Learn) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student browses the Q-Learn curriculum on mobile (course → level → lesson), reads lessons rendered from the real content schema (legacy Markdown or CMS blocks), marks lessons complete against the backend, and sees "continue learning" on Home. Progress is shared with the web through `PUT /lessons/{id}/progress`.

**Architecture:** Content comes from the same source the web uses, switched by `EXPO_PUBLIC_CONTENT_SOURCE`: `legacy` reads FastAPI `/api/v1/courses|lessons`, and `cms` reads the web app's `/api/cms/*`. Both return the same `CourseDetail`/`LessonDetail` contract. Learner state always comes from FastAPI (`GET /progress`, `PUT /lessons/{id}/progress`, `GET /search/lessons`). All of it is TanStack Query. Curriculum derivations (ordering, completion, sequential unlock, next lesson) are ported from `frontend/src/lib/curriculum.ts` so both clients behave the same. Lessons render through a closed block registry mirroring `cms/src/blocks/lessonBlocks.ts`. Markdown renders natively from `marked` tokens. Only chunks containing math go through an Expo DOM component (`react-markdown` + `remark-math` + `rehype-katex`, the web's exact stack). Authored simulations run through `POST /circuits/{id}/execute` with the result delivered by Supabase Realtime (subscribe before POST).

**Tech Stack additions:** `marked` (Markdown lexer), `react-native-svg` (circuit diagrams), `react-markdown` + `remark-math` + `rehype-katex` + `katex` (math, inside a DOM component).

**Spec:** `docs/architecture-audit.md` §5, §6, §13, §18 (Phase 2)

## Global Constraints

- No backend changes. Endpoints used: `/courses`, `/courses/{id}`, `/lessons/{id}`, `/progress`, `/lessons/{id}/progress`, `/search/lessons` (added upstream after the audit), `/circuits/{id}/execute`, and the web's `/api/cms/*`.
- Server state lives only in TanStack Query. The selected course id is the only new client state (preferences store).
- Lesson text never renders as raw HTML. Markdown `html` tokens render as plain text, and link and image URLs are restricted to http(s).
- Lessons keyed `payload:<id>` (no content ref) render but cannot record progress, same as the web.
- Inline quiz blocks are an unscored self-check (as on the web). Nothing is written to the learner model. Scored practice is Phase 3.
- Mark-complete is optimistic, rolls back on failure, and never pretends to succeed offline.

---

### Task 1: Content and progress data layer
- [x] `lib/api/endpoints/learning.ts`: `listCourses`, `getCourse`, `getLesson` (source-aware), `getProgress`, `updateLessonProgress`, `searchLessons`. A content client for `cms` (anonymous, web origin)
- [x] `features/learning/curriculum.ts`: port of the web derivations + `progressMap`, `nextLesson`, `courseCompletion`, `locateLesson` (level/lesson index, prev/next), `isTrackableLessonId`. Tests
- [x] `features/learning/hooks.ts`: query keys and hooks, `useActiveCourse` (selected or first), `useMarkLessonComplete` (optimistic). Tests for the optimistic update and rollback

### Task 2: Lesson renderer
- [x] `components/lessons/markdown/chunks.ts`: split Markdown into native / math / circuit-fence chunks (pure, tested)
- [x] `NativeMarkdown.tsx` (marked tokens → RN), `MathMarkdown.tsx` (`'use dom'`, `matchContents`), `Markdown.tsx`
- [x] `components/lessons/blocks/*` + `LessonRenderer` registry. Unknown block types are skipped, never crash
- [x] `components/circuit/CircuitDiagram.tsx` (SVG) + `layoutCircuit` (tested). `ProbabilityBars`, `StatevectorList`
- [x] Simulation: `lib/realtime/circuits.ts`, `lib/api/endpoints/circuits.ts`, `features/circuit/useCircuitRun.ts` (subscribe before POST, timeout, failure states). Tests

### Task 3: Screens
- [x] Learn tab: course picker (when more than one), lesson search, level cards with completion and lock state
- [x] `level/[id]`: ordered lessons with status
- [x] `lesson/[id]`: renderer, mark complete, previous/next, untrackable notice
- [x] Home: continue learning (next lesson, level, course completion)
- [x] Loading, empty, error and retry on every query

### Task 4: Docs and verification
- [x] Audit update (search endpoint, web progress hydration discrepancy)
- [x] lint, type-check, tests, iOS + Android export
