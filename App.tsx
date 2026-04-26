import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { User } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import { TasksProvider } from './context/TasksContext';
import SignIn from './screens/Auth/SignIn';
import SignUp from './screens/Auth/SignUp';
import PasswordReset from './screens/Auth/PasswordReset';
import MainTabs from './navigation/MainTabs';
import { requestNotificationPermission } from './utils/notifications';

type AuthScreen = 'signin' | 'signup' | 'reset';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('signin');
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    // Request notification permissions at startup
    requestNotificationPermission().catch(console.warn);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Handle deep links for email verification
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      if (url.includes('auth/callback')) {
        // Extract the token from the URL and let Supabase handle it
        const params = new URL(url).searchParams;
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          supabase.auth.setSession({
            access_token,
            refresh_token,
          });
        }
      }
    };

    // Listen for deep link events
    const subscription2 = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.unsubscribe();
      subscription2.remove();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setGuestMode(false);
    setAuthScreen('signin');
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1877F2" />
      </View>
    );
  }

  if (user || guestMode) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <TasksProvider user={user}>
          <NavigationContainer>
            <MainTabs user={user} onSignOut={handleSignOut} />
          </NavigationContainer>
        </TasksProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {authScreen === 'signin' && (
        <SignIn
          onSignInSuccess={(u) => setUser(u)}
          onSwitchToSignUp={() => setAuthScreen('signup')}
          onSwitchToReset={() => setAuthScreen('reset')}
          onGuestMode={() => setGuestMode(true)}
        />
      )}
      {authScreen === 'signup' && (
        <SignUp
          onSignUpSuccess={() => setAuthScreen('signin')}
          onSwitchToSignIn={() => setAuthScreen('signin')}
        />
      )}
      {authScreen === 'reset' && (
        <PasswordReset onBack={() => setAuthScreen('signin')} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' },
});
