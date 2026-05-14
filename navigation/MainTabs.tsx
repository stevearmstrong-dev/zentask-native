import React, { useState } from 'react';
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
// import CreditScoreScreen from '../screens/CreditScoreScreen';
import GemCollectorScreen from '../screens/GemCollectorScreen';
import PowerSwordHallScreen from '../screens/PowerSwordHallScreen';
import DashboardScreen from '../screens/DashboardScreen';
import UpcomingScreen from '../screens/UpcomingScreen';
import CalmPracticeScreen from '../screens/CalmPracticeScreen';

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
      <MoreStack.Screen name="AllTasks">
        {() => <AllTasksScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="Kanban">
        {() => <KanbanScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="Eisenhower">
        {() => <EisenhowerScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="WaterTracker">
        {() => <WaterTrackerScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="MealTracker">
        {() => <MealTrackerScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="SleepTracker">
        {() => <SleepTrackerScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="CalmPractice">
        {() => <CalmPracticeScreen />}
      </MoreStack.Screen>
      <MoreStack.Screen name="WorkoutTracker">
        {() => <WorkoutTrackerScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="NoFapTracker">
        {() => <NoFapTrackerScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="TimeBlocks">
        {() => <TimeBlocksScreen />}
      </MoreStack.Screen>
      <MoreStack.Screen name="ExpenseTracker">
        {() => <ExpenseTrackerScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="RecurringExpenses">
        {() => <RecurringExpensesScreen user={user} />}
      </MoreStack.Screen>
      {/* <MoreStack.Screen name="CreditScore">
        {() => <CreditScoreScreen user={user} />}
      </MoreStack.Screen> */}
      <MoreStack.Screen name="GemCollector">
        {() => <GemCollectorScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="PowerSwordHall">
        {() => <PowerSwordHallScreen user={user} />}
      </MoreStack.Screen>
      <MoreStack.Screen name="Dashboard">
        {() => <DashboardScreen user={user} />}
      </MoreStack.Screen>
    </MoreStack.Navigator>
  );
}

const TAB_THEMES: Record<string, { bg: string; border: string; active: string; inactive: string }> = {
  Today:    { bg: '#081A15', border: 'rgba(20,180,120,0.15)',  active: '#14B478', inactive: '#1F4A38' },
  Water:    { bg: '#060A10', border: 'rgba(59,130,246,0.15)',  active: '#3B82F6', inactive: '#1A3050' },
  Upcoming: { bg: '#0A0814', border: 'rgba(124,58,237,0.15)', active: '#7C3AED', inactive: '#2A1A50' },
  Expenses: { bg: '#080E12', border: 'rgba(0,229,204,0.15)',  active: '#00E5CC', inactive: '#1A3A40' },
  Pomodoro: { bg: '#080E12', border: 'rgba(0,229,204,0.15)',  active: '#00E5CC', inactive: '#1A3A40' },
  More:     { bg: '#081A15', border: 'rgba(20,180,120,0.15)',  active: '#14B478', inactive: '#1F4A38' },
};

export default function MainTabs({ user, onSignOut }: Props) {
  const [activeTab, setActiveTab] = useState('Today');
  const theme = TAB_THEMES[activeTab] ?? TAB_THEMES.Today;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopColor: theme.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: theme.active,
        tabBarInactiveTintColor: theme.inactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
      screenListeners={{
        state: (e) => {
          const routes = (e.data as any)?.state?.routes;
          const idx = (e.data as any)?.state?.index;
          if (routes && idx != null) setActiveTab(routes[idx].name);
        },
      }}
    >
      <Tab.Screen
        name="Today"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} /> }}
      >
        {() => <TodayScreen user={user} />}
      </Tab.Screen>

      <Tab.Screen
        name="Water"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="water-outline" size={size} color={color} /> }}
      >
        {() => <WaterTrackerScreen user={user} />}
      </Tab.Screen>

      <Tab.Screen
        name="Upcoming"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }}
      >
        {() => <UpcomingScreen />}
      </Tab.Screen>

      <Tab.Screen
        name="Expenses"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} /> }}
      >
        {() => <ExpenseTrackerScreen user={user} />}
      </Tab.Screen>

      <Tab.Screen
        name="Pomodoro"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="timer-outline" size={size} color={color} /> }}
      >
        {() => <PomodoroScreen user={user} />}
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
