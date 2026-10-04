import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { hasLessonContent, LessonRenderer } from '@/components/lessons/LessonRenderer';
import { Banner, Button, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  isLessonCompleted,
  isTrackableLessonId,
  lessonNumber,
  levelLabel,
  locateLesson,
} from '@/features/learning/curriculum';
import {
  useActiveCourse,
  useCourse,
  useLesson,
  useLessonCompletionPendingSync,
  useMarkLessonComplete,
  useProgress,
} from '@/features/learning/hooks';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { isWaitingForNetwork, OFFLINE_ERROR } from '@/lib/query/online';
import { useTutorStore } from '@/stores/tutor-store';

export default function LessonScreen() {
  const theme = useTheme();
  const { id, courseId } = useLocalSearchParams<{ id: string; courseId?: string }>();
  const active = useActiveCourse();
  const resolvedCourseId = courseId ?? active.activeId;
  const lesson = useLesson(id);
  const course = useCourse(resolvedCourseId);
  const { progress } = useProgress();
  const markComplete = useMarkLessonComplete();
  const pendingSync = useLessonCompletionPendingSync(lesson.data?.id);
  const setTutorContext = useTutorStore((s) => s.setContext);
  const offline = isWaitingForNetwork(lesson);

  if (lesson.isPending && !offline) return <LoadingState label="Loading lesson…" />;
  if (lesson.isPending || lesson.isError) {
    return (
      <Screen edges={[]}>
        <ErrorState
          error={lesson.error ?? OFFLINE_ERROR}
          onRetry={() => void lesson.refetch()}
          retrying={lesson.isRefetching}
        />
      </Screen>
    );
  }

  const location = course.data ? locateLesson(course.data, lesson.data.id) : null;
  const completed = isLessonCompleted(progress, lesson.data.id);
  const trackable = isTrackableLessonId(lesson.data.id);

  const go = (lessonId: string) =>
    router.replace({
      pathname: '/lesson/[id]',
      params: { id: lessonId, ...(resolvedCourseId ? { courseId: resolvedCourseId } : {}) },
    });

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: location ? levelLabel(location.moduleIndex) : 'Lesson' }} />

      <View style={styles.header}>
        {location ? (
          <Text variant="caption" color="primary" style={styles.eyebrow}>
            {`LESSON ${lessonNumber(location.moduleIndex, location.lessonIndex)} · ${location.module.title.toUpperCase()}`}
          </Text>
        ) : null}
        <Text variant="display" accessibilityRole="header">
          {lesson.data.title}
        </Text>
        {lesson.data.concepts.length ? (
          <Text variant="label" color="muted">
            Concepts: {lesson.data.concepts.map((c) => c.name).join(', ')}
          </Text>
        ) : null}
      </View>

      {hasLessonContent(lesson.data) ? (
        <LessonRenderer lesson={lesson.data} />
      ) : (
        <EmptyState icon="document-outline" title="This lesson has no content yet" />
      )}

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Button
          label="Ask the AI Tutor about this lesson"
          variant="ghost"
          icon={<Ionicons name="sparkles-outline" size={16} color={theme.primary} />}
          onPress={() => {
            setTutorContext({ kind: 'lesson', lessonId: lesson.data.id, title: lesson.data.title });
            router.navigate('/tutor');
          }}
        />
        {!trackable ? (
          <Text variant="caption" color="muted">
            Progress tracking is unavailable for this lesson.
          </Text>
        ) : pendingSync ? (
          // Queued offline: the progress cache already shows it, but the
          // server hasn't saved it, so never say "Completed" here.
          <View style={styles.completed} accessibilityLiveRegion="polite">
            <Ionicons name="time-outline" size={20} color={theme.muted} />
            <Text variant="label" color="muted" style={styles.shrink}>
              Saved on this device · syncs when you&apos;re back online
            </Text>
          </View>
        ) : completed ? (
          <View style={styles.completed} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={20} color={theme.success} />
            <Text variant="label" color="success" style={styles.bold}>
              Completed
            </Text>
          </View>
        ) : (
          <Button
            label="Mark complete"
            onPress={() => markComplete.mutate(lesson.data.id)}
            loading={markComplete.isPending}
          />
        )}
        {markComplete.isError ? (
          <Banner tone="error" message={`Couldn't save your progress. ${toUserMessage(markComplete.error)}`} />
        ) : null}

        {location ? (
          <View style={styles.nav}>
            {location.previous ? (
              <Button
                label="Previous"
                variant="ghost"
                style={styles.navButton}
                icon={<Ionicons name="chevron-back" size={16} color={theme.foreground} />}
                onPress={() => go(location.previous!.id)}
              />
            ) : (
              <View style={styles.navButton} />
            )}
            {location.next ? (
              <Button
                label="Next lesson"
                variant="secondary"
                style={styles.navButton}
                onPress={() => go(location.next!.id)}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm },
  eyebrow: { letterSpacing: 1, fontWeight: '700' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.lg, gap: Spacing.md, marginTop: Spacing.lg },
  completed: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  bold: { fontWeight: '700' },
  shrink: { flexShrink: 1 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  navButton: { flex: 1 },
});
