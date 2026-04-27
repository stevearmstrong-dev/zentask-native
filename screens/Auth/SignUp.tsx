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
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../services/supabase';

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onSignUpSuccess: () => void;
  onSwitchToSignIn: () => void;
}

export default function SignUp({ onSignUpSuccess, onSwitchToSignIn }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  useEffect(() => {
    // Listen for auth state changes to reset loading and trigger success
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setGoogleLoading(false);
        setLoading(false);
        onSignUpSuccess();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onSignUpSuccess]);

  const validate = (): boolean => {
    if (!email.trim()) { setError('Please enter your email'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address'); return false; }
    if (!password) { setError('Please enter a password'); return false; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return false; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return false; }
    return true;
  };

  const handleSignUp = async () => {
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || email.split('@')[0] },
          // Use GitHub Pages hosted confirmation page for better UX
          emailRedirectTo: 'https://stevearmstrong-dev.github.io/zentask-native/auth-success.html',
        },
      });
      if (error) throw error;
      setSubmittedEmail(email);
      setVerified(true);
    } catch (err: any) {
      setError(err.message || 'Failed to sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
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
      console.error('Google sign up error:', err);
      setError(err.message || 'Failed to sign up with Google. Please try again.');
      setGoogleLoading(false);
    }
  };

  if (verified) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>✉️</Text>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.verifyMsg}>
            We've sent a verification link to{'\n'}
            <Text style={styles.emailHighlight}>{submittedEmail}</Text>
          </Text>
          <Text style={styles.subtitle}>Click the link in the email to verify your account.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={onSwitchToSignIn}>
            <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to sync your tasks across all devices</Text>

          <TextInput
            style={styles.input}
            placeholder="Your name (optional)"
            placeholderTextColor="#8E8E93"
            value={name}
            onChangeText={t => { setName(t); setError(''); }}
            autoCapitalize="words"
            editable={!loading}
          />
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
            placeholder="Password (min 6 characters)"
            placeholderTextColor="#8E8E93"
            value={password}
            onChangeText={t => { setPassword(t); setError(''); }}
            secureTextEntry
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="#8E8E93"
            value={confirmPassword}
            onChangeText={t => { setConfirmPassword(t); setError(''); }}
            secureTextEntry
            editable={!loading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleSignUp} disabled={loading || googleLoading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign Up</Text>}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignUp} disabled={loading || googleLoading}>
            {googleLoading ? (
              <ActivityIndicator color="#1877F2" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={onSwitchToSignIn} disabled={loading}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.privacyNote}>
            By signing up, you agree to receive verification emails. We don't send spam or share your data.
          </Text>
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
  icon: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8E8E93', marginBottom: 28 },
  verifyMsg: { fontSize: 16, color: '#EBEBF5', textAlign: 'center', marginBottom: 12, lineHeight: 24 },
  emailHighlight: { color: '#1877F2', fontWeight: '600' },
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
  primaryButton: {
    backgroundColor: '#1877F2',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
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
    marginBottom: 24,
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
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 16,
  },
  secondaryButtonText: { color: '#EBEBF5', fontSize: 17, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  footerText: { color: '#636366', fontSize: 15 },
  link: { color: '#1877F2', fontSize: 15, fontWeight: '600' },
  privacyNote: { color: '#48484A', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
