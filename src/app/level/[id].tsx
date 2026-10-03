import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LessonRow } from '@/components/learning/LessonRow';
import { Card, EmptyState, ErrorState, LoadingState, ProgressBar, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  isLessonCompleted,
  lessonNumber,
  levelLabel,
  moduleCompletion,
  sortedLessons,
  sortedModules,
} from '@/features/learning/curriculum';
import { useActiveCourse, useCourse, useProgress } from '@/features/learning/hooks';

export default function LevelScreen() {
  const { id, courseId } = useLocalSearchParams<{ id: string; courseId?: string }>();
  const active = useActiveCourse();
  const course = useCourse(courseId ?? active.activeId);
  const { progress } = useProgress();

  if (course.isPending) return <LoadingState />;
  if (course.isError) {
    return (
      <Screen edges={[]}>
        <ErrorState error={course.error} onRetry={() => void course.refetch()} />
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
          {done} of {total} lessons complete
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
