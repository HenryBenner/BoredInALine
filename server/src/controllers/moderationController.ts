import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

const VALID_CONTENT_TYPES = ['post', 'chat_message', 'user_profile'];
const VALID_REASONS = ['spam', 'harassment', 'hate_speech', 'inappropriate', 'violence', 'other'];

export const reportContent = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { reportedUserId, contentId, contentType, reason, message } = req.body;

    if (!contentType || !reason) {
      return res.status(400).json({ error: 'contentType and reason are required' });
    }

    if (!VALID_CONTENT_TYPES.includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Invalid reason' });
    }

    const result = await pool.query(
      `INSERT INTO reports (reporter_id, reported_user_id, content_id, content_type, reason, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, reportedUserId, contentId || null, contentType, reason, message || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Report content error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

export const blockUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { blockedUserId } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({ error: 'blockedUserId is required' });
    }

    if (blockedUserId === userId) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    await pool.query(
      `INSERT INTO user_blocks (blocker_id, blocked_user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, blockedUserId]
    );

    res.status(201).json({ message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
};

export const unblockUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { userId: blockedUserId } = req.params;

    await pool.query(
      'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_user_id = $2',
      [userId, blockedUserId]
    );

    res.json({ message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
};

export const getBlockedUsers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT u.id, u.name, u.profile_image, ub.created_at as blocked_at
       FROM user_blocks ub
       JOIN users u ON ub.blocked_user_id = u.id
       WHERE ub.blocker_id = $1
       ORDER BY ub.created_at DESC`,
      [userId]
    );

    const blockedUsers = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      profileImage: row.profile_image,
      blockedAt: row.blocked_at,
    }));

    res.json(blockedUsers);
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
};

export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const adminCheck = await pool.query(
      'SELECT id FROM bar_admins WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, reason, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (reason) {
      whereClause += ` AND r.reason = $${paramIndex}`;
      params.push(reason);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM reports r WHERE 1=1${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT r.*,
        reporter.name as reporter_name,
        reported.name as reported_user_name,
        CASE 
          WHEN r.content_type = 'post' THEN (SELECT content FROM posts WHERE id = r.content_id)
          WHEN r.content_type = 'chat_message' THEN (SELECT message FROM chat_messages WHERE id = r.content_id)
          ELSE NULL
        END as content_text
       FROM reports r
       LEFT JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported ON r.reported_user_id = reported.id
       WHERE 1=1${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );

    res.json({
      reports: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

export const resolveReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { reportId } = req.params;
    const { action } = req.body;

    const adminCheck = await pool.query(
      'SELECT id FROM bar_admins WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!['dismiss', 'remove_content', 'ban_user'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const report = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (report.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportData = report.rows[0];

    if (action === 'dismiss') {
      await pool.query(
        `UPDATE reports SET status = 'dismissed', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
         WHERE id = $2`,
        [userId, reportId]
      );
    } else if (action === 'remove_content') {
      if (reportData.content_type === 'post' && reportData.content_id) {
        await pool.query('DELETE FROM posts WHERE id = $1', [reportData.content_id]);
      } else if (reportData.content_type === 'chat_message' && reportData.content_id) {
        await pool.query('DELETE FROM chat_messages WHERE id = $1', [reportData.content_id]);
      }

      await pool.query(
        `UPDATE reports SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
         WHERE id = $2`,
        [userId, reportId]
      );

      await pool.query(
        `INSERT INTO moderation_logs (moderator_id, action_type, target_id, target_type, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'remove_content', reportData.content_id, reportData.content_type, JSON.stringify({ reportId })]
      );
    } else if (action === 'ban_user') {
      await pool.query(
        `UPDATE users SET is_banned = true, ban_reason = $1, banned_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [`Banned due to report: ${reportData.reason}`, reportData.reported_user_id]
      );

      await pool.query(
        `UPDATE reports SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
         WHERE id = $2`,
        [userId, reportId]
      );

      await pool.query(
        `INSERT INTO moderation_logs (moderator_id, action_type, target_id, target_type, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'ban_user', reportData.reported_user_id, 'user', JSON.stringify({ reportId, reason: reportData.reason })]
      );
    }

    res.json({ message: 'Report resolved' });
  } catch (error) {
    console.error('Resolve report error:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
};

export const getModerationLogs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const adminCheck = await pool.query(
      'SELECT id FROM bar_admins WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    const result = await pool.query(
      `SELECT ml.*, u.name as moderator_name
       FROM moderation_logs ml
       LEFT JOIN users u ON ml.moderator_id = u.id
       ORDER BY ml.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limitNum, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM moderation_logs');

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Get moderation logs error:', error);
    res.status(500).json({ error: 'Failed to fetch moderation logs' });
  }
};
