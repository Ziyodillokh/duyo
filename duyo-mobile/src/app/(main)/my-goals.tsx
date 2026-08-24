import { router } from 'expo-router';

import GoalsScreen from '@/screens/goals/goals-screen';

// The child's own goals — the screen that used to BE the goals tab. The tab
// shows Maqsaddoshlar now; this is where its "Qo'shish" story (and the brain
// screen's "Yangi maqsad") land, because adding a goal is what creates new
// matches. As a pushed route it needs a back button the tab never did.
//
// The button itself lives INSIDE the screen, beside the title. It used to be
// floated over the screen from here, positioned by `insets.top`, while the
// screen dodged it with a fixed `paddingTop` — two files guessing at each
// other. On web `insets.top` is 0, so the guess was wrong and the button sat
// on the word "Maqsadlarim".
export default function MyGoalsRoute() {
  return (
    <GoalsScreen
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace('/(main)/(tabs)/goals')
      }
    />
  );
}
