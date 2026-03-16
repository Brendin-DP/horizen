import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'GymApp' }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
    </Tabs>
  );
}
