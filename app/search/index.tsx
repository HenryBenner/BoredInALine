import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userApi, friendApi } from '../../utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface SearchResult {
  id: string;
  name: string;
  school?: string;
  profileImage: string;
  friendStatus: 'friends' | 'request_sent' | 'request_received' | 'none';
}

export default function SearchScreen() {
  const { refreshUser } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'friends' | 'pending'>('all');

  const handleSearch = async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const users = await userApi.searchUsers(searchQuery);
      setResults(users);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await friendApi.sendRequest(userId);
      setResults(prev =>
        prev.map(user =>
          user.id === userId ? { ...user, friendStatus: 'request_sent' } : user
        )
      );
    } catch (error) {
      console.error('Send request error:', error);
    }
  };

  const filteredResults = results.filter(user => {
    if (filter === 'friends') return user.friendStatus === 'friends';
    if (filter === 'pending') return user.friendStatus === 'request_sent' || user.friendStatus === 'request_received';
    return true;
  });

  const renderUser = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => router.push(`/profile/${item.id}`)}
    >
      <Image source={{ uri: item.profileImage }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        {item.school && <Text style={styles.userSchool}>From {item.school}</Text>}
      </View>
      {item.friendStatus === 'friends' ? (
        <View style={styles.friendsBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.friendsText}>Friends</Text>
        </View>
      ) : item.friendStatus === 'request_sent' ? (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      ) : item.friendStatus === 'request_received' ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={async () => {
            try {
              const requests = await friendApi.getPendingRequests();
              const request = requests.incoming.find(r => r.id === item.id);
              if (request) {
                await friendApi.acceptRequest(request.requestId);
                setResults(prev =>
                  prev.map(user =>
                    user.id === item.id ? { ...user, friendStatus: 'friends' } : user
                  )
                );
                await refreshUser();
                Alert.alert('Success', 'Friend request accepted!');
              } else {
                Alert.alert('Error', 'Could not find friend request');
              }
            } catch (error) {
              console.error('Accept request error:', error);
              Alert.alert('Error', 'Failed to accept friend request');
            }
          }}
        >
          <Text style={styles.addButtonText}>Accept</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleSendRequest(item.id)}
        >
          <Ionicons name="person-add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Friends</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            handleSearch(text);
          }}
          placeholder="Search by name or email..."
          placeholderTextColor="#666"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'friends' && styles.filterChipActive]}
          onPress={() => setFilter('friends')}
        >
          <Text style={[styles.filterText, filter === 'friends' && styles.filterTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'pending' && styles.filterChipActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
        </View>
      ) : filteredResults.length === 0 && query.length >= 2 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={48} color="#666" />
          <Text style={styles.emptyText}>No users found</Text>
        </View>
      ) : query.length < 2 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={48} color="#666" />
          <Text style={styles.emptyText}>Search for friends</Text>
          <Text style={styles.emptySubtext}>Type at least 2 characters</Text>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  filterChipActive: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userSchool: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  addButton: {
    backgroundColor: '#DC143C',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  friendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  pendingBadge: {
    backgroundColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pendingText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
});
