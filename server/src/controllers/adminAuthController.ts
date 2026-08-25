import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { config } from '../config/env';

export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, barName, barAddress, barId } = req.body;

    const existingAdmin = await pool.query(
      'SELECT id FROM bar_admins WHERE email = $1',
      [email]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let bar;
    
    if (barId) {
      const existingBar = await pool.query(
        'SELECT id, name, address FROM bars WHERE id = $1',
        [barId]
      );
      
      if (existingBar.rows.length === 0) {
        return res.status(400).json({ error: 'Bar not found' });
      }
      
      const barHasAdmin = await pool.query(
        'SELECT id FROM bar_admins WHERE bar_id = $1 AND is_active = true',
        [barId]
      );
      
      if (barHasAdmin.rows.length > 0) {
        return res.status(400).json({ error: 'This bar already has an active admin. Contact support if you believe this is an error.' });
      }
      
      bar = existingBar.rows[0];
    } else if (barName && barAddress) {
      const existingBar = await pool.query(
        'SELECT id, name, address FROM bars WHERE LOWER(name) = LOWER($1) AND LOWER(address) = LOWER($2)',
        [barName, barAddress]
      );
      
      if (existingBar.rows.length > 0) {
        const barHasAdmin = await pool.query(
          'SELECT id FROM bar_admins WHERE bar_id = $1 AND is_active = true',
          [existingBar.rows[0].id]
        );
        
        if (barHasAdmin.rows.length > 0) {
          return res.status(400).json({ error: 'This bar already has an active admin. Contact support if you believe this is an error.' });
        }
        
        bar = existingBar.rows[0];
      } else {
        const barResult = await pool.query(
          `INSERT INTO bars (name, address)
           VALUES ($1, $2)
           RETURNING id, name, address, created_at`,
          [barName, barAddress]
        );
        bar = barResult.rows[0];
      }
    } else {
      return res.status(400).json({ error: 'Either barId or barName and barAddress are required' });
    }

    const adminResult = await pool.query(
      `INSERT INTO bar_admins (email, password, name, bar_id, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, bar_id, role, is_active, created_at`,
      [email, hashedPassword, name, bar.id, 'owner']
    );

    const admin = adminResult.rows[0];

    const token = jwt.sign(
      { id: admin.id, email: admin.email, barId: admin.bar_id, isAdmin: true },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    res.status(201).json({
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.is_active,
      },
      bar: {
        id: bar.id,
        name: bar.name,
        address: bar.address,
      },
      token,
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Failed to register admin' });
  }
};

export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password } = req.body;
    const loginIdentifier = email || username;

    if (!loginIdentifier) {
      return res.status(400).json({ error: 'Email or username is required' });
    }

    const result = await pool.query(
      `SELECT ba.*, b.name as bar_name, b.address as bar_address
       FROM bar_admins ba
       LEFT JOIN bars b ON ba.bar_id = b.id
       WHERE ba.email = $1 OR ba.username = $1`,
      [loginIdentifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, admin.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, barId: admin.bar_id, isAdmin: true },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    res.json({
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.is_active,
      },
      bar: admin.bar_id ? {
        id: admin.bar_id,
        name: admin.bar_name,
        address: admin.bar_address,
      } : null,
      token,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const getAdminProfile = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id;

    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT ba.id, ba.email, ba.name, ba.role, ba.is_active, ba.bar_id, ba.created_at,
              b.name as bar_name, b.address as bar_address, b.music_type, b.cover_charge,
              b.crowd_level, b.specials, b.image_url, b.rating, b.latitude, b.longitude
       FROM bar_admins ba
       LEFT JOIN bars b ON ba.bar_id = b.id
       WHERE ba.id = $1`,
      [adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const admin = result.rows[0];

    res.json({
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.is_active,
        createdAt: admin.created_at,
      },
      bar: admin.bar_id ? {
        id: admin.bar_id,
        name: admin.bar_name,
        address: admin.bar_address,
        musicType: admin.music_type,
        coverCharge: admin.cover_charge,
        crowdLevel: admin.crowd_level,
        specials: admin.specials,
        imageUrl: admin.image_url,
        rating: admin.rating,
        latitude: admin.latitude,
        longitude: admin.longitude,
      } : null,
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};
