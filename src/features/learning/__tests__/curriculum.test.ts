import {
  courseCompletion,
  isModuleLocked,
  isTrackableLessonId,
  lessonNumber,
  levelLabel,
  locateLesson,
  moduleCompletion,
  nextLesson,
  progressMap,
  searchCourseTitles,
  sortedLessons,
  sortedModules,
} from '../curriculum';

import { course } from './fixtures';

describe('progressMap', () => {
  it('maps rows to percentages and treats completed as 100', () => {
    expect(
      progressMap([
        { lesson_id: 'l1', status: 'completed', completion_pct: 40 },
        { lesson_id: 'l2', status: 'in_progress', completion_pct: 30 },
      ])
    ).toEqual({ l1: 100, l2: 30 });
    expect(progressMap(undefined)).toEqual({});
  });
});

describe('ordering and labels', () => {
  it('sorts levels and lessons by order_index', () => {
    const modules = sortedModules(course);
    expect(modules.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(sortedLessons(modules[1]).map((l) => l.id)).toEqual(['l3', 'l4']);
  });

  it('labels like the web', () => {
    expect(levelLabel(0)).toBe('Level 1');
    expect(lessonNumber(1, 0)).toBe('2.1');
  });
});

describe('completion and unlocking', () => {
  const modules = sortedModules(course);

  it('counts completed lessons', () => {
    expect(moduleCompletion(modules[0], { l1: 100, l2: 50 })).toEqual({ done: 1, total: 2 });
    expect(courseCompletion(course, { l1: 100, l3: 100 })).toEqual({ done: 2, total: 4 });
  });

  it('locks a level until the previous one is complete', () => {
    expect(isModuleLocked(modules, 0, {})).toBe(false);
    expect(isModuleLocked(modules, 1, { l1: 100 })).toBe(true);
    expect(isModuleLocked(modules, 1, { l1: 100, l2: 100 })).toBe(false);
  });
});

describe('locateLesson / nextLesson', () => {
  it('finds a lesson with its neighbours across levels', () => {
    const loc = locateLesson(course, 'l3');
    expect(loc).toMatchObject({ moduleIndex: 1, lessonIndex: 0 });
    expect(loc?.previous?.id).toBe('l2');
    expect(loc?.next?.id).toBe('l4');
    expect(locateLesson(course, 'nope')).toBeNull();
  });

  it('continues with the first incomplete lesson in curriculum order', () => {
    expect(nextLesson(course, {})?.lesson.id).toBe('l1');
    expect(nextLesson(course, { l1: 100, l2: 100 })?.lesson.id).toBe('l3');
    expect(nextLesson(course, { l1: 100, l2: 100, l3: 100, l4: 100 })).toBeNull();
  });
});

describe('isTrackableLessonId', () => {
  it('rejects CMS lessons without a content ref', () => {
    expect(isTrackableLessonId('payload:12')).toBe(false);
    expect(isTrackableLessonId('0b6f1f6e-1111-4c1e-9f00-000000000000')).toBe(true);
  });
});

describe('searchCourseTitles', () => {
  it('matches titles case-insensitively in curriculum order', () => {
    const hits = searchCourseTitles(course, 'GATE');
    expect(hits.map((h) => h.lesson_id)).toEqual(['l3']);
    expect(hits[0]).toMatchObject({ module_title: 'Gates', course_id: 'c1', snippet: null });
    expect(searchCourseTitles(course, '  ')).toEqual([]);
  });
});
