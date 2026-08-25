import bcrypt from "bcryptjs";
import { Response } from "express";
import pool from "../config/database";
import { AuthRequest } from "../middleware/auth";

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT 
        u.id, u.email, u.name, u.school, u.profile_image,
        u.notifications_enabled, u.privacy_public,
        (SELECT COUNT(*) FROM friendships f 
         WHERE (f.user_id = u.id OR f.friend_id = u.id) AND f.status = 'accepted') as friend_count
      FROM users u
      WHERE u.id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      name: result.rows[0].name,
      school: result.rows[0].school,
      profileImage: result.rows[0].profile_image,
      notificationsEnabled: result.rows[0].notifications_enabled,
      privacyPublic: result.rows[0].privacy_public,
      friendCount: parseInt(result.rows[0].friend_count) || 0,
    };

    res.json(user);
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const result = await pool.query(
      `SELECT 
        u.id, u.name, u.school, u.profile_image,
        COUNT(DISTINCT CASE 
          WHEN (f1.friend_id = u.id AND f2.friend_id = $1) 
            OR (f1.user_id = u.id AND f2.user_id = $1)
          THEN f1.id 
        END) as mutual_friends
      FROM users u
      LEFT JOIN friendships f1 ON (u.id = f1.user_id OR u.id = f1.friend_id) AND f1.status = 'accepted'
      LEFT JOIN friendships f2 ON (f1.user_id = f2.user_id OR f1.friend_id = f2.friend_id) AND f2.status = 'accepted'
      WHERE u.id = $2
      GROUP BY u.id`,
      [currentUserId, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      school: result.rows[0].school,
      profileImage: result.rows[0].profile_image,
      mutualFriends: parseInt(result.rows[0].mutual_friends) || 0,
    };

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

export const getFriends = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT 
        u.id, u.name, u.school, u.profile_image,
        CASE WHEN ci.id IS NOT NULL THEN b.name ELSE NULL END as current_bar
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.user_id = $1 THEN f.friend_id
          WHEN f.friend_id = $1 THEN f.user_id
        END = u.id
      )
      LEFT JOIN check_ins ci ON u.id = ci.user_id AND ci.checked_out_at IS NULL
      LEFT JOIN bars b ON ci.bar_id = b.id
      WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
      ORDER BY ci.id IS NOT NULL DESC, u.name`,
      [userId],
    );

    const friends = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      school: row.school,
      profileImage: row.profile_image,
      currentBar: row.current_bar,
    }));

    res.json(friends);
  } catch (error) {
    console.error("Get friends error:", error);
    res.status(500).json({ error: "Failed to fetch friends" });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      name,
      email,
      school,
      profileImage,
      notificationsEnabled,
      privacyPublic,
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const existingEmail = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email, userId],
      );
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: "Email already in use" });
      }

      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (school !== undefined) {
      updates.push(`school = $${paramCount++}`);
      values.push(school);
    }
    if (profileImage !== undefined) {
      updates.push(`profile_image = $${paramCount++}`);
      values.push(profileImage);
    }
    if (notificationsEnabled !== undefined) {
      updates.push(`notifications_enabled = $${paramCount++}`);
      values.push(notificationsEnabled);
    }
    if (privacyPublic !== undefined) {
      updates.push(`privacy_public = $${paramCount++}`);
      values.push(privacyPublic);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")} 
       WHERE id = $${paramCount}
       RETURNING id, email, name, school, profile_image, notifications_enabled, privacy_public`,
      values,
    );

    const user = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      name: result.rows[0].name,
      school: result.rows[0].school,
      profileImage: result.rows[0].profile_image,
      notificationsEnabled: result.rows[0].notifications_enabled,
      privacyPublic: result.rows[0].privacy_public,
    };

    res.json(user);
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters" });
    }

    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password,
    );

    if (!validPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      userId,
    ]);

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
};

export const searchUsers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const searchTerm = `%${q.toLowerCase()}%`;

    const result = await pool.query(
      `SELECT 
        u.id, u.name, u.school, u.profile_image,
        CASE 
          WHEN f1.id IS NOT NULL AND f1.status = 'accepted' THEN 'friends'
          WHEN f2.id IS NOT NULL AND f2.status = 'pending' THEN 'request_sent'
          WHEN f3.id IS NOT NULL AND f3.status = 'pending' THEN 'request_received'
          ELSE 'none'
        END as friend_status
      FROM users u
      LEFT JOIN friendships f1 ON ((f1.user_id = $1 AND f1.friend_id = u.id) OR (f1.friend_id = $1 AND f1.user_id = u.id)) AND f1.status = 'accepted'
      LEFT JOIN friendships f2 ON f2.user_id = $1 AND f2.friend_id = u.id AND f2.status = 'pending'
      LEFT JOIN friendships f3 ON f3.user_id = u.id AND f3.friend_id = $1 AND f3.status = 'pending'
      WHERE u.id != $1 AND (LOWER(u.name) LIKE $2 OR LOWER(u.email) LIKE $2)
      ORDER BY u.name
      LIMIT 50`,
      [userId, searchTerm],
    );

    const users = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      school: row.school,
      profileImage: row.profile_image,
      friendStatus: row.friend_status,
    }));

    res.json(users);
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
};

export const getFriendActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT 
        u.id as user_id, 
        u.name as user_name, 
        u.profile_image,
        b.id as bar_id,
        b.name as bar_name,
        ci.checked_in_at
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.user_id = $1 THEN f.friend_id
          WHEN f.friend_id = $1 THEN f.user_id
        END = u.id
      )
      JOIN check_ins ci ON u.id = ci.user_id AND ci.checked_out_at IS NULL
      JOIN bars b ON ci.bar_id = b.id
      WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
      ORDER BY ci.checked_in_at DESC
      LIMIT 10`,
      [userId],
    );

    const activity = result.rows.map((row) => ({
      userId: row.user_id,
      userName: row.user_name,
      profileImage: row.profile_image,
      barId: row.bar_id,
      barName: row.bar_name,
      checkedInAt: row.checked_in_at,
    }));

    res.json(activity);
  } catch (error) {
    console.error("Get friend activity error:", error);
    res.status(500).json({ error: "Failed to fetch friend activity" });
  }
};

export const updatePushToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ error: "Push token is required" });
    }

    await pool.query(
      "UPDATE users SET push_token = $1 WHERE id = $2",
      [pushToken, userId]
    );

    res.json({ message: "Push token updated successfully" });
  } catch (error) {
    console.error("Update push token error:", error);
    res.status(500).json({ error: "Failed to update push token" });
  }
};

export const removePushToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await pool.query(
      "UPDATE users SET push_token = NULL WHERE id = $1",
      [userId]
    );

    res.json({ message: "Push token removed successfully" });
  } catch (error) {
    console.error("Remove push token error:", error);
    res.status(500).json({ error: "Failed to remove push token" });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;
    const isOwnProfile = id === currentUserId;

    const result = await pool.query(
      `SELECT 
        u.id, u.name, u.school, u.profile_image, u.privacy_public, u.created_at,
        (SELECT COUNT(*) FROM friendships f 
         WHERE (f.user_id = u.id OR f.friend_id = u.id) AND f.status = 'accepted') as friend_count,
        (SELECT COUNT(DISTINCT bar_id) FROM check_ins WHERE user_id = u.id) as bars_visited,
        (SELECT COUNT(*) FROM check_ins WHERE user_id = u.id) as total_check_ins
      FROM users u
      WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = result.rows[0];

    if (!isOwnProfile && !row.privacy_public) {
      const friendshipCheck = await pool.query(
        `SELECT id FROM friendships 
         WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) 
         AND status = 'accepted'`,
        [currentUserId, id]
      );
      
      if (friendshipCheck.rows.length === 0) {
        return res.status(403).json({ error: "This profile is private" });
      }
    }

    let friendStatus = 'none';
    if (!isOwnProfile) {
      const statusResult = await pool.query(
        `SELECT 
          CASE 
            WHEN status = 'accepted' THEN 'friends'
            WHEN user_id = $1 AND status = 'pending' THEN 'request_sent'
            WHEN friend_id = $1 AND status = 'pending' THEN 'request_received'
            ELSE 'none'
          END as status
        FROM friendships 
        WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
        [currentUserId, id]
      );
      if (statusResult.rows.length > 0) {
        friendStatus = statusResult.rows[0].status;
      }
    }

    const profile = {
      id: row.id,
      name: row.name,
      school: row.school,
      profileImage: row.profile_image,
      friendCount: parseInt(row.friend_count) || 0,
      barsVisited: parseInt(row.bars_visited) || 0,
      totalCheckIns: parseInt(row.total_check_ins) || 0,
      memberSince: row.created_at,
      isOwnProfile,
      friendStatus,
    };

    res.json(profile);
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const getVisitHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;
    const days = parseInt(req.query.days as string) || 10;

    const userResult = await pool.query(
      "SELECT privacy_public FROM users WHERE id = $1",
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const isOwnProfile = id === currentUserId;
    if (!isOwnProfile && !userResult.rows[0].privacy_public) {
      const friendshipCheck = await pool.query(
        `SELECT id FROM friendships 
         WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) 
         AND status = 'accepted'`,
        [currentUserId, id]
      );
      
      if (friendshipCheck.rows.length === 0) {
        return res.status(403).json({ error: "This profile is private" });
      }
    }

    const result = await pool.query(
      `SELECT 
        DATE(ci.checked_in_at) as visit_date,
        b.id as bar_id,
        b.name as bar_name,
        b.image_url as bar_image,
        ci.checked_in_at,
        ci.photo_url
      FROM check_ins ci
      JOIN bars b ON ci.bar_id = b.id
      WHERE ci.user_id = $1 
        AND ci.checked_in_at >= NOW() - INTERVAL '${days} days'
      ORDER BY ci.checked_in_at DESC`,
      [id]
    );

    interface VisitBarEntry {
      barId: string;
      barName: string;
      barImage: string | null;
      checkedInAt: Date;
      photoUrl: string | null;
    }

    const visitsByDate: { [date: string]: VisitBarEntry[] } = {};
    
    result.rows.forEach(row => {
      const dateStr = row.visit_date.toISOString().split('T')[0];
      if (!visitsByDate[dateStr]) {
        visitsByDate[dateStr] = [];
      }
      if (!visitsByDate[dateStr].find((v) => v.barId === row.bar_id)) {
        visitsByDate[dateStr].push({
          barId: row.bar_id,
          barName: row.bar_name,
          barImage: row.bar_image,
          checkedInAt: row.checked_in_at,
          photoUrl: isOwnProfile ? (row.photo_url || null) : null,
        });
      }
    });

    const visits = Object.entries(visitsByDate)
      .map(([date, bars]) => ({
        date,
        bars,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(visits);
  } catch (error) {
    console.error("Get visit history error:", error);
    res.status(500).json({ error: "Failed to fetch visit history" });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.user!.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const userResult = await client.query(
      "SELECT password FROM users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(
      password,
      userResult.rows[0].password,
    );

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    await client.query("BEGIN");

    await client.query(
      "DELETE FROM chat_messages WHERE user_id = $1",
      [userId],
    );

    await client.query(
      "DELETE FROM post_likes WHERE user_id = $1",
      [userId],
    );

    await client.query(
      "DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE user_id = $1)",
      [userId],
    );

    await client.query(
      "DELETE FROM posts WHERE user_id = $1",
      [userId],
    );

    await client.query(
      "DELETE FROM check_ins WHERE user_id = $1",
      [userId],
    );

    await client.query(
      "DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1",
      [userId],
    );

    await client.query(
      "DELETE FROM notifications WHERE user_id = $1",
      [userId],
    );

    await client.query(
      "DELETE FROM users WHERE id = $1",
      [userId],
    );

    await client.query("COMMIT");

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  } finally {
    client.release();
  }
};
