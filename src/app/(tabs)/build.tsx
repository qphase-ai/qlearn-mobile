import { ScreenTitle } from '@/components/ScreenTitle';
import { Card, EmptyState, Screen } from '@/components/ui';

export default function BuildScreen() {
  return (
    <Screen>
      <ScreenTitle title="Build" subtitle="Design quantum circuits with touch." />
      <Card>
        <EmptyState icon="git-network-outline" title="Circuit builder in progress" message="A touch-first circuit editor that runs on the same quantum simulator as the web. Until then, build circuits in the Q-Learn web lab." />
      </Card>
    </Screen>
  );
}
