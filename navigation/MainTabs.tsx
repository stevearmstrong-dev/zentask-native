import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import TodayScreen from '../screens/TodayScreen';
import AllTasksScreen from '../screens/AllTasksScreen';
import PomodoroScreen from '../screens/PomodoroScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';

const Tab = createBottomTabNavigator();

interface Props {
  user: User | null;
  onSignOut: () => void;
}

export default function MainTabs({ user, onSignOut }: Props) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1C1C1E',
          borderTopColor: 'rgba(255,255,255,0.1)',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#1877F2',
        tabBarInactiveTintColor: '#636366',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tab.Screen
        name="Today"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} /> }}
      >
        {() => <TodayScreen user={user} />}
      </Tab.Screen>

      <Tab.Screen
        name="Tasks"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle-outline" size={size} color={color} /> }}
      >
        {() => <AllTasksScreen user={user} />}
      </Tab.Screen>

      <Tab.Screen
        name="Pomodoro"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="timer-outline" size={size} color={color} /> }}
      >
        {() => <PomodoroScreen />}
      </Tab.Screen>

      <Tab.Screen
        name="More"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }}
      >
        {() => <PlaceholderScreen title="More" icon="⊞" onSignOut={onSignOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
