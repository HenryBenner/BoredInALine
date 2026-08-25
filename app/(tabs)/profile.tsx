import { StyleSheet, ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Platform, RefreshControl, Modal, FlatList } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, friendApi, getMediaUrl, UserProfile, VisitHistory } from '@/utils/api';

interface Friend {
  id: string;
  name: string;
  school?: string;
  profileImage?: string;
}

export default function ProfileScreen() {
  const { user, isGuest, isAuthenticated, isLoading: authLoading, exitGuestMode } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [visitHistory, setVisitHistory] = useState<VisitHistory[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ incoming: any[]; outgoing: any[] }>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      loadProfile();
    }
  }, [isAuthenticated, authLoading, user]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading && isAuthenticated && user) {
        loadProfile();
      }
    }, [isAuthenticated, authLoading, user])
  );

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const [profileData, historyData, requests] = await Promise.all([
        userApi.getProfile(user.id),
        userApi.getVisitHistory(user.id, 10),
        friendApi.getPendingRequests().catch(() => ({ incoming: [], outgoing: [] })),
      ]);
      setProfile(profileData);
      setVisitHistory(historyData);
      setPendingRequests(requests);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [user]);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await friendApi.acceptRequest(requestId);
      await loadProfile();
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await friendApi.declineRequest(requestId);
      await loadProfile();
    } catch (error) {
      console.error('Failed to decline request:', error);
    }
  };

  const openFriendsList = async () => {
    setShowFriendsModal(true);
    setLoadingFriends(true);
    try {
      const friendsList = await userApi.getFriends();
      setFriends(friendsList);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const navigateToFriendProfile = (friendId: string) => {
    setShowFriendsModal(false);
    router.push(`/profile/${friendId}`);
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

  if (isGuest) {
    return (
      <View style={styles.container}>
        <View style={styles.guestContainer}>
          <View style={styles.guestIconContainer}>
            <Ionicons name="person-circle-outline" size={80} color="#DC143C" />
          </View>
          <Text style={styles.guestTitle}>Guest Mode</Text>
          <Text style={styles.guestSubtitle}>
            Create an account to access your profile, connect with friends, and unlock all features
          </Text>
          <View style={styles.guestFeaturesList}>
            <View style={styles.guestFeature}>
              <Ionicons name="people" size={24} color="#DC143C" />
              <Text style={styles.guestFeatureText}>Send and receive friend requests</Text>
            </View>
            <View style={styles.guestFeature}>
              <Ionicons name="beer" size={24} color="#DC143C" />
              <Text style={styles.guestFeatureText}>Track your nights out and visits</Text>
            </View>
            <View style={styles.guestFeature}>
              <Ionicons name="stats-chart" size={24} color="#DC143C" />
              <Text style={styles.guestFeatureText}>Build your bar-hopping stats</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.guestSignUpButton}
            onPress={async () => {
              await exitGuestMode();
              router.push('/auth/register');
            }}
          >
            <Text style={styles.guestSignUpButtonText}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.guestLoginButton}
            onPress={async () => {
              await exitGuestMode();
              router.push('/auth/login');
            }}
          >
            <Text style={styles.guestLoginButtonText}>Already have an account? Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading || !user || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/search')}>
            <Ionicons name="search" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DC143C" />
        }
      >
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {user.profileImage ? (
              <Image
                source={{ uri: getMediaUrl(user.profileImage) || undefined }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="#666" />
              </View>
            )}
            
            <Text style={styles.name}>{user.name}</Text>
            {user.school && <Text style={styles.school}>From {user.school}</Text>}
          </View>

          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={openFriendsList}>
              <Text style={styles.statValue}>{profile.friendCount}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </TouchableOpacity>
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

          <TouchableOpacity style={styles.editProfileButton} onPress={() => router.push('/settings')}>
            <Ionicons name="pencil" size={16} color="#FFF" />
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {pendingRequests.incoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Friend Requests ({pendingRequests.incoming.length})</Text>
            {pendingRequests.incoming.map((request) => (
              <View key={request.requestId} style={styles.requestCard}>
                <TouchableOpacity 
                  style={styles.requestUser}
                  onPress={() => router.push(`/profile/${request.id}`)}
                >
                  {request.profileImage ? (
                    <Image
                      source={{ uri: getMediaUrl(request.profileImage) || undefined }}
                      style={styles.requestAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.requestAvatarPlaceholder}>
                      <Ionicons name="person" size={20} color="#666" />
                    </View>
                  )}
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{request.name}</Text>
                    {request.school && (
                      <Text style={styles.requestSchool}>From {request.school}</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRequest(request.requestId)}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => handleDeclineRequest(request.requestId)}
                  >
                    <Ionicons name="close" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Nights Out</Text>
          
          {visitHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="calendar-outline" size={48} color="#444" />
              <Text style={styles.emptyHistoryText}>No recent visits yet</Text>
              <Text style={styles.emptyHistorySubtext}>Check in to bars to build your history</Text>
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
                        <View key={bar.barId} style={styles.barCard}>
                          <TouchableOpacity 
                            style={styles.barCardRow}
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
                            <Ionicons name="chevron-forward" size={16} color="#666" />
                          </TouchableOpacity>
                          {bar.photoUrl && (
                            <Image
                              source={{ uri: getMediaUrl(bar.photoUrl) || undefined }}
                              style={styles.checkInPhoto}
                              contentFit="cover"
                            />
                          )}
                        </View>
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

      <Modal
        visible={showFriendsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFriendsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Friends</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowFriendsModal(false)}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            {loadingFriends ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#DC143C" />
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.emptyFriends}>
                <Ionicons name="people-outline" size={48} color="#444" />
                <Text style={styles.emptyFriendsText}>No friends yet</Text>
                <TouchableOpacity 
                  style={styles.findFriendsButton}
                  onPress={() => {
                    setShowFriendsModal(false);
                    router.push('/search');
                  }}
                >
                  <Text style={styles.findFriendsButtonText}>Find Friends</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.friendsList}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.friendItem}
                    onPress={() => navigateToFriendProfile(item.id)}
                  >
                    {item.profileImage ? (
                      <Image
                        source={{ uri: getMediaUrl(item.profileImage) || undefined }}
                        style={styles.friendAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.friendAvatarPlaceholder}>
                        <Ionicons name="person" size={24} color="#666" />
                      </View>
                    )}
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{item.name}</Text>
                      {item.school && (
                        <Text style={styles.friendSchool}>From {item.school}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#DC143C',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#DC143C',
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
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 28,
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
    height: 36,
    backgroundColor: '#333',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2C2C2C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editProfileButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  requestUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  requestAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: {
    marginLeft: 12,
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  requestSchool: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DC143C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#1C1C1C',
    borderRadius: 16,
  },
  emptyHistoryText: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
  },
  emptyHistorySubtext: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
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
    backgroundColor: '#1C1C1C',
    padding: 12,
    borderRadius: 12,
  },
  barCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkInPhoto: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: 10,
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
    height: 100,
  },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  guestIconContainer: {
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  guestFeaturesList: {
    width: '100%',
    marginBottom: 32,
    gap: 16,
  },
  guestFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  guestFeatureText: {
    fontSize: 14,
    color: '#CCC',
    flex: 1,
  },
  guestSignUpButton: {
    backgroundColor: '#DC143C',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 28,
    marginBottom: 16,
  },
  guestSignUpButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  guestLoginButton: {
    padding: 12,
  },
  guestLoginButtonText: {
    color: '#DC143C',
    fontSize: 14,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2C',
    borderRadius: 18,
  },
  modalLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyFriends: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyFriendsText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
    marginBottom: 24,
  },
  findFriendsButton: {
    backgroundColor: '#DC143C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  findFriendsButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  friendsList: {
    padding: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  friendAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  friendSchool: {
    fontSize: 13,
    color: '#888',
  },
});
