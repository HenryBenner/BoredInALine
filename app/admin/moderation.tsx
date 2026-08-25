import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { ApiClient } from '../../utils/api';

interface Report {
  id: string;
  reporter_name: string;
  reported_user_name: string;
  content_type: 'post' | 'chat_message' | 'user_profile';
  reason: string;
  message?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  content_text?: string;
}

type StatusFilter = 'all' | 'pending' | 'resolved' | 'dismissed';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Dismissed', value: 'dismissed' },
];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: 'Post',
  chat_message: 'Chat Message',
  user_profile: 'User Profile',
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function ModerationPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const statusParam = statusFilter !== 'all' ? `status=${statusFilter}&` : '';
      const data = await ApiClient.get<{ reports: Report[] }>(
        `/moderation/reports?${statusParam}page=1&limit=20`
      );
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to load reports');
      } else {
        Alert.alert('Error', 'Failed to load reports');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchReports();
  }, [fetchReports]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReports();
  }, [fetchReports]);

  const handleAction = async (reportId: string, action: 'dismiss' | 'remove_content' | 'ban_user') => {
    if (action === 'ban_user') {
      if (Platform.OS === 'web') {
        if (!window.confirm('Are you sure you want to ban this user? This action cannot be undone.')) {
          return;
        }
      } else {
        return new Promise<void>((resolve) => {
          Alert.alert(
            'Ban User',
            'Are you sure you want to ban this user? This action cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
              {
                text: 'Ban User',
                style: 'destructive',
                onPress: async () => {
                  await executeAction(reportId, action);
                  resolve();
                },
              },
            ]
          );
        });
      }
    }

    await executeAction(reportId, action);
  };

  const executeAction = async (reportId: string, action: 'dismiss' | 'remove_content' | 'ban_user') => {
    setActionLoading(reportId);
    try {
      await ApiClient.put(`/moderation/reports/${reportId}`, { action });

      const actionLabels = {
        dismiss: 'Report dismissed',
        remove_content: 'Content removed',
        ban_user: 'User banned',
      };

      if (Platform.OS === 'web') {
        window.alert(actionLabels[action]);
      } else {
        Alert.alert('Success', actionLabels[action]);
      }

      fetchReports();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to perform action';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#EAB308';
      case 'resolved': return '#22C55E';
      case 'dismissed': return '#6B7280';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moderation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {STATUS_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterPill,
              statusFilter === filter.value && styles.filterPillActive,
            ]}
            onPress={() => setStatusFilter(filter.value)}
          >
            <Text
              style={[
                styles.filterPillText,
                statusFilter === filter.value && styles.filterPillTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#DC143C"
              colors={['#DC143C']}
            />
          }
        >
          {reports.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#666" />
              <Text style={styles.emptyStateText}>No reports found</Text>
            </View>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.reportUsers}>
                    <Text style={styles.reporterText}>
                      <Text style={styles.reporterName}>{report.reporter_name}</Text>
                      {' reported '}
                      <Text style={styles.reportedName}>{report.reported_user_name}</Text>
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(report.status) }]}>
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.badgeRow}>
                  <View style={styles.contentTypeBadge}>
                    <Text style={styles.contentTypeBadgeText}>
                      {CONTENT_TYPE_LABELS[report.content_type] || report.content_type}
                    </Text>
                  </View>
                  <View style={styles.reasonBadge}>
                    <Text style={styles.reasonBadgeText}>{report.reason}</Text>
                  </View>
                </View>

                {report.message && (
                  <Text style={styles.reportMessage}>{report.message}</Text>
                )}

                {report.content_text ? (
                  <Text style={styles.contentText}>"{report.content_text}"</Text>
                ) : null}

                <Text style={styles.reportDate}>{formatDate(report.created_at)}</Text>

                {report.status === 'pending' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.dismissButton]}
                      onPress={() => handleAction(report.id, 'dismiss')}
                      disabled={actionLoading === report.id}
                    >
                      {actionLoading === report.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.actionButtonText}>Dismiss</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.removeButton]}
                      onPress={() => handleAction(report.id, 'remove_content')}
                      disabled={actionLoading === report.id}
                    >
                      <Text style={styles.actionButtonText}>Remove Content</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.banButton]}
                      onPress={() => handleAction(report.id, 'ban_user')}
                      disabled={actionLoading === report.id}
                    >
                      <Text style={styles.actionButtonText}>Ban User</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1C1C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterBar: {
    maxHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  filterBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1C',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#DC143C',
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 12,
  },
  reportCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reportUsers: {
    flex: 1,
    marginRight: 8,
  },
  reporterText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  reporterName: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  reportedName: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  contentTypeBadge: {
    backgroundColor: '#2563EB20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contentTypeBadgeText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '500',
  },
  reasonBadge: {
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reasonBadgeText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '500',
  },
  reportMessage: {
    color: '#D1D5DB',
    fontSize: 13,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  contentText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 8,
    fontStyle: 'italic',
    backgroundColor: '#2A2A2A',
    padding: 8,
    borderRadius: 6,
  },
  reportDate: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: '#4B5563',
  },
  removeButton: {
    backgroundColor: '#D97706',
  },
  banButton: {
    backgroundColor: '#DC2626',
  },
});
