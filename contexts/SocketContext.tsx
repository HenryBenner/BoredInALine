import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getSocketUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.host) {
    const { protocol, host } = window.location;
    const url = `${protocol}//${host}`;
    console.log('Socket URL resolved to:', url);
    return url;
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    const url = process.env.EXPO_PUBLIC_API_URL.replace(/\/api$/, '');
    console.log('Socket URL from EXPO_PUBLIC_API_URL:', url);
    return url;
  }

  return 'http://localhost:5000';
};

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
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  joinBar: (barId: string) => void;
  leaveBar: (barId: string) => void;
  sendMessage: (barId: string, message: string, imageUrl?: string, replyToId?: string) => void;
  messages: ChatMessage[];
  currentBarId: string | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  joinBar: () => {},
  leaveBar: () => {},
  sendMessage: () => {},
  messages: [],
  currentBarId: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isGuest } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentBarId, setCurrentBarId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isGuest || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const initSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('@bored_in_line_token');
        if (!token) {
          return;
        }

        const socketUrl = getSocketUrl();
        const newSocket = io(socketUrl, {
          auth: { token },
          extraHeaders: {
            Authorization: `Bearer ${token}`,
          },
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 20000,
        });

        newSocket.on('connect', () => {
          setConnected(true);
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error.message);
        });

        newSocket.on('disconnect', () => {
          setConnected(false);
        });

        newSocket.on('new-message', (message: ChatMessage) => {
          setMessages((prev) => {
            if (prev.some(msg => msg.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
        });

        newSocket.on('error', (error: { message: string }) => {
          console.error('Socket error:', error.message);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
      } catch (error) {
        console.error('Failed to initialize socket:', error);
      }
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, isGuest]);

  const joinBar = (barId: string) => {
    if (currentBarId && currentBarId !== barId) {
      setMessages([]);
    }
    
    setCurrentBarId(barId);
    
    const attemptJoin = () => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('join-bar-chat', barId);
        console.log('Joined bar:', barId);
        return true;
      }
      return false;
    };

    if (!attemptJoin()) {
      const checkInterval = setInterval(() => {
        if (attemptJoin()) {
          clearInterval(checkInterval);
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkInterval);
      }, 5000);
    }
  };

  const leaveBar = (barId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-bar-chat', barId);
      console.log('Left bar:', barId);
    }
    setCurrentBarId(null);
    setMessages([]);
  };

  const sendMessage = (barId: string, message: string, imageUrl?: string, replyToId?: string) => {
    if (socketRef.current?.connected && (message.trim() || imageUrl)) {
      socketRef.current.emit('send-message', { 
        barId, 
        message: message.trim() || null,
        imageUrl: imageUrl || null,
        replyToId: replyToId || null
      });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        joinBar,
        leaveBar,
        sendMessage,
        messages,
        currentBarId,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
