import { Response } from 'express';
import { Expo } from 'expo-server-sdk';
import pool from '../config/database';
import { SuperAdminRequest } from '../middleware/auth';

interface UserTokenRow {
  id: string;
  push_token: string;
}

interface BroadcastRow {
  id: string;
  title: string;
  body: string;
  recipient_count: number;
  sent_at: string;
  sent_by_name: string | null;
}

export const sendBroadcastNotification = async (req: SuperAdminRequest, res: Response) => {
  try {
    const { title, body } = req.body;

    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Title and message body are required' });
    }

    const usersResult = await pool.query<UserTokenRow>(
      `SELECT id, push_token FROM users
       WHERE push_token IS NOT NULL
         AND notifications_enabled = true
         AND is_banned = false`
    );

    const validRows = usersResult.rows.filter((r) => Expo.isExpoPushToken(r.push_token));

    if (validRows.length > 0) {
      const expo = new Expo();
      const messages = validRows.map((r) => ({
        to: r.push_token,
        sound: 'default' as const,
        title: title.trim(),
        body: body.trim(),
        data: { type: 'broadcast' },
      }));

      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (err) {
          console.error('Push chunk send error:', err);
        }
      }
    }

    await pool.query(
      `INSERT INTO broadcast_notifications (title, body, sent_by, recipient_count)
       VALUES ($1, $2, $3, $4)`,
      [title.trim(), body.trim(), req.superAdmin!.id, validRows.length]
    );

    return res.json({ success: true, recipientCount: validRows.length });
  } catch (error) {
    console.error('Send broadcast notification error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
};

export const getBroadcastHistory = async (req: SuperAdminRequest, res: Response) => {
  try {
    const result = await pool.query<BroadcastRow>(
      `SELECT bn.id, bn.title, bn.body, bn.recipient_count, bn.sent_at,
              sa.name as sent_by_name
       FROM broadcast_notifications bn
       LEFT JOIN super_admins sa ON bn.sent_by = sa.id
       ORDER BY bn.sent_at DESC
       LIMIT 50`
    );

    return res.json(
      result.rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        recipientCount: r.recipient_count,
        sentAt: r.sent_at,
        sentByName: r.sent_by_name,
      }))
    );
  } catch (error) {
    console.error('Get broadcast history error:', error);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
};
