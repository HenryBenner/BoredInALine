import { Bar, User, Post, ChatMessage } from '@/types';

export const mockBars: Bar[] = [
  {
    id: '1',
    name: 'Threes',
    address: '2247 N High St',
    musicType: 'Top 40 and Throwbacks',
    coverCharge: 5,
    crowdLevel: 'packed',
    distance: 0.2,
    friendsHere: 14,
    specials: ['$3 Wells', '$2 Domestic Bottles'],
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
    rating: 4.3
  },
  {
    id: '2',
    name: 'Midway',
    address: '1728 N High St',
    musicType: 'Hip Hop and Top 40',
    coverCharge: 10,
    crowdLevel: 'very-packed',
    distance: 0.1,
    friendsHere: 22,
    specials: ['$4 Long Islands', 'DJ at 10pm'],
    imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800',
    rating: 4.5
  },
  {
    id: '3',
    name: 'Ethyl and Tank',
    address: '19 E 13th Ave',
    musicType: 'Mixed',
    coverCharge: 0,
    crowdLevel: 'moderate',
    distance: 0.3,
    friendsHere: 6,
    specials: ['$3 Drafts', 'Half Price Burgers'],
    imageUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800',
    rating: 4.2
  },
  {
    id: '4',
    name: 'Big Bar',
    address: '1716 N High St',
    musicType: 'EDM and Top 40',
    coverCharge: 5,
    crowdLevel: 'packed',
    distance: 0.1,
    friendsHere: 18,
    specials: ['$5 Buckets', 'College Night Deals'],
    imageUrl: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800',
    rating: 4.4
  },
  {
    id: '5',
    name: 'The Library',
    address: '2169 N High St',
    musicType: 'Rock and Alt',
    coverCharge: 0,
    crowdLevel: 'moderate',
    distance: 0.4,
    friendsHere: 4,
    specials: ['$2 PBRs', 'Trivia Tuesday'],
    imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800',
    rating: 4.1
  },
  {
    id: '6',
    name: 'The Horseshoe',
    address: '2615 N High St',
    musicType: 'Country and Top 40',
    coverCharge: 5,
    crowdLevel: 'light',
    distance: 0.9,
    friendsHere: 1,
    specials: ['$4 Domestic Drafts', 'Karaoke Night'],
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
    rating: 3.9
  },
  {
    id: '7',
    name: 'The Standard',
    address: '1100 N High St',
    musicType: 'Top 40 and EDM',
    coverCharge: 10,
    crowdLevel: 'packed',
    distance: 1.4,
    friendsHere: 10,
    specials: ['$6 Cocktails', 'Ladies Night Deals'],
    imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800',
    rating: 4.3
  },
  {
    id: '8',
    name: 'Fourth Street Bar and Grill',
    address: '1810 N 4th St',
    musicType: 'Mixed',
    coverCharge: 0,
    crowdLevel: 'moderate',
    distance: 1.1,
    friendsHere: 3,
    specials: ['$3 Wells', 'Burger Specials'],
    imageUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800',
    rating: 4.0
  }
];


export const mockCurrentUser: User = {
  id: 'user1',
  name: 'Alex Johnson',
  school: 'State University',
  profileImage: 'https://i.pravatar.cc/150?img=1',
  mutualFriends: 0,
};

export const mockUsers: User[] = [
  {
    id: 'user2',
    name: 'Sarah Miller',
    school: 'State University',
    profileImage: 'https://i.pravatar.cc/150?img=2',
    mutualFriends: 8,
  },
  {
    id: 'user3',
    name: 'Mike Davis',
    school: 'State University',
    profileImage: 'https://i.pravatar.cc/150?img=3',
    mutualFriends: 5,
  },
  {
    id: 'user4',
    name: 'Emma Wilson',
    school: 'State University',
    profileImage: 'https://i.pravatar.cc/150?img=4',
    mutualFriends: 12,
  },
];

export const mockPosts: Post[] = [
  {
    id: 'p1',
    userId: 'user2',
    userName: 'Sarah Miller',
    userImage: 'https://i.pravatar.cc/150?img=2',
    barId: '1',
    content: 'This place is 🔥 right now! DJ is killing it',
    timestamp: new Date(Date.now() - 300000),
    likes: 23,
  },
  {
    id: 'p2',
    userId: 'user3',
    userName: 'Mike Davis',
    userImage: 'https://i.pravatar.cc/150?img=3',
    barId: '1',
    content: 'Free pizza at the bar!',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400',
    timestamp: new Date(Date.now() - 600000),
    likes: 45,
  },
  {
    id: 'p3',
    userId: 'user4',
    userName: 'Emma Wilson',
    userImage: 'https://i.pravatar.cc/150?img=4',
    barId: '2',
    content: 'Just got here, who else is at Scarlet?',
    timestamp: new Date(Date.now() - 900000),
    likes: 12,
  },
];

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'c1',
    userId: 'user2',
    userName: 'Sarah',
    userImage: 'https://i.pravatar.cc/150?img=2',
    message: 'Anyone want to grab a drink?',
    timestamp: new Date(Date.now() - 120000),
  },
  {
    id: 'c2',
    userId: 'user3',
    userName: 'Mike',
    userImage: 'https://i.pravatar.cc/150?img=3',
    message: 'I am by the pool table!',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: 'c3',
    userId: 'user4',
    userName: 'Emma',
    userImage: 'https://i.pravatar.cc/150?img=4',
    message: 'This DJ is amazing 🎵',
    timestamp: new Date(Date.now() - 30000),
  },
];
