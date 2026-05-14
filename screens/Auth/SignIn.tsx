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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../services/supabase';
import { User } from '@supabase/supabase-js';
import GoogleLogo from '../../components/GoogleLogo';

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
          queryParams: {
            prompt: 'select_account',
          },
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
        // Parse the URL fragment to get the session tokens
        const url = result.url.replace('#', '?'); // Convert fragment to query string
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('Setting session from OAuth tokens...');
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Session error:', error);
            throw error;
          }
          console.log('Session established:', data.session?.user?.email);
          // The onAuthStateChange listener will handle the success callback
        } else {
          throw new Error('No tokens in callback URL');
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
      {/* Deep teal background */}
      <LinearGradient
        colors={['#0A1F1A', '#061612', '#081A15']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Radial glow from top */}
      <LinearGradient
        colors={['rgba(20,180,120,0.18)', 'transparent']}
        style={styles.topGlow}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to access your tasks from anywhere</Text>

          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#2E5A4A"
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
            placeholderTextColor="#2E5A4A"
            value={password}
            onChangeText={t => { setPassword(t); setError(''); }}
            secureTextEntry
            editable={!loading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity onPress={onSwitchToReset} disabled={loading}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSignIn} disabled={loading || googleLoading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={loading || googleLoading}>
            {googleLoading ? (
              <ActivityIndicator color="#666" />
            ) : (
              <>
                <GoogleLogo size={20} />
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
  container: { flex: 1, backgroundColor: '#081A15' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },

  topGlow: {
    position: 'absolute',
    top: -80,
    left: -60,
    right: -60,
    height: 400,
    borderRadius: 300,
  },

  card: {
    backgroundColor: 'rgba(10,40,30,0.9)',
    borderRadius: 28,
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(20,180,120,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.7,
    shadowRadius: 48,
    elevation: 24,
    overflow: 'hidden',
  },

  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: { fontSize: 14, color: '#3D7A62', marginBottom: 32, lineHeight: 20 },

  input: {
    backgroundColor: 'rgba(5,25,18,0.8)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,180,120,0.12)',
    marginBottom: 12,
  },

  error: { color: '#FF6B6B', fontSize: 13, marginBottom: 8 },
  forgotLink: { color: '#14B478', fontSize: 13, textAlign: 'right', marginBottom: 22 },

  primaryButton: {
    backgroundColor: '#14B478',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#14B478',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  divider: { flex: 1, height: 1, backgroundColor: 'rgba(20,180,120,0.08)' },
  dividerText: { color: '#1A4A38', fontSize: 11, marginHorizontal: 12, fontWeight: '700', letterSpacing: 2 },

  googleButton: {
    backgroundColor: '#F0FBF6',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  googleButtonText: { color: '#0A1F18', fontSize: 16, fontWeight: '600' },

  guestButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 16,
  },
  guestButtonText: { color: '#1F5240', fontSize: 15, fontWeight: '500' },

  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: '#1F5240', fontSize: 15 },
  link: { color: '#14B478', fontSize: 15, fontWeight: '700' },
});
