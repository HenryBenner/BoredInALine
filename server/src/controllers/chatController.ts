import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { getNightStartTime } from '../utils/nightCycle';
import { checkContent } from '../utils/contentFilter';

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { barId } = req.params;
    const nightStart = getNightStartTime();

    const checkIn = await pool.query(
      'SELECT id FROM check_ins WHERE user_id = $1 AND bar_id = $2 AND checked_out_at IS NULL AND checked_in_at >= $3',
      [userId, barId, nightStart]
    );

    if (checkIn.rows.length === 0) {
      return res.status(403).json({ error: 'Must be tapped in to view chat' });
    }

    const result = await pool.query(
      `SELECT 
        cm.*,
        u.name as user_name,
        u.profile_image as user_image,
        rm.id as reply_to_message_id,
        rm.message as reply_to_message,
        ru.name as reply_to_user_name
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      LEFT JOIN chat_messages rm ON cm.reply_to_id = rm.id
      LEFT JOIN users ru ON rm.user_id = ru.id
      WHERE cm.bar_id = $1 AND cm.is_archived = false AND cm.created_at >= $2
      AND cm.user_id NOT IN (SELECT blocked_user_id FROM user_blocks WHERE blocker_id = $3)
      ORDER BY cm.created_at ASC
      LIMIT 100`,
      [barId, nightStart, userId]
    );

    const messageIds = result.rows.map(row => row.id);
    
    let reactionsMap: Record<string, Array<{emoji: string, count: number, userReacted: boolean}>> = {};
    if (messageIds.length > 0) {
      const reactionsResult = await pool.query(
        `SELECT message_id, emoji, COUNT(*) as count,
          EXISTS(SELECT 1 FROM chat_reactions WHERE message_id = cr.message_id AND emoji = cr.emoji AND user_id = $2) as user_reacted
        FROM chat_reactions cr
        WHERE message_id = ANY($1)
        GROUP BY message_id, emoji`,
        [messageIds, userId]
      );
      
      reactionsResult.rows.forEach(row => {
        if (!reactionsMap[row.message_id]) {
          reactionsMap[row.message_id] = [];
        }
        reactionsMap[row.message_id].push({
          emoji: row.emoji,
          count: parseInt(row.count),
          userReacted: row.user_reacted
        });
      });
    }

    const messages = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userImage: row.user_image,
      message: row.message,
      imageUrl: row.image_url,
      timestamp: row.created_at,
      replyToId: row.reply_to_message_id || null,
      replyToMessage: row.reply_to_message || null,
      replyToUserName: row.reply_to_user_name || null,
      reactions: reactionsMap[row.id] || [],
    }));

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { barId } = req.params;
    const { message, imageUrl, replyToId } = req.body;

    if ((!message || !message.trim()) && !imageUrl) {
      return res.status(400).json({ error: 'Message or image is required' });
    }

    if (message) {
      const filterResult = await checkContent(message);
      if (!filterResult.isClean) {
        return res.status(400).json({ error: 'Message contains inappropriate content' });
      }
    }

    const checkIn = await pool.query(
      'SELECT id FROM check_ins WHERE user_id = $1 AND bar_id = $2 AND checked_out_at IS NULL',
      [userId, barId]
    );

    if (checkIn.rows.length === 0) {
      return res.status(403).json({ error: 'Must be checked in to send messages' });
    }

    let validatedReplyToId = null;
    if (replyToId) {
      const parentMessage = await pool.query(
        'SELECT id FROM chat_messages WHERE id = $1 AND bar_id = $2', 
        [replyToId, barId]
      );
      if (parentMessage.rows.length === 0) {
        return res.status(404).json({ error: 'Parent message not found in this bar' });
      }
      validatedReplyToId = replyToId;
    }

    const result = await pool.query(
      `INSERT INTO chat_messages (user_id, bar_id, message, image_url, reply_to_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at, reply_to_id`,
      [userId, barId, message?.trim() || null, imageUrl || null, validatedReplyToId]
    );

    const user = await pool.query(
      'SELECT name, profile_image FROM users WHERE id = $1',
      [userId]
    );

    let replyToMessage = null;
    let replyToUserName = null;
    if (replyToId) {
      const replyInfo = await pool.query(
        `SELECT cm.message, u.name FROM chat_messages cm JOIN users u ON cm.user_id = u.id WHERE cm.id = $1`,
        [replyToId]
      );
      if (replyInfo.rows.length > 0) {
        replyToMessage = replyInfo.rows[0].message;
        replyToUserName = replyInfo.rows[0].name;
      }
    }

    res.status(201).json({
      id: result.rows[0].id,
      userId,
      userName: user.rows[0].name,
      userImage: user.rows[0].profile_image,
      message: message?.trim() || null,
      imageUrl: imageUrl || null,
      timestamp: result.rows[0].created_at,
      replyToId: result.rows[0].reply_to_id || null,
      replyToMessage,
      replyToUserName,
      reactions: [],
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

export const addMessageReaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { barId, messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const checkIn = await pool.query(
      'SELECT id FROM check_ins WHERE user_id = $1 AND bar_id = $2 AND checked_out_at IS NULL',
      [userId, barId]
    );

    if (checkIn.rows.length === 0) {
      return res.status(403).json({ error: 'Must be checked in to react to messages' });
    }

    const message = await pool.query('SELECT id FROM chat_messages WHERE id = $1 AND bar_id = $2', [messageId, barId]);
    if (message.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await pool.query(
      'INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT (message_id, user_id, emoji) DO NOTHING',
      [messageId, userId, emoji]
    );

    const reactionsResult = await pool.query(
      `SELECT emoji, COUNT(*) as count FROM chat_reactions WHERE message_id = $1 GROUP BY emoji`,
      [messageId]
    );

    const reactions = reactionsResult.rows.map(row => ({
      emoji: row.emoji,
      count: parseInt(row.count),
      userReacted: true
    }));

    res.json({ reactions });
  } catch (error) {
    console.error('Add message reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
};

export const removeMessageReaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    await pool.query(
      'DELETE FROM chat_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [messageId, userId, emoji]
    );

    const reactionsResult = await pool.query(
      `SELECT emoji, COUNT(*) as count FROM chat_reactions WHERE message_id = $1 GROUP BY emoji`,
      [messageId]
    );

    const reactions = reactionsResult.rows.map(row => ({
      emoji: row.emoji,
      count: parseInt(row.count),
      userReacted: false
    }));

    res.json({ reactions });
  } catch (error) {
    console.error('Remove message reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
};
