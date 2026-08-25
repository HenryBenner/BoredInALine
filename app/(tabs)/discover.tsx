import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Image, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Colors } from '@/constants/Colors';
import { barApi, Bar, getMediaUrl } from '@/utils/api';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentCrowdedness, getCrowdednessLabel } from '@/data/popularTimes';

type FilterType = 'all' | 'closest' | 'deals' | 'packed' | 'chill';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function DiscoverScreen() {
  const colors = Colors['dark'];
  const [activeFilter, setActiveFilter] = useState<FilterType>('closest');
  const [searchQuery, setSearchQuery] = useState('');
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      loadBars();
      loadUserLocation();
    }
  }, [authLoading]);

  const loadUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      }
    } catch (error) {
      console.log('Could not get location:', error);
    }
  };

  const loadBars = async () => {
    try {
      setLoading(true);
      const fetchedBars = await barApi.getBars();
      setBars(fetchedBars);
    } catch (error) {
      console.error('Failed to load bars:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriceLevel = (coverCharge: number) => {
    if (coverCharge === 0) return '$';
    if (coverCharge <= 5) return '$$';
    return '$$$';
  };

  const getBarDistance = (bar: Bar): number | null => {
    if (!userLocation || !bar.latitude || !bar.longitude) return null;
    return calculateDistance(userLocation.latitude, userLocation.longitude, bar.latitude, bar.longitude);
  };

  const filteredBars = bars
    .filter(bar => {
      const matchesSearch = bar.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeFilter === 'all' || activeFilter === 'closest') return true;
      if (activeFilter === 'deals') return bar.hasActiveDeals || (bar.specials && bar.specials.length > 0);
      const crowdLevel = getCurrentCrowdedness(bar.name);
      if (activeFilter === 'packed') return crowdLevel > 50;
      if (activeFilter === 'chill') return crowdLevel >= 0 && crowdLevel <= 50;
      return true;
    })
    .sort((a, b) => {
      if (activeFilter === 'closest' && userLocation) {
        const distA = getBarDistance(a);
        const distB = getBarDistance(b);
        if (distA === null && distB === null) return 0;
        if (distA === null) return 1;
        if (distB === null) return -1;
        return distA - distB;
      }
      return 0;
    });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <View style={[styles.searchBar, { backgroundColor: colors.searchBg }]}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search bars..."
            placeholderTextColor={colors.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {(['all', 'closest', 'deals', 'packed', 'chill'] as FilterType[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              { 
                backgroundColor: activeFilter === filter ? colors.scarlet : 'transparent',
                borderWidth: activeFilter === filter ? 0 : 1,
                borderColor: colors.border,
              }
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            {filter === 'closest' && (
              <IconSymbol name="location" size={16} color={activeFilter === filter ? '#FFF' : colors.lightGray} />
            )}
            {filter === 'deals' && (
              <IconSymbol name="dollarsign.circle" size={16} color={activeFilter === filter ? '#FFF' : colors.lightGray} />
            )}
            {filter === 'packed' && (
              <IconSymbol name="flame" size={16} color={activeFilter === filter ? '#FFF' : colors.lightGray} />
            )}
            <Text style={[
              styles.filterText,
              { color: activeFilter === filter ? '#FFF' : colors.lightGray }
            ]}>
              {filter === 'all' ? 'All Bars' : 
               filter === 'closest' ? 'Closest' :
               filter === 'deals' ? 'Best Deals' :
               filter === 'packed' ? 'Most Packed' : 'Chill Spots'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.barList} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.scarlet} />
          </View>
        ) : filteredBars.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.gray }]}>
              {activeFilter === 'packed' ? 'No bars are packed right now' :
               activeFilter === 'chill' ? 'No chill spots found right now' :
               'No bars found'}
            </Text>
          </View>
        ) : (
          filteredBars.map((bar) => {
            const deals = bar.activeDealTitles && bar.activeDealTitles.length > 0
              ? bar.activeDealTitles
              : [];
            const hasDeals = deals.length > 0;

            const isDealsView = activeFilter === 'deals';

            return (
              <TouchableOpacity
                key={bar.id}
                style={[styles.barCard, isDealsView && hasDeals && styles.barCardDeals]}
                onPress={() => router.push(`/bar/${bar.id}`)}
                activeOpacity={0.9}
              >
                {getMediaUrl(bar.imageUrl) ? (
                  <Image source={{ uri: getMediaUrl(bar.imageUrl)! }} style={styles.barImage} />
                ) : (
                  <View style={[styles.barImage, { backgroundColor: '#2C2C2C' }]} />
                )}

                <View style={[styles.imageOverlay, isDealsView && hasDeals && styles.imageOverlayDeals]} />

                {hasDeals && !isDealsView && (
                  <View style={styles.dealBadge}>
                    <Text style={styles.dealBadgeIcon}>🏷️</Text>
                    <Text style={styles.dealBadgeText}>DEALS TONIGHT</Text>
                  </View>
                )}

                {isDealsView && hasDeals ? (
                  <View style={styles.barContentDeals}>
                    <View style={styles.dealCardHeader}>
                      <Text style={styles.barNameDeals}>{bar.name}</Text>
                      <View style={styles.addressRow}>
                        <IconSymbol name="mappin" size={11} color="rgba(255,255,255,0.6)" />
                        {bar.address && <Text style={styles.addressText}>{bar.address}</Text>}
                        {getBarDistance(bar) !== null && (
                          <>
                            {bar.address && <Text style={styles.addressText}> · </Text>}
                            <IconSymbol name="location" size={11} color="rgba(255,255,255,0.6)" />
                            <Text style={styles.addressText}>{getBarDistance(bar)!.toFixed(1)} mi</Text>
                          </>
                        )}
                      </View>
                    </View>

                    <View style={styles.dealDivider} />

                    <View style={styles.dealList}>
                      {deals.map((deal, idx) => (
                        <View key={idx} style={styles.dealListItem}>
                          <View style={styles.dealListDot} />
                          <Text style={styles.dealListText}>{deal}</Text>
                        </View>
                      ))}
                    </View>

                    {bar.friendsHere > 0 && (
                      <View style={[styles.friendsTag, { marginTop: 10 }]}>
                        <IconSymbol name="person.2.fill" size={12} color="#FFF" />
                        <Text style={styles.friendsText}>{bar.friendsHere} friend{bar.friendsHere > 1 ? 's' : ''} here</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.barContent}>
                    {hasDeals && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        scrollEnabled={false}
                        pointerEvents="none"
                        style={styles.dealStrip}
                        contentContainerStyle={styles.dealStripContent}
                      >
                        {deals.map((deal, idx) => (
                          <View key={idx} style={styles.dealPill}>
                            <Text style={styles.dealPillText} numberOfLines={1}>{deal}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    )}

                    <Text style={styles.barName}>{bar.name}</Text>
                    {bar.address && (
                      <View style={styles.addressRow}>
                        <IconSymbol name="mappin" size={12} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.addressText}>{bar.address}</Text>
                      </View>
                    )}
                    <View style={styles.barMeta}>
                      <Text style={styles.metaText}>{getPriceLevel(bar.coverCharge || 0)}</Text>
                      <View style={styles.dot} />
                      <IconSymbol name="music.note" size={12} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.metaText}>{bar.musicType || 'Mixed'}</Text>
                      <View style={styles.dot} />
                      <Text style={styles.metaText}>{getCrowdednessLabel(getCurrentCrowdedness(bar.name))}</Text>
                    </View>

                    {bar.friendsHere > 0 && (
                      <View style={styles.friendsTag}>
                        <IconSymbol name="person.2.fill" size={12} color="#FFF" />
                        <Text style={styles.friendsText}>{bar.friendsHere} friend{bar.friendsHere > 1 ? 's' : ''}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 260,
    height: 85,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxHeight: 60,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  barList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  barCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 230,
    position: 'relative',
  },
  barCardDeals: {
    height: 'auto' as any,
    minHeight: 140,
  },
  barImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  imageOverlayDeals: {
    top: 0,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  barContentDeals: {
    padding: 18,
    paddingVertical: 20,
    minHeight: 140,
  },
  dealCardHeader: {
    marginBottom: 12,
  },
  barNameDeals: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  dealDivider: {
    height: 1,
    backgroundColor: 'rgba(220,20,60,0.5)',
    marginBottom: 12,
  },
  dealList: {
    gap: 8,
  },
  dealListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dealListDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC143C',
  },
  dealListText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
    flex: 1,
  },
  dealBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  dealBadgeIcon: {
    fontSize: 13,
  },
  dealBadgeText: {
    fontSize: 11,
    color: '#DC143C',
    fontWeight: '800',
    letterSpacing: 1,
  },
  dealStrip: {
    marginBottom: 10,
  },
  dealStripContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  dealPill: {
    backgroundColor: '#DC143C',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#DC143C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  dealPillText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  barContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  barName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  addressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  barMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  dot: {
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
  friendsText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
