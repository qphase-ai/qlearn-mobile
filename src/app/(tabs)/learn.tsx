import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LessonRow } from '@/components/learning/LessonRow';
import { LevelCard } from '@/components/learning/LevelCard';
import { ScreenTitle } from '@/components/ScreenTitle';
import {
  Banner,
  Card,
  EmptyState,
  ErrorState,
  listContentStyle,
  LoadingState,
  ProgressBar,
  Text,
  TextField,
} from '@/components/ui';
import { MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import {
  completionCaption,
  courseCompletion,
  courseLessons,
  isModuleLocked,
  levelLabel,
  moduleCompletion,
  pendingCount,
  sortedModules,
} from '@/features/learning/curriculum';
import {
  MIN_SEARCH_LENGTH,
  useActiveCourse,
  useLessonSearch,
  usePendingLessonCompletions,
  useProgress,
} from '@/features/learning/hooks';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { isWaitingForNetwork, OFFLINE_ERROR } from '@/lib/query/online';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { LessonSearchResult, ModuleWithLessons } from '@/types/contracts';

/** One list for both modes, so the search field in the header keeps focus. */
type Row = { kind: 'hit'; hit: LessonSearchResult } | { kind: 'level'; mod: ModuleWithLessons; index: number };

export default function LearnScreen() {
  const theme = useTheme();
  const { courses, course, activeId } = useActiveCourse();
  const progressQuery = useProgress();
  const { progress } = progressQuery;
  const pending = usePendingLessonCompletions();
  const setSelectedCourseId = usePreferencesStore((s) => s.setSelectedCourseId);

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const searching = debounced.trim().length >= MIN_SEARCH_LENGTH;
  const search = useLessonSearch(debounced, course.data);

  const modules = useMemo(() => (course.data ? sortedModules(course.data) : []), [course.data]);
  const completion = course.data ? courseCompletion(course.data, progress) : { done: 0, total: 0 };

  const refreshing = courses.isRefetching || course.isRefetching || progressQuery.isRefetching;
  const refresh = () => {
    void courses.refetch();
    void course.refetch();
    void progressQuery.refetch();
  };

  function openLesson(lessonId: string, courseId = activeId) {
    router.push({ pathname: '/lesson/[id]', params: { id: lessonId, ...(courseId ? { courseId } : {}) } });
  }

  // `rows` fill the list; otherwise `state` (loading, error, empty) shows in its place.
  let rows: Row[] = [];
  let state: React.ReactNode = null;
  let summary: React.ReactNode = null;
  if (courses.isPending && !isWaitingForNetwork(courses)) state = <LoadingState label="Loading the curriculum…" />;
  else if (courses.isPending || courses.isError)
    state = <ErrorState error={courses.error ?? OFFLINE_ERROR} onRetry={() => void courses.refetch()} />;
  else if (courses.data.length === 0)
    state = <EmptyState icon="book-outline" title="No courses yet" message="Published courses will appear here." />;
  else if (course.isPending && !isWaitingForNetwork(course)) state = <LoadingState label="Loading course…" />;
  else if (course.isPending || course.isError)
    state = <ErrorState error={course.error ?? OFFLINE_ERROR} onRetry={() => void course.refetch()} />;
  else if (searching) {
    const searchOffline = 'fetchStatus' in search && isWaitingForNetwork(search);
    if (search.isPending && !searchOffline) state = <LoadingState label="Searching…" />;
    else if (search.isPending || search.isError)
      state = <ErrorState error={search.error ?? OFFLINE_ERROR} onRetry={() => void search.refetch()} />;
    else if (!search.data?.length)
      state = (
        <EmptyState icon="search-outline" title="No matching lessons" message={`Nothing found for “${debounced.trim()}”.`} />
      );
    else rows = search.data.map((hit) => ({ kind: 'hit', hit }));
  } else {
    summary = (
      <>
        <Card>
          <Text variant="heading">{course.data.title}</Text>
          {course.data.description ? <Text color="muted">{course.data.description}</Text> : null}
          <ProgressBar value={completion.total ? completion.done / completion.total : 0} label="Course progress" />
          <Text variant="caption" color="muted">
            {completionCaption(completion.done, completion.total, pendingCount(courseLessons(course.data), pending))}
          </Text>
        </Card>
        {progressQuery.isError ? (
          <Banner tone="error" message={`Progress couldn't be loaded. ${toUserMessage(progressQuery.error)}`} />
        ) : null}
      </>
    );
    if (modules.length === 0)
      state = <EmptyState icon="layers-outline" title="No levels yet" message="This course has no published lessons." />;
    else rows = modules.map((mod, index) => ({ kind: 'level', mod, index }));
  }

  function renderRow({ item }: { item: Row }) {
    if (item.kind === 'hit') {
      const { hit } = item;
      return (
        <LessonRow
          title={hit.lesson_title}
          subtitle={hit.snippet ?? `${hit.course_title} · ${hit.module_title}`}
          type={hit.lesson_type}
          completed={(progress[hit.lesson_id] ?? 0) >= 100}
          pendingSync={pending.has(hit.lesson_id)}
          onPress={() => openLesson(hit.lesson_id, hit.course_id)}
        />
      );
    }
    const { mod, index } = item;
    const { done, total } = moduleCompletion(mod, progress);
    const courseId = course.data?.id;
    return (
      <LevelCard
        label={levelLabel(index)}
        title={mod.title}
        done={done}
        total={total}
        pending={pendingCount(mod.lessons, pending)}
        // Lock only once progress is known: a failed or pending progress
        // load must not trap the student out of later levels.
        locked={progressQuery.isSuccess && isModuleLocked(modules, index, progress)}
        onPress={() =>
          router.push({ pathname: '/level/[id]', params: { id: mod.id, ...(courseId ? { courseId } : {}) } })
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: theme.background }]}>
      <FlatList
        contentContainerStyle={listContentStyle}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
        data={rows}
        keyExtractor={(row) => (row.kind === 'hit' ? `hit:${row.hit.lesson_id}` : `level:${row.mod.id}`)}
        // Rows read these outside `data`: re-render them when they change.
        extraData={[progress, pending, progressQuery.isSuccess]}
        renderItem={renderRow}
        ItemSeparatorComponent={searching ? undefined : LevelGap}
        ListHeaderComponentStyle={styles.header}
        ListHeaderComponent={
          <>
            <ScreenTitle title="Learn" subtitle="Concept → intuition → math → circuit → practice." />

            {courses.data && courses.data.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {courses.data.map((c) => {
                  const selected = c.id === activeId;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedCourseId(c.id)}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? theme.primary : theme.border,
                          backgroundColor: selected ? theme.overlay : 'transparent',
                        },
                      ]}>
                      <Text variant="label" color={selected ? 'foreground' : 'muted'}>
                        {c.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <TextField
              label="Search lessons"
              placeholder="e.g. superposition, Hadamard"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />

            {summary}
          </>
        }
        ListEmptyComponent={state}
      />
    </SafeAreaView>
  );
}

function LevelGap() {
  return <View style={styles.levelGap} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { gap: Spacing.lg, marginBottom: Spacing.lg },
  levelGap: { height: Spacing.md },
  chips: { gap: Spacing.sm },
  chip: {
    minHeight: MIN_TOUCH - 8,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
});
