import { ScreenTitle } from '@/components/ScreenTitle';
import { Card, EmptyState, Screen } from '@/components/ui';

export default function AITutorScreen() {
  return (
    <Screen>
      <ScreenTitle title="AI Tutor" subtitle="Ask questions about any concept or circuit." />
      <Card>
        <EmptyState icon="chatbubbles-outline" title="Your AI tutor is on its way" message="Chat with the same Q-Learn tutor you use on the web, with answers grounded in your lessons and circuits." />
      </Card>
    </Screen>
  );
}
