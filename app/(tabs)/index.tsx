import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Image, RefreshControl, ActivityIndicator, Alert, Share } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentCheckIn, postApi, Post, userApi, getMediaUrl, Reaction, friendApi } from '@/utils/api';
import { NewPostModal } from '@/components/NewPostModal';
import { EmojiPicker, ReactionDisplay } from '@/components/EmojiPicker';
import { ReportModal } from '@/components/ReportModal';
import { BlockConfirmModal } from '@/components/BlockConfirmModal';

interface FriendActivity {
  userId: string;
  userName: string;
  profileImage: string;
  barId: string;
  barName: string;
  checkedInAt: string;
}

export default function FeedScreen() {
  const colors = Colors['dark'];
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [checkIn, setCheckIn] = useState<{ barId: string; barName: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendActivity, setFriendActivity] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string; content: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [reportPost, setReportPost] = useState<Post | null>(null);
  const [blockPost, setBlockPost] = useState<Post | null>(null);

  const handleDeletePost = useCallback((post: Post) => {
    setOpenMenuPostId(null);
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setPosts(prev => prev.filter(p => p.id !== post.id));
            try {
              await postApi.deletePost(post.id);
            } catch (error) {
              setPosts(prev => [post, ...prev.filter(p => p.id !== post.id)]);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  }, []);

  const loadFeedData = useCallback(async (showErrorAlert = false) => {
    if (authLoading) {
      return;
    }

    try {
      setLoadError(null);
      
      const feedPosts = await postApi.getPosts();
      setPosts(feedPosts);
      
      if (isAuthenticated) {
        const [currentCheckIn, activity] = await Promise.all([
          getCurrentCheckIn(),
          userApi.getFriendActivity().catch(() => []),
        ]);
        setCheckIn(currentCheckIn);
        setFriendActivity(activity);
      } else {
        setCheckIn(null);
        setFriendActivity([]);
      }
    } catch (error: any) {
      console.error('Failed to load feed data:', error);
      const errorMessage = error?.message || 'Failed to load feed';
      setLoadError(errorMessage);
      
      if (showErrorAlert) {
        Alert.alert('Error', 'Could not refresh feed. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      loadFeedData();
    }
  }, [loadFeedData, authLoading]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        loadFeedData();
      }
    }, [loadFeedData, authLoading])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeedData(true);
  }, [loadFeedData]);

  const handleLikeToggle = async (postId: string, currentlyLiked: boolean) => {
    const previousPosts = posts;
    
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === postId
          ? {
              ...post,
              userLiked: !currentlyLiked,
              likes: currentlyLiked ? post.likes - 1 : post.likes + 1,
            }
          : post
      )
    );

    try {
      if (currentlyLiked) {
        await postApi.unlikePost(postId);
      } else {
        await postApi.likePost(postId);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      setPosts(previousPosts);
      Alert.alert('Error', 'Could not update like. Please try again.');
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const goToDiscover = () => {
    router.push('/(tabs)/discover');
  };

  const handleReply = (post: Post) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to reply to posts.');
      return;
    }
    setReplyingTo({
      id: post.id,
      userName: post.userName,
      content: post.content,
    });
    setShowNewPostModal(true);
  };

  const handleCloseNewPostModal = () => {
    setShowNewPostModal(false);
    setReplyingTo(null);
  };

  const handleReactionToggle = async (postId: string, emoji: string, userReacted: boolean) => {
    if (!isAuthenticated) {
      Alert.alert('Account Required', 'Please sign in to react to posts.');
      return;
    }

    const previousPosts = posts;
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post.id !== postId) return post;
        const reactions = post.reactions || [];
        if (userReacted) {
          return {
            ...post,
            reactions: reactions.map(r =>
              r.emoji === emoji
                ? { ...r, count: r.count - 1, userReacted: false }
                : r
            ).filter(r => r.count > 0),
          };
        } else {
          const existing = reactions.find(r => r.emoji === emoji);
          if (existing) {
            return {
              ...post,
              reactions: reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, userReacted: true }
                  : r
              ),
            };
          } else {
            return {
              ...post,
              reactions: [...reactions, { emoji, count: 1, userReacted: true }],
            };
          }
        }
      })
    );

    try {
      if (userReacted) {
        await postApi.removeReaction(postId, emoji);
      } else {
        await postApi.addReaction(postId, emoji);
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      setPosts(previousPosts);
      Alert.alert('Error', 'Could not update reaction. Please try again.');
    }
  };

  const handleAddReaction = async (postId: string, emoji: string) => {
    if (!isAuthenticated) {
      Alert.alert('Account Required', 'Please sign in to react to posts.');
      return;
    }
    setShowEmojiPicker(null);
    await handleReactionToggle(postId, emoji, false);
  };

  const handleShare = async (post: Post) => {
    try {
      const barInfo = post.barName ? ` @ ${post.barName}` : '';
      const message = `${post.userName}${barInfo}: "${post.content}"`;
      
      await Share.share({
        message: `${message}\n\nCheck out what's happening on Bored in Line!`,
        title: 'Share Post',
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Share error:', error);
      }
    }
  };

  const handleAddFriend = async (post: Post) => {
    if (!isAuthenticated) {
      Alert.alert('Account Required', 'Please sign in to add friends.');
      return;
    }
    
    if (!post.userId) {
      return;
    }

    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === post.id ? { ...p, requestSent: true } : p
      )
    );

    try {
      await friendApi.sendRequest(post.userId);
      Alert.alert('Request Sent', `Friend request sent to ${post.userName}!`);
    } catch (error: any) {
      setPosts(prevPosts =>
        prevPosts.map(p =>
          p.id === post.id ? { ...p, requestSent: false } : p
        )
      );
      Alert.alert('Error', error?.message || 'Could not send friend request.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.scarlet} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={styles.headerTitle}>Live Feed</Text>
        {checkIn ? (
          <View style={[styles.checkedInBadge, { backgroundColor: colors.scarlet }]}>
            <IconSymbol name="checkmark.circle.fill" size={14} color="#FFF" />
            <Text style={styles.checkedInText}>{checkIn.barName}</Text>
          </View>
        ) : (
          <Text style={[styles.headerSubtitle, { color: colors.gray }]}>
            See what's happening at local bars
          </Text>
        )}
      </View>

      <ScrollView 
        style={styles.feedList} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.scarlet}
          />
        }
      >
        {friendActivity.length > 0 && (
          <View style={styles.friendActivitySection}>
            <Text style={styles.sectionTitle}>Friend Activity</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.friendActivityList}
            >
              {friendActivity.map((activity) => (
                <TouchableOpacity
                  key={`${activity.userId}-${activity.barId}`}
                  style={[styles.friendActivityCard, { backgroundColor: colors.card }]}
                  onPress={() => router.push(`/profile/${activity.userId}`)}
                >
                  {activity.profileImage ? (
                    <Image 
                      source={{ uri: getMediaUrl(activity.profileImage) || activity.profileImage }} 
                      style={styles.friendActivityImage}
                    />
                  ) : (
                    <View style={[styles.defaultAvatar, styles.friendActivityImage]}>
                      <Ionicons name="person" size={24} color="#666" />
                    </View>
                  )}
                  <Text style={styles.friendActivityName} numberOfLines={1}>
                    {activity.userName}
                  </Text>
                  <TouchableOpacity onPress={() => router.push(`/bar/${activity.barId}`)}>
                    <Text style={[styles.friendActivityBar, { color: colors.scarlet }]} numberOfLines={1}>
                      @ {activity.barName}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.sectionTitle}>All Posts</Text>

        {isAuthenticated && (
          <View style={[styles.newPostCard, { backgroundColor: colors.card }]}>
            {user?.profileImage ? (
              <Image 
                source={{ uri: getMediaUrl(user.profileImage) || user.profileImage }} 
                style={styles.currentUserImage}
              />
            ) : (
              <View style={[styles.defaultAvatar, styles.currentUserImage]}>
                <Ionicons name="person" size={20} color="#666" />
              </View>
            )}
            <TouchableOpacity 
              style={styles.newPostInput}
              onPress={() => setShowNewPostModal(true)}
            >
              <Text style={{ color: colors.gray }}>
                Share something...
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowNewPostModal(true)}>
              <IconSymbol name="photo" size={24} color={colors.gray} />
            </TouchableOpacity>
          </View>
        )}

        {posts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={[styles.emptyText, { color: colors.gray }]}>
              No posts yet. Tap in to a bar and be the first to share!
            </Text>
          </View>
        ) : (
          posts.map((post) => (
            <View 
              key={post.id} 
              style={[styles.postCard, { backgroundColor: colors.card }]}
            >
              <TouchableOpacity 
                style={styles.postHeader}
                onPress={() => post.userId && router.push(`/profile/${post.userId}`)}
                disabled={!post.userId}
              >
                {post.userImage ? (
                  <Image source={{ uri: getMediaUrl(post.userImage) || post.userImage }} style={styles.userImage} />
                ) : (
                  <View style={[styles.defaultAvatar, styles.userImage]}>
                    <Ionicons name="person" size={22} color="#666" />
                  </View>
                )}
                <View style={styles.postUserInfo}>
                  <Text style={styles.userName}>{post.userName}</Text>
                  <View style={styles.postMeta}>
                    {post.barName && (
                      <Text style={[styles.barTag, { color: colors.scarlet }]}>
                        @ {post.barName}
                      </Text>
                    )}
                    <Text style={[styles.timestamp, { color: colors.gray }]}>
                      {formatTimeAgo(post.timestamp)}
                    </Text>
                  </View>
                </View>
                {isAuthenticated && (post.userId === user?.id || post.userId !== user?.id) && (
                  <TouchableOpacity
                    style={styles.postMenuButton}
                    onPress={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.gray} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {openMenuPostId === post.id && (
                <View style={styles.postMenu}>
                  {post.userId === user?.id ? (
                    <TouchableOpacity
                      style={styles.postMenuItem}
                      onPress={() => handleDeletePost(post)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#DC143C" />
                      <Text style={[styles.postMenuText, { color: '#DC143C' }]}>Delete Post</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.postMenuItem}
                        onPress={() => {
                          setOpenMenuPostId(null);
                          setReportPost(post);
                        }}
                      >
                        <Ionicons name="flag-outline" size={18} color="#FFF" />
                        <Text style={styles.postMenuText}>Report Post</Text>
                      </TouchableOpacity>
                      {post.userId && (
                        <TouchableOpacity
                          style={styles.postMenuItem}
                          onPress={() => {
                            setOpenMenuPostId(null);
                            setBlockPost(post);
                          }}
                        >
                          <Ionicons name="ban-outline" size={18} color="#DC143C" />
                          <Text style={[styles.postMenuText, { color: '#DC143C' }]}>Block {post.userName}</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}

              {post.replyToUserName && (
                <View style={styles.replyIndicator}>
                  <IconSymbol name="arrowshape.turn.up.left.fill" size={12} color={colors.gray} />
                  <Text style={[styles.replyIndicatorText, { color: colors.gray }]}>
                    Replying to {post.replyToUserName}
                  </Text>
                </View>
              )}

              <Text style={styles.postContent}>{post.content}</Text>

              {post.imageUrl && getMediaUrl(post.imageUrl) && (
                <Image source={{ uri: getMediaUrl(post.imageUrl)! }} style={styles.postImage} />
              )}

              {(post.reactions?.length ?? 0) > 0 && (
                <View style={styles.reactionsRow}>
                  <ReactionDisplay
                    reactions={post.reactions || []}
                    onReactionPress={(emoji, userReacted) => handleReactionToggle(post.id, emoji, userReacted)}
                    onAddPress={() => setShowEmojiPicker(post.id)}
                  />
                </View>
              )}

              {isAuthenticated && post.userId && post.userId !== user?.id && !post.isFriend && (
                <TouchableOpacity
                  style={[
                    styles.addFriendBanner,
                    post.requestSent && styles.addFriendBannerSent
                  ]}
                  onPress={() => handleAddFriend(post)}
                  disabled={post.requestSent}
                >
                  <Ionicons 
                    name={post.requestSent ? "checkmark-circle" : "person-add"} 
                    size={18} 
                    color={post.requestSent ? colors.gray : "#FFF"} 
                  />
                  <Text style={[
                    styles.addFriendBannerText,
                    post.requestSent && { color: colors.gray }
                  ]}>
                    {post.requestSent ? 'Request Sent' : `Add ${post.userName}`}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.postFooter}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleLikeToggle(post.id, post.userLiked)}
                >
                  <IconSymbol 
                    name={post.userLiked ? "heart.fill" : "heart"} 
                    size={22} 
                    color={post.userLiked ? colors.scarlet : colors.lightGray} 
                  />
                  <Text style={[
                    styles.actionText, 
                    { color: post.userLiked ? colors.scarlet : colors.lightGray }
                  ]}>
                    {post.likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleReply(post)}
                >
                  <IconSymbol 
                    name="bubble.left" 
                    size={20} 
                    color={colors.lightGray} 
                  />
                  {(post.replyCount ?? 0) > 0 && (
                    <Text style={[styles.actionText, { color: colors.lightGray }]}>
                      {post.replyCount}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => setShowEmojiPicker(post.id)}
                >
                  <Ionicons 
                    name="happy-outline" 
                    size={20} 
                    color={colors.lightGray} 
                  />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleShare(post)}
                >
                  <Ionicons 
                    name="share-outline" 
                    size={20} 
                    color={colors.lightGray} 
                  />
                </TouchableOpacity>
              </View>

              {(post.replyCount ?? 0) > 0 && (
                <TouchableOpacity 
                  style={styles.viewRepliesButton}
                  onPress={() => router.push(`/post/${post.id}`)}
                >
                  <Text style={[styles.viewRepliesText, { color: colors.scarlet }]}>
                    View {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.scarlet} />
                </TouchableOpacity>
              )}

              <EmojiPicker
                visible={showEmojiPicker === post.id}
                onClose={() => setShowEmojiPicker(null)}
                onSelect={(emoji) => handleAddReaction(post.id, emoji)}
              />
            </View>
          ))
        )}
      </ScrollView>

      {isAuthenticated && (
        <NewPostModal
          visible={showNewPostModal}
          onClose={handleCloseNewPostModal}
          barId={checkIn?.barId ?? null}
          onPostCreated={loadFeedData}
          replyTo={replyingTo}
        />
      )}

      {reportPost && (
        <ReportModal
          visible={!!reportPost}
          onClose={() => setReportPost(null)}
          onReported={() => {
            const id = reportPost.id;
            setReportPost(null);
            setPosts(prev => prev.filter(p => p.id !== id));
          }}
          contentType="post"
          contentId={reportPost.id}
          reportedUserId={reportPost.userId}
          reportedUserName={reportPost.userName}
        />
      )}

      {blockPost && (
        <BlockConfirmModal
          visible={!!blockPost}
          onClose={() => setBlockPost(null)}
          userId={blockPost.userId}
          userName={blockPost.userName}
          onBlocked={() => {
            setPosts(prev => prev.filter(p => p.userId !== blockPost.userId));
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    alignSelf: 'flex-start',
  },
  checkedInText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  feedList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  checkInButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  checkInButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  newPostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    gap: 12,
  },
  currentUserImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  newPostInput: {
    flex: 1,
  },
  postCard: {
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  userImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  postUserInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFF',
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkInPrompt: {
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barTag: {
    fontSize: 12,
    fontWeight: '600',
  },
  friendActivitySection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  friendActivityList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  friendActivityCard: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    width: 100,
  },
  friendActivityImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
  },
  friendActivityName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 2,
  },
  friendActivityBar: {
    fontSize: 11,
    textAlign: 'center',
  },
  defaultAvatar: {
    backgroundColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  replyIndicatorText: {
    fontSize: 12,
  },
  reactionsRow: {
    marginBottom: 8,
  },
  addFriendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 20, 60, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  addFriendBannerSent: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  addFriendBannerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  viewRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    gap: 4,
  },
  viewRepliesText: {
    fontSize: 14,
    fontWeight: '500',
  },
  postMenuButton: {
    padding: 8,
    marginLeft: 4,
  },
  postMenu: {
    backgroundColor: '#252525',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  postMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  postMenuText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
});
