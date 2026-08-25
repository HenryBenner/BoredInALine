const getApiUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.host) {
    const { protocol, host } = window.location;
    console.log('API using current host:', host);
    return `${protocol}//${host}/api`;
  }
  
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log('API using EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  return '/api';
};

export const getMediaUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  const apiUrl = getApiUrl();
  const baseUrl = apiUrl.replace('/api', '');
  
  if (path.startsWith('/api/')) {
    return `${baseUrl}${path}`;
  }
  
  return `${baseUrl}/api/media/${path}`;
};

interface ApiError {
  error: string;
  errors?: any[];
}

export class ApiClient {
  private static token: string | null = null;
  private static onUnauthorizedCallback: (() => void) | null = null;

  static setToken(token: string | null) {
    this.token = token;
  }

  static getToken() {
    return this.token;
  }

  static setOnUnauthorized(callback: (() => void) | null) {
    this.onUnauthorizedCallback = callback;
  }

  private static readonly REQUEST_TIMEOUT = 15000; // 15 seconds
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second between retries

  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      error.name === 'AbortError' ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('failed to fetch') ||
      message.includes('unable to connect')
    );
  }

  static async checkServerHealth(): Promise<{ isOnline: boolean; latency?: number }> {
    const startTime = Date.now();
    try {
      const API_URL = getApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check
      
      const response = await fetch(`${API_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      
      return { isOnline: response.ok, latency };
    } catch {
      return { isOnline: false };
    }
  }

  private static getUserFriendlyError(error: string, statusCode?: number): string {
    // Map technical errors to user-friendly messages
    if (error.includes('fetch') || error.includes('network') || error.includes('Failed to fetch')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }
    if (error.includes('timeout') || error.includes('Timeout') || error.includes('AbortError')) {
      return 'The request took too long. Please check your connection and try again.';
    }
    if (error.includes('JSON') || error.includes('Unexpected character') || error.includes('Unexpected token')) {
      return 'The server is temporarily unavailable. Please try again in a moment.';
    }
    if (statusCode === 500 || error.includes('Internal Server Error')) {
      return 'Something went wrong on our end. Please try again in a moment.';
    }
    if (statusCode === 503 || error.includes('Service Unavailable')) {
      return 'The service is temporarily unavailable. Please try again later.';
    }
    
    // Pass through specific actionable errors that users need to see verbatim
    if (error.includes('within half a mile') || error.includes('must be within') || error.includes('check in') || error.includes('check-in')) {
      return error;
    }

    // Known user-facing auth error patterns (pass through sanitized versions)
    const lowerError = error.toLowerCase();
    if (lowerError.includes('invalid email') || lowerError.includes('invalid password') || lowerError.includes('invalid credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (lowerError.includes('email already') || lowerError.includes('already exists') || lowerError.includes('already registered')) {
      return 'An account with this email already exists. Please log in instead.';
    }
    if (lowerError.includes('user not found') || lowerError.includes('account not found')) {
      return 'We couldn\'t find an account with that email. Please check or create a new account.';
    }
    if (lowerError.includes('password') && (lowerError.includes('wrong') || lowerError.includes('incorrect'))) {
      return 'The password you entered is incorrect. Please try again.';
    }
    
    // For any other error, return a generic friendly message to avoid showing technical details
    return 'Something went wrong. Please try again.';
  }

  static async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const API_URL = getApiUrl();
    const url = `${API_URL}${endpoint}`;
    console.log('API Request:', options.method || 'GET', url, retryCount > 0 ? `(retry ${retryCount})` : '');

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check Content-Type before parsing
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      
      let data;
      if (isJson) {
        try {
          data = await response.json();
        } catch {
          data = { error: 'Invalid response from server' };
        }
      } else {
        // Response is not JSON - likely an HTML error page
        const textResponse = await response.text();
        const isHtml = textResponse.trim().startsWith('<') || contentType.includes('text/html');
        
        if (isHtml) {
          console.error('Server returned HTML instead of JSON. Status:', response.status, 'First 200 chars:', textResponse.substring(0, 200));
          // Server is likely down, returning an error page, or there's a redirect issue
          data = { error: 'The server is temporarily unavailable. Please try again in a moment.' };
        } else {
          console.error('Unexpected response format:', contentType, 'Body:', textResponse.substring(0, 200));
          data = { error: 'Unexpected response from server' };
        }
        
        // Treat non-JSON response as an error
        if (response.ok) {
          throw new Error('The server is temporarily unavailable. Please try again in a moment.');
        }
      }

      if (!response.ok) {
        const error = data as ApiError;
        console.error('API Error:', response.status, error);
        
        // Only clear auth state for 401 on non-auth endpoints
        // Login/register 401s are expected for invalid credentials
        const isAuthEndpoint = endpoint.startsWith('/auth/');
        if (response.status === 401 && this.onUnauthorizedCallback && !isAuthEndpoint) {
          console.log('Unauthorized - clearing auth state');
          this.onUnauthorizedCallback();
        }
        
        // Don't retry auth errors (401, 403) or client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          const friendlyError = this.getUserFriendlyError(error.error || 'Request failed', response.status);
          throw new Error(friendlyError);
        }
        
        // Retry server errors (5xx)
        if (response.status >= 500 && retryCount < this.MAX_RETRIES) {
          console.log(`Server error, retrying in ${this.RETRY_DELAY}ms...`);
          await this.delay(this.RETRY_DELAY);
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        
        const friendlyError = this.getUserFriendlyError(error.error || 'Request failed', response.status);
        throw new Error(friendlyError);
      }

      console.log('API Success:', options.method || 'GET', endpoint);
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        // Check if this is a retryable network error
        if (this.isRetryableError(error) && retryCount < this.MAX_RETRIES) {
          console.log(`Network error, retrying in ${this.RETRY_DELAY}ms... (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
          await this.delay(this.RETRY_DELAY);
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        
        console.error('API Request failed after retries:', error);
        
        // Handle abort/timeout
        if (error.name === 'AbortError') {
          throw new Error('The request took too long. Please check your connection and try again.');
        }
        // If it's already a user-friendly error we threw, pass it through
        if (error.message.includes('Please') || error.message.includes('try again')) {
          throw error;
        }
        // Convert to user-friendly message
        throw new Error(this.getUserFriendlyError(error.message));
      }
      throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
    }
  }

  static async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  static async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  static async uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const API_URL = getApiUrl();
    const url = `${API_URL}${endpoint}`;
    console.log('API Upload:', url);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      // Check Content-Type before parsing
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      
      let data;
      if (isJson) {
        try {
          data = await response.json();
        } catch {
          data = { error: 'Invalid response from server' };
        }
      } else {
        const textResponse = await response.text();
        if (textResponse.trim().startsWith('<')) {
          console.error('Upload: Server returned HTML instead of JSON');
          throw new Error('The server is temporarily unavailable. Please try again in a moment.');
        }
        data = { error: 'Unexpected response from server' };
      }

      if (!response.ok) {
        const error = data as ApiError;
        console.error('API Upload Error:', response.status, error);
        
        if (response.status === 401 && this.onUnauthorizedCallback) {
          this.onUnauthorizedCallback();
        }
        
        throw new Error(this.getUserFriendlyError(error.error || 'Upload failed', response.status));
      }

      console.log('API Upload Success:', endpoint);
      return data as T;
    } catch (error) {
      console.error('API Upload failed:', error);
      if (error instanceof Error) {
        // If it's already a user-friendly error, pass it through
        if (error.message.includes('Please') || error.message.includes('try again')) {
          throw error;
        }
        throw new Error(this.getUserFriendlyError(error.message));
      }
      throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
    }
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  school?: string;
  profileImage: string | null;
  notificationsEnabled?: boolean;
  privacyPublic?: boolean;
  friendCount?: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  register: (data: {
    email: string;
    password: string;
    name: string;
    school?: string;
    termsAccepted: boolean;
  }) => ApiClient.post<AuthResponse>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    ApiClient.post<LoginResponse>('/auth/login', data),

  googleAuth: (data: { accessToken: string }) =>
    ApiClient.post<AuthResponse>('/auth/google', data),

  appleAuth: (data: { identityToken: string; name?: string }) =>
    ApiClient.post<AuthResponse>('/auth/apple', data),

  forgotPassword: (data: { email: string }) =>
    ApiClient.post<{ message: string }>('/auth/forgot-password', data),

  resetPassword: (data: { token: string; password: string }) =>
    ApiClient.post<{ message: string }>('/auth/reset-password', data),
};

export type LoginResponse = AuthResponse | BarAdminAuthResponse | SuperAdminAuthResponse;

export const userApi = {
  getCurrentUser: () => ApiClient.get<User>('/users/me'),

  updateProfile: (data: {
    name?: string;
    email?: string;
    school?: string;
    profileImage?: string;
    notificationsEnabled?: boolean;
    privacyPublic?: boolean;
  }) => ApiClient.put<User>('/users/me', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    ApiClient.post<{ message: string }>('/users/me/password', data),

  deleteAccount: (password: string) =>
    ApiClient.post<{ message: string }>('/users/me/delete', { password }),

  uploadProfileImage: async (uri: string, mimeType: string): Promise<{ user: User; imageUrl: string }> => {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'profile.jpg';
    const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
    
    if (isWeb) {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const finalMimeType = blob.type || mimeType || 'image/jpeg';
        const file = new File([blob], filename, { type: finalMimeType });
        formData.append('file', file);
      } catch (error) {
        console.error('Failed to fetch blob:', error);
        throw new Error('Failed to prepare image for upload');
      }
    } else {
      formData.append('file', {
        uri,
        type: mimeType,
        name: filename,
      } as any);
    }
    return ApiClient.uploadFile<{ user: User; imageUrl: string }>('/uploads/profile-image', formData);
  },

  searchUsers: (query: string) =>
    ApiClient.get<
      Array<{
        id: string;
        name: string;
        school?: string;
        profileImage: string;
        friendStatus: 'friends' | 'request_sent' | 'request_received' | 'none';
      }>
    >(`/users/search?q=${encodeURIComponent(query)}`),

  getUserById: (id: string) =>
    ApiClient.get<{
      id: string;
      name: string;
      school?: string;
      profileImage: string;
      mutualFriends: number;
    }>(`/users/${id}`),

  getFriends: () =>
    ApiClient.get<
      Array<{
        id: string;
        name: string;
        school?: string;
        profileImage: string;
        currentBar?: string;
      }>
    >('/users/me/friends'),
    
  getFriendActivity: () =>
    ApiClient.get<
      Array<{
        userId: string;
        userName: string;
        profileImage: string;
        barId: string;
        barName: string;
        checkedInAt: string;
      }>
    >('/users/me/friends/activity'),

  getProfile: (userId: string) =>
    ApiClient.get<UserProfile>(`/users/${userId}/profile`),

  getVisitHistory: (userId: string, days: number = 10) =>
    ApiClient.get<VisitHistory[]>(`/users/${userId}/visit-history?days=${days}`),
};

export interface UserProfile {
  id: string;
  name: string;
  school?: string;
  profileImage: string | null;
  friendCount: number;
  barsVisited: number;
  totalCheckIns: number;
  memberSince: string;
  isOwnProfile: boolean;
  friendStatus: 'friends' | 'request_sent' | 'request_received' | 'none';
}

export interface VisitHistory {
  date: string;
  bars: Array<{
    barId: string;
    barName: string;
    barImage: string | null;
    checkedInAt: string;
    photoUrl: string | null;
  }>;
}

export interface Bar {
  id: string;
  name: string;
  address: string;
  musicType: string;
  coverCharge: number;
  crowdLevel: string;
  distance: number;
  friendsHere: number;
  specials: string[];
  imageUrl: string;
  rating: number;
  latitude: number | null;
  longitude: number | null;
  barNote?: string | null;
  priceLevel?: number;
  hasActiveDeals?: boolean;
  activeDealTitles?: string[];
}

export interface BarDeal {
  id: string;
  bar_id: string;
  title: string;
  description: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
}

export interface BarEvent {
  id: string;
  bar_id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  cover_charge: number;
  image_url: string | null;
  is_published: boolean;
}

export const barApi = {
  getBars: () => ApiClient.get<Bar[]>('/bars'),
  
  getBarById: (id: string) => ApiClient.get<Bar>(`/bars/${id}`),
  
  getCrowdLevel: (id: string) => ApiClient.get<{ count: number; level: string }>(`/bars/${id}/crowd`),
  
  getBarDeals: (barId: string) => ApiClient.get<BarDeal[]>(`/bars/${barId}/deals`),
  
  getBarEvents: (barId: string) => ApiClient.get<BarEvent[]>(`/bars/${barId}/events`),
};

export const friendApi = {
  sendRequest: (friendId: string) =>
    ApiClient.post<{ message: string }>('/friends/request', { friendId }),

  getPendingRequests: () =>
    ApiClient.get<{
      incoming: Array<{
        requestId: string;
        id: string;
        name: string;
        school?: string;
        profileImage: string;
        createdAt: string;
      }>;
      outgoing: Array<{
        requestId: string;
        id: string;
        name: string;
        school?: string;
        profileImage: string;
        createdAt: string;
      }>;
    }>('/friends/requests'),

  acceptRequest: (requestId: string) =>
    ApiClient.post<{ message: string }>(`/friends/accept/${requestId}`),

  declineRequest: (requestId: string) =>
    ApiClient.delete<{ message: string }>(`/friends/decline/${requestId}`),

  removeFriend: (friendId: string) =>
    ApiClient.delete<{ message: string }>(`/friends/remove/${friendId}`),
};

export interface CheckIn {
  id: string;
  barId: string;
  barName: string;
  checkedInAt: string;
}

export interface CheckedInUser {
  id: string;
  name: string;
  profileImage: string;
  checkedInAt: string;
  isFriend: boolean;
}

export const checkIn = (barId: string, latitude: number, longitude: number, photoUrl?: string) =>
  ApiClient.post<CheckIn>('/check-ins', { barId, latitude, longitude, photoUrl });

export const checkOut = () =>
  ApiClient.delete<{ message: string }>('/check-ins/current');

export const getCurrentCheckIn = () =>
  ApiClient.get<CheckIn | null>('/check-ins/current');

export const getCheckedInUsers = (barId: string) =>
  ApiClient.get<{
    total: number;
    friends: CheckedInUser[];
    others: CheckedInUser[];
  }>(`/check-ins/${barId}/users`);

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  barId: string;
  barName?: string;
  content: string;
  imageUrl?: string;
  timestamp: string;
  likes: number;
  userLiked: boolean;
  replyToId?: string | null;
  replyToContent?: string | null;
  replyToUserName?: string | null;
  replyCount?: number;
  reactions?: Reaction[];
  isFriend?: boolean;
  requestSent?: boolean;
}

export const postApi = {
  getPosts: () => ApiClient.get<Post[]>('/posts'),
  
  getPostById: (postId: string) => ApiClient.get<Post>(`/posts/${postId}`),
  
  createPost: (data: { content: string; barId?: string | null; imageUrl?: string; replyToId?: string }) =>
    ApiClient.post<Post>('/posts', data),
  
  likePost: (postId: string) =>
    ApiClient.post<{ message: string }>(`/posts/${postId}/like`),
  
  unlikePost: (postId: string) =>
    ApiClient.delete<{ message: string }>(`/posts/${postId}/like`),
  
  getReplies: (postId: string) =>
    ApiClient.get<Post[]>(`/posts/${postId}/replies`),
  
  addReaction: (postId: string, emoji: string) =>
    ApiClient.post<{ reactions: Reaction[] }>(`/posts/${postId}/reactions`, { emoji }),
  
  removeReaction: (postId: string, emoji: string) =>
    ApiClient.request<{ reactions: Reaction[] }>(`/posts/${postId}/reactions`, {
      method: 'DELETE',
      body: JSON.stringify({ emoji }),
    }),

  deletePost: (postId: string) =>
    ApiClient.delete<{ message: string }>(`/posts/${postId}`),
};

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  message: string | null;
  imageUrl?: string;
  timestamp: string;
  replyToId?: string | null;
  replyToMessage?: string | null;
  replyToUserName?: string | null;
  reactions?: Reaction[];
}

export const chatApi = {
  getMessages: (barId: string) =>
    ApiClient.get<ChatMessage[]>(`/chat/${barId}/messages`),
  
  sendMessage: (barId: string, data: { message?: string; imageUrl?: string; replyToId?: string }) =>
    ApiClient.post<ChatMessage>(`/chat/${barId}/messages`, data),
  
  addReaction: (barId: string, messageId: string, emoji: string) =>
    ApiClient.post<{ reactions: Reaction[] }>(`/chat/${barId}/messages/${messageId}/reactions`, { emoji }),
  
  removeReaction: (barId: string, messageId: string, emoji: string) =>
    ApiClient.request<{ reactions: Reaction[] }>(`/chat/${barId}/messages/${messageId}/reactions`, {
      method: 'DELETE',
      body: JSON.stringify({ emoji }),
    }),
};

export interface BarAdmin {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
}

export interface AdminBar {
  id: string;
  name: string;
  address: string;
  musicType: string | null;
  coverCharge: number | null;
  specials: string[];
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  hidden: boolean;
  barNote: string | null;
  priceLevel: number;
}

export interface BarAdminAuthResponse {
  isBarAdmin: true;
  admin: BarAdmin;
  bar: AdminBar;
  token: string;
}

export interface Deal {
  id: string;
  barId: string;
  title: string;
  description: string | null;
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
}

export interface Event {
  id: string;
  barId: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  coverCharge: number;
  imageUrl: string | null;
  isPublished: boolean;
}

export const moderationApi = {
  reportContent: (data: { reportedUserId?: string; contentId?: string; contentType: string; reason: string; message?: string }) =>
    ApiClient.post<{ message: string }>('/moderation/report', data),

  blockUser: (blockedUserId: string) =>
    ApiClient.post<{ message: string }>('/moderation/block', { blockedUserId }),

  unblockUser: (userId: string) =>
    ApiClient.delete<{ message: string }>(`/moderation/block/${userId}`),

  getBlockedUsers: () =>
    ApiClient.get<Array<{ id: string; name: string; profileImage: string | null; blockedAt: string }>>('/moderation/blocked'),
};

export const barAdminApi = {
  getMyBar: () => ApiClient.get<AdminBar>('/bars/admin/my-bar'),
  
  updateBar: (data: Partial<AdminBar>) => ApiClient.put<AdminBar>('/bars/admin/my-bar', data),
  
  uploadBarImage: async (uri: string, mimeType: string): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'bar.jpg';
    const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
    
    if (isWeb) {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const finalMimeType = blob.type || mimeType || 'image/jpeg';
        const file = new File([blob], filename, { type: finalMimeType });
        formData.append('file', file);
      } catch (error) {
        console.error('Failed to fetch blob:', error);
        throw new Error('Failed to prepare image for upload');
      }
    } else {
      formData.append('file', {
        uri,
        type: mimeType,
        name: filename,
      } as any);
    }
    return ApiClient.uploadFile<{ imageUrl: string }>('/uploads/bar-image', formData);
  },

  getDeals: () => ApiClient.get<Deal[]>('/bars/admin/deals'),
  createDeal: (data: Omit<Deal, 'id' | 'barId'>) => ApiClient.post<Deal>('/bars/admin/deals', data),
  updateDeal: (id: string, data: Partial<Deal>) => ApiClient.put<Deal>(`/bars/admin/deals/${id}`, data),
  deleteDeal: (id: string) => ApiClient.delete<{ message: string }>(`/bars/admin/deals/${id}`),

  getEvents: () => ApiClient.get<Event[]>('/bars/admin/events'),
  createEvent: (data: Omit<Event, 'id' | 'barId'>) => ApiClient.post<Event>('/bars/admin/events', data),
  updateEvent: (id: string, data: Partial<Event>) => ApiClient.put<Event>(`/bars/admin/events/${id}`, data),
  deleteEvent: (id: string) => ApiClient.delete<{ message: string }>(`/bars/admin/events/${id}`),
};

export interface SuperAdmin {
  id: string;
  email: string;
  name: string;
}

export interface SuperAdminAuthResponse {
  isSuperAdmin: true;
  superAdmin: SuperAdmin;
  token: string;
}

export interface BroadcastNotification {
  id: string;
  title: string;
  body: string;
  recipientCount: number;
  sentAt: string;
  sentByName: string | null;
}

export const superAdminApi = {
  sendNotification: (title: string, body: string) =>
    ApiClient.post<{ success: boolean; recipientCount: number }>('/super-admin/send-notification', { title, body }),

  getHistory: () =>
    ApiClient.get<BroadcastNotification[]>('/super-admin/notifications'),
};
