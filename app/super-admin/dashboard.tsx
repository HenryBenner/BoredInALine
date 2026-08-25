import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { superAdminApi, BroadcastNotification } from '@/utils/api';

export default function SuperAdminDashboard() {
  const { superAdmin, logout } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ recipientCount: number } | null>(null);
  const [history, setHistory] = useState<BroadcastNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const data = await superAdminApi.getHistory();
      setHistory(data || []);
    } catch (error) {
      console.error('Failed to load broadcast history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleSend = async () => {
    if (!title.trim()) {
      showAlert('Missing Title', 'Please enter a notification title.');
      return;
    }
    if (!body.trim()) {
      showAlert('Missing Message', 'Please enter a notification message.');
      return;
    }

    showConfirm(
      'Send to All Users',
      `Send "${title.trim()}" to all users with notifications enabled?`,
      async () => {
        setSending(true);
        setLastResult(null);
        try {
          const result = await superAdminApi.sendNotification(title.trim(), body.trim());
          setLastResult({ recipientCount: result.recipientCount });
          setTitle('');
          setBody('');
          await loadHistory();
        } catch (error) {
          showAlert('Send Failed', 'Failed to send notification. Please try again.');
        } finally {
          setSending(false);
        }
      }
    );
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const charCount = body.length;
  const isOverLimit = charCount > 200;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSub}>Signed in as {superAdmin?.name || superAdmin?.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DC143C" />}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Push Notification</Text>
          <Text style={styles.sectionSub}>Broadcast a message to all users with notifications enabled.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Happy Hour Alert 🍺"
              placeholderTextColor="#555"
              maxLength={60}
              autoCapitalize="sentences"
            />
            <Text style={styles.charHint}>{title.length}/60</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={body}
              onChangeText={setBody}
              placeholder="Write your message here..."
              placeholderTextColor="#555"
              multiline
              maxLength={200}
              autoCapitalize="sentences"
            />
            <Text style={[styles.charHint, isOverLimit && styles.charOver]}>{charCount}/200</Text>
          </View>

          {lastResult && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text style={styles.successText}>
                Sent to {lastResult.recipientCount} user{lastResult.recipientCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.sendBtn, (sending || !title.trim() || !body.trim()) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
          >
            {sending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#FFF" />
                <Text style={styles.sendBtnText}>Send to All Users</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Broadcast History</Text>

          {loadingHistory ? (
            <ActivityIndicator color="#DC143C" style={{ marginTop: 16 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={40} color="#444" />
              <Text style={styles.emptyText}>No broadcasts sent yet</Text>
            </View>
          ) : (
            history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <View style={styles.recipientBadge}>
                    <Ionicons name="people" size={12} color="#9CA3AF" />
                    <Text style={styles.recipientCount}>{item.recipientCount}</Text>
                  </View>
                </View>
                <Text style={styles.historyBody}>{item.body}</Text>
                <Text style={styles.historyDate}>{formatDate(item.sentAt)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#1C1C1C',
    borderRadius: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: -4,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E5E7EB',
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charHint: {
    fontSize: 12,
    color: '#555',
    textAlign: 'right',
    marginTop: -2,
  },
  charOver: {
    color: '#DC143C',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  successText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '600',
  },
  sendBtn: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: {
    color: '#555',
    fontSize: 14,
  },
  historyCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  recipientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2C2C2C',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recipientCount: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  historyBody: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  historyDate: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },
});
