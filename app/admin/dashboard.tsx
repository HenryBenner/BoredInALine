import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
  Platform,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { barAdminApi, getMediaUrl, Deal, Event } from '../../utils/api';

const PRICE_LEVELS = [1, 2, 3, 4];
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type TabType = 'profile' | 'deals' | 'events' | 'moderation';

export default function AdminDashboard() {
  const { isBarAdmin, barAdmin, adminBar, logout, updateAdminBar } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [musicType, setMusicType] = useState('');
  const [coverCharge, setCoverCharge] = useState('');
  const [specials, setSpecials] = useState('');
  const [barNote, setBarNote] = useState('');
  const [priceLevel, setPriceLevel] = useState(2);
  const [hidden, setHidden] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [showDealModal, setShowDealModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const [dealTitle, setDealTitle] = useState('');
  const [dealDescription, setDealDescription] = useState('');
  const [dealDayOfWeek, setDealDayOfWeek] = useState(0);
  const [dealStartTime, setDealStartTime] = useState('');
  const [dealEndTime, setDealEndTime] = useState('');
  const [dealIsActive, setDealIsActive] = useState(true);

  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventCoverCharge, setEventCoverCharge] = useState('');
  const [eventIsPublished, setEventIsPublished] = useState(false);

  useEffect(() => {
    if (adminBar) {
      setName(adminBar.name || '');
      setAddress(adminBar.address || '');
      setMusicType(adminBar.musicType || '');
      setCoverCharge(adminBar.coverCharge?.toString() || '');
      setSpecials(adminBar.specials?.join(', ') || '');
      setBarNote(adminBar.barNote || '');
      setPriceLevel(adminBar.priceLevel || 2);
      setHidden(adminBar.hidden || false);
      setImageUrl(adminBar.imageUrl);
    }
  }, [adminBar]);

  useEffect(() => {
    if (!isBarAdmin) return;
    if (activeTab === 'deals') {
      loadDeals();
    } else if (activeTab === 'events') {
      loadEvents();
    }
  }, [activeTab, isBarAdmin]);

  const loadDeals = async () => {
    setLoadingDeals(true);
    try {
      const data = await barAdminApi.getDeals();
      setDeals(data);
    } catch (error) {
      console.error('Failed to load deals:', error);
    } finally {
      setLoadingDeals(false);
    }
  };

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const data = await barAdminApi.getEvents();
      setEvents(data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Bar name is required');
      return;
    }

    setSaving(true);
    try {
      const specialsArray = specials
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const updatedBar = await barAdminApi.updateBar({
        name: name.trim(),
        address: address.trim(),
        musicType: musicType.trim() || null,
        coverCharge: coverCharge ? parseFloat(coverCharge) : null,
        specials: specialsArray,
        barNote: barNote.trim() || null,
        priceLevel,
        hidden,
        imageUrl,
      });

      updateAdminBar(updatedBar);
      Alert.alert('Success', 'Bar information updated successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      try {
        const asset = result.assets[0];
        const response = await barAdminApi.uploadBarImage(
          asset.uri,
          asset.mimeType || 'image/jpeg'
        );
        setImageUrl(response.imageUrl);
      } catch (error) {
        Alert.alert('Error', 'Failed to upload image');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        await logout();
        router.replace('/auth/login');
      }
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Out',
            style: 'destructive',
            onPress: async () => {
              await logout();
              router.replace('/auth/login');
            },
          },
        ]
      );
    }
  };

  const openDealModal = (deal?: Deal) => {
    if (deal) {
      setEditingDeal(deal);
      setDealTitle(deal.title);
      setDealDescription(deal.description || '');
      setDealDayOfWeek(deal.dayOfWeek);
      setDealStartTime(deal.startTime || '');
      setDealEndTime(deal.endTime || '');
      setDealIsActive(deal.isActive);
    } else {
      setEditingDeal(null);
      setDealTitle('');
      setDealDescription('');
      setDealDayOfWeek(0);
      setDealStartTime('');
      setDealEndTime('');
      setDealIsActive(true);
    }
    setShowDealModal(true);
  };

  const saveDeal = async () => {
    if (!dealTitle.trim()) {
      Alert.alert('Error', 'Deal title is required');
      return;
    }

    setSaving(true);
    try {
      const dealData = {
        title: dealTitle.trim(),
        description: dealDescription.trim() || null,
        dayOfWeek: dealDayOfWeek,
        startTime: dealStartTime || null,
        endTime: dealEndTime || null,
        isActive: dealIsActive,
      };

      if (editingDeal) {
        await barAdminApi.updateDeal(editingDeal.id, dealData);
      } else {
        await barAdminApi.createDeal(dealData);
      }

      setShowDealModal(false);
      loadDeals();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save deal');
    } finally {
      setSaving(false);
    }
  };

  const deleteDeal = async (id: string) => {
    const doDelete = async () => {
      try {
        await barAdminApi.deleteDeal(id);
        loadDeals();
      } catch (error) {
        if (Platform.OS === 'web') {
          window.alert('Failed to delete deal');
        } else {
          Alert.alert('Error', 'Failed to delete deal');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this deal?')) {
        await doDelete();
      }
    } else {
      Alert.alert(
        'Delete Deal',
        'Are you sure you want to delete this deal?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const openEventModal = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setEventTitle(event.title);
      setEventDescription(event.description || '');
      setEventDate(event.eventDate ? event.eventDate.split('T')[0] : '');
      setEventStartTime(event.startTime || '');
      setEventEndTime(event.endTime || '');
      setEventCoverCharge(event.coverCharge?.toString() || '');
      setEventIsPublished(event.isPublished);
    } else {
      setEditingEvent(null);
      setEventTitle('');
      setEventDescription('');
      setEventDate('');
      setEventStartTime('');
      setEventEndTime('');
      setEventCoverCharge('');
      setEventIsPublished(false);
    }
    setShowEventModal(true);
  };

  const saveEvent = async () => {
    if (!eventTitle.trim() || !eventDate) {
      Alert.alert('Error', 'Event title and date are required');
      return;
    }

    setSaving(true);
    try {
      const eventData = {
        title: eventTitle.trim(),
        description: eventDescription.trim() || null,
        eventDate: eventDate,
        startTime: eventStartTime || null,
        endTime: eventEndTime || null,
        coverCharge: eventCoverCharge ? parseFloat(eventCoverCharge) : 0,
        imageUrl: null,
        isPublished: eventIsPublished,
      };

      if (editingEvent) {
        await barAdminApi.updateEvent(editingEvent.id, eventData);
      } else {
        await barAdminApi.createEvent(eventData);
      }

      setShowEventModal(false);
      loadEvents();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: string) => {
    const doDelete = async () => {
      try {
        await barAdminApi.deleteEvent(id);
        loadEvents();
      } catch (error) {
        if (Platform.OS === 'web') {
          window.alert('Failed to delete event');
        } else {
          Alert.alert('Error', 'Failed to delete event');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this event?')) {
        await doDelete();
      }
    } else {
      Alert.alert(
        'Delete Event',
        'Are you sure you want to delete this event?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  if (!isBarAdmin || !adminBar) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#DC143C" />
      </View>
    );
  }

  const displayImageUrl = getMediaUrl(imageUrl);

  const renderProfileTab = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bar Image</Text>
        <TouchableOpacity onPress={pickImage} style={styles.imagePickerContainer}>
          {uploadingImage ? (
            <View style={styles.imagePlaceholder}>
              <ActivityIndicator size="large" color="#DC143C" />
            </View>
          ) : displayImageUrl ? (
            <Image source={{ uri: displayImageUrl }} style={styles.barImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera" size={48} color="#666" />
              <Text style={styles.imagePlaceholderText}>Tap to add image</Text>
            </View>
          )}
          <View style={styles.imageOverlay}>
            <Ionicons name="camera" size={20} color="#FFF" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bar Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter bar name"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter address"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Music Type</Text>
          <TextInput
            style={styles.input}
            value={musicType}
            onChangeText={setMusicType}
            placeholder="e.g., Top 40, Hip Hop, Country"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cover Charge ($)</Text>
          <TextInput
            style={styles.input}
            value={coverCharge}
            onChangeText={setCoverCharge}
            placeholder="0"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Price Level</Text>
        <View style={styles.priceLevelContainer}>
          {PRICE_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.priceLevelButton,
                priceLevel === level && styles.priceLevelButtonActive,
              ]}
              onPress={() => setPriceLevel(level)}
            >
              <Text
                style={[
                  styles.priceLevelText,
                  priceLevel === level && styles.priceLevelTextActive,
                ]}
              >
                {'$'.repeat(level)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Specials</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={specials}
          onChangeText={setSpecials}
          placeholder="Enter specials separated by commas (e.g., $3 Wells, $2 Beers)"
          placeholderTextColor="#666"
          multiline
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bar Note</Text>
        <Text style={styles.sectionDescription}>
          This note will be displayed on your bar's profile in the app
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={barNote}
          onChangeText={setBarNote}
          placeholder="Add a note for visitors (e.g., Happy Hour 5-7pm, Live DJ Fridays)"
          placeholderTextColor="#666"
          multiline
        />
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Hide from Discover</Text>
            <Text style={styles.switchDescription}>
              When enabled, your bar won't appear in the Discover page
            </Text>
          </View>
          <Switch
            value={hidden}
            onValueChange={setHidden}
            trackColor={{ false: '#3C3C3C', true: '#DC143C' }}
            thumbColor={hidden ? '#FFFFFF' : '#F4F3F4'}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderDealsTab = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Deals</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openDealModal()}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loadingDeals ? (
        <ActivityIndicator size="large" color="#DC143C" style={{ marginTop: 40 }} />
      ) : deals.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="pricetag-outline" size={48} color="#666" />
          <Text style={styles.emptyStateText}>No deals yet</Text>
          <Text style={styles.emptyStateSubtext}>Tap the + button to add your first deal</Text>
        </View>
      ) : (
        deals.map((deal) => (
          <View key={deal.id} style={styles.itemCard}>
            <View style={styles.itemCardHeader}>
              <View style={styles.itemCardInfo}>
                <Text style={styles.itemCardTitle}>{deal.title}</Text>
                <Text style={styles.itemCardSubtitle}>{DAYS_OF_WEEK[deal.dayOfWeek]}</Text>
                {(deal.startTime || deal.endTime) && (
                  <Text style={styles.itemCardTime}>
                    {deal.startTime || '?'} - {deal.endTime || '?'}
                  </Text>
                )}
              </View>
              <View style={styles.itemCardActions}>
                <View style={[styles.statusBadge, deal.isActive ? styles.statusActive : styles.statusInactive]}>
                  <Text style={styles.statusText}>{deal.isActive ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
            </View>
            {deal.description && (
              <Text style={styles.itemCardDescription}>{deal.description}</Text>
            )}
            <View style={styles.itemCardFooter}>
              <TouchableOpacity style={styles.editButton} onPress={() => openDealModal(deal)}>
                <Ionicons name="pencil" size={18} color="#DC143C" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteDeal(deal.id)}>
                <Ionicons name="trash" size={18} color="#FF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </>
  );

  const renderEventsTab = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Events</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openEventModal()}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loadingEvents ? (
        <ActivityIndicator size="large" color="#DC143C" style={{ marginTop: 40 }} />
      ) : events.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color="#666" />
          <Text style={styles.emptyStateText}>No events yet</Text>
          <Text style={styles.emptyStateSubtext}>Tap the + button to add your first event</Text>
        </View>
      ) : (
        events.map((event) => (
          <View key={event.id} style={styles.itemCard}>
            <View style={styles.itemCardHeader}>
              <View style={styles.itemCardInfo}>
                <Text style={styles.itemCardTitle}>{event.title}</Text>
                <Text style={styles.itemCardSubtitle}>
                  {event.eventDate ? new Date(event.eventDate).toLocaleDateString() : 'No date'}
                </Text>
                {(event.startTime || event.endTime) && (
                  <Text style={styles.itemCardTime}>
                    {event.startTime || '?'} - {event.endTime || '?'}
                  </Text>
                )}
                {event.coverCharge > 0 && (
                  <Text style={styles.itemCardCover}>${event.coverCharge} cover</Text>
                )}
              </View>
              <View style={styles.itemCardActions}>
                <View style={[styles.statusBadge, event.isPublished ? styles.statusActive : styles.statusInactive]}>
                  <Text style={styles.statusText}>{event.isPublished ? 'Published' : 'Draft'}</Text>
                </View>
              </View>
            </View>
            {event.description && (
              <Text style={styles.itemCardDescription}>{event.description}</Text>
            )}
            <View style={styles.itemCardFooter}>
              <TouchableOpacity style={styles.editButton} onPress={() => openEventModal(event)}>
                <Ionicons name="pencil" size={18} color="#DC143C" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteEvent(event.id)}>
                <Ionicons name="trash" size={18} color="#FF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Bar Admin</Text>
          <Text style={styles.headerSubtitle}>{barAdmin?.name || 'Admin'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#DC143C" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons name="business" size={20} color={activeTab === 'profile' ? '#DC143C' : '#9CA3AF'} />
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'deals' && styles.tabActive]}
          onPress={() => setActiveTab('deals')}
        >
          <Ionicons name="pricetag" size={20} color={activeTab === 'deals' ? '#DC143C' : '#9CA3AF'} />
          <Text style={[styles.tabText, activeTab === 'deals' && styles.tabTextActive]}>Deals</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Ionicons name="calendar" size={20} color={activeTab === 'events' ? '#DC143C' : '#9CA3AF'} />
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>Events</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'moderation' && styles.tabActive]}
          onPress={() => setActiveTab('moderation')}
        >
          <Ionicons name="shield" size={20} color={activeTab === 'moderation' ? '#DC143C' : '#9CA3AF'} />
          <Text style={[styles.tabText, activeTab === 'moderation' && styles.tabTextActive]}>Reports</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'deals' && renderDealsTab()}
        {activeTab === 'events' && renderEventsTab()}
        {activeTab === 'moderation' && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <Ionicons name="shield-checkmark" size={64} color="#DC143C" />
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>Content Moderation</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>Review and manage user reports, remove inappropriate content, and maintain community standards.</Text>
            <TouchableOpacity
              style={{ backgroundColor: '#DC143C', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
              onPress={() => router.push('/admin/moderation')}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>View Reports</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={showDealModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingDeal ? 'Edit Deal' : 'New Deal'}</Text>
              <TouchableOpacity onPress={() => setShowDealModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={dealTitle}
                  onChangeText={setDealTitle}
                  placeholder="e.g., $3 Well Drinks"
                  placeholderTextColor="#666"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={dealDescription}
                  onChangeText={setDealDescription}
                  placeholder="Optional description"
                  placeholderTextColor="#666"
                  multiline
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Day of Week</Text>
                <View style={styles.dayPicker}>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayButton, dealDayOfWeek === index && styles.dayButtonActive]}
                      onPress={() => setDealDayOfWeek(index)}
                    >
                      <Text style={[styles.dayButtonText, dealDayOfWeek === index && styles.dayButtonTextActive]}>
                        {day.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Start Time</Text>
                  <TextInput
                    style={styles.input}
                    value={dealStartTime}
                    onChangeText={setDealStartTime}
                    placeholder="e.g., 17:00"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>End Time</Text>
                  <TextInput
                    style={styles.input}
                    value={dealEndTime}
                    onChangeText={setDealEndTime}
                    placeholder="e.g., 21:00"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch
                  value={dealIsActive}
                  onValueChange={setDealIsActive}
                  trackColor={{ false: '#3C3C3C', true: '#DC143C' }}
                  thumbColor={dealIsActive ? '#FFFFFF' : '#F4F3F4'}
                />
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveDeal}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>{editingDeal ? 'Update Deal' : 'Create Deal'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEventModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingEvent ? 'Edit Event' : 'New Event'}</Text>
              <TouchableOpacity onPress={() => setShowEventModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="e.g., Live DJ Night"
                  placeholderTextColor="#666"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={eventDescription}
                  onChangeText={setEventDescription}
                  placeholder="Optional description"
                  placeholderTextColor="#666"
                  multiline
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Event Date *</Text>
                <TextInput
                  style={styles.input}
                  value={eventDate}
                  onChangeText={setEventDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#666"
                />
              </View>
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Start Time</Text>
                  <TextInput
                    style={styles.input}
                    value={eventStartTime}
                    onChangeText={setEventStartTime}
                    placeholder="e.g., 21:00"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>End Time</Text>
                  <TextInput
                    style={styles.input}
                    value={eventEndTime}
                    onChangeText={setEventEndTime}
                    placeholder="e.g., 02:00"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cover Charge ($)</Text>
                <TextInput
                  style={styles.input}
                  value={eventCoverCharge}
                  onChangeText={setEventCoverCharge}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Publish Event</Text>
                <Switch
                  value={eventIsPublished}
                  onValueChange={setEventIsPublished}
                  trackColor={{ false: '#3C3C3C', true: '#DC143C' }}
                  thumbColor={eventIsPublished ? '#FFFFFF' : '#F4F3F4'}
                />
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveEvent}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>{editingEvent ? 'Update Event' : 'Create Event'}</Text>
              )}
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
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: '#1C1C1C',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1C',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#DC143C',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#DC143C',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#DC143C',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  barImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#1C1C1C',
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#1C1C1C',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    color: '#666',
    marginTop: 8,
    fontSize: 14,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  priceLevelContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  priceLevelButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  priceLevelButtonActive: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
  },
  priceLevelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  priceLevelTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1C',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    maxWidth: '80%',
  },
  saveButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  itemCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemCardInfo: {
    flex: 1,
  },
  itemCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemCardSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  itemCardTime: {
    fontSize: 13,
    color: '#DC143C',
    marginTop: 4,
  },
  itemCardCover: {
    fontSize: 13,
    color: '#4ADE80',
    marginTop: 4,
  },
  itemCardDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  itemCardActions: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  statusInactive: {
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2C',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    color: '#DC143C',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  dayPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
  },
  dayButtonActive: {
    backgroundColor: '#DC143C',
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  dayButtonTextActive: {
    color: '#FFFFFF',
  },
});
