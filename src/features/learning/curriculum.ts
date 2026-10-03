import type {
  CourseDetail,
  LessonSearchResult,
  LessonSummary,
  ModuleWithLessons,
  ProgressItem,
} from '@/types/contracts';

/**
 * Curriculum derivations, ported from the web (frontend/src/lib/curriculum.ts)
 * so both clients order, label and unlock content identically. The API has
 * no level number or lock field: everything here is derived from
 * `CourseDetail.modules` (by `order_index`) plus the student's progress.
 * A CMS "Level" arrives as a module, so modules are labelled "Level N".
 */

/** lessonId → completion percent (0–100), from `GET /progress`. */
export type ProgressMap = Record<string, number>;

export function progressMap(items: readonly ProgressItem[] | undefined): ProgressMap {
  const map: ProgressMap = {};
  for (const item of items ?? []) {
    map[item.lesson_id] = item.status === 'completed' ? 100 : item.completion_pct;
  }
  return map;
}

export function sortedModules(course: CourseDetail): ModuleWithLessons[] {
  return [...course.modules].sort((a, b) => a.order_index - b.order_index);
}

export function sortedLessons(module: ModuleWithLessons): LessonSummary[] {
  return [...module.lessons].sort((a, b) => a.order_index - b.order_index);
}

export function isLessonCompleted(progress: ProgressMap, lessonId: string): boolean {
  return (progress[lessonId] ?? 0) >= 100;
}

export function moduleCompletion(
  module: ModuleWithLessons,
  progress: ProgressMap
): { done: number; total: number } {
  const done = module.lessons.filter((l) => isLessonCompleted(progress, l.id)).length;
  return { done, total: module.lessons.length };
}

export function isModuleCompleted(module: ModuleWithLessons, progress: ProgressMap): boolean {
  return module.lessons.length > 0 && module.lessons.every((l) => isLessonCompleted(progress, l.id));
}

/** Sequential unlock: a level is locked until the previous one is complete (web parity). */
export function isModuleLocked(
  modules: readonly ModuleWithLessons[],
  index: number,
  progress: ProgressMap
): boolean {
  if (index <= 0) return false;
  const previous = modules[index - 1];
  return !!previous && !isModuleCompleted(previous, progress);
}

export function courseCompletion(course: CourseDetail, progress: ProgressMap): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const mod of course.modules) {
    const c = moduleCompletion(mod, progress);
    done += c.done;
    total += c.total;
  }
  return { done, total };
}

export function levelLabel(moduleIndex: number): string {
  return `Level ${moduleIndex + 1}`;
}

export function lessonNumber(moduleIndex: number, lessonIndex: number): string {
  return `${moduleIndex + 1}.${lessonIndex + 1}`;
}

export interface LessonLocation {
  module: ModuleWithLessons;
  moduleIndex: number;
  lesson: LessonSummary;
  lessonIndex: number;
  previous: LessonSummary | null;
  next: LessonSummary | null;
}

/** Find a lesson in the course, with its level and neighbours in curriculum order. */
export function locateLesson(course: CourseDetail, lessonId: string): LessonLocation | null {
  const modules = sortedModules(course);
  const flat: { lesson: LessonSummary; module: ModuleWithLessons; moduleIndex: number; lessonIndex: number }[] = [];
  modules.forEach((module, moduleIndex) =>
    sortedLessons(module).forEach((lesson, lessonIndex) => flat.push({ lesson, module, moduleIndex, lessonIndex }))
  );
  const i = flat.findIndex((entry) => entry.lesson.id === lessonId);
  if (i < 0) return null;
  return {
    ...flat[i],
    previous: flat[i - 1]?.lesson ?? null,
    next: flat[i + 1]?.lesson ?? null,
  };
}

/**
 * The lesson to continue with: the first incomplete lesson in curriculum
 * order, or null when the course is finished (same rule as the web's
 * `useCourseBootstrap`).
 */
export function nextLesson(course: CourseDetail, progress: ProgressMap): LessonLocation | null {
  for (const mod of sortedModules(course)) {
    for (const lesson of sortedLessons(mod)) {
      if (!isLessonCompleted(progress, lesson.id)) return locateLesson(course, lesson.id);
    }
  }
  return null;
}

/**
 * CMS lessons published without a backend content ref are keyed
 * `payload:<id>`: they render, but have nowhere to record progress.
 */
export function isTrackableLessonId(id: string): boolean {
  return !id.startsWith('payload:');
}

/**
 * Title search within a loaded course, the web's fallback for the CMS source
 * (Payload has no search route yet).
 */
export function searchCourseTitles(course: CourseDetail, query: string): LessonSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return sortedModules(course).flatMap((mod) =>
    sortedLessons(mod)
      .filter((lesson) => lesson.title.toLowerCase().includes(needle))
      .map((lesson) => ({
        lesson_id: lesson.id,
        lesson_title: lesson.title,
        lesson_type: lesson.lesson_type,
        is_pro: lesson.is_pro,
        module_id: mod.id,
        module_title: mod.title,
        course_id: course.id,
        course_title: course.title,
        snippet: null,
      }))
  );
}
