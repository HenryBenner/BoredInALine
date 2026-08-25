import { Response, Request } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

interface BarAdminRequest extends Request {
  admin?: {
    id: string;
    barId: string;
  };
}

export const getAllBars = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const query = `
      SELECT 
        b.*,
        COUNT(DISTINCT ci.user_id) FILTER (WHERE ci.checked_out_at IS NULL) as current_users,
        COUNT(DISTINCT CASE 
          WHEN f.user_id = $1 AND ci2.user_id = f.friend_id THEN f.friend_id
          WHEN f.friend_id = $1 AND ci2.user_id = f.user_id THEN f.user_id
        END) as friends_here,
        EXISTS (SELECT 1 FROM bar_deals bd WHERE bd.bar_id = b.id AND bd.is_active = true) as has_active_deals,
        ARRAY(SELECT title FROM bar_deals WHERE bar_id = b.id AND is_active = true ORDER BY created_at LIMIT 3) as active_deal_titles
      FROM bars b
      LEFT JOIN check_ins ci ON b.id = ci.bar_id AND ci.checked_out_at IS NULL
      LEFT JOIN friendships f ON (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
      LEFT JOIN check_ins ci2 ON ci2.bar_id = b.id AND ci2.checked_out_at IS NULL
        AND (
          (f.user_id = $1 AND ci2.user_id = f.friend_id) OR
          (f.friend_id = $1 AND ci2.user_id = f.user_id)
        )
      WHERE b.hidden IS NOT TRUE
      GROUP BY b.id
      ORDER BY b.name
    `;

    const result = await pool.query(query, [userId || null]);

    const bars = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      address: row.address,
      musicType: row.music_type,
      coverCharge: row.cover_charge,
      crowdLevel: row.crowd_level,
      distance: row.distance || 0,
      friendsHere: parseInt(row.friends_here) || 0,
      specials: row.specials || [],
      imageUrl: row.image_url,
      rating: parseFloat(row.rating) || 0,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      barNote: row.bar_note,
      priceLevel: row.price_level || 2,
      hasActiveDeals: row.has_active_deals === true,
      activeDealTitles: row.active_deal_titles || [],
    }));

    res.json(bars);
  } catch (error) {
    console.error('Get bars error:', error);
    res.status(500).json({ error: 'Failed to fetch bars' });
  }
};

export const getBarById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT 
        b.*,
        COUNT(DISTINCT ci.user_id) FILTER (WHERE ci.checked_out_at IS NULL) as current_users,
        COUNT(DISTINCT CASE 
          WHEN f.user_id = $2 AND ci2.user_id = f.friend_id THEN f.friend_id
          WHEN f.friend_id = $2 AND ci2.user_id = f.user_id THEN f.user_id
        END) as friends_here
      FROM bars b
      LEFT JOIN check_ins ci ON b.id = ci.bar_id AND ci.checked_out_at IS NULL
      LEFT JOIN friendships f ON (f.user_id = $2 OR f.friend_id = $2) AND f.status = 'accepted'
      LEFT JOIN check_ins ci2 ON ci2.bar_id = b.id AND ci2.checked_out_at IS NULL
        AND (
          (f.user_id = $2 AND ci2.user_id = f.friend_id) OR
          (f.friend_id = $2 AND ci2.user_id = f.user_id)
        )
      WHERE b.id = $1
      GROUP BY b.id`,
      [id, userId || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bar not found' });
    }

    const row = result.rows[0];
    const bar = {
      id: row.id,
      name: row.name,
      address: row.address,
      musicType: row.music_type,
      coverCharge: row.cover_charge,
      crowdLevel: row.crowd_level,
      distance: row.distance || 0,
      friendsHere: parseInt(row.friends_here) || 0,
      specials: row.specials || [],
      imageUrl: row.image_url,
      rating: parseFloat(row.rating) || 0,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      barNote: row.bar_note,
      priceLevel: row.price_level || 2,
    };

    res.json(bar);
  } catch (error) {
    console.error('Get bar error:', error);
    res.status(500).json({ error: 'Failed to fetch bar' });
  }
};

export const getCrowdLevel = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        COUNT(DISTINCT user_id) as count,
        b.crowd_level
      FROM check_ins ci
      JOIN bars b ON b.id = ci.bar_id
      WHERE ci.bar_id = $1 AND ci.checked_out_at IS NULL
      GROUP BY b.crowd_level`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.json({ count: 0, level: 'empty' });
    }

    res.json({
      count: parseInt(result.rows[0].count),
      level: result.rows[0].crowd_level,
    });
  } catch (error) {
    console.error('Get crowd level error:', error);
    res.status(500).json({ error: 'Failed to fetch crowd level' });
  }
};

export const updateBar = async (req: BarAdminRequest, res: Response) => {
  try {
    const barId = req.admin?.barId;
    
    if (!barId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      name, 
      address, 
      musicType, 
      coverCharge, 
      specials, 
      imageUrl, 
      latitude, 
      longitude,
      hidden,
      barNote,
      priceLevel
    } = req.body;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(address);
    }
    if (musicType !== undefined) {
      updates.push(`music_type = $${paramIndex++}`);
      values.push(musicType);
    }
    if (coverCharge !== undefined) {
      updates.push(`cover_charge = $${paramIndex++}`);
      values.push(coverCharge);
    }
    if (specials !== undefined) {
      updates.push(`specials = $${paramIndex++}`);
      values.push(specials);
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(imageUrl);
    }
    if (latitude !== undefined) {
      updates.push(`latitude = $${paramIndex++}`);
      values.push(latitude);
    }
    if (longitude !== undefined) {
      updates.push(`longitude = $${paramIndex++}`);
      values.push(longitude);
    }
    if (hidden !== undefined) {
      updates.push(`hidden = $${paramIndex++}`);
      values.push(hidden);
    }
    if (barNote !== undefined) {
      updates.push(`bar_note = $${paramIndex++}`);
      values.push(barNote);
    }
    if (priceLevel !== undefined) {
      updates.push(`price_level = $${paramIndex++}`);
      values.push(priceLevel);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(barId);

    const query = `
      UPDATE bars 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bar not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      address: row.address,
      musicType: row.music_type,
      coverCharge: row.cover_charge,
      specials: row.specials || [],
      imageUrl: row.image_url,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      hidden: row.hidden || false,
      barNote: row.bar_note,
      priceLevel: row.price_level || 2,
    });
  } catch (error) {
    console.error('Update bar error:', error);
    res.status(500).json({ error: 'Failed to update bar' });
  }
};

export const getBarForAdmin = async (req: BarAdminRequest, res: Response) => {
  try {
    const barId = req.admin?.barId;
    
    if (!barId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT * FROM bars WHERE id = $1`,
      [barId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bar not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      address: row.address,
      musicType: row.music_type,
      coverCharge: row.cover_charge,
      specials: row.specials || [],
      imageUrl: row.image_url,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      hidden: row.hidden || false,
      barNote: row.bar_note,
      priceLevel: row.price_level || 2,
    });
  } catch (error) {
    console.error('Get bar for admin error:', error);
    res.status(500).json({ error: 'Failed to fetch bar' });
  }
};
