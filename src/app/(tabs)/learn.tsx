import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LessonRow } from '@/components/learning/LessonRow';
import { LevelCard } from '@/components/learning/LevelCard';
import { ScreenTitle } from '@/components/ScreenTitle';
import { Banner, Card, EmptyState, ErrorState, LoadingState, ProgressBar, Text, TextField } from '@/components/ui';
import { MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import {
  courseCompletion,
  isModuleLocked,
  levelLabel,
  moduleCompletion,
  sortedModules,
} from '@/features/learning/curriculum';
import { MIN_SEARCH_LENGTH, useActiveCourse, useLessonSearch, useProgress } from '@/features/learning/hooks';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { usePreferencesStore } from '@/stores/preferences-store';

export default function LearnScreen() {
  const theme = useTheme();
  const { courses, course, activeId } = useActiveCourse();
  const progressQuery = useProgress();
  const { progress } = progressQuery;
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

  let body: React.ReactNode;
  if (courses.isPending) body = <LoadingState label="Loading the curriculum…" />;
  else if (courses.isError) body = <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />;
  else if (courses.data.length === 0)
    body = <EmptyState icon="book-outline" title="No courses yet" message="Published courses will appear here." />;
  else if (course.isPending) body = <LoadingState label="Loading course…" />;
  else if (course.isError) body = <ErrorState error={course.error} onRetry={() => void course.refetch()} />;
  else if (searching) {
    body = search.isPending ? (
      <LoadingState label="Searching…" />
    ) : search.isError ? (
      <ErrorState error={search.error} onRetry={() => void search.refetch()} />
    ) : !search.data?.length ? (
      <EmptyState icon="search-outline" title="No matching lessons" message={`Nothing found for “${debounced.trim()}”.`} />
    ) : (
      <View>
        {search.data.map((hit) => (
          <LessonRow
            key={hit.lesson_id}
            title={hit.lesson_title}
            subtitle={hit.snippet ?? `${hit.course_title} · ${hit.module_title}`}
            type={hit.lesson_type}
            completed={(progress[hit.lesson_id] ?? 0) >= 100}
            onPress={() => openLesson(hit.lesson_id, hit.course_id)}
          />
        ))}
      </View>
    );
  } else {
    body = (
      <View style={styles.levels}>
        <Card>
          <Text variant="heading">{course.data.title}</Text>
          {course.data.description ? <Text color="muted">{course.data.description}</Text> : null}
          <ProgressBar value={completion.total ? completion.done / completion.total : 0} label="Course progress" />
          <Text variant="caption" color="muted">
            {completion.done} of {completion.total} lessons complete
          </Text>
        </Card>
        {progressQuery.isError ? (
          <Banner tone="error" message={`Progress couldn't be loaded. ${toUserMessage(progressQuery.error)}`} />
        ) : null}
        {modules.length === 0 ? (
          <EmptyState icon="layers-outline" title="No levels yet" message="This course has no published lessons." />
        ) : (
          modules.map((mod, i) => {
            const { done, total } = moduleCompletion(mod, progress);
            return (
              <LevelCard
                key={mod.id}
                label={levelLabel(i)}
                title={mod.title}
                done={done}
                total={total}
                // Lock only once progress is known: a failed or pending progress
                // load must not trap the student out of later levels.
                locked={progressQuery.isSuccess && isModuleLocked(modules, i, progress)}
                onPress={() =>
                  router.push({ pathname: '/level/[id]', params: { id: mod.id, courseId: course.data.id } })
                }
              />
            );
          })
        )}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}>
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
                    { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.overlay : 'transparent' },
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

        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  levels: { gap: Spacing.md },
  chips: { gap: Spacing.sm },
  chip: {
    minHeight: MIN_TOUCH - 8,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
});
