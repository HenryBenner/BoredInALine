import { Response } from 'express';
import { validationResult } from 'express-validator';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { checkContent } from '../utils/contentFilter';

export const getPostById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        p.*,
        u.name as user_name,
        u.profile_image as user_image,
        b.name as bar_name,
        COUNT(DISTINCT pl.user_id) as likes,
        CASE WHEN $2::uuid IS NOT NULL THEN 
          EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $2)
        ELSE false END as user_liked,
        rp.id as reply_to_post_id,
        rp.content as reply_to_content,
        ru.name as reply_to_user_name,
        rp.is_anonymous as reply_to_is_anonymous,
        (SELECT COUNT(*) FROM posts WHERE reply_to_id = p.id) as reply_count,
        CASE WHEN $2::uuid IS NOT NULL THEN 
          EXISTS(
            SELECT 1 FROM friendships 
            WHERE ((user_id = $2 AND friend_id = p.user_id) 
               OR (user_id = p.user_id AND friend_id = $2))
            AND status = 'accepted'
          )
        ELSE false END as is_friend,
        CASE WHEN $2::uuid IS NOT NULL THEN 
          EXISTS(
            SELECT 1 FROM friendships 
            WHERE user_id = $2 AND friend_id = p.user_id AND status = 'pending'
          )
        ELSE false END as request_sent
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN bars b ON p.bar_id = b.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id
      LEFT JOIN posts rp ON p.reply_to_id = rp.id
      LEFT JOIN users ru ON rp.user_id = ru.id
      WHERE p.id = $1
      GROUP BY p.id, u.name, u.profile_image, b.name, rp.id, rp.content, ru.name, rp.is_anonymous`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const row = result.rows[0];
    
    const reactionsResult = await pool.query(
      `SELECT emoji, COUNT(*) as count,
        CASE WHEN $2::uuid IS NOT NULL THEN 
          EXISTS(SELECT 1 FROM post_reactions WHERE post_id = $1 AND emoji = pr.emoji AND user_id = $2)
        ELSE false END as user_reacted
      FROM post_reactions pr
      WHERE post_id = $1
      GROUP BY emoji`,
      [id, userId]
    );
    
    const reactions = reactionsResult.rows.map(r => ({
      emoji: r.emoji,
      count: parseInt(r.count),
      userReacted: r.user_reacted
    }));

    const post = {
      id: row.id,
      userId: row.is_anonymous ? null : row.user_id,
      userName: row.is_anonymous ? 'Anonymous' : row.user_name,
      userImage: row.is_anonymous ? null : row.user_image,
      barId: row.bar_id,
      barName: row.bar_name,
      content: row.content,
      imageUrl: row.image_url,
      timestamp: row.created_at,
      likes: parseInt(row.likes),
      userLiked: row.user_liked,
      isAnonymous: row.is_anonymous || false,
      replyToId: row.reply_to_post_id || null,
      replyToContent: row.reply_to_content || null,
      replyToUserName: row.reply_to_is_anonymous ? 'Anonymous' : (row.reply_to_user_name || null),
      replyCount: parseInt(row.reply_count) || 0,
      reactions: reactions,
      isFriend: row.is_friend || false,
      requestSent: row.request_sent || false,
    };

    res.json(post);
  } catch (error) {
    console.error('Get post by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
};

export const getPosts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;

    const result = await pool.query(
      `SELECT 
        p.*,
        u.name as user_name,
        u.profile_image as user_image,
        b.name as bar_name,
        COUNT(DISTINCT pl.user_id) as likes,
        CASE WHEN $1::uuid IS NOT NULL THEN 
          EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1)
        ELSE false END as user_liked,
        rp.id as reply_to_post_id,
        rp.content as reply_to_content,
        ru.name as reply_to_user_name,
        rp.is_anonymous as reply_to_is_anonymous,
        (SELECT COUNT(*) FROM posts WHERE reply_to_id = p.id) as reply_count,
        CASE WHEN $1::uuid IS NOT NULL THEN 
          EXISTS(
            SELECT 1 FROM friendships 
            WHERE ((user_id = $1 AND friend_id = p.user_id) 
               OR (user_id = p.user_id AND friend_id = $1))
            AND status = 'accepted'
          )
        ELSE false END as is_friend,
        CASE WHEN $1::uuid IS NOT NULL THEN 
          EXISTS(
            SELECT 1 FROM friendships 
            WHERE user_id = $1 AND friend_id = p.user_id AND status = 'pending'
          )
        ELSE false END as request_sent
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN bars b ON p.bar_id = b.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id
      LEFT JOIN posts rp ON p.reply_to_id = rp.id
      LEFT JOIN users ru ON rp.user_id = ru.id
      WHERE p.reply_to_id IS NULL
      AND ($1::uuid IS NULL OR p.user_id NOT IN (SELECT blocked_user_id FROM user_blocks WHERE blocker_id = $1))
      GROUP BY p.id, u.name, u.profile_image, b.name, rp.id, rp.content, ru.name, rp.is_anonymous
      ORDER BY p.created_at DESC
      LIMIT 50`,
      [userId]
    );

    const postIds = result.rows.map(row => row.id);
    
    let reactionsMap: Record<string, Array<{emoji: string, count: number, userReacted: boolean}>> = {};
    if (postIds.length > 0) {
      const reactionsResult = await pool.query(
        `SELECT post_id, emoji, COUNT(*) as count,
          CASE WHEN $2::uuid IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM post_reactions WHERE post_id = pr.post_id AND emoji = pr.emoji AND user_id = $2)
          ELSE false END as user_reacted
        FROM post_reactions pr
        WHERE post_id = ANY($1)
        GROUP BY post_id, emoji`,
        [postIds, userId]
      );
      
      reactionsResult.rows.forEach(row => {
        if (!reactionsMap[row.post_id]) {
          reactionsMap[row.post_id] = [];
        }
        reactionsMap[row.post_id].push({
          emoji: row.emoji,
          count: parseInt(row.count),
          userReacted: row.user_reacted
        });
      });
    }

    const posts = result.rows.map(row => ({
      id: row.id,
      userId: row.is_anonymous ? null : row.user_id,
      userName: row.is_anonymous ? 'Anonymous' : row.user_name,
      userImage: row.is_anonymous ? null : row.user_image,
      barId: row.bar_id,
      barName: row.bar_name,
      content: row.content,
      imageUrl: row.image_url,
      timestamp: row.created_at,
      likes: parseInt(row.likes),
      userLiked: row.user_liked,
      isAnonymous: row.is_anonymous || false,
      replyToId: row.reply_to_post_id || null,
      replyToContent: row.reply_to_content || null,
      replyToUserName: row.reply_to_is_anonymous ? 'Anonymous' : (row.reply_to_user_name || null),
      replyCount: parseInt(row.reply_count) || 0,
      reactions: reactionsMap[row.id] || [],
      isFriend: row.is_friend || false,
      requestSent: row.request_sent || false,
    }));

    res.json(posts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const { content, barId, imageUrl, replyToId } = req.body;

    if (content) {
      const filterResult = await checkContent(content);
      if (!filterResult.isClean) {
        return res.status(400).json({ error: 'Your post contains inappropriate content. Please revise and try again.' });
      }
    }

    if (replyToId) {
      const parentPost = await pool.query('SELECT id FROM posts WHERE id = $1', [replyToId]);
      if (parentPost.rows.length === 0) {
        return res.status(404).json({ error: 'Parent post not found' });
      }
    }

    const result = await pool.query(
      `INSERT INTO posts (user_id, bar_id, content, image_url, is_anonymous, reply_to_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, barId, content, imageUrl || null, false, replyToId || null]
    );

    const userResult = await pool.query(
      'SELECT name, profile_image FROM users WHERE id = $1',
      [userId]
    );

    const post = {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      userName: userResult.rows[0].name,
      userImage: userResult.rows[0].profile_image,
      barId: result.rows[0].bar_id,
      content: result.rows[0].content,
      imageUrl: result.rows[0].image_url,
      timestamp: result.rows[0].created_at,
      likes: 0,
      isAnonymous: false,
      replyToId: result.rows[0].reply_to_id || null,
      replyCount: 0,
      reactions: [],
    };

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

export const likePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const post = await pool.query(
      'SELECT id FROM posts WHERE id = $1',
      [id]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await pool.query(
      'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, userId]
    );

    const result = await pool.query(
      'SELECT COUNT(*) as likes FROM post_likes WHERE post_id = $1',
      [id]
    );

    res.json({ likes: parseInt(result.rows[0].likes) });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
};

export const unlikePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await pool.query(
      'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [id, userId]
    );

    const result = await pool.query(
      'SELECT COUNT(*) as likes FROM post_likes WHERE post_id = $1',
      [id]
    );

    res.json({ likes: parseInt(result.rows[0].likes) });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
};

export const addReaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const post = await pool.query('SELECT id FROM posts WHERE id = $1', [id]);
    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await pool.query(
      'INSERT INTO post_reactions (post_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT (post_id, user_id, emoji) DO NOTHING',
      [id, userId, emoji]
    );

    const reactionsResult = await pool.query(
      `SELECT emoji, COUNT(*) as count FROM post_reactions WHERE post_id = $1 GROUP BY emoji`,
      [id]
    );

    const reactions = reactionsResult.rows.map(row => ({
      emoji: row.emoji,
      count: parseInt(row.count),
      userReacted: true
    }));

    res.json({ reactions });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
};

export const removeReaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    await pool.query(
      'DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND emoji = $3',
      [id, userId, emoji]
    );

    const reactionsResult = await pool.query(
      `SELECT emoji, COUNT(*) as count FROM post_reactions WHERE post_id = $1 GROUP BY emoji`,
      [id]
    );

    const reactions = reactionsResult.rows.map(row => ({
      emoji: row.emoji,
      count: parseInt(row.count),
      userReacted: false
    }));

    res.json({ reactions });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
};

export const getReplies = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        p.*,
        u.name as user_name,
        u.profile_image as user_image,
        b.name as bar_name,
        COUNT(DISTINCT pl.user_id) as likes,
        CASE WHEN $2::uuid IS NOT NULL THEN 
          EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $2)
        ELSE false END as user_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN bars b ON p.bar_id = b.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id
      WHERE p.reply_to_id = $1
      GROUP BY p.id, u.name, u.profile_image, b.name
      ORDER BY p.created_at ASC`,
      [id, userId]
    );

    const postIds = result.rows.map(row => row.id);
    
    let reactionsMap: Record<string, Array<{emoji: string, count: number, userReacted: boolean}>> = {};
    if (postIds.length > 0) {
      const reactionsResult = await pool.query(
        `SELECT post_id, emoji, COUNT(*) as count,
          CASE WHEN $2::uuid IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM post_reactions WHERE post_id = pr.post_id AND emoji = pr.emoji AND user_id = $2)
          ELSE false END as user_reacted
        FROM post_reactions pr
        WHERE post_id = ANY($1)
        GROUP BY post_id, emoji`,
        [postIds, userId]
      );
      
      reactionsResult.rows.forEach(row => {
        if (!reactionsMap[row.post_id]) {
          reactionsMap[row.post_id] = [];
        }
        reactionsMap[row.post_id].push({
          emoji: row.emoji,
          count: parseInt(row.count),
          userReacted: row.user_reacted
        });
      });
    }

    const replies = result.rows.map(row => ({
      id: row.id,
      userId: row.is_anonymous ? null : row.user_id,
      userName: row.is_anonymous ? 'Anonymous' : row.user_name,
      userImage: row.is_anonymous ? null : row.user_image,
      barId: row.bar_id,
      barName: row.bar_name,
      content: row.content,
      imageUrl: row.image_url,
      timestamp: row.created_at,
      likes: parseInt(row.likes),
      userLiked: row.user_liked,
      isAnonymous: row.is_anonymous || false,
      replyToId: row.reply_to_id,
      reactions: reactionsMap[row.id] || [],
    }));

    res.json(replies);
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
};

export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await pool.query(
      'SELECT user_id FROM posts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (result.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    await pool.query('DELETE FROM posts WHERE id = $1', [id]);

    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};
