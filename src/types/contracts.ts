/**
 * Backend contract types.
 *
 * Copied from the Q-Learn web client (`frontend/src/types/index.ts`), which
 * mirrors the FastAPI Pydantic schemas in `backend/app/schemas/`. Keep both in
 * sync by hand until they are extracted into a shared `@qlearn/types` package
 * (docs/architecture-audit.md §11). Do not add fields the backend doesn't send.
 */

// ── Envelope (backend/app/schemas/common.py) ─────────────────────────────

export interface StandardResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

// ── Auth (schemas/auth.py) ───────────────────────────────────────────────

export type UserRole = 'student' | 'instructor' | 'admin';

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
}

export interface HealthResponse {
  status: string;
  service: string;
}

// ── Learning (schemas/learning.py) ───────────────────────────────────────

export type LessonType = 'text' | 'circuit' | 'code' | 'quiz';

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  lesson_type: LessonType;
  is_pro: boolean;
  order_index: number;
}

export interface ModuleWithLessons {
  id: string;
  title: string;
  order_index: number;
  lessons: LessonSummary[];
}

export interface CourseDetail extends CourseSummary {
  modules: ModuleWithLessons[];
}

export interface ConceptOut {
  id: string;
  name: string;
  description: string | null;
}

export interface LessonDetail {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  lesson_type: LessonType;
  is_pro: boolean;
  concepts: ConceptOut[];
  /** Present when the lesson comes from the Payload CMS (web /api/cms/*). */
  blocks?: LessonBlock[];
}

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface ProgressItem {
  lesson_id: string;
  status: ProgressStatus | (string & {});
  completion_pct: number;
}

export interface UpdateProgressRequest {
  status: ProgressStatus;
  completion_pct: number;
}

// ── Lesson blocks (cms/src/blocks/lessonBlocks.ts, closed registry) ──────

interface BlockBase {
  id?: string | null;
}

export interface CmsMedia {
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export type LessonBlock =
  | (BlockBase & { blockType: 'heading'; text: string; level: '2' | '3' | '4' })
  | (BlockBase & { blockType: 'text'; body: string })
  | (BlockBase & { blockType: 'markdown'; body: string })
  | (BlockBase & { blockType: 'math'; latex: string; displayMode?: boolean | null; caption?: string | null })
  | (BlockBase & { blockType: 'image'; image: CmsMedia | number | null; caption?: string | null })
  | (BlockBase & {
      blockType: 'code';
      language: 'python' | 'qasm' | 'text';
      code: string;
      filename?: string | null;
      caption?: string | null;
    })
  | (BlockBase & {
      blockType: 'callout';
      variant: 'info' | 'tip' | 'warning' | 'important';
      title?: string | null;
      body: string;
    })
  | (BlockBase & { blockType: 'circuit'; spec: CircuitSpec; title?: string | null; description?: string | null })
  | (BlockBase & {
      blockType: 'quiz';
      question: string;
      questionType: 'multiple_choice' | 'true_false';
      options: { id?: string | null; text: string }[];
      correctAnswer: string;
      hint?: string | null;
      explanation?: string | null;
      difficulty?: string | null;
      concept?: string | null;
    })
  | (BlockBase & {
      blockType: 'simulation';
      view: 'probabilities' | 'statevector';
      circuit: CircuitSpec;
      shots: number;
      title?: string | null;
      description?: string | null;
    });

export type LessonBlockType = LessonBlock['blockType'];

// ── Circuits (schemas/circuit.py) ────────────────────────────────────────

export interface GateSpec {
  type: string;
  targets: number[];
  control?: number;
  params?: Record<string, unknown>;
  classical?: number[];
}

export interface CircuitSpec {
  qubits: number;
  classical_bits: number;
  gates: GateSpec[];
}

export interface ExecuteCircuitRequest {
  circuit: CircuitSpec;
  shots?: number;
  name?: string;
}

export interface ExecutionAccepted {
  execution_id: string;
  status: string;
}

/** Payload of the `circuit:{id}` / `result` Realtime broadcast. */
export interface SimulationResult {
  status: 'completed' | 'failed' | (string & {});
  probabilities: Record<string, number> | null;
  measurements: Record<string, number> | null;
  statevector: [number, number][] | null;
  qasm?: string | null;
  execution_time_ms: number | null;
  error_message?: string | null;
}

// ── Tutor (schemas/tutor.py) ─────────────────────────────────────────────

export interface Citation {
  title: string;
  url: string | null;
  score: number;
}

export interface TutorChatRequest {
  message: string;
  session_id: string;
  lesson_id?: string | null;
  circuit_context?: string | null;
}

export interface TutorChatAccepted {
  session_id: string;
  status: string;
}

export interface TutorMessageOut {
  role: 'user' | 'assistant' | (string & {});
  content: string;
  citations: Citation[];
}

export interface TutorSessionResponse {
  session_id: string;
  messages: TutorMessageOut[];
}

/** Payload of the `tutor:{session_id}` / `complete` Realtime broadcast. */
export interface TutorCompletePayload {
  message_id?: string;
  content?: string;
  citations?: Citation[];
  error?: string;
}
