import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, ApiClient, User, BarAdmin, AdminBar, SuperAdmin } from '../utils/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  isBarAdmin: boolean;
  isSuperAdmin: boolean;
  barAdmin: BarAdmin | null;
  adminBar: AdminBar | null;
  superAdmin: SuperAdmin | null;
  isServerOnline: boolean;
  checkServerConnectivity: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<{ isBarAdmin: boolean; isSuperAdmin: boolean }>;
  loginWithGoogle: (accessToken: string) => Promise<void>;
  loginWithApple: (identityToken: string, name?: string) => Promise<void>;
  register: (email: string, password: string, name: string, school?: string, termsAccepted?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  exitGuestMode: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  updateAdminBar: (bar: AdminBar) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = '@bored_in_line_token';
const AUTH_USER_KEY = '@bored_in_line_user';
const GUEST_MODE_KEY = '@bored_in_line_guest';
const BAR_ADMIN_KEY = '@bored_in_line_bar_admin';
const ADMIN_BAR_KEY = '@bored_in_line_admin_bar';
const SUPER_ADMIN_KEY = '@bored_in_line_super_admin';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBarAdmin, setIsBarAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [barAdmin, setBarAdmin] = useState<BarAdmin | null>(null);
  const [adminBar, setAdminBar] = useState<AdminBar | null>(null);
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [isServerOnline, setIsServerOnline] = useState(true);
  const isLoggingOut = useRef(false);

  const checkServerConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const health = await ApiClient.checkServerHealth();
      setIsServerOnline(health.isOnline);
      console.log('Server health check:', health.isOnline ? 'online' : 'offline', health.latency ? `${health.latency}ms` : '');
      return health.isOnline;
    } catch (error) {
      console.error('Server connectivity check failed:', error);
      setIsServerOnline(false);
      return false;
    }
  }, []);

  const clearAuthState = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(AUTH_USER_KEY);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      await AsyncStorage.removeItem(BAR_ADMIN_KEY);
      await AsyncStorage.removeItem(ADMIN_BAR_KEY);
      await AsyncStorage.removeItem(SUPER_ADMIN_KEY);
      setToken(null);
      setUser(null);
      setIsGuest(false);
      setIsBarAdmin(false);
      setIsSuperAdmin(false);
      setBarAdmin(null);
      setAdminBar(null);
      setSuperAdmin(null);
      ApiClient.setToken(null);
      console.log('Auth state cleared due to invalid token');
    } catch (error) {
      console.error('Failed to clear auth state:', error);
    } finally {
      isLoggingOut.current = false;
    }
  }, []);

  useEffect(() => {
    ApiClient.setOnUnauthorized(clearAuthState);
    
    const initializeApp = async () => {
      await checkServerConnectivity();
      await loadStoredAuth();
    };
    
    initializeApp();
    
    return () => {
      ApiClient.setOnUnauthorized(null);
    };
  }, [clearAuthState, checkServerConnectivity]);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
      const storedBarAdmin = await AsyncStorage.getItem(BAR_ADMIN_KEY);
      const storedAdminBar = await AsyncStorage.getItem(ADMIN_BAR_KEY);
      const storedSuperAdmin = await AsyncStorage.getItem(SUPER_ADMIN_KEY);
      const guestMode = await AsyncStorage.getItem(GUEST_MODE_KEY);

      if (storedToken && storedSuperAdmin) {
        const parsedSuperAdmin = JSON.parse(storedSuperAdmin);
        setToken(storedToken);
        setIsSuperAdmin(true);
        setSuperAdmin(parsedSuperAdmin);
        ApiClient.setToken(storedToken);
      } else if (storedToken && storedBarAdmin && storedAdminBar) {
        const parsedBarAdmin = JSON.parse(storedBarAdmin);
        const parsedAdminBar = JSON.parse(storedAdminBar);
        setToken(storedToken);
        setIsBarAdmin(true);
        setBarAdmin(parsedBarAdmin);
        setAdminBar(parsedAdminBar);
        ApiClient.setToken(storedToken);
      } else if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        setIsGuest(false);
        ApiClient.setToken(storedToken);
      } else if (guestMode === 'true') {
        setIsGuest(true);
      }
    } catch (error) {
      console.error('Failed to load auth data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ isBarAdmin: boolean; isSuperAdmin: boolean }> => {
    try {
      const response = await authApi.login({ email, password });
      
      if ('isSuperAdmin' in response && response.isSuperAdmin) {
        await saveSuperAdminAuth(response.token, response.superAdmin);
        return { isBarAdmin: false, isSuperAdmin: true };
      }
      
      if ('isBarAdmin' in response && response.isBarAdmin) {
        await saveBarAdminAuth(response.token, response.admin, response.bar);
        return { isBarAdmin: true, isSuperAdmin: false };
      }
      
      await saveAuth(response.token, response.user);
      return { isBarAdmin: false, isSuperAdmin: false };
    } catch (error) {
      throw error;
    }
  };

  const saveSuperAdminAuth = async (newToken: string, newSuperAdmin: SuperAdmin) => {
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
      await AsyncStorage.setItem(SUPER_ADMIN_KEY, JSON.stringify(newSuperAdmin));
      await AsyncStorage.removeItem(AUTH_USER_KEY);
      await AsyncStorage.removeItem(BAR_ADMIN_KEY);
      await AsyncStorage.removeItem(ADMIN_BAR_KEY);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setToken(newToken);
      setIsSuperAdmin(true);
      setSuperAdmin(newSuperAdmin);
      setUser(null);
      setIsBarAdmin(false);
      setBarAdmin(null);
      setAdminBar(null);
      setIsGuest(false);
      ApiClient.setToken(newToken);
      console.log('Super admin auth saved:', { id: newSuperAdmin.id });
    } catch (error) {
      console.error('Failed to save super admin auth:', error);
      throw new Error('Failed to save login information');
    }
  };
  
  const saveBarAdminAuth = async (newToken: string, newAdmin: BarAdmin, newBar: AdminBar) => {
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
      await AsyncStorage.setItem(BAR_ADMIN_KEY, JSON.stringify(newAdmin));
      await AsyncStorage.setItem(ADMIN_BAR_KEY, JSON.stringify(newBar));
      await AsyncStorage.removeItem(AUTH_USER_KEY);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      await AsyncStorage.removeItem(SUPER_ADMIN_KEY);
      setToken(newToken);
      setIsBarAdmin(true);
      setBarAdmin(newAdmin);
      setAdminBar(newBar);
      setUser(null);
      setIsGuest(false);
      ApiClient.setToken(newToken);
      console.log('Bar admin auth saved successfully:', { adminId: newAdmin.id, barId: newBar.id });
    } catch (error) {
      console.error('Failed to save bar admin auth data:', error);
      throw new Error('Failed to save login information');
    }
  };

  const loginWithGoogle = async (accessToken: string): Promise<void> => {
    const response = await authApi.googleAuth({ accessToken });
    await saveAuth(response.token, response.user);
  };

  const loginWithApple = async (identityToken: string, name?: string): Promise<void> => {
    const response = await authApi.appleAuth({ identityToken, name });
    await saveAuth(response.token, response.user);
  };

  const register = async (email: string, password: string, name: string, school?: string, termsAccepted?: boolean) => {
    try {
      const response = await authApi.register({ email, password, name, school, termsAccepted: termsAccepted ?? true });
      await saveAuth(response.token, response.user);
    } catch (error) {
      throw error;
    }
  };

  const saveAuth = async (newToken: string, newUser: User) => {
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setToken(newToken);
      setUser(newUser);
      setIsGuest(false);
      ApiClient.setToken(newToken);
      console.log('Auth saved successfully:', { userId: newUser.id, email: newUser.email });
    } catch (error) {
      console.error('Failed to save auth data:', error);
      throw new Error('Failed to save login information');
    }
  };

  const logout = async () => {
    try {
      if (!isBarAdmin && !isSuperAdmin) {
        try {
          await ApiClient.delete('/users/me/push-token');
        } catch (e) {
          console.log('Failed to remove push token:', e);
        }
      }
      
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(AUTH_USER_KEY);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      await AsyncStorage.removeItem(BAR_ADMIN_KEY);
      await AsyncStorage.removeItem(ADMIN_BAR_KEY);
      await AsyncStorage.removeItem(SUPER_ADMIN_KEY);
      setToken(null);
      setUser(null);
      setIsGuest(false);
      setIsBarAdmin(false);
      setIsSuperAdmin(false);
      setBarAdmin(null);
      setAdminBar(null);
      setSuperAdmin(null);
      ApiClient.setToken(null);
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };
  
  const updateAdminBar = (bar: AdminBar) => {
    setAdminBar(bar);
    AsyncStorage.setItem(ADMIN_BAR_KEY, JSON.stringify(bar));
  };

  const continueAsGuest = async () => {
    try {
      await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
      setIsGuest(true);
    } catch (error) {
      console.error('Failed to set guest mode:', error);
      throw new Error('Failed to continue as guest');
    }
  };

  const exitGuestMode = async () => {
    try {
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setIsGuest(false);
    } catch (error) {
      console.error('Failed to exit guest mode:', error);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const response = await ApiClient.get<User>('/users/me');
      if (response) {
        setUser(response);
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(response));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && (!!user || isBarAdmin || isSuperAdmin),
        isGuest,
        isBarAdmin,
        isSuperAdmin,
        barAdmin,
        adminBar,
        superAdmin,
        isServerOnline,
        checkServerConnectivity,
        login,
        loginWithGoogle,
        loginWithApple,
        register,
        logout,
        continueAsGuest,
        exitGuestMode,
        updateUser,
        refreshUser,
        updateAdminBar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
