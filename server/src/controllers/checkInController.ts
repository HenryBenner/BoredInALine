import { Response } from 'express';
import { validationResult } from 'express-validator';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { notifyFriendsOfCheckIn } from '../services/pushNotificationService';
import { getNightStartTime } from '../utils/nightCycle';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const checkIn = async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const { barId, latitude, longitude } = req.body;

    await pool.query(
      'UPDATE check_ins SET checked_out_at = NOW() WHERE user_id = $1 AND checked_out_at IS NULL',
      [userId]
    );

    const bar = await pool.query(
      'SELECT name, latitude, longitude FROM bars WHERE id = $1',
      [barId]
    );
    
    if (bar.rows.length === 0) {
      return res.status(404).json({ error: 'Bar not found' });
    }

    // Check if user is a tester account (bypasses location check)
    const testerCheck = await pool.query(
      'SELECT is_tester FROM users WHERE id = $1',
      [userId]
    );
    const isTester = testerCheck.rows[0]?.is_tester === true;

    // Location validation - user must be within half a mile (805 meters)
    if (!isTester && bar.rows[0].latitude && bar.rows[0].longitude) {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(bar.rows[0].latitude),
        parseFloat(bar.rows[0].longitude)
      );

      const MAX_DISTANCE = 805; // Half a mile in meters
      if (distance > MAX_DISTANCE) {
        return res.status(403).json({
          error: 'You must be within half a mile of the bar to check in',
          distance: Math.round(distance),
        });
      }
    }

    const { photoUrl } = req.body;
    
    const result = await pool.query(
      `INSERT INTO check_ins (user_id, bar_id, latitude, longitude, photo_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, barId, latitude, longitude, photoUrl || null]
    );

    const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    const userName = userResult.rows[0]?.name || 'Someone';

    notifyFriendsOfCheckIn(userId, userName, bar.rows[0].name, barId).catch(err => {
      console.error('Failed to send friend check-in notifications:', err);
    });

    if (photoUrl) {
      await pool.query(
        `INSERT INTO chat_messages (bar_id, user_id, message, image_url)
         VALUES ($1, $2, $3, $4)`,
        [barId, userId, `${userName} just checked in!`, photoUrl]
      );
    }

    res.status(201).json({
      id: result.rows[0].id,
      barId: result.rows[0].bar_id,
      barName: bar.rows[0].name,
      checkedInAt: result.rows[0].checked_in_at,
      photoUrl: result.rows[0].photo_url,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
};

export const getCurrentCheckIn = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const nightStart = getNightStartTime();

    const result = await pool.query(
      `SELECT ci.*, b.name as bar_name
       FROM check_ins ci
       JOIN bars b ON ci.bar_id = b.id
       WHERE ci.user_id = $1 AND ci.checked_out_at IS NULL AND ci.checked_in_at >= $2`,
      [userId, nightStart]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json({
      id: result.rows[0].id,
      barId: result.rows[0].bar_id,
      barName: result.rows[0].bar_name,
      checkedInAt: result.rows[0].checked_in_at,
      photoUrl: result.rows[0].photo_url,
    });
  } catch (error) {
    console.error('Get check-in error:', error);
    res.status(500).json({ error: 'Failed to fetch check-in' });
  }
};

export const checkOut = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      'UPDATE check_ins SET checked_out_at = NOW() WHERE user_id = $1 AND checked_out_at IS NULL RETURNING *',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active check-in found' });
    }

    res.json({ message: 'Checked out successfully' });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
};

export const getCheckedInUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { barId } = req.params;
    const userId = req.user!.id;
    const nightStart = getNightStartTime();

    const friends = await pool.query(
      `SELECT friend_id FROM friendships 
       WHERE user_id = $1 AND status = 'accepted'
       UNION
       SELECT user_id FROM friendships 
       WHERE friend_id = $1 AND status = 'accepted'`,
      [userId]
    );

    const friendIds = friends.rows.map(row => row.friend_id || row.user_id);

    const result = await pool.query(
      `SELECT 
        u.id,
        u.name,
        u.profile_image,
        ci.checked_in_at,
        CASE WHEN u.id = ANY($2::uuid[]) THEN true ELSE false END as is_friend
      FROM check_ins ci
      JOIN users u ON ci.user_id = u.id
      WHERE ci.bar_id = $1 AND ci.checked_out_at IS NULL AND ci.checked_in_at >= $3
      ORDER BY ci.checked_in_at DESC`,
      [barId, friendIds, nightStart]
    );

    const users = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      profileImage: row.profile_image,
      checkedInAt: row.checked_in_at,
      isFriend: row.is_friend,
    }));

    res.json({
      total: users.length,
      friends: users.filter(u => u.isFriend),
      others: users.filter(u => !u.isFriend),
    });
  } catch (error) {
    console.error('Get checked-in users error:', error);
    res.status(500).json({ error: 'Failed to fetch checked-in users' });
  }
};
