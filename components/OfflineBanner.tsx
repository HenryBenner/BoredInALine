import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

export function OfflineBanner() {
  const { isServerOnline, checkServerConnectivity } = useAuth();

  if (isServerOnline) {
    return null;
  }

  const handleRetry = async () => {
    await checkServerConnectivity();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="wifi-off" size={20} color="#FFF" />
        <Text style={styles.text}>Connection issue. Some features may be unavailable.</Text>
        <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#B22222',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: '#FFF',
    fontSize: 13,
    flex: 1,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
