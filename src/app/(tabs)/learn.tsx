import { ScreenTitle } from '@/components/ScreenTitle';
import { Card, EmptyState, Screen } from '@/components/ui';

export default function LearnScreen() {
  return (
    <Screen>
      <ScreenTitle title="Learn" subtitle="Follow the Q-Learn curriculum level by level." />
      <Card>
        <EmptyState icon="book-outline" title="Lessons are coming next" message="Levels, modules and interactive lessons from the Q-Learn curriculum will live here, with your progress synced across web and mobile." />
      </Card>
    </Screen>
  );
}
