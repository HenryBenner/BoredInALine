import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const sendFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ error: 'Friend ID is required' });
    }

    if (userId === friendId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const friendExists = await pool.query('SELECT id FROM users WHERE id = $1', [friendId]);
    
    if (friendExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingRequest = await pool.query(
      'SELECT * FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [userId, friendId]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: 'Friend request already exists or you are already friends' });
    }

    await pool.query(
      'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3)',
      [userId, friendId, 'pending']
    );

    res.status(201).json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
};

export const acceptFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE friendships 
       SET status = 'accepted' 
       WHERE id = $1 AND friend_id = $2 AND status = 'pending'
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found or already processed' });
    }

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
};

export const declineFriendRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM friendships WHERE id = $1 AND friend_id = $2 AND status = $3 RETURNING *',
      [id, userId, 'pending']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
};

export const removeFriend = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM friendships 
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) 
       AND status = 'accepted'
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
};

export const getPendingRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const incomingResult = await pool.query(
      `SELECT 
        f.id as request_id,
        u.id, u.name, u.school, u.profile_image,
        f.created_at
      FROM friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC`,
      [userId]
    );

    const outgoingResult = await pool.query(
      `SELECT 
        f.id as request_id,
        u.id, u.name, u.school, u.profile_image,
        f.created_at
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC`,
      [userId]
    );

    const incoming = incomingResult.rows.map(row => ({
      requestId: row.request_id,
      id: row.id,
      name: row.name,
      school: row.school,
      profileImage: row.profile_image,
      createdAt: row.created_at,
    }));

    const outgoing = outgoingResult.rows.map(row => ({
      requestId: row.request_id,
      id: row.id,
      name: row.name,
      school: row.school,
      profileImage: row.profile_image,
      createdAt: row.created_at,
    }));

    res.json({ incoming, outgoing });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
};
