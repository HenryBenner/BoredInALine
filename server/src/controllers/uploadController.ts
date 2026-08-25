import { Response, Request } from 'express';
import { AuthRequest, BarAdminRequest } from '../middleware/auth';
import { uploadService } from '../services/uploadService';
import pool from '../config/database';

export const uploadMedia = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { mimetype, size, buffer } = req.file;

    const validation = uploadService.validateRequest(mimetype, size);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await uploadService.uploadFile(buffer, mimetype, userId);
    
    res.json(result);
  } catch (error: any) {
    console.error('Upload error:', error);
    const errorMessage = error?.message || 'Failed to upload file';
    
    if (errorMessage.includes('Object storage') || errorMessage.includes('bucket')) {
      return res.status(503).json({ 
        error: 'Photo/video uploads are temporarily unavailable. Please try posting without media.'
      });
    }
    
    res.status(500).json({ error: errorMessage });
  }
};

export const serveMedia = async (req: Request, res: Response) => {
  try {
    const objectPath = req.params[0];
    
    if (!objectPath) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const file = await uploadService.downloadFile(objectPath);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(file.data);
  } catch (error: any) {
    console.error('Serve media error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
};

export const uploadProfileImage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { mimetype, size, buffer } = req.file;

    let normalizedMimeType = (mimetype || '').toLowerCase();
    
    if (!normalizedMimeType || 
        normalizedMimeType === 'image' || 
        normalizedMimeType === 'application/octet-stream' ||
        !normalizedMimeType.includes('/')) {
      normalizedMimeType = 'image/jpeg';
    }
    
    if (!normalizedMimeType.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed for profile pictures' });
    }
    
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(normalizedMimeType)) {
      normalizedMimeType = 'image/jpeg';
    }

    const validation = uploadService.validateRequest(normalizedMimeType, size);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await uploadService.uploadFile(buffer, normalizedMimeType, userId, 'profiles');
    
    await pool.query(
      'UPDATE users SET profile_image = $1 WHERE id = $2',
      [result.publicUrl, userId]
    );

    const userResult = await pool.query(
      `SELECT id, email, name, school, profile_image, notifications_enabled, privacy_public,
        (SELECT COUNT(*) FROM friendships f 
         WHERE (f.user_id = users.id OR f.friend_id = users.id) AND f.status = 'accepted') as friend_count
      FROM users WHERE id = $1`,
      [userId]
    );

    const user = {
      id: userResult.rows[0].id,
      email: userResult.rows[0].email,
      name: userResult.rows[0].name,
      school: userResult.rows[0].school,
      profileImage: userResult.rows[0].profile_image,
      notificationsEnabled: userResult.rows[0].notifications_enabled,
      privacyPublic: userResult.rows[0].privacy_public,
      friendCount: parseInt(userResult.rows[0].friend_count) || 0,
    };
    
    res.json({ user, imageUrl: result.publicUrl });
  } catch (error: any) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
};

export const uploadBarImage = async (req: BarAdminRequest, res: Response) => {
  try {
    const barId = req.admin?.barId;
    
    if (!barId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { mimetype, size, buffer } = req.file;

    let normalizedMimeType = (mimetype || '').toLowerCase();
    
    if (!normalizedMimeType || 
        normalizedMimeType === 'image' || 
        normalizedMimeType === 'application/octet-stream' ||
        !normalizedMimeType.includes('/')) {
      normalizedMimeType = 'image/jpeg';
    }
    
    if (!normalizedMimeType.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed for bar images' });
    }
    
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(normalizedMimeType)) {
      normalizedMimeType = 'image/jpeg';
    }

    const validation = uploadService.validateRequest(normalizedMimeType, size);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await uploadService.uploadFile(buffer, normalizedMimeType, barId, 'bars');
    
    await pool.query(
      'UPDATE bars SET image_url = $1, updated_at = NOW() WHERE id = $2',
      [result.publicUrl, barId]
    );
    
    res.json({ imageUrl: result.publicUrl });
  } catch (error: any) {
    console.error('Bar image upload error:', error);
    res.status(500).json({ error: 'Failed to upload bar image' });
  }
};
