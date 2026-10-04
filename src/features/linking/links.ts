import { getEnv, type ContentSource } from '@/lib/env';

/**
 * Incoming links (`qlearn://…`) are untrusted input. These helpers turn one
 * into an app path and decide whether it is a supported, signed-in-only
 * destination that may be remembered across sign-in (see pending-href.ts).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A Payload document id, as the web's /api/cms routes accept it (frontend/src/lib/cms.ts).
const CMS_DOC_ID = /^[A-Za-z0-9-]{1,64}$/;

function contentSource(): ContentSource {
  return getEnv().contentSource;
}

/**
 * Lesson ids are backend UUIDs (lessons / content_refs). The CMS source also
 * serves lessons without a content ref as `payload:<doc id>`.
 */
export function isValidLessonId(id: string, source = contentSource()): boolean {
  if (UUID.test(id)) return true;
  return source === 'cms' && id.startsWith('payload:') && CMS_DOC_ID.test(id.slice('payload:'.length));
}

/** Level (module) and course ids: backend UUIDs, or Payload doc ids from the CMS source. */
export function isValidContentId(id: string, source = contentSource()): boolean {
  return source === 'cms' ? CMS_DOC_ID.test(id) : UUID.test(id);
}

/**
 * The app path of an incoming URL or path, or null when it isn't one of ours
 * (e.g. `https://…`: universal links aren't configured). Handles
 * `qlearn://lesson/x`, Expo Go / dev builds (`exp://host/--/lesson/x`) and
 * plain `/lesson/x`.
 */
export function toAppPath(input: string): string | null {
  const expo = input.match(/^exps?:\/\/.*?\/--\/(.*)$/);
  if (expo) return `/${expo[1]}`;
  if (/^qlearn:\/\//i.test(input)) return `/${input.replace(/^qlearn:\/\//i, '')}`;
  if (input.startsWith('/')) return input;
  return null;
}

const TAB_ROOTS = new Set(['learn', 'build', 'tutor', 'profile']);

/**
 * The normalized href of a supported signed-in destination, or null. Auth
 * links (`auth/callback`, `reset-password`), unknown roots (`quiz/…`,
 * `circuit/…`) and invalid ids are never returned, so they are never
 * remembered or replayed.
 */
export function protectedHref(input: string): string | null {
  const path = toAppPath(input);
  if (!path) return null;
  const [pathname, query = ''] = path.split('?', 2);
  const segments = pathname.split('/').filter(Boolean).map(safeDecode);
  if (segments.some((s) => s === null)) return null;
  const [root, id, ...rest] = segments as string[];

  if (!root) return '/';
  if (TAB_ROOTS.has(root) && id === undefined) return `/${root}`;
  if ((root === 'lesson' || root === 'level') && id !== undefined && rest.length === 0) {
    const valid = root === 'lesson' ? isValidLessonId(id) : isValidContentId(id);
    if (!valid) return null;
    const courseId = new URLSearchParams(query).get('courseId');
    if (courseId !== null && !isValidContentId(courseId)) return null;
    const href = `/${root}/${encodeURIComponent(id)}`;
    return courseId ? `${href}?courseId=${encodeURIComponent(courseId)}` : href;
  }
  return null;
}

function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
