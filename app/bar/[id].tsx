import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView, Modal, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { checkIn, checkOut, getCurrentCheckIn, getCheckedInUsers, barApi, Bar, BarDeal, BarEvent, getMediaUrl, ApiClient, chatApi, Reaction, friendApi } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { EmojiPicker, ReactionDisplay } from '@/components/EmojiPicker';
import { getCurrentCrowdedness, getCrowdednessLabel, getCrowdednessColor } from '@/data/popularTimes';

interface CheckedInUser {
  id: string;
  name: string;
  profileImage: string;
  isFriend: boolean;
}

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

export default function BarProfileScreen() {
  const { id } = useLocalSearchParams();
  const colors = Colors['dark'];
  const { user, isGuest, isAuthenticated, isLoading: authLoading } = useAuth();
  const { requestLocation, loading: locationLoading, error: locationError, resetError } = useLocation();
  const { joinBar, leaveBar, sendMessage: sendSocketMessage, messages: socketMessages, connected } = useSocket();
  const { pickImage, takePhoto, uploadMedia, uploading } = useMediaUpload();
  
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedInUsers, setCheckedInUsers] = useState<{ friends: CheckedInUser[], others: CheckedInUser[], total: number } | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [bar, setBar] = useState<Bar | null>(null);
  const [loadingBar, setLoadingBar] = useState(true);
  const [deals, setDeals] = useState<BarDeal[]>([]);
  const [events, setEvents] = useState<BarEvent[]>([]);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatExpanded, setChatExpanded] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatInitialized, setChatInitialized] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const lastConnectionRef = useRef<boolean>(false);
  
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInPhoto, setCheckInPhoto] = useState<{ uri: string; mimeType: string } | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<{ id: string; userName: string; message: string } | null>(null);
  const [showChatEmojiPicker, setShowChatEmojiPicker] = useState<string | null>(null);
  const [friendRequestsSent, setFriendRequestsSent] = useState<Set<string>>(new Set());

  const handleShareBar = async () => {
    try {
      await Share.share({
        message: `Check out ${bar?.name}! ${bar?.address || ''}\n\nFind the vibe on Bored in Line 🍻`,
        title: bar?.name,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleShareDeal = async (deal: BarDeal) => {
    try {
      await Share.share({
        message: `🍺 Deal at ${bar?.name}: ${deal.title}${deal.description ? '\n' + deal.description : ''}\n\nFound on Bored in Line`,
        title: `Deal at ${bar?.name}`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3958.8;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getDistanceText = (): string => {
    if (!userLocation || !bar?.latitude || !bar?.longitude) {
      return '--';
    }
    const dist = calculateDistance(userLocation.latitude, userLocation.longitude, bar.latitude, bar.longitude);
    return dist.toFixed(2);
  };

  useEffect(() => {
    const fetchUserLocation = async () => {
      const coords = await requestLocation();
      if (coords) {
        setUserLocation({ latitude: coords.latitude, longitude: coords.longitude });
      }
    };
    fetchUserLocation();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadBar();
      if (isAuthenticated) {
        loadCheckInStatus();
        loadCheckedInUsers();
      }
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    const barId = id as string;
    
    if (isCheckedIn && barId && connected) {
      const wasDisconnected = lastConnectionRef.current === false && connected === true;
      lastConnectionRef.current = connected;
      
      if (!chatInitialized) {
        loadChatMessages();
        joinBar(barId);
        setChatInitialized(true);
      } else if (wasDisconnected) {
        joinBar(barId);
      }
    } else {
      lastConnectionRef.current = connected;
    }
  }, [isCheckedIn, id, connected, chatInitialized]);

  useEffect(() => {
    const barId = id as string;
    
    return () => {
      if (chatInitialized && barId) {
        leaveBar(barId);
      }
      setChatMessages([]);
      setChatInitialized(false);
    };
  }, [id]);

  useEffect(() => {
    if (socketMessages.length > 0 && isCheckedIn && chatInitialized) {
      setChatMessages((prev) => {
        const newMessages = socketMessages.filter(
          (newMsg) => !prev.some((existingMsg) => existingMsg.id === newMsg.id)
        );
        if (newMessages.length === 0) return prev;
        return [...prev, ...newMessages];
      });
      scrollChatToBottom();
    }
  }, [socketMessages, isCheckedIn, chatInitialized]);

  const loadChatMessages = async () => {
    if (!id) return;
    setLoadingChat(true);
    try {
      const response = await ApiClient.get<ChatMessage[]>(`/chat/${id}/messages`);
      setChatMessages(response);
      scrollChatToBottom();
    } catch (error) {
      console.error('Failed to load chat messages:', error);
    } finally {
      setLoadingChat(false);
    }
  };

  const scrollChatToBottom = () => {
    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !id || !isCheckedIn) return;
    sendSocketMessage(id as string, chatMessage.trim(), undefined, replyingToMessage?.id);
    setChatMessage('');
    setReplyingToMessage(null);
    scrollChatToBottom();
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

  const handleChatReactionToggle = async (messageId: string, emoji: string, userReacted: boolean) => {
    const barId = id as string;
    const previousMessages = chatMessages;
    
    setChatMessages(prevMessages =>
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
        await chatApi.removeReaction(barId, messageId, emoji);
      } else {
        await chatApi.addReaction(barId, messageId, emoji);
      }
    } catch (error) {
      console.error('Failed to toggle chat reaction:', error);
      setChatMessages(previousMessages);
      Alert.alert('Error', 'Could not update reaction. Please try again.');
    }
  };

  const handleAddChatReaction = async (messageId: string, emoji: string) => {
    setShowChatEmojiPicker(null);
    await handleChatReactionToggle(messageId, emoji, false);
  };

  const formatChatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const loadBar = async () => {
    try {
      setLoadingBar(true);
      const [fetchedBar, fetchedDeals, fetchedEvents] = await Promise.all([
        barApi.getBarById(id as string),
        barApi.getBarDeals(id as string).catch(() => []),
        barApi.getBarEvents(id as string).catch(() => []),
      ]);
      setBar(fetchedBar);
      setDeals(fetchedDeals);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error('Failed to load bar:', error);
    } finally {
      setLoadingBar(false);
    }
  };

  const loadCheckInStatus = async () => {
    if (!isAuthenticated) return;
    
    try {
      const currentCheckIn = await getCurrentCheckIn();
      setIsCheckedIn(currentCheckIn?.barId === id);
    } catch (error) {
      console.error('Failed to load check-in status:', error);
    }
  };

  const loadCheckedInUsers = async () => {
    if (!isAuthenticated) return;
    
    setLoadingUsers(true);
    try {
      const users = await getCheckedInUsers(id as string);
      setCheckedInUsers(users);
    } catch (error) {
      console.error('Failed to load checked-in users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddFriend = async (userId: string, userName: string) => {
    if (friendRequestsSent.has(userId)) return;
    
    setFriendRequestsSent(prev => new Set(prev).add(userId));
    
    try {
      await friendApi.sendRequest(userId);
      Alert.alert('Request Sent', `Friend request sent to ${userName}!`);
    } catch (error: any) {
      setFriendRequestsSent(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      Alert.alert('Error', error?.message || 'Could not send friend request.');
    }
  };

  const handleCheckInPress = () => {
    if (!isAuthenticated) {
      if (Platform.OS === 'web') {
        if (window.confirm('Please create an account to check in to bars. Would you like to sign up?')) {
          router.push('/auth/register');
        }
      } else {
        Alert.alert('Account Required', 'Please create an account to check in to bars.', [
          { text: 'Cancel' },
          { text: 'Sign Up', onPress: () => router.push('/auth/register') }
        ]);
      }
      return;
    }
    setShowCheckInModal(true);
  };

  const handleTakeCheckInPhoto = async () => {
    const result = await takePhoto();
    if (result) {
      setCheckInPhoto({ uri: result.uri, mimeType: result.mimeType });
    }
  };

  const handleConfirmCheckIn = async () => {
    setCheckingIn(true);
    resetError();

    const coords = await requestLocation();
    if (!coords) {
      setCheckingIn(false);
      if (locationError) {
        Alert.alert('Location Error', locationError.message);
      }
      return;
    }

    try {
      let photoUrl: string | undefined;
      
      if (checkInPhoto) {
        const uploadResult = await uploadMedia(checkInPhoto.uri, checkInPhoto.mimeType);
        photoUrl = uploadResult.publicUrl;
      }

      await checkIn(id as string, coords.latitude, coords.longitude, photoUrl);
      setIsCheckedIn(true);
      setShowCheckInModal(false);
      setCheckInPhoto(null);
      loadCheckedInUsers();
      Alert.alert(
        'Tapped In!', 
        `You're now tapped in at ${bar?.name}. Chat is now unlocked!`,
        [
          {
            text: 'Go to Chat',
            onPress: () => router.replace('/(tabs)/chat'),
          },
        ]
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to check in';
      const distance = error.response?.data?.distance;
      
      // Check if it's a distance-related error
      if (errorMessage.includes('within half a mile') || distance) {
        const distanceMiles = distance ? (distance / 1609).toFixed(1) : null;
        const distanceText = distanceMiles ? ` You are currently about ${distanceMiles} miles away.` : '';
        const message = `You need to be closer to ${bar?.name} to tap in.${distanceText} Get within half a mile and try again!`;
        
        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert('Too Far Away', message);
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(errorMessage);
        } else {
          Alert.alert('Check-In Failed', errorMessage);
        }
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (isGuest) return;

    try {
      setIsCheckedIn(false);
      
      if (chatInitialized && id) {
        leaveBar(id as string);
        setChatMessages([]);
        setChatInitialized(false);
      }
      
      await checkOut();
      Alert.alert('Tapped Out', `You've left ${bar?.name}.`);
      loadCheckedInUsers();
    } catch (error: any) {
      setIsCheckedIn(true);
      const message = error.response?.data?.error || 'Failed to check out';
      Alert.alert('Check-Out Failed', message);
    }
  };

  if (loadingBar) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.scarlet} />
      </View>
    );
  }

  if (!bar) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#FFF' }}>Bar not found</Text>
        <TouchableOpacity 
          style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.scarlet, borderRadius: 8 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getCrowdText = (level: string) => {
    switch (level) {
      case 'empty': return 'Chill';
      case 'moderate': return 'Moderate';
      case 'packed': return 'Busy';
      case 'very-packed': return 'Packed';
      default: return 'Moderate';
    }
  };

  const getPriceLevel = (priceLevel?: number) => {
    return '$'.repeat(priceLevel || 2);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return 'TBD';
    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T12:00:00');
    if (isNaN(date.getTime())) return 'TBD';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          {getMediaUrl(bar.imageUrl) ? (
            <Image source={{ uri: getMediaUrl(bar.imageUrl)! }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: '#2C2C2C' }]} />
          )}
          <View style={styles.heroOverlay} />
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={handleShareBar}
          >
            <Ionicons name="share-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.heroContent}>
            <Text style={styles.barName}>{bar.name}</Text>
            <View style={styles.barQuickInfo}>
              <Text style={styles.quickInfoText}>{getPriceLevel(bar.priceLevel)}</Text>
              <View style={styles.infoDot} />
              <IconSymbol name="music.note" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.quickInfoText}>{bar.musicType}</Text>
              <View style={styles.infoDot} />
              <Text style={styles.quickInfoText}>{getCrowdText(bar.crowdLevel)}</Text>
            </View>
            {bar.friendsHere > 0 && (
              <View style={styles.friendsTag}>
                <IconSymbol name="person.2.fill" size={14} color="#FFF" />
                <Text style={styles.friendsTagText}>{bar.friendsHere} friends here</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.crowdCard, { backgroundColor: colors.card }]}>
            <View style={styles.crowdHeader}>
              <Text style={styles.crowdLabel}>Crowd Level</Text>
              <Text style={[styles.crowdValue, { color: getCrowdednessColor(getCurrentCrowdedness(bar.name)) }]}>
                {getCrowdednessLabel(getCurrentCrowdedness(bar.name))}
              </Text>
            </View>
            <View style={styles.crowdBarBg}>
              <View 
                style={[
                  styles.crowdBarFill, 
                  { 
                    backgroundColor: getCrowdednessColor(getCurrentCrowdedness(bar.name)),
                    width: getCurrentCrowdedness(bar.name) >= 0 ? `${Math.max(getCurrentCrowdedness(bar.name), 5)}%` : '0%'
                  }
                ]} 
              />
            </View>
          </View>

          {bar.barNote && (
            <View style={[styles.barNoteCard, { backgroundColor: colors.card }]}>
              <View style={styles.barNoteHeader}>
                <Ionicons name="megaphone" size={18} color={colors.scarlet} />
                <Text style={styles.barNoteTitle}>From the bar</Text>
              </View>
              <Text style={styles.barNoteText}>{bar.barNote}</Text>
            </View>
          )}

          <View style={[styles.infoGrid, { backgroundColor: colors.card }]}>
            <View style={styles.infoItem}>
              <IconSymbol name="music.note" size={22} color={colors.scarlet} />
              <Text style={[styles.infoLabel, { color: colors.gray }]}>Music</Text>
              <Text style={styles.infoValue}>{bar.musicType}</Text>
            </View>
            <View style={[styles.infoItemDivider, { backgroundColor: colors.border }]} />
            <View style={styles.infoItem}>
              <IconSymbol name="dollarsign.circle" size={22} color={colors.scarlet} />
              <Text style={[styles.infoLabel, { color: colors.gray }]}>Cover</Text>
              <Text style={styles.infoValue}>${bar.coverCharge}</Text>
            </View>
            <View style={[styles.infoItemDivider, { backgroundColor: colors.border }]} />
            <View style={styles.infoItem}>
              <IconSymbol name="mappin.circle" size={22} color={colors.scarlet} />
              <Text style={[styles.infoLabel, { color: colors.gray }]}>Distance</Text>
              <Text style={styles.infoValue}>{getDistanceText()} mi</Text>
            </View>
          </View>

          {deals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Deals</Text>
              <View style={[styles.specialsCard, { backgroundColor: colors.card }]}>
                {deals.map((deal, index) => (
                  <View key={deal.id}>
                    <View style={styles.specialItem}>
                      <Text style={styles.specialIcon}>🍺</Text>
                      <View style={styles.dealContent}>
                        <Text style={styles.specialText}>{deal.title}</Text>
                        {deal.description && (
                          <Text style={[styles.dealDescription, { color: colors.gray }]}>{deal.description}</Text>
                        )}
                        {deal.start_time && deal.end_time && (
                          <Text style={[styles.dealTime, { color: colors.scarlet }]}>
                            {formatTime(deal.start_time)} - {formatTime(deal.end_time)}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity 
                        style={styles.dealShareButton}
                        onPress={() => handleShareDeal(deal)}
                      >
                        <Ionicons name="share-outline" size={18} color={colors.gray} />
                      </TouchableOpacity>
                    </View>
                    {index < deals.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {events.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              {events.map((event) => (
                <View key={event.id} style={[styles.eventCard, { backgroundColor: colors.card }]}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.cover_charge > 0 && (
                      <View style={[styles.coverBadge, { backgroundColor: colors.scarlet }]}>
                        <Text style={styles.coverText}>${event.cover_charge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.eventDate, { color: colors.gray }]}>
                    {formatEventDate(event.event_date)}
                    {event.start_time && ` • ${formatTime(event.start_time)}`}
                  </Text>
                  {event.description && (
                    <Text style={[styles.eventDescription, { color: colors.lightGray }]}>{event.description}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {bar.specials.length > 0 && deals.length === 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specials</Text>
              <View style={[styles.specialsCard, { backgroundColor: colors.card }]}>
                {bar.specials.map((special, index) => (
                  <View key={index}>
                    <View style={styles.specialItem}>
                      <Text style={styles.specialIcon}>🍺</Text>
                      <Text style={styles.specialText}>{special}</Text>
                    </View>
                    {index < bar.specials.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {!isGuest && checkedInUsers && checkedInUsers.total > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {checkedInUsers.total} {checkedInUsers.total === 1 ? 'Person' : 'People'} Here Now
              </Text>
              
              {checkedInUsers.friends.length > 0 && (
                <View style={styles.subsection}>
                  <Text style={[styles.subsectionTitle, { color: colors.gray }]}>Friends</Text>
                  {checkedInUsers.friends.map((friend) => (
                    <View key={friend.id} style={[styles.userItem, { backgroundColor: colors.card }]}>
                      <Image source={{ uri: friend.profileImage }} style={styles.userImage} />
                      <Text style={styles.userName}>{friend.name}</Text>
                      <View style={[styles.friendBadge, { backgroundColor: colors.scarlet }]}>
                        <IconSymbol name="person.fill" size={12} color="#FFF" />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {checkedInUsers.others.length > 0 && (
                <View style={styles.subsection}>
                  <Text style={[styles.subsectionTitle, { color: colors.gray }]}>Others</Text>
                  {checkedInUsers.others.slice(0, 5).map((person) => (
                    <View key={person.id} style={[styles.userItem, { backgroundColor: colors.card }]}>
                      {person.profileImage ? (
                        <Image source={{ uri: getMediaUrl(person.profileImage) || person.profileImage }} style={styles.userImage} />
                      ) : (
                        <View style={[styles.defaultAvatarSmall, styles.userImage]}>
                          <Ionicons name="person" size={16} color="#666" />
                        </View>
                      )}
                      <Text style={styles.userName}>{person.name}</Text>
                      {person.id !== user?.id && (
                        <TouchableOpacity
                          style={[
                            styles.addFriendBadge,
                            friendRequestsSent.has(person.id) && styles.addFriendBadgeSent
                          ]}
                          onPress={() => handleAddFriend(person.id, person.name)}
                          disabled={friendRequestsSent.has(person.id)}
                        >
                          <Ionicons 
                            name={friendRequestsSent.has(person.id) ? "checkmark" : "person-add"} 
                            size={14} 
                            color={friendRequestsSent.has(person.id) ? colors.gray : "#FFF"} 
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {checkedInUsers.others.length > 5 && (
                    <Text style={[styles.moreText, { color: colors.gray }]}>
                      +{checkedInUsers.others.length - 5} more
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {isCheckedIn && (
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.chatHeader}
                onPress={() => setChatExpanded(!chatExpanded)}
              >
                <View style={styles.chatHeaderLeft}>
                  <IconSymbol name="message.fill" size={20} color={colors.scarlet} />
                  <Text style={styles.sectionTitle}>Live Chat</Text>
                  {connected && (
                    <View style={[styles.liveDot, { backgroundColor: '#4CAF50' }]} />
                  )}
                </View>
                <IconSymbol 
                  name={chatExpanded ? "chevron.up" : "chevron.down"} 
                  size={18} 
                  color={colors.gray} 
                />
              </TouchableOpacity>

              {chatExpanded && (
                <View style={[styles.chatContainer, { backgroundColor: colors.card }]}>
                  <Text style={[styles.chatNote, { color: colors.gray }]}>
                    Messages disappear when the night ends 👻
                  </Text>

                  {loadingChat ? (
                    <View style={styles.chatLoading}>
                      <ActivityIndicator size="small" color={colors.scarlet} />
                    </View>
                  ) : (
                    <ScrollView 
                      ref={chatScrollRef}
                      style={styles.chatMessages}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {chatMessages.length === 0 ? (
                        <Text style={[styles.noMessages, { color: colors.gray }]}>
                          No messages yet. Be the first to say something!
                        </Text>
                      ) : (
                        chatMessages.map((msg) => {
                          const isOwnMessage = msg.userId === user?.id;
                          return (
                            <TouchableOpacity 
                              key={msg.id} 
                              style={styles.chatMessageRow}
                              onPress={() => handleReplyToMessage(msg)}
                              activeOpacity={0.7}
                            >
                              <Image source={{ uri: msg.userImage }} style={styles.chatUserImage} />
                              <View style={styles.chatMessageContent}>
                                <View style={styles.chatMessageHeader}>
                                  <Text style={styles.chatUserName}>
                                    {isOwnMessage ? 'You' : msg.userName}
                                  </Text>
                                  <Text style={[styles.chatTime, { color: colors.gray }]}>
                                    {formatChatTime(msg.timestamp)}
                                  </Text>
                                </View>
                                {msg.replyToUserName && (
                                  <View style={styles.chatReplyIndicator}>
                                    <IconSymbol name="arrowshape.turn.up.left.fill" size={10} color={colors.gray} />
                                    <Text style={[styles.chatReplyText, { color: colors.gray }]} numberOfLines={1}>
                                      Replying to {msg.replyToUserName}: {msg.replyToMessage || '[Image]'}
                                    </Text>
                                  </View>
                                )}
                                <View style={[
                                  styles.chatBubble,
                                  { backgroundColor: isOwnMessage ? colors.scarlet : '#2C2C2C' }
                                ]}>
                                  {msg.imageUrl && (
                                    <Image 
                                      source={{ uri: msg.imageUrl }} 
                                      style={styles.chatImagePreview}
                                      resizeMode="cover"
                                    />
                                  )}
                                  {msg.message && (
                                    <Text style={styles.chatMessageText}>{msg.message}</Text>
                                  )}
                                </View>
                                <View style={styles.chatReactionsRow}>
                                  <ReactionDisplay
                                    reactions={msg.reactions || []}
                                    onReactionPress={(emoji, userReacted) => handleChatReactionToggle(msg.id, emoji, userReacted)}
                                    onAddPress={() => setShowChatEmojiPicker(msg.id)}
                                  />
                                </View>
                                <EmojiPicker
                                  visible={showChatEmojiPicker === msg.id}
                                  onClose={() => setShowChatEmojiPicker(null)}
                                  onSelect={(emoji) => handleAddChatReaction(msg.id, emoji)}
                                />
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  )}

                  {replyingToMessage && (
                    <View style={styles.chatReplyPreview}>
                      <View style={styles.chatReplyPreviewContent}>
                        <Text style={styles.chatReplyPreviewLabel}>Replying to {replyingToMessage.userName}</Text>
                        <Text style={styles.chatReplyPreviewText} numberOfLines={1}>{replyingToMessage.message}</Text>
                      </View>
                      <TouchableOpacity onPress={cancelReply} style={styles.chatReplyPreviewClose}>
                        <IconSymbol name="xmark" size={16} color={colors.gray} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={[styles.chatInputContainer, { borderTopColor: colors.border }]}>
                    <TextInput
                      style={[styles.chatInput, { backgroundColor: '#2C2C2C', color: '#FFF' }]}
                      placeholder={replyingToMessage ? `Reply to ${replyingToMessage.userName}...` : "Send a message..."}
                      placeholderTextColor={colors.gray}
                      value={chatMessage}
                      onChangeText={setChatMessage}
                      onSubmitEditing={handleSendMessage}
                      returnKeyType="send"
                    />
                    <TouchableOpacity 
                      style={[
                        styles.chatSendButton, 
                        { backgroundColor: chatMessage.trim() ? colors.scarlet : '#2C2C2C' }
                      ]}
                      onPress={handleSendMessage}
                      disabled={!chatMessage.trim()}
                    >
                      <IconSymbol 
                        name="paperplane.fill" 
                        size={16} 
                        color={chatMessage.trim() ? "#FFF" : colors.gray} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {isCheckedIn ? (
            <TouchableOpacity 
              style={[styles.checkOutButton, { backgroundColor: colors.card, borderColor: colors.scarlet }]}
              onPress={handleCheckOut}
              disabled={checkingIn}
            >
              <IconSymbol name="location.fill" size={22} color={colors.scarlet} />
              <Text style={[styles.checkOutButtonText, { color: colors.scarlet }]}>
                Tapped In • Tap to Leave
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[
                styles.checkInButton, 
                { backgroundColor: checkingIn ? colors.card : colors.scarlet }
              ]}
              onPress={handleCheckInPress}
              disabled={checkingIn || locationLoading}
            >
              {checkingIn || locationLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <IconSymbol name="checkmark.circle.fill" size={22} color="#FFF" />
                  <Text style={styles.checkInButtonText}>
                    {!isAuthenticated ? 'Create Account to Tap In' : 'Tap In Here'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showCheckInModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCheckInModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.checkInModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.checkInModalHeader}>
              <Text style={styles.checkInModalTitle}>Tap In to {bar?.name}</Text>
              <TouchableOpacity onPress={() => { setShowCheckInModal(false); setCheckInPhoto(null); }}>
                <IconSymbol name="xmark" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.checkInModalSubtitle, { color: colors.gray }]}>
              Add a photo to share with friends (optional)
            </Text>

            {checkInPhoto ? (
              <View style={styles.checkInPhotoPreview}>
                <Image source={{ uri: checkInPhoto.uri }} style={styles.checkInPhotoImage} />
                <TouchableOpacity 
                  style={styles.removePhotoButton}
                  onPress={() => setCheckInPhoto(null)}
                >
                  <IconSymbol name="xmark.circle.fill" size={28} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.photoOptionButton, { backgroundColor: colors.background, width: '100%', marginBottom: 16 }]}
                onPress={handleTakeCheckInPhoto}
              >
                <IconSymbol name="camera" size={32} color={colors.scarlet} />
                <Text style={styles.photoOptionText}>Take Photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[
                styles.confirmCheckInButton, 
                { backgroundColor: (checkingIn || uploading) ? colors.gray : colors.scarlet }
              ]}
              onPress={handleConfirmCheckIn}
              disabled={checkingIn || uploading}
            >
              {checkingIn || uploading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmCheckInText}>
                  {checkInPhoto ? 'Tap In with Photo' : 'Tap In Without Photo'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelCheckInButton}
              onPress={() => { setShowCheckInModal(false); setCheckInPhoto(null); }}
              disabled={checkingIn || uploading}
            >
              <Text style={styles.cancelCheckInText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    height: 400,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  shareButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dealShareButton: {
    padding: 8,
    marginLeft: 8,
  },
  heroContent: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  barName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  barQuickInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  quickInfoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  infoDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  friendsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  friendsTagText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  crowdCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  crowdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  crowdLabel: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  crowdValue: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
  crowdBarBg: {
    height: 8,
    backgroundColor: 'rgba(220,20,60,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  crowdBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  crowdSubtext: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  infoItemDivider: {
    width: 1,
    marginHorizontal: 12,
  },
  infoLabel: {
    fontSize: 12,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  specialsCard: {
    borderRadius: 16,
    padding: 16,
  },
  specialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  specialIcon: {
    fontSize: 24,
  },
  specialText: {
    fontSize: 15,
    color: '#FFF',
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  postCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  postUserImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  postUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  postContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#FFF',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
    marginBottom: 40,
  },
  checkInButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  checkOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
    marginBottom: 40,
    borderWidth: 2,
  },
  checkOutButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  subsection: {
    marginTop: 12,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  userImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
  },
  friendBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFriendBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(220, 20, 60, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFriendBadgeSent: {
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
  },
  defaultAvatarSmall: {
    backgroundColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 13,
    paddingLeft: 12,
    marginTop: 4,
  },
  dealContent: {
    flex: 1,
  },
  dealDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  dealTime: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  eventCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  eventDate: {
    fontSize: 14,
    marginBottom: 6,
  },
  eventDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  coverBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  coverText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  chatContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  chatNote: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  chatLoading: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMessages: {
    maxHeight: 300,
    paddingHorizontal: 12,
  },
  noMessages: {
    textAlign: 'center',
    paddingVertical: 40,
    fontSize: 14,
  },
  chatMessageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  chatUserImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  chatMessageContent: {
    flex: 1,
  },
  chatMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatUserName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  chatTime: {
    fontSize: 11,
  },
  chatBubble: {
    padding: 10,
    borderRadius: 12,
    borderTopLeftRadius: 4,
  },
  chatMessageText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#FFF',
  },
  chatImagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 6,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 14,
  },
  chatSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatReplyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  chatReplyText: {
    fontSize: 11,
    flex: 1,
  },
  chatReactionsRow: {
    marginTop: 4,
  },
  chatReplyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#1A1A1A',
    borderLeftWidth: 3,
    borderLeftColor: '#DC143C',
  },
  chatReplyPreviewContent: {
    flex: 1,
  },
  chatReplyPreviewLabel: {
    fontSize: 12,
    color: '#DC143C',
    fontWeight: '600',
    marginBottom: 2,
  },
  chatReplyPreviewText: {
    fontSize: 13,
    color: '#888',
  },
  chatReplyPreviewClose: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  checkInModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  checkInModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  checkInModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  checkInModalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  checkInPhotoOptions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  photoOptionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 16,
    gap: 8,
  },
  photoOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  checkInPhotoPreview: {
    position: 'relative',
    marginBottom: 24,
    alignItems: 'center',
  },
  checkInPhotoImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
  },
  confirmCheckInButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmCheckInText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelCheckInButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelCheckInText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#888',
  },
  barNoteCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  barNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  barNoteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC143C',
  },
  barNoteText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFF',
  },
});
