import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LessonRow } from '@/components/learning/LessonRow';
import { LinkNotSupported } from '@/components/LinkNotSupported';
import { Card, EmptyState, ErrorState, LoadingState, ProgressBar, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  completionCaption,
  isLessonCompleted,
  lessonNumber,
  levelLabel,
  moduleCompletion,
  pendingCount,
  sortedLessons,
  sortedModules,
} from '@/features/learning/curriculum';
import { useActiveCourse, useCourse, usePendingLessonCompletions, useProgress } from '@/features/learning/hooks';
import { isValidContentId } from '@/features/linking/links';
import { isWaitingForNetwork, OFFLINE_ERROR } from '@/lib/query/online';

export default function LevelScreen() {
  const { id, courseId } = useLocalSearchParams<{ id: string; courseId?: string }>();
  // Params can come from a deep link: never fetch with a malformed id.
  const validLink = isValidContentId(id) && (courseId === undefined || isValidContentId(courseId));
  const active = useActiveCourse();
  const course = useCourse(validLink ? (courseId ?? active.activeId) : null);
  const { progress } = useProgress();
  const pending = usePendingLessonCompletions();

  if (!validLink) return <LinkNotSupported />;
  if (course.isPending && !isWaitingForNetwork(course)) return <LoadingState />;
  if (course.isPending || course.isError) {
    return (
      <Screen edges={[]}>
        <ErrorState error={course.error ?? OFFLINE_ERROR} onRetry={() => void course.refetch()} />
      </Screen>
    );
  }

  const modules = sortedModules(course.data);
  const index = modules.findIndex((m) => m.id === id);
  const mod = modules[index];
  if (!mod) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="compass-outline" title="Level not found" message="It may have been moved or unpublished." />
      </Screen>
    );
  }

  const { done, total } = moduleCompletion(mod, progress);
  const lessons = sortedLessons(mod);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: levelLabel(index) }} />
      <Card>
        <Text variant="caption" color="primary" style={styles.label}>
          {levelLabel(index).toUpperCase()}
        </Text>
        <Text variant="title">{mod.title}</Text>
        <ProgressBar value={total ? done / total : 0} label="Level progress" />
        <Text variant="caption" color="muted">
          {completionCaption(done, total, pendingCount(mod.lessons, pending))}
        </Text>
      </Card>
      {lessons.length === 0 ? (
        <EmptyState icon="document-outline" title="No lessons yet" />
      ) : (
        <View>
          {lessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              number={lessonNumber(index, i)}
              title={lesson.title}
              type={lesson.lesson_type}
              completed={isLessonCompleted(progress, lesson.id)}
              pendingSync={pending.has(lesson.id)}
              onPress={() =>
                router.push({ pathname: '/lesson/[id]', params: { id: lesson.id, courseId: course.data.id } })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ label: { letterSpacing: 1, fontWeight: '700', marginBottom: Spacing.xxs } });
