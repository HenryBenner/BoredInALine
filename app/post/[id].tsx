import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Image, RefreshControl, ActivityIndicator, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentCheckIn, postApi, Post, getMediaUrl, Reaction, friendApi } from '@/utils/api';
import { NewPostModal } from '@/components/NewPostModal';
import { EmojiPicker, ReactionDisplay } from '@/components/EmojiPicker';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors['dark'];
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [checkIn, setCheckIn] = useState<{ barId: string; barName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string; content: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);

  const loadPostData = useCallback(async () => {
    if (!id) return;
    
    try {
      const [fetchedPost, postReplies] = await Promise.all([
        postApi.getPostById(id),
        postApi.getReplies(id),
      ]);
      
      setPost(fetchedPost);
      setReplies(postReplies);
      
      if (isAuthenticated) {
        const currentCheckIn = await getCurrentCheckIn();
        setCheckIn(currentCheckIn);
      }
    } catch (error) {
      console.error('Failed to load post data:', error);
      Alert.alert('Error', 'Could not load post. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    loadPostData();
  }, [loadPostData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPostData();
  }, [loadPostData]);

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleLikeToggle = async (postId: string, currentlyLiked: boolean, isReply: boolean = false) => {
    const updatePosts = (posts: Post[]) =>
      posts.map(p =>
        p.id === postId
          ? { ...p, userLiked: !currentlyLiked, likes: currentlyLiked ? p.likes - 1 : p.likes + 1 }
          : p
      );

    if (isReply) {
      const previousReplies = replies;
      setReplies(updatePosts(replies));
      try {
        if (currentlyLiked) {
          await postApi.unlikePost(postId);
        } else {
          await postApi.likePost(postId);
        }
      } catch (error) {
        console.error('Failed to toggle like:', error);
        setReplies(previousReplies);
        Alert.alert('Error', 'Could not update like. Please try again.');
      }
    } else {
      const previousPost = post;
      if (post) {
        setPost({ ...post, userLiked: !currentlyLiked, likes: currentlyLiked ? post.likes - 1 : post.likes + 1 });
      }
      try {
        if (currentlyLiked) {
          await postApi.unlikePost(postId);
        } else {
          await postApi.likePost(postId);
        }
      } catch (error) {
        console.error('Failed to toggle like:', error);
        setPost(previousPost);
        Alert.alert('Error', 'Could not update like. Please try again.');
      }
    }
  };

  const handleReply = (targetPost: Post) => {
    if (!checkIn) {
      Alert.alert('Check In Required', 'You need to check in to a bar to reply to posts.');
      return;
    }
    setReplyingTo({
      id: targetPost.id,
      userName: targetPost.userName,
      content: targetPost.content,
    });
    setShowNewPostModal(true);
  };

  const handleCloseNewPostModal = () => {
    setShowNewPostModal(false);
    setReplyingTo(null);
  };

  const handleReactionToggle = async (postId: string, emoji: string, userReacted: boolean, isReply: boolean = false) => {
    if (!isAuthenticated) {
      Alert.alert('Account Required', 'Please sign in to react to posts.');
      return;
    }

    const updateReactions = (posts: Post[]) =>
      posts.map(p => {
        if (p.id !== postId) return p;
        const reactions = p.reactions || [];
        if (userReacted) {
          return {
            ...p,
            reactions: reactions.map(r =>
              r.emoji === emoji ? { ...r, count: r.count - 1, userReacted: false } : r
            ).filter(r => r.count > 0),
          };
        } else {
          const existing = reactions.find(r => r.emoji === emoji);
          if (existing) {
            return {
              ...p,
              reactions: reactions.map(r =>
                r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r
              ),
            };
          } else {
            return { ...p, reactions: [...reactions, { emoji, count: 1, userReacted: true }] };
          }
        }
      });

    if (isReply) {
      const previousReplies = replies;
      setReplies(updateReactions(replies));
      try {
        if (userReacted) {
          await postApi.removeReaction(postId, emoji);
        } else {
          await postApi.addReaction(postId, emoji);
        }
      } catch (error) {
        console.error('Failed to toggle reaction:', error);
        setReplies(previousReplies);
        Alert.alert('Error', 'Could not update reaction. Please try again.');
      }
    } else if (post) {
      const previousPost = post;
      const [updatedPost] = updateReactions([post]);
      setPost(updatedPost);
      try {
        if (userReacted) {
          await postApi.removeReaction(postId, emoji);
        } else {
          await postApi.addReaction(postId, emoji);
        }
      } catch (error) {
        console.error('Failed to toggle reaction:', error);
        setPost(previousPost);
        Alert.alert('Error', 'Could not update reaction. Please try again.');
      }
    }
  };

  const handleAddReaction = async (postId: string, emoji: string, isReply: boolean = false) => {
    if (!isAuthenticated) {
      Alert.alert('Account Required', 'Please sign in to react to posts.');
      return;
    }
    setShowEmojiPicker(null);
    await handleReactionToggle(postId, emoji, false, isReply);
  };

  const handleShare = async (targetPost: Post) => {
    try {
      const barInfo = targetPost.barName ? ` @ ${targetPost.barName}` : '';
      const message = `${targetPost.userName}${barInfo}: "${targetPost.content}"`;
      
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

  const handleAddFriend = async (targetPost: Post) => {
    if (!isAuthenticated) {
      Alert.alert('Account Required', 'Please sign in to add friends.');
      return;
    }
    
    if (!targetPost.userId) {
      return;
    }

    const updateRequestSent = (posts: Post[], sent: boolean) =>
      posts.map(p => p.id === targetPost.id ? { ...p, requestSent: sent } : p);

    if (post?.id === targetPost.id) {
      setPost({ ...post, requestSent: true });
    } else {
      setReplies(prev => updateRequestSent(prev, true));
    }

    try {
      await friendApi.sendRequest(targetPost.userId);
      Alert.alert('Request Sent', `Friend request sent to ${targetPost.userName}!`);
    } catch (error: any) {
      if (post?.id === targetPost.id) {
        setPost({ ...post, requestSent: false });
      } else {
        setReplies(prev => updateRequestSent(prev, false));
      }
      Alert.alert('Error', error?.message || 'Could not send friend request.');
    }
  };

  const renderPost = (postItem: Post, isMainPost: boolean = false) => (
    <View 
      key={postItem.id} 
      style={[styles.postCard, { backgroundColor: colors.card }, isMainPost && styles.mainPostCard]}
    >
      <View style={styles.postHeader}>
        {postItem.userImage ? (
          <Image source={{ uri: getMediaUrl(postItem.userImage) || postItem.userImage }} style={styles.userImage} />
        ) : (
          <View style={[styles.defaultAvatar, styles.userImage]}>
            <Ionicons name="person" size={22} color="#666" />
          </View>
        )}
        <View style={styles.postUserInfo}>
          <Text style={styles.userName}>{postItem.userName}</Text>
          <View style={styles.postMeta}>
            {postItem.barName && (
              <Text style={[styles.barTag, { color: colors.scarlet }]}>
                @ {postItem.barName}
              </Text>
            )}
            <Text style={[styles.timestamp, { color: colors.gray }]}>
              {formatTimeAgo(postItem.timestamp)}
            </Text>
          </View>
        </View>
      </View>

      {postItem.replyToUserName && (
        <View style={styles.replyIndicator}>
          <IconSymbol name="arrowshape.turn.up.left.fill" size={12} color={colors.gray} />
          <Text style={[styles.replyIndicatorText, { color: colors.gray }]}>
            Replying to {postItem.replyToUserName}
          </Text>
        </View>
      )}

      <Text style={styles.postContent}>{postItem.content}</Text>

      {postItem.imageUrl && getMediaUrl(postItem.imageUrl) && (
        <Image source={{ uri: getMediaUrl(postItem.imageUrl)! }} style={styles.postImage} />
      )}

      {(postItem.reactions?.length ?? 0) > 0 && (
        <View style={styles.reactionsRow}>
          <ReactionDisplay
            reactions={postItem.reactions || []}
            onReactionPress={(emoji, userReacted) => handleReactionToggle(postItem.id, emoji, userReacted, !isMainPost)}
            onAddPress={() => setShowEmojiPicker(postItem.id)}
          />
        </View>
      )}

      {isAuthenticated && postItem.userId && postItem.userId !== user?.id && !postItem.isFriend && (
        <TouchableOpacity
          style={[
            styles.addFriendBanner,
            postItem.requestSent && styles.addFriendBannerSent
          ]}
          onPress={() => handleAddFriend(postItem)}
          disabled={postItem.requestSent}
        >
          <Ionicons 
            name={postItem.requestSent ? "checkmark-circle" : "person-add"} 
            size={18} 
            color={postItem.requestSent ? colors.gray : "#FFF"} 
          />
          <Text style={[
            styles.addFriendBannerText,
            postItem.requestSent && { color: colors.gray }
          ]}>
            {postItem.requestSent ? 'Request Sent' : `Add ${postItem.userName}`}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.postFooter}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLikeToggle(postItem.id, postItem.userLiked, !isMainPost)}
        >
          <IconSymbol 
            name={postItem.userLiked ? "heart.fill" : "heart"} 
            size={22} 
            color={postItem.userLiked ? colors.scarlet : colors.lightGray} 
          />
          <Text style={[styles.actionText, { color: postItem.userLiked ? colors.scarlet : colors.lightGray }]}>
            {postItem.likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleReply(postItem)}
        >
          <IconSymbol name="bubble.left" size={20} color={colors.lightGray} />
          {(postItem.replyCount ?? 0) > 0 && (
            <Text style={[styles.actionText, { color: colors.lightGray }]}>
              {postItem.replyCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowEmojiPicker(postItem.id)}
        >
          <Ionicons name="happy-outline" size={20} color={colors.lightGray} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleShare(postItem)}
        >
          <Ionicons name="share-outline" size={20} color={colors.lightGray} />
        </TouchableOpacity>
      </View>

      <EmojiPicker
        visible={showEmojiPicker === postItem.id}
        onClose={() => setShowEmojiPicker(null)}
        onSelect={(emoji) => handleAddReaction(postItem.id, emoji, !isMainPost)}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.scarlet} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.gray }}>Post not found</Text>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: colors.scarlet, marginTop: 16 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.scarlet}
          />
        }
      >
        {renderPost(post, true)}

        <View style={styles.repliesSection}>
          <Text style={styles.repliesTitle}>
            {replies.length > 0 ? `${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}` : 'No replies yet'}
          </Text>
          
          {checkIn && (
            <TouchableOpacity 
              style={[styles.replyPrompt, { backgroundColor: colors.card }]}
              onPress={() => handleReply(post)}
            >
              <Text style={{ color: colors.gray }}>Write a reply...</Text>
            </TouchableOpacity>
          )}

          {replies.map((reply) => renderPost(reply, false))}
        </View>
      </ScrollView>

      {checkIn && (
        <NewPostModal
          visible={showNewPostModal}
          onClose={handleCloseNewPostModal}
          barId={checkIn.barId}
          onPostCreated={loadPostData}
          replyTo={replyingTo}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backArrow: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  postCard: {
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
  },
  mainPostCard: {
    borderWidth: 1,
    borderColor: 'rgba(220, 20, 60, 0.3)',
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
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barTag: {
    fontSize: 12,
    fontWeight: '600',
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
  reactionsRow: {
    marginBottom: 8,
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
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  replyIndicatorText: {
    fontSize: 12,
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
  defaultAvatar: {
    backgroundColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  repliesSection: {
    paddingBottom: 40,
  },
  repliesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  replyPrompt: {
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
