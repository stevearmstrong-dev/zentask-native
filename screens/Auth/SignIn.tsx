import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { supabase } from '../../services/supabase';
import { User } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onSignInSuccess: (user: User) => void;
  onSwitchToSignUp: () => void;
  onSwitchToReset: () => void;
  onGuestMode: () => void;
}

export default function SignIn({ onSignInSuccess, onSwitchToSignUp, onSwitchToReset, onGuestMode }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    // Listen for auth state changes to reset loading and trigger success
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setGoogleLoading(false);
        setLoading(false);
        onSignInSuccess(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onSignInSuccess]);

  const validate = (): boolean => {
    if (!email.trim()) { setError('Please enter your email'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address'); return false; }
    if (!password) { setError('Please enter your password'); return false; }
    return true;
  };

  const handleSignIn = async () => {
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) onSignInSuccess(data.user);
    } catch (err: any) {
      if (err.message?.includes('Email not confirmed')) {
        setError('Please verify your email before signing in. Check your inbox.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const redirectUrl = 'zentask://auth/callback';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (!data?.url) {
        throw new Error('No OAuth URL returned');
      }

      // Use WebBrowser to open OAuth - this properly handles redirects
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      console.log('WebBrowser result:', result);

      if (result.type === 'success' && result.url) {
        // Extract the code from the callback URL
        const urlObj = new URL(result.url);
        const code = urlObj.searchParams.get('code');

        if (code) {
          console.log('Exchanging code for session...');
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) {
            console.error('Exchange error:', sessionError);
            throw sessionError;
          }
          console.log('Session established:', sessionData.session?.user?.email);
          // The onAuthStateChange listener will handle the success callback
        } else {
          throw new Error('No code in callback URL');
        }
      } else if (result.type === 'cancel') {
        setGoogleLoading(false);
      } else {
        throw new Error('Authentication was not completed');
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(err.message || 'Failed to sign in with Google. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to access your tasks from anywhere</Text>

          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#8E8E93"
            value={email}
            onChangeText={t => { setEmail(t); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#8E8E93"
            value={password}
            onChangeText={t => { setPassword(t); setError(''); }}
            secureTextEntry
            editable={!loading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity onPress={onSwitchToReset} disabled={loading}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSignIn} disabled={loading || googleLoading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={loading || googleLoading}>
            {googleLoading ? (
              <ActivityIndicator color="#1877F2" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.guestButton} onPress={onGuestMode} disabled={loading || googleLoading}>
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={onSwitchToSignUp} disabled={loading}>
              <Text style={styles.link}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8E8E93', marginBottom: 28 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 12,
  },
  error: { color: '#FF453A', fontSize: 14, marginBottom: 8 },
  forgotLink: { color: '#636366', fontSize: 14, textAlign: 'right', marginBottom: 20 },
  primaryButton: {
    backgroundColor: '#1877F2',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: '#636366',
    fontSize: 13,
    marginHorizontal: 12,
    fontWeight: '500',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1877F2',
    marginRight: 8,
  },
  googleButtonText: {
    color: '#1F1F1F',
    fontSize: 17,
    fontWeight: '600',
  },
  guestButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 24,
  },
  guestButtonText: { color: '#EBEBF5', fontSize: 17, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: '#636366', fontSize: 15 },
  link: { color: '#1877F2', fontSize: 15, fontWeight: '600' },
});
