import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { useNotifications } from '@/hooks/useNotifications';
import { OfflineBanner } from '@/components/OfflineBanner';

function RootLayoutNav() {
  const { isAuthenticated, isGuest, isLoading, isBarAdmin, isSuperAdmin } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  
  useNotifications(isAuthenticated && !isBarAdmin && !isSuperAdmin);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inAdminGroup = segments[0] === 'admin';
    const inSuperAdminGroup = segments[0] === 'super-admin';
    const isPublicPage = segments[0] === 'support' || segments[0] === 'privacy' || segments[0] === 'terms' || segments[0] === 'eula' || (segments[0] === 'auth' && segments[1] === 'forgot-password');
    const canAccessApp = isAuthenticated || isGuest;

    console.log('Navigation check:', { isAuthenticated, isGuest, isBarAdmin, isSuperAdmin, inAuthGroup, inAdminGroup, inSuperAdminGroup, canAccessApp, segments: segments[0] });

    if (isPublicPage) return;

    if (isSuperAdmin) {
      if (!inSuperAdminGroup) {
        router.replace('/super-admin/dashboard');
      }
    } else if (isBarAdmin) {
      if (!inAdminGroup) {
        router.replace('/admin/dashboard');
      }
    } else if (!canAccessApp) {
      if (!inAuthGroup) {
        router.replace('/auth/login');
      }
    } else {
      if (inAuthGroup) {
        router.replace('/(tabs)/discover');
      } else if (inAdminGroup || inSuperAdminGroup) {
        router.replace('/(tabs)/discover');
      }
    }
  }, [isAuthenticated, isGuest, isLoading, isBarAdmin, isSuperAdmin, segments]);

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="search/index" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="admin/dashboard" />
        <Stack.Screen name="super-admin/dashboard" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="bar/[id]" />
        <Stack.Screen name="support" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="eula" />
        <Stack.Screen name="+not-found" options={{ headerShown: true }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <SocketProvider>
        <ThemeProvider value={DarkTheme}>
          <RootLayoutNav />
          <StatusBar style="light" />
        </ThemeProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
