import { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert, ImageBackground } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentCheckIn, getMediaUrl, chatApi, Reaction } from '@/utils/api';
import { ApiClient } from '@/utils/api';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { EmojiPicker, ReactionDisplay } from '@/components/EmojiPicker';
import { ReportModal } from '@/components/ReportModal';
import { BlockConfirmModal } from '@/components/BlockConfirmModal';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  message: string | null;
  imageUrl?: string | null;
  timestamp: string;
  replyToId?: string | null;
  replyToMessage?: string | null;
  replyToUserName?: string | null;
  reactions?: Reaction[];
}

function ChatVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, player => {
    player.loop = false;
  });

  return (
    <VideoView
      style={{ width: '100%', height: 200, borderRadius: 12 }}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

export default function ChatScreen() {
  const colors = Colors['dark'];
  const router = useRouter();
  const { isGuest, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { joinBar, leaveBar, sendMessage: sendSocketMessage, messages: socketMessages, currentBarId } = useSocket();
  const { pickImage, takePhoto, uploadMedia, uploading, progress } = useMediaUpload();
  
  const [checkIn, setCheckIn] = useState<{ barId: string; barName: string; barImage?: string } | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; mimeType: string; type: 'image' | 'video' } | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<{ id: string; userName: string; message: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [openMenuMsgId, setOpenMenuMsgId] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<ChatMessage | null>(null);
  const [blockMessage, setBlockMessage] = useState<ChatMessage | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) {
        return;
      }
      
      if (isAuthenticated) {
        loadCheckInStatus();
      } else {
        setLoading(false);
      }
    }, [isAuthenticated, authLoading])
  );

  useEffect(() => {
    if (checkIn?.barId) {
      setMessages([]);
      loadMessages();

      return () => {
        if (checkIn.barId) {
          leaveBar(checkIn.barId);
        }
      };
    }
  }, [checkIn]);

  useEffect(() => {
    if (socketMessages.length > 0) {
      setMessages((prev) => {
        const newMessages = socketMessages.filter(
          (newMsg) => !prev.some((existingMsg) => existingMsg.id === newMsg.id)
        );
        return [...prev, ...newMessages];
      });
      scrollToBottom();
    }
  }, [socketMessages]);

  const loadCheckInStatus = async () => {
    if (isGuest || !isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const currentCheckIn = await getCurrentCheckIn();
      if (currentCheckIn) {
        const barDetails = await ApiClient.get<{ imageUrl?: string }>(`/bars/${currentCheckIn.barId}`);
        setCheckIn({
          barId: currentCheckIn.barId,
          barName: currentCheckIn.barName,
          barImage: barDetails.imageUrl ? getMediaUrl(barDetails.imageUrl) || undefined : undefined,
        });
      }
    } catch (error) {
      console.error('Failed to load check-in status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!checkIn?.barId) return;

    try {
      const response = await ApiClient.get<ChatMessage[]>(`/chat/${checkIn.barId}/messages`);
      setMessages(response);
      
      joinBar(checkIn.barId);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const isVideo = (url: string | null | undefined): boolean => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('.mp4') || lowerUrl.includes('.mov') || 
           lowerUrl.includes('.avi') || lowerUrl.includes('.webm') ||
           lowerUrl.includes('video/');
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && !selectedMedia) || !checkIn?.barId) return;

    if (selectedMedia) {
      setSendingImage(true);
      try {
        const uploadResult = await uploadMedia(selectedMedia.uri, selectedMedia.mimeType);
        sendSocketMessage(checkIn.barId, message.trim(), uploadResult.publicUrl, replyingToMessage?.id);
        setSelectedMedia(null);
      } catch (error) {
        console.error('Failed to upload media:', error);
      } finally {
        setSendingImage(false);
      }
    } else {
      sendSocketMessage(checkIn.barId, message.trim(), undefined, replyingToMessage?.id);
    }
    
    setMessage('');
    setReplyingToMessage(null);
    scrollToBottom();
  };

  const handleReplyToMessage = (msg: ChatMessage) => {
    setReplyingToMessage({
      id: msg.id,
      userName: msg.userName,
      message: msg.message || '[Image]',
    });
  };

  const cancelReply = () => {
    setReplyingToMessage(null);
  };

  const handleReactionToggle = async (messageId: string, emoji: string, userReacted: boolean) => {
    if (!checkIn?.barId) return;
    
    const previousMessages = messages;
    setMessages(prevMessages =>
      prevMessages.map(msg => {
        if (msg.id !== messageId) return msg;
        const reactions = msg.reactions || [];
        if (userReacted) {
          return {
            ...msg,
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
              ...msg,
              reactions: reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, userReacted: true }
                  : r
              ),
            };
          } else {
            return {
              ...msg,
              reactions: [...reactions, { emoji, count: 1, userReacted: true }],
            };
          }
        }
      })
    );

    try {
      if (userReacted) {
        await chatApi.removeReaction(checkIn.barId, messageId, emoji);
      } else {
        await chatApi.addReaction(checkIn.barId, messageId, emoji);
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      setMessages(previousMessages);
      Alert.alert('Error', 'Could not update reaction. Please try again.');
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    setShowEmojiPicker(null);
    await handleReactionToggle(messageId, emoji, false);
  };

  const handlePickImage = async () => {
    setShowMediaPicker(false);
    const result = await pickImage();
    if (result) {
      setSelectedMedia(result);
    }
  };

  const handleTakePhoto = async () => {
    setShowMediaPicker(false);
    const result = await takePhoto();
    if (result) {
      setSelectedMedia(result);
    }
  };

  const removeSelectedMedia = () => {
    setSelectedMedia(null);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={styles.headerTitle}>Chat</Text>
        {checkIn ? (
          <View style={[styles.checkedInBadge, { backgroundColor: colors.scarlet }]}>
            <View style={styles.onlineDot} />
            <Text style={styles.checkedInText}>{checkIn.barName}</Text>
          </View>
        ) : (
          <Text style={[styles.headerSubtitle, { color: colors.gray }]}>
            {isGuest ? 'Create an account to chat' : 'Tap in to unlock chat'}
          </Text>
        )}
      </View>

      {!checkIn || loading ? (
        <View style={styles.lockedState}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={[styles.lockedText, { color: colors.gray }]}>
            {isGuest 
              ? 'Chat is only available for registered users' 
              : 'Chat is only available when you\'re tapped in'}
          </Text>
          <TouchableOpacity 
            style={[styles.checkInButton, { backgroundColor: colors.scarlet }]}
            onPress={() => router.push(isGuest ? '/auth/register' : '/(tabs)/discover')}
          >
            <Text style={styles.checkInButtonText}>
              {isGuest ? 'Sign Up to Chat' : 'Find a Bar to Tap In'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ImageBackground
          source={checkIn.barImage ? { uri: checkIn.barImage } : undefined}
          style={styles.chatBackground}
          imageStyle={styles.chatBackgroundImage}
        >
          <View style={styles.chatBackgroundOverlay} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.chatContainer}
            keyboardVerticalOffset={100}
          >
            <ScrollView 
              ref={scrollViewRef}
              style={styles.messageList} 
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
            >
              <View style={styles.chatInfo}>
                <Text style={[styles.chatInfoText, { color: 'rgba(255,255,255,0.8)' }]}>
                  Messages disappear when the night ends 👻
                </Text>
              </View>

            {messages.map((chat) => {
              const isOwnMessage = chat.userId === user?.id;
              return (
                <View 
                  key={chat.id} 
                  style={styles.messageContainer}
                >
                  <TouchableOpacity 
                    onPress={() => !isOwnMessage && router.push(`/profile/${chat.userId}`)}
                    disabled={isOwnMessage}
                  >
                    <Image source={{ uri: chat.userImage }} style={styles.messageUserImage} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.messageContent}
                    onPress={() => {
                      setOpenMenuMsgId(null);
                      handleReplyToMessage(chat);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.messageHeader}>
                      <TouchableOpacity 
                        onPress={() => !isOwnMessage && router.push(`/profile/${chat.userId}`)}
                        disabled={isOwnMessage}
                      >
                        <Text style={styles.messageName}>
                          {isOwnMessage ? 'You' : chat.userName}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.messageHeaderRight}>
                        <Text style={[styles.messageTime, { color: colors.gray }]}>
                          {formatTime(chat.timestamp)}
                        </Text>
                        {!isOwnMessage && (
                          <TouchableOpacity
                            style={styles.msgMenuButton}
                            onPress={() => setOpenMenuMsgId(openMenuMsgId === chat.id ? null : chat.id)}
                          >
                            <Ionicons name="ellipsis-horizontal" size={16} color={colors.gray} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {openMenuMsgId === chat.id && (
                      <View style={styles.msgMenu}>
                        <TouchableOpacity
                          style={styles.msgMenuItem}
                          onPress={() => {
                            setOpenMenuMsgId(null);
                            setReportMessage(chat);
                          }}
                        >
                          <Ionicons name="flag-outline" size={16} color="#FFF" />
                          <Text style={styles.msgMenuText}>Report Message</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.msgMenuItem}
                          onPress={() => {
                            setOpenMenuMsgId(null);
                            setBlockMessage(chat);
                          }}
                        >
                          <Ionicons name="ban-outline" size={16} color="#DC143C" />
                          <Text style={[styles.msgMenuText, { color: '#DC143C' }]}>Block {chat.userName}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {chat.replyToUserName && (
                      <View style={styles.replyIndicator}>
                        <Ionicons name="arrow-undo" size={10} color={colors.gray} />
                        <Text style={[styles.replyText, { color: colors.gray }]} numberOfLines={1}>
                          Replying to {chat.replyToUserName}: {chat.replyToMessage || '[Image]'}
                        </Text>
                      </View>
                    )}
                    <View style={[
                      styles.messageBubble, 
                      { backgroundColor: isOwnMessage ? colors.scarlet : colors.card }
                    ]}>
                      {chat.imageUrl && (
                        isVideo(chat.imageUrl) ? (
                          <ChatVideoPlayer uri={getMediaUrl(chat.imageUrl) || chat.imageUrl} />
                        ) : (
                          <Image 
                            source={{ uri: getMediaUrl(chat.imageUrl) || chat.imageUrl }} 
                            style={styles.chatImage}
                            resizeMode="cover"
                          />
                        )
                      )}
                      {chat.message && (
                        <Text style={[styles.messageText, chat.imageUrl && { marginTop: 8 }]}>
                          {chat.message}
                        </Text>
                      )}
                    </View>
                    <View style={styles.messageActions}>
                      <ReactionDisplay
                        reactions={chat.reactions || []}
                        onReactionPress={(emoji, userReacted) => handleReactionToggle(chat.id, emoji, userReacted)}
                        onAddPress={() => setShowEmojiPicker(chat.id)}
                      />
                      {(chat.reactions?.length ?? 0) === 0 && (
                        <TouchableOpacity 
                          style={styles.addReactionButton}
                          onPress={() => setShowEmojiPicker(chat.id)}
                        >
                          <Ionicons name="happy-outline" size={16} color={colors.gray} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <EmojiPicker
                      visible={showEmojiPicker === chat.id}
                      onClose={() => setShowEmojiPicker(null)}
                      onSelect={(emoji) => handleAddReaction(chat.id, emoji)}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          {selectedMedia && (
            <View style={styles.selectedImageContainer}>
              {selectedMedia.type === 'video' ? (
                <View style={[styles.selectedImage, styles.videoPlaceholder]}>
                  <IconSymbol name="video" size={32} color="#FFF" />
                </View>
              ) : (
                <Image source={{ uri: selectedMedia.uri }} style={styles.selectedImage} />
              )}
              <TouchableOpacity 
                style={styles.removeImageButton}
                onPress={removeSelectedMedia}
              >
                <IconSymbol name="xmark.circle.fill" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {replyingToMessage && (
            <View style={[styles.replyPreview, { backgroundColor: colors.card, borderLeftColor: colors.scarlet }]}>
              <View style={styles.replyPreviewContent}>
                <Text style={styles.replyPreviewLabel}>Replying to {replyingToMessage.userName}</Text>
                <Text style={[styles.replyPreviewText, { color: colors.gray }]} numberOfLines={1}>
                  {replyingToMessage.message}
                </Text>
              </View>
              <TouchableOpacity onPress={cancelReply} style={styles.replyPreviewClose}>
                <Ionicons name="close" size={18} color={colors.gray} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <TouchableOpacity 
              style={[styles.mediaButton, { backgroundColor: colors.card }]}
              onPress={() => setShowMediaPicker(true)}
              disabled={sendingImage || uploading}
            >
              <IconSymbol name="photo" size={20} color={colors.gray} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: '#FFF' }]}
              placeholder={replyingToMessage ? `Reply to ${replyingToMessage.userName}...` : "Message..."}
              placeholderTextColor={colors.gray}
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                { backgroundColor: (message.trim() || selectedMedia) ? colors.scarlet : colors.card }
              ]}
              onPress={handleSendMessage}
              disabled={(!message.trim() && !selectedMedia) || sendingImage || uploading}
            >
              {sendingImage || uploading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <IconSymbol name="paperplane.fill" size={18} color={(message.trim() || selectedMedia) ? "#FFF" : colors.gray} />
              )}
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </ImageBackground>
      )}

      <Modal
        visible={showMediaPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMediaPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMediaPicker(false)}
        >
          <View style={[styles.mediaPickerSheet, { backgroundColor: colors.card }]}>
            <View style={styles.mediaPickerHandle} />
            <TouchableOpacity 
              style={styles.mediaPickerOption}
              onPress={handleTakePhoto}
            >
              <IconSymbol name="camera" size={24} color="#FFF" />
              <Text style={styles.mediaPickerText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.mediaPickerOption}
              onPress={handlePickImage}
            >
              <IconSymbol name="photo" size={24} color="#FFF" />
              <Text style={styles.mediaPickerText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.mediaPickerOption, styles.cancelOption]}
              onPress={() => setShowMediaPicker(false)}
            >
              <Text style={[styles.mediaPickerText, { color: colors.scarlet }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {reportMessage && (
        <ReportModal
          visible={!!reportMessage}
          onClose={() => setReportMessage(null)}
          onReported={() => {
            setMessages(prev => prev.filter(m => m.id !== reportMessage.id));
            setReportMessage(null);
          }}
          contentType="chat_message"
          contentId={reportMessage.id}
          reportedUserId={reportMessage.userId}
          reportedUserName={reportMessage.userName}
        />
      )}

      {blockMessage && (
        <BlockConfirmModal
          visible={!!blockMessage}
          onClose={() => setBlockMessage(null)}
          userId={blockMessage.userId}
          userName={blockMessage.userName}
          onBlocked={() => {
            setMessages(prev => prev.filter(m => m.userId !== blockMessage.userId));
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
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  checkedInText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  lockedState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  lockEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  lockedText: {
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
  chatBackground: {
    flex: 1,
  },
  chatBackgroundImage: {
    opacity: 0.3,
  },
  chatBackgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.7)',
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  chatInfo: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  chatInfoText: {
    fontSize: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  messageUserImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  messageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  messageTime: {
    fontSize: 11,
  },
  messageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  msgMenuButton: {
    padding: 4,
  },
  msgMenu: {
    backgroundColor: '#2C2C2C',
    borderRadius: 10,
    padding: 4,
    marginBottom: 8,
    minWidth: 180,
  },
  msgMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  msgMenuText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#FFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  chatVideo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  selectedImageContainer: {
    padding: 12,
    position: 'relative',
  },
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  videoPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    left: 84,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  mediaPickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  mediaPickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  mediaPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  mediaPickerText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelOption: {
    justifyContent: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  replyText: {
    fontSize: 11,
    flex: 1,
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    minHeight: 24,
  },
  addReactionButton: {
    padding: 4,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 12,
  },
  replyPreviewClose: {
    padding: 4,
  },
});
