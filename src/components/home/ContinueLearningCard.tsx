import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, ProgressBar, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  completionCaption,
  courseCompletion,
  courseLessons,
  lessonNumber,
  levelLabel,
  nextLesson,
  pendingCount,
} from '@/features/learning/curriculum';
import { useActiveCourse, usePendingLessonCompletions, useProgress } from '@/features/learning/hooks';
import { useTheme } from '@/hooks/use-theme';
import { isWaitingForNetwork, OFFLINE_ERROR } from '@/lib/query/online';

/** "What should I do right now?": the first incomplete lesson in the active course. */
export function ContinueLearningCard() {
  const theme = useTheme();
  const { courses, course } = useActiveCourse();
  const progressQuery = useProgress();
  const pending = usePendingLessonCompletions();

  const loading = courses.isPending || (course.isPending && course.fetchStatus !== 'idle') || progressQuery.isPending;
  const offline = [courses, course, progressQuery].some(isWaitingForNetwork);
  const error = courses.error ?? course.error ?? progressQuery.error ?? (offline ? OFFLINE_ERROR : null);

  let content: React.ReactNode;
  if (error) {
    content = (
      <ErrorState
        error={error}
        onRetry={() => {
          void courses.refetch();
          void course.refetch();
          void progressQuery.refetch();
        }}
      />
    );
  } else if (loading) {
    content = <LoadingState label="Finding your next lesson…" />;
  } else if (!course.data) {
    content = <Text color="muted">No courses are published yet. Check back soon.</Text>;
  } else {
    const completion = courseCompletion(course.data, progressQuery.progress);
    const next = nextLesson(course.data, progressQuery.progress);
    const waiting = pendingCount(courseLessons(course.data), pending);
    content = (
      <>
        <Text variant="label" color="muted">
          {course.data.title}
        </Text>
        <ProgressBar value={completion.total ? completion.done / completion.total : 0} label="Course progress" />
        <Text variant="caption" color="muted">
          {completionCaption(completion.done, completion.total, waiting)}
        </Text>
        {next ? (
          <View style={styles.next}>
            <Text variant="caption" color="primary" style={styles.eyebrow}>
              {`${levelLabel(next.moduleIndex).toUpperCase()} · LESSON ${lessonNumber(next.moduleIndex, next.lessonIndex)}`}
            </Text>
            <Text variant="heading">{next.lesson.title}</Text>
            <Button
              label={completion.done > 0 ? 'Continue' : 'Start learning'}
              onPress={() =>
                router.push({ pathname: '/lesson/[id]', params: { id: next.lesson.id, courseId: course.data.id } })
              }
            />
          </View>
        ) : waiting > 0 ? (
          <View style={styles.row}>
            <Ionicons name="time-outline" size={20} color={theme.muted} />
            <Text variant="label" color="muted" style={styles.shrink}>
              Every lesson is done on this device. It syncs when you&apos;re back online.
            </Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Ionicons name="trophy-outline" size={20} color={theme.success} />
            <Text variant="label" color="success">
              You&apos;ve completed every lesson in this course.
            </Text>
          </View>
        )}
      </>
    );
  }

  return (
    <Card>
      <Text variant="heading">Continue learning</Text>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  next: { gap: Spacing.sm, marginTop: Spacing.sm },
  eyebrow: { letterSpacing: 1, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  shrink: { flexShrink: 1 },
});
