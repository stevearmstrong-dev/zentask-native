import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import TodayScreen from '../screens/TodayScreen';
import AllTasksScreen from '../screens/AllTasksScreen';
import PomodoroScreen from '../screens/PomodoroScreen';
import MoreScreen from '../screens/MoreScreen';
import KanbanScreen from '../screens/KanbanScreen';
import EisenhowerScreen from '../screens/EisenhowerScreen';
import WaterTrackerScreen from '../screens/WaterTrackerScreen';
import MealTrackerScreen from '../screens/MealTrackerScreen';
import SleepTrackerScreen from '../screens/SleepTrackerScreen';
import WorkoutTrackerScreen from '../screens/WorkoutTrackerScreen';
import NoFapTrackerScreen from '../screens/NoFapTrackerScreen';
import TimeBlocksScreen from '../screens/TimeBlocksScreen';
import ExpenseTrackerScreen from '../screens/ExpenseTrackerScreen';
import RecurringExpensesScreen from '../screens/RecurringExpensesScreen';

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

interface Props {
  user: User | null;
  onSignOut: () => void;
}

function MoreStackNavigator({ user, onSignOut }: Props) {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome">
        {() => <MoreScreen user={user} onSignOut={onSignOut} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="Kanban">
        {() => <KanbanScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="Eisenhower">
        {() => <EisenhowerScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="WaterTracker">
        {() => <WaterTrackerScreen />}
      </MoreStack.Screen>
      <MoreStack.Screen name="MealTracker">
        {() => <MealTrackerScreen />}
      </MoreStack.Screen>
      <MoreStack.Screen name="SleepTracker">
        {() => <SleepTrackerScreen />}
      </MoreStack.Screen>
      <MoreStack.Screen name="WorkoutTracker">
        {() => <WorkoutTrackerScreen />}
      </MoreStack.Screen>
      <MoreStack.Screen name="NoFapTracker">
        {() => <NoFapTrackerScreen />}
      </MoreStack.Screen>
      <MoreStack.Screen name="TimeBlocks">
        {() => <TimeBlocksScreen />}
      </MoreStack.Screen>
      <MoreStack.Screen name="ExpenseTracker">
        {() => <ExpenseTrackerScreen />}
      </MoreStack.Screen>
      <MoreStack.Screen name="RecurringExpenses">
        {() => <RecurringExpensesScreen />}
      </MoreStack.Screen>
    </MoreStack.Navigator>
  );
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
        {() => <MoreStackNavigator user={user} onSignOut={onSignOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
