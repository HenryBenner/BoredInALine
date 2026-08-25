import React, { useState } from 'react';
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
  ScrollView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';


export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, checkServerConnectivity } = useAuth();

  const handleRegister = async () => {
    console.log('========= REGISTER BUTTON CLICKED =========');
    console.log('Form data:', { name, email, password: '***', confirmPassword: '***' });
    
    if (!name || !email || !password) {
      console.log('Validation failed: missing required fields');
      Alert.alert('Missing Information', 'Please fill in your name, email, and password to create an account.');
      return;
    }

    if (password !== confirmPassword) {
      console.log('Validation failed: passwords do not match');
      Alert.alert('Password Mismatch', 'The passwords you entered don\'t match. Please try again.');
      return;
    }

    if (password.length < 6) {
      console.log('Validation failed: password too short');
      Alert.alert('Password Too Short', 'Your password needs to be at least 6 characters long.');
      return;
    }

    if (!termsAccepted) {
      Alert.alert('Terms Required', 'Please accept the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    console.log('✅ Validation passed, starting registration...');
    setLoading(true);
    
    // Check server connectivity first
    const isOnline = await checkServerConnectivity();
    if (!isOnline) {
      Alert.alert(
        'Connection Issue',
        'We\'re having trouble connecting to our servers. Please check your internet connection and try again.',
        [{ text: 'OK', onPress: () => setLoading(false) }]
      );
      return;
    }
    
    try {
      console.log('Calling register function...');
      await register(email.trim(), password, name.trim(), undefined, termsAccepted);
      console.log('✅ Registration successful! Navigation will be handled by _layout.tsx');
      setTimeout(() => setLoading(false), 2000);
    } catch (error) {
      console.error('❌ Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'We couldn\'t create your account. Please try again.';
      console.error('Error message:', errorMessage);
      Alert.alert('Sign Up Issue', errorMessage);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>Create your account</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#666"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor="#666"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                placeholderTextColor="#666"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.checkboxRow}>
              <TouchableOpacity onPress={() => setTermsAccepted(!termsAccepted)} style={styles.checkboxTouch}>
                <Ionicons
                  name={termsAccepted ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={termsAccepted ? '#DC143C' : '#666'}
                />
              </TouchableOpacity>
              <Text style={styles.checkboxText}>
                I agree to the{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/terms')}>
                <Text style={styles.checkboxLink}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.checkboxText}> and </Text>
              <TouchableOpacity onPress={() => router.push('/privacy')}>
                <Text style={styles.checkboxLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.replace('/auth/login')}
              disabled={loading}
            >
              <Text style={styles.linkText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginLeft: 4,
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
  button: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
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
    padding: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 4,
  },
  checkboxTouch: {
    marginRight: 8,
  },
  checkboxText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  checkboxLink: {
    color: '#DC143C',
    fontSize: 13,
  },
});
