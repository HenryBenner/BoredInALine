export interface Bar {
  id: string;
  name: string;
  address: string;
  musicType: string;
  coverCharge: number;
  crowdLevel: 'empty' | 'moderate' | 'packed' | 'very-packed';
  distance: number;
  friendsHere: number;
  specials: string[];
  imageUrl: string;
  rating: number;
}

export interface User {
  id: string;
  name: string;
  school: string;
  profileImage: string;
  mutualFriends: number;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  barId: string;
  content: string;
  imageUrl?: string;
  timestamp: Date;
  likes: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  message: string;
  timestamp: Date;
}

export interface BarOwnerPost {
  id: string;
  barId: string;
  title: string;
  content: string;
  timestamp: Date;
  isPinned: boolean;
}
