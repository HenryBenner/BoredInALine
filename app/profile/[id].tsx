import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, friendApi, getMediaUrl, UserProfile, VisitHistory } from '@/utils/api';
import { ReportModal } from '@/components/ReportModal';
import { BlockConfirmModal } from '@/components/BlockConfirmModal';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [visitHistory, setVisitHistory] = useState<VisitHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, historyData] = await Promise.all([
        userApi.getProfile(id!),
        userApi.getVisitHistory(id!, 10),
      ]);
      setProfile(profileData);
      setVisitHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFriendAction = async () => {
    if (!profile) return;
    
    setFriendActionLoading(true);
    try {
      if (profile.friendStatus === 'none') {
        await friendApi.sendRequest(profile.id);
        setProfile({ ...profile, friendStatus: 'request_sent' });
      } else if (profile.friendStatus === 'request_received') {
        await friendApi.acceptRequest(profile.id);
        setProfile({ ...profile, friendStatus: 'friends', friendCount: profile.friendCount + 1 });
      } else if (profile.friendStatus === 'friends') {
        await friendApi.removeFriend(profile.id);
        setProfile({ ...profile, friendStatus: 'none', friendCount: profile.friendCount - 1 });
      }
    } catch (err) {
      console.error('Friend action failed:', err);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const getFriendButtonText = () => {
    if (!profile) return '';
    switch (profile.friendStatus) {
      case 'friends': return 'Friends';
      case 'request_sent': return 'Request Sent';
      case 'request_received': return 'Accept Request';
      default: return 'Add Friend';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <TouchableOpacity style={styles.backButtonFloat} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Ionicons name="lock-closed" size={64} color="#666" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profile) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {profile && !profile.isOwnProfile ? (
          <TouchableOpacity
            style={styles.headerRight}
            onPress={() => setShowMoreMenu(!showMoreMenu)}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {showMoreMenu && profile && !profile.isOwnProfile && (
        <View style={styles.moreMenu}>
          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => {
              setShowMoreMenu(false);
              setShowReportModal(true);
            }}
          >
            <Ionicons name="flag-outline" size={18} color="#FFF" />
            <Text style={styles.moreMenuText}>Report User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => {
              setShowMoreMenu(false);
              setShowBlockModal(true);
            }}
          >
            <Ionicons name="ban-outline" size={18} color="#DC143C" />
            <Text style={[styles.moreMenuText, { color: '#DC143C' }]}>Block User</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          {profile.profileImage ? (
            <Image
              source={{ uri: getMediaUrl(profile.profileImage) || undefined }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color="#666" />
            </View>
          )}
          
          <Text style={styles.name}>{profile.name}</Text>
          {profile.school && <Text style={styles.school}>From {profile.school}</Text>}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.friendCount}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.barsVisited}</Text>
              <Text style={styles.statLabel}>Bars Visited</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.totalCheckIns}</Text>
              <Text style={styles.statLabel}>Check-ins</Text>
            </View>
          </View>

          {!profile.isOwnProfile && (
            <TouchableOpacity
              style={[
                styles.friendButton,
                profile.friendStatus === 'friends' && styles.friendButtonActive,
                profile.friendStatus === 'request_sent' && styles.friendButtonPending,
              ]}
              onPress={handleFriendAction}
              disabled={friendActionLoading || profile.friendStatus === 'request_sent'}
            >
              {friendActionLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons 
                    name={profile.friendStatus === 'friends' ? 'checkmark' : 'person-add'} 
                    size={18} 
                    color="#FFF" 
                  />
                  <Text style={styles.friendButtonText}>{getFriendButtonText()}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Nights Out</Text>
          
          {visitHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="calendar-outline" size={48} color="#444" />
              <Text style={styles.emptyHistoryText}>No recent visits</Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {visitHistory.map((visit, index) => (
                <View key={visit.date} style={styles.timelineItem}>
                  <View style={styles.timelineDateContainer}>
                    <View style={styles.timelineDot} />
                    {index < visitHistory.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineDate}>{formatDate(visit.date)}</Text>
                    <View style={styles.barsList}>
                      {visit.bars.map((bar) => (
                        <TouchableOpacity 
                          key={bar.barId} 
                          style={styles.barCard}
                          onPress={() => router.push(`/bar/${bar.barId}`)}
                        >
                          {bar.barImage ? (
                            <Image
                              source={{ uri: getMediaUrl(bar.barImage) || undefined }}
                              style={styles.barImage}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={styles.barImagePlaceholder}>
                              <Ionicons name="beer-outline" size={20} color="#666" />
                            </View>
                          )}
                          <Text style={styles.barName} numberOfLines={1}>{bar.barName}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {profile && !profile.isOwnProfile && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          contentType="user_profile"
          reportedUserId={profile.id}
          reportedUserName={profile.name}
        />
      )}

      {profile && !profile.isOwnProfile && (
        <BlockConfirmModal
          visible={showBlockModal}
          onClose={() => setShowBlockModal(false)}
          userId={profile.id}
          userName={profile.name}
          onBlocked={() => router.back()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  backButtonFloat: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#DC143C',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  headerRight: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 16,
    backgroundColor: '#252525',
    borderRadius: 12,
    zIndex: 100,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  moreMenuText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1C1C1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  school: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#333',
  },
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DC143C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  friendButtonActive: {
    backgroundColor: '#2C2C2C',
  },
  friendButtonPending: {
    backgroundColor: '#444',
  },
  friendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineDateContainer: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC143C',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#333',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 16,
  },
  timelineDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  barsList: {
    gap: 8,
  },
  barCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  barImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  barImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barName: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 40,
  },
});
