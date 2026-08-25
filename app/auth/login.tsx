import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

// Support both EXPO_PUBLIC_GOOGLE_CLIENT_ID (Expo convention) and GOOGLE_CLIENT_ID
// (Replit secret name), piped in via app.config.js extra.googleClientId.
const GOOGLE_CLIENT_ID: string =
  (Constants.expoConfig?.extra?.googleClientId as string) ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  '';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState('');
  const { login, loginWithGoogle, loginWithApple, continueAsGuest, checkServerConnectivity } = useAuth();

  // expo-auth-session throws if any clientId is undefined, so we always pass a
  // defined string. The handleGooglePress guard below prevents sign-in from
  // actually starting when GOOGLE_CLIENT_ID is not properly configured.
  const googleClientIdSafe = GOOGLE_CLIENT_ID || 'google-not-configured';
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: googleClientIdSafe,
    iosClientId: googleClientIdSafe,
    androidClientId: googleClientIdSafe,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const accessToken = googleResponse.authentication?.accessToken;
      if (accessToken) {
        handleGoogleSignIn(accessToken);
      } else {
        setError('Google sign-in failed. Please try again.');
        setSocialLoading(null);
      }
    } else if (googleResponse?.type === 'error') {
      setError('Google sign-in was cancelled or failed.');
      setSocialLoading(null);
    } else if (googleResponse?.type === 'cancel' || googleResponse?.type === 'dismiss') {
      setSocialLoading(null);
    }
  }, [googleResponse]);

  const handleGoogleSignIn = async (accessToken: string) => {
    setError('');
    setSocialLoading('google');
    try {
      await loginWithGoogle(accessToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
      setError(msg);
      setSocialLoading(null);
    }
  };

  const handleGooglePress = async () => {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert('Not Available', 'Google sign-in is not configured yet. Please use email and password.');
      return;
    }
    setError('');
    setSocialLoading('google');
    try {
      await googlePromptAsync();
    } catch (err) {
      setError('Could not open Google sign-in. Please try again.');
      setSocialLoading(null);
    }
  };

  const handleApplePress = async () => {
    if (Platform.OS !== 'ios') return;
    setError('');
    setSocialLoading('apple');
    try {
      const AppleAuthentication = await import('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { identityToken, fullName } = credential;
      if (!identityToken) {
        setError('Apple sign-in failed. Please try again.');
        setSocialLoading(null);
        return;
      }
      const name = fullName?.givenName
        ? `${fullName.givenName}${fullName.familyName ? ' ' + fullName.familyName : ''}`.trim()
        : undefined;
      await loginWithApple(identityToken, name);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'ERR_REQUEST_CANCELED') {
        setSocialLoading(null);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Apple sign-in failed. Please try again.';
      setError(msg);
      setSocialLoading(null);
    }
  };

  const handleLogin = async () => {
    setError('');
    
    if (!email || !password) {
      setError('Please enter your email/username and password.');
      return;
    }

    setLoading(true);
    
    const isOnline = await checkServerConnectivity();
    if (!isOnline) {
      setError('Connection issue. Please check your internet and try again.');
      setLoading(false);
      return;
    }
    
    try {
      const result = await login(email.trim(), password);
      if (result.isSuperAdmin) {
        router.replace('/super-admin/dashboard');
      } else if (result.isBarAdmin) {
        router.replace('/admin/dashboard');
      }
      setTimeout(() => setLoading(false), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Incorrect username or password. Please try again.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleGuestMode = async () => {
    setLoading(true);
    try {
      await continueAsGuest();
      setTimeout(() => setLoading(false), 2000);
    } catch (error) {
      Alert.alert('Guest Mode Issue', 'We couldn\'t start guest mode. Please try again or create an account.');
      setLoading(false);
    }
  };

  const isAnySocialLoading = socialLoading !== null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>Welcome back</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email or Username</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com or username"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#666"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, (loading || isAnySocialLoading) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || isAnySocialLoading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/auth/register')}
            disabled={loading || isAnySocialLoading}
          >
            <Text style={styles.linkText}>Don't have an account? Sign up</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, (loading || isAnySocialLoading) && styles.buttonDisabled]}
            onPress={handleGooglePress}
            disabled={loading || isAnySocialLoading}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#FFFFFF" style={styles.socialIcon} />
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton, (loading || isAnySocialLoading) && styles.buttonDisabled]}
              onPress={handleApplePress}
              disabled={loading || isAnySocialLoading}
            >
              {socialLoading === 'apple' ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#000000" style={styles.socialIcon} />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.guestButton, (loading || isAnySocialLoading) && styles.buttonDisabled]}
            onPress={handleGuestMode}
            disabled={loading || isAnySocialLoading}
          >
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 280,
    height: 100,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 4,
    marginRight: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  forgotText: {
    fontSize: 13,
    color: '#DC143C',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  errorContainer: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    padding: 8,
    alignItems: 'center',
  },
  linkText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2C2C2C',
  },
  dividerText: {
    color: '#666',
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3C3C3C',
    gap: 10,
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  socialIcon: {},
  socialButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  guestButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  guestButtonText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
});
