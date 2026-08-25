import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import pool from '../config/database';

const expo = new Expo();

interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export const sendPushNotification = async (
  userId: string,
  notification: PushNotificationData
): Promise<boolean> => {
  try {
    const result = await pool.query(
      'SELECT push_token, notifications_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) return false;

    const { push_token, notifications_enabled } = result.rows[0];
    
    if (!notifications_enabled || !push_token) return false;

    if (!Expo.isExpoPushToken(push_token)) {
      console.error(`Invalid Expo push token for user ${userId}`);
      return false;
    }

    const message: ExpoPushMessage = {
      to: push_token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
    };

    const chunks = expo.chunkPushNotifications([message]);
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        for (const ticket of ticketChunk) {
          if (ticket.status === 'error') {
            console.error('Push notification error:', ticket.message);
          }
        }
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    return true;
  } catch (error) {
    console.error('Push notification error:', error);
    return false;
  }
};

export const sendPushNotificationToMultiple = async (
  userIds: string[],
  notification: PushNotificationData
): Promise<void> => {
  try {
    if (userIds.length === 0) return;

    const result = await pool.query(
      `SELECT id, push_token FROM users 
       WHERE id = ANY($1) AND notifications_enabled = true AND push_token IS NOT NULL`,
      [userIds]
    );

    const messages: ExpoPushMessage[] = [];

    for (const row of result.rows) {
      if (Expo.isExpoPushToken(row.push_token)) {
        messages.push({
          to: row.push_token,
          sound: 'default',
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
        });
      }
    }

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        for (const ticket of ticketChunk) {
          if (ticket.status === 'error') {
            console.error('Push notification error:', ticket.message);
          }
        }
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }
  } catch (error) {
    console.error('Push notification to multiple error:', error);
  }
};

export const notifyFriendsOfCheckIn = async (
  userId: string,
  userName: string,
  barName: string,
  barId: string
): Promise<void> => {
  try {
    const friendsResult = await pool.query(
      `SELECT 
        CASE 
          WHEN f.user_id = $1 THEN f.friend_id
          ELSE f.user_id
        END as friend_id
      FROM friendships f
      WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'`,
      [userId]
    );

    const friendIds = friendsResult.rows.map(row => row.friend_id);

    if (friendIds.length === 0) return;

    await sendPushNotificationToMultiple(friendIds, {
      title: 'Friend Check-In',
      body: `${userName} just checked into ${barName}`,
      data: { type: 'friend_checkin', barId, userId },
    });
  } catch (error) {
    console.error('Notify friends of check-in error:', error);
  }
};

export const notifyChatMessage = async (
  barId: string,
  senderId: string,
  senderName: string,
  message: string,
  barName: string
): Promise<void> => {
  try {
    const checkedInResult = await pool.query(
      `SELECT ci.user_id, u.push_token, u.notifications_enabled
       FROM check_ins ci
       JOIN users u ON ci.user_id = u.id
       WHERE ci.bar_id = $1 
         AND ci.checked_out_at IS NULL 
         AND ci.user_id != $2
         AND u.notifications_enabled = true
         AND u.push_token IS NOT NULL`,
      [barId, senderId]
    );

    const messages: ExpoPushMessage[] = [];
    const truncatedMessage = message.length > 50 ? message.substring(0, 47) + '...' : message;

    for (const row of checkedInResult.rows) {
      if (Expo.isExpoPushToken(row.push_token)) {
        messages.push({
          to: row.push_token,
          sound: 'default',
          title: `${senderName} at ${barName}`,
          body: truncatedMessage || '📷 Sent an image',
          data: { type: 'chat_message', barId },
        });
      }
    }

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending chat notification chunk:', error);
      }
    }
  } catch (error) {
    console.error('Notify chat message error:', error);
  }
};
