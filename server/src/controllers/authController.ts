import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database';
import { config } from '../config/env';
import { sendEmail, getPasswordResetEmailHtml } from '../services/emailService';

export const register = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, school, termsAccepted } = req.body;

    if (!termsAccepted) {
      return res.status(400).json({ error: 'You must accept the Terms of Service' });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      `INSERT INTO users (email, password, name, school, profile_image, terms_accepted_at) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) 
       RETURNING id, email, name, school, profile_image, created_at`,
      [email, hashedPassword, name, school, null]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    const userResult = await pool.query(
      'SELECT id, email, name, school, profile_image, notifications_enabled, privacy_public FROM users WHERE id = $1',
      [user.id]
    );

    res.status(201).json({
      user: {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        name: userResult.rows[0].name,
        school: userResult.rows[0].school,
        profileImage: userResult.rows[0].profile_image,
        notificationsEnabled: userResult.rows[0].notifications_enabled,
        privacyPublic: userResult.rows[0].privacy_public,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // First, check if this is a super admin login
    const superAdminResult = await pool.query(
      'SELECT * FROM super_admins WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (superAdminResult.rows.length > 0) {
      const superAdmin = superAdminResult.rows[0];
      const validPassword = await bcrypt.compare(password, superAdmin.password);
      if (validPassword) {
        const token = jwt.sign(
          { id: superAdmin.id, email: superAdmin.email, name: superAdmin.name, isSuperAdmin: true },
          config.jwtSecret,
          { expiresIn: config.jwtExpiration }
        );
        return res.json({
          isSuperAdmin: true,
          superAdmin: { id: superAdmin.id, email: superAdmin.email, name: superAdmin.name },
          token,
        });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if this is a bar admin login
    const adminResult = await pool.query(
      `SELECT ba.*, b.name as bar_name, b.address, b.music_type, b.cover_charge, 
              b.specials, b.image_url, b.latitude, b.longitude, b.hidden, b.bar_note, b.price_level
       FROM bar_admins ba
       JOIN bars b ON ba.bar_id = b.id
       WHERE (ba.email = $1 OR ba.username = $1) AND ba.is_active = true`,
      [email]
    );

    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      const validPassword = await bcrypt.compare(password, admin.password);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email, isBarAdmin: true, barId: admin.bar_id },
        config.jwtSecret,
        { expiresIn: config.jwtExpiration }
      );

      return res.json({
        isBarAdmin: true,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          username: admin.username,
          role: admin.role,
        },
        bar: {
          id: admin.bar_id,
          name: admin.bar_name,
          address: admin.address,
          musicType: admin.music_type,
          coverCharge: admin.cover_charge,
          specials: admin.specials || [],
          imageUrl: admin.image_url,
          latitude: admin.latitude,
          longitude: admin.longitude,
          hidden: admin.hidden || false,
          barNote: admin.bar_note,
          priceLevel: admin.price_level || 2,
        },
        token,
      });
    }

    // Regular user login - check by email or username
    const result = await pool.query(
      `SELECT u.*, 
        (SELECT COUNT(*) FROM friendships f 
         WHERE (f.user_id = u.id OR f.friend_id = u.id) AND f.status = 'accepted') as friend_count
      FROM users u WHERE u.email = $1 OR u.username = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Guard: social-only accounts have no password
    if (!user.password) {
      return res.status(401).json({ error: 'This account uses social login. Please sign in with Google or Apple.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended', reason: user.ban_reason });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        school: user.school,
        profileImage: user.profile_image,
        notificationsEnabled: user.notifications_enabled,
        privacyPublic: user.privacy_public,
        friendCount: parseInt(user.friend_count) || 0,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account exists with that email, you will receive a reset link shortly.' });
    }

    const user = result.rows[0];

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate old tokens for this user
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    // Store new token
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const rawDomain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPLIT_DEV_DOMAIN;
    const protocol = rawDomain ? 'https' : 'http';
    const domain = rawDomain || 'localhost:5000';
    const resetUrl = `${protocol}://${domain}/auth/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your Bored in a Line password',
      html: getPasswordResetEmailHtml(resetUrl),
    });

    console.log('Password reset email sent to:', user.email);

    res.json({ message: 'If an account exists with that email, you will receive a reset link shortly.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await pool.query(
      `SELECT prt.*, u.email FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 AND prt.used = false AND prt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const resetToken = result.rows[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [
      hashedPassword,
      resetToken.user_id,
    ]);

    await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    // Fetch user info from Google
    const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!googleResponse.ok) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const googleUser = await googleResponse.json() as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };

    const { sub: googleId, email, name, picture } = googleUser;

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Invalid Google account data' });
    }

    // Check if user exists by google_id or email
    let userResult = await pool.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [googleId, email.toLowerCase()]
    );

    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];

      if (user.is_banned) {
        return res.status(403).json({ error: 'Your account has been suspended', reason: user.ban_reason });
      }

      // Link google_id if not already linked
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id = $1, updated_at = NOW() WHERE id = $2', [
          googleId,
          user.id,
        ]);
        user.google_id = googleId;
      }
    } else {
      // Create new user
      const newUserResult = await pool.query(
        `INSERT INTO users (email, name, google_id, profile_image, terms_accepted_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING id, email, name, school, profile_image, notifications_enabled, privacy_public`,
        [email.toLowerCase(), name, googleId, picture || null]
      );
      user = newUserResult.rows[0];
    }

    const friendCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        school: user.school,
        profileImage: user.profile_image,
        notificationsEnabled: user.notifications_enabled,
        privacyPublic: user.privacy_public,
        friendCount: parseInt(friendCountResult.rows[0].count) || 0,
      },
      token,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google sign-in failed. Please try again.' });
  }
};

export const appleAuth = async (req: Request, res: Response) => {
  try {
    const { identityToken, name } = req.body;

    if (!identityToken) {
      return res.status(400).json({ error: 'Identity token is required' });
    }

    // Verify Apple identity token against Apple's JWKS
    let appleId: string;
    let email: string | undefined;
    try {
      const { createRemoteJWKSet, jwtVerify } = await import('jose');
      const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');
      const appleJwks = createRemoteJWKSet(APPLE_JWKS_URL);

      const { payload } = await jwtVerify(identityToken, appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience: 'com.boredinline.app',
      });

      if (!payload.sub) {
        return res.status(401).json({ error: 'Invalid Apple identity token: missing subject' });
      }
      appleId = payload.sub;
      email = typeof payload.email === 'string' ? payload.email : undefined;
    } catch (verifyErr) {
      console.error('Apple token verification failed:', verifyErr);
      return res.status(401).json({ error: 'Invalid Apple identity token' });
    }

    // Check if user exists by apple_id or email
    let userResult = await pool.query(
      'SELECT * FROM users WHERE apple_id = $1' + (email ? ' OR email = $2' : ''),
      email ? [appleId, email.toLowerCase()] : [appleId]
    );

    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];

      if (user.is_banned) {
        return res.status(403).json({ error: 'Your account has been suspended', reason: user.ban_reason });
      }

      // Link apple_id if not already linked
      if (!user.apple_id) {
        await pool.query('UPDATE users SET apple_id = $1, updated_at = NOW() WHERE id = $2', [
          appleId,
          user.id,
        ]);
        user.apple_id = appleId;
      }
    } else {
      // Create new user — Apple only provides email on first sign-in
      const userName = name || (email ? email.split('@')[0] : 'Apple User');
      const userEmail = email ? email.toLowerCase() : `apple_${appleId}@privaterelay.appleid.com`;

      const newUserResult = await pool.query(
        `INSERT INTO users (email, name, apple_id, terms_accepted_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING id, email, name, school, profile_image, notifications_enabled, privacy_public`,
        [userEmail, userName, appleId]
      );
      user = newUserResult.rows[0];
    }

    const friendCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        school: user.school,
        profileImage: user.profile_image,
        notificationsEnabled: user.notifications_enabled,
        privacyPublic: user.privacy_public,
        friendCount: parseInt(friendCountResult.rows[0].count) || 0,
      },
      token,
    });
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ error: 'Apple sign-in failed. Please try again.' });
  }
};
