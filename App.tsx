import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { User } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import SignIn from './screens/Auth/SignIn';
import SignUp from './screens/Auth/SignUp';
import PasswordReset from './screens/Auth/PasswordReset';

type AuthScreen = 'signin' | 'signup' | 'reset';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('signin');
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1877F2" />
      </View>
    );
  }

  // Authenticated or guest — placeholder for main app
  if (user || guestMode) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.placeholder}>
          {/* Dashboard coming next */}
        </View>
      </SafeAreaProvider>
    );
  }

  // Auth flow
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
  placeholder: { flex: 1, backgroundColor: '#0A0A0F' },
});
