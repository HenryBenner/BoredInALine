import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { registerAdmin, loginAdmin, getAdminProfile } from '../controllers/adminAuthController';
import { authenticateAdmin, AdminAuthRequest } from '../middleware/adminAuth';
import pool from '../config/database';
import multer from 'multer';
import { UploadService } from '../services/uploadService';
import { runCleanup } from '../jobs/cleanup';

const router = Router();
const uploadService = new UploadService();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post(
  '/auth/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('barName').notEmpty().withMessage('Bar name is required'),
    body('barAddress').notEmpty().withMessage('Bar address is required'),
  ],
  registerAdmin
);

router.post(
  '/auth/login',
  [
    body('password').notEmpty().withMessage('Password is required'),
  ],
  loginAdmin
);

router.get('/profile', authenticateAdmin, getAdminProfile);

router.get('/deals', authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM bar_deals WHERE bar_id = $1 ORDER BY day_of_week, start_time`,
      [req.admin!.barId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

router.post(
  '/deals',
  authenticateAdmin,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').optional().isString(),
    body('day_of_week').isInt({ min: 0, max: 6 }).withMessage('Day of week must be between 0 and 6'),
    body('start_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid start time format'),
    body('end_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid end time format'),
    body('is_active').optional().isBoolean(),
  ],
  async (req: AdminAuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, day_of_week, start_time, end_time, is_active } = req.body;

      const result = await pool.query(
        `INSERT INTO bar_deals (bar_id, title, description, day_of_week, start_time, end_time, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [req.admin!.barId, title, description, day_of_week, start_time, end_time, is_active ?? true, req.admin!.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating deal:', error);
      res.status(500).json({ error: 'Failed to create deal' });
    }
  }
);

router.put(
  '/deals/:id',
  authenticateAdmin,
  [
    param('id').isUUID().withMessage('Invalid deal ID'),
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().isString(),
    body('day_of_week').optional().isInt({ min: 0, max: 6 }).withMessage('Day of week must be between 0 and 6'),
    body('start_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid start time format'),
    body('end_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid end time format'),
    body('is_active').optional().isBoolean(),
  ],
  async (req: AdminAuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      const existingDeal = await pool.query(
        'SELECT * FROM bar_deals WHERE id = $1',
        [id]
      );

      if (existingDeal.rows.length === 0) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      if (existingDeal.rows[0].bar_id !== req.admin!.barId) {
        return res.status(403).json({ error: 'Unauthorized to modify this deal' });
      }

      const { title, description, day_of_week, start_time, end_time, is_active } = req.body;
      const current = existingDeal.rows[0];

      const result = await pool.query(
        `UPDATE bar_deals 
         SET title = $1, description = $2, day_of_week = $3, start_time = $4, end_time = $5, is_active = $6
         WHERE id = $7
         RETURNING *`,
        [
          title ?? current.title,
          description ?? current.description,
          day_of_week ?? current.day_of_week,
          start_time ?? current.start_time,
          end_time ?? current.end_time,
          is_active ?? current.is_active,
          id
        ]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating deal:', error);
      res.status(500).json({ error: 'Failed to update deal' });
    }
  }
);

router.delete(
  '/deals/:id',
  authenticateAdmin,
  [param('id').isUUID().withMessage('Invalid deal ID')],
  async (req: AdminAuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      const existingDeal = await pool.query(
        'SELECT * FROM bar_deals WHERE id = $1',
        [id]
      );

      if (existingDeal.rows.length === 0) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      if (existingDeal.rows[0].bar_id !== req.admin!.barId) {
        return res.status(403).json({ error: 'Unauthorized to delete this deal' });
      }

      await pool.query('DELETE FROM bar_deals WHERE id = $1', [id]);

      res.json({ message: 'Deal deleted successfully' });
    } catch (error) {
      console.error('Error deleting deal:', error);
      res.status(500).json({ error: 'Failed to delete deal' });
    }
  }
);

router.get('/events', authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM bar_events WHERE bar_id = $1 ORDER BY event_date, start_time`,
      [req.admin!.barId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post(
  '/events',
  authenticateAdmin,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').optional().isString(),
    body('event_date').isDate().withMessage('Valid event date is required'),
    body('start_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid start time format'),
    body('end_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid end time format'),
    body('cover_charge').optional().isFloat({ min: 0 }).withMessage('Cover charge must be a positive number'),
    body('image_url').optional().isString(),
    body('is_published').optional().isBoolean(),
  ],
  async (req: AdminAuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, event_date, start_time, end_time, cover_charge, image_url, is_published } = req.body;

      const result = await pool.query(
        `INSERT INTO bar_events (bar_id, title, description, event_date, start_time, end_time, cover_charge, image_url, is_published, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [req.admin!.barId, title, description, event_date, start_time, end_time, cover_charge ?? 0, image_url, is_published ?? false, req.admin!.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  }
);

router.put(
  '/events/:id',
  authenticateAdmin,
  [
    param('id').isUUID().withMessage('Invalid event ID'),
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().isString(),
    body('event_date').optional().isDate().withMessage('Valid event date is required'),
    body('start_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid start time format'),
    body('end_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid end time format'),
    body('cover_charge').optional().isFloat({ min: 0 }).withMessage('Cover charge must be a positive number'),
    body('image_url').optional().isString(),
    body('is_published').optional().isBoolean(),
  ],
  async (req: AdminAuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      const existingEvent = await pool.query(
        'SELECT * FROM bar_events WHERE id = $1',
        [id]
      );

      if (existingEvent.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      if (existingEvent.rows[0].bar_id !== req.admin!.barId) {
        return res.status(403).json({ error: 'Unauthorized to modify this event' });
      }

      const { title, description, event_date, start_time, end_time, cover_charge, image_url, is_published } = req.body;
      const current = existingEvent.rows[0];

      const result = await pool.query(
        `UPDATE bar_events 
         SET title = $1, description = $2, event_date = $3, start_time = $4, end_time = $5, cover_charge = $6, image_url = $7, is_published = $8
         WHERE id = $9
         RETURNING *`,
        [
          title ?? current.title,
          description ?? current.description,
          event_date ?? current.event_date,
          start_time ?? current.start_time,
          end_time ?? current.end_time,
          cover_charge ?? current.cover_charge,
          image_url ?? current.image_url,
          is_published ?? current.is_published,
          id
        ]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Failed to update event' });
    }
  }
);

router.delete(
  '/events/:id',
  authenticateAdmin,
  [param('id').isUUID().withMessage('Invalid event ID')],
  async (req: AdminAuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      const existingEvent = await pool.query(
        'SELECT * FROM bar_events WHERE id = $1',
        [id]
      );

      if (existingEvent.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      if (existingEvent.rows[0].bar_id !== req.admin!.barId) {
        return res.status(403).json({ error: 'Unauthorized to delete this event' });
      }

      await pool.query('DELETE FROM bar_events WHERE id = $1', [id]);

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Failed to delete event' });
    }
  }
);

router.get('/bar', authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, address, music_type, cover_charge, crowd_level, specials, 
              image_url, rating, latitude, longitude, created_at, updated_at
       FROM bars WHERE id = $1`,
      [req.admin!.barId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bar not found' });
    }

    const bar = result.rows[0];
    res.json({
      id: bar.id,
      name: bar.name,
      address: bar.address,
      musicType: bar.music_type,
      coverCharge: parseFloat(bar.cover_charge) || 0,
      crowdLevel: bar.crowd_level,
      specials: bar.specials || [],
      imageUrl: bar.image_url,
      rating: parseFloat(bar.rating) || 0,
      latitude: bar.latitude ? parseFloat(bar.latitude) : null,
      longitude: bar.longitude ? parseFloat(bar.longitude) : null,
      createdAt: bar.created_at,
      updatedAt: bar.updated_at,
    });
  } catch (error) {
    console.error('Error fetching bar:', error);
    res.status(500).json({ error: 'Failed to fetch bar details' });
  }
});

router.put(
  '/bar',
  authenticateAdmin,
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('address').optional().notEmpty().withMessage('Address cannot be empty'),
    body('musicType').optional().isString(),
    body('coverCharge').optional().isFloat({ min: 0 }).withMessage('Cover charge must be a positive number'),
    body('specials').optional().isArray(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  ],
  async (req: AdminAuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, address, musicType, coverCharge, specials, latitude, longitude } = req.body;

      const existingBar = await pool.query(
        'SELECT * FROM bars WHERE id = $1',
        [req.admin!.barId]
      );

      if (existingBar.rows.length === 0) {
        return res.status(404).json({ error: 'Bar not found' });
      }

      const current = existingBar.rows[0];

      const result = await pool.query(
        `UPDATE bars 
         SET name = $1, address = $2, music_type = $3, cover_charge = $4, 
             specials = $5, latitude = $6, longitude = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING *`,
        [
          name ?? current.name,
          address ?? current.address,
          musicType ?? current.music_type,
          coverCharge ?? current.cover_charge,
          specials ?? current.specials,
          latitude ?? current.latitude,
          longitude ?? current.longitude,
          req.admin!.barId
        ]
      );

      const bar = result.rows[0];
      res.json({
        id: bar.id,
        name: bar.name,
        address: bar.address,
        musicType: bar.music_type,
        coverCharge: parseFloat(bar.cover_charge) || 0,
        crowdLevel: bar.crowd_level,
        specials: bar.specials || [],
        imageUrl: bar.image_url,
        rating: parseFloat(bar.rating) || 0,
        latitude: bar.latitude ? parseFloat(bar.latitude) : null,
        longitude: bar.longitude ? parseFloat(bar.longitude) : null,
        createdAt: bar.created_at,
        updatedAt: bar.updated_at,
      });
    } catch (error) {
      console.error('Error updating bar:', error);
      res.status(500).json({ error: 'Failed to update bar' });
    }
  }
);

router.post(
  '/bar/image',
  authenticateAdmin,
  upload.single('file') as any,
  async (req: AdminAuthRequest, res: Response) => {
    try {
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

      const result = await uploadService.uploadFile(buffer, normalizedMimeType, req.admin!.barId, 'bars');

      await pool.query(
        'UPDATE bars SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [result.publicUrl, req.admin!.barId]
      );

      const barResult = await pool.query(
        'SELECT * FROM bars WHERE id = $1',
        [req.admin!.barId]
      );

      const bar = barResult.rows[0];
      res.json({
        imageUrl: result.publicUrl,
        bar: {
          id: bar.id,
          name: bar.name,
          address: bar.address,
          musicType: bar.music_type,
          coverCharge: parseFloat(bar.cover_charge) || 0,
          crowdLevel: bar.crowd_level,
          specials: bar.specials || [],
          imageUrl: bar.image_url,
          rating: parseFloat(bar.rating) || 0,
          latitude: bar.latitude ? parseFloat(bar.latitude) : null,
          longitude: bar.longitude ? parseFloat(bar.longitude) : null,
        },
      });
    } catch (error: any) {
      console.error('Bar image upload error:', error);
      res.status(500).json({ error: 'Failed to upload bar image' });
    }
  }
);

router.post('/cleanup', authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    console.log(`🧹 Manual cleanup triggered by admin ${req.admin!.email}`);
    const result = await runCleanup();
    res.json({ 
      message: 'Cleanup completed successfully',
      ...result
    });
  } catch (error) {
    console.error('Manual cleanup failed:', error);
    res.status(500).json({ error: 'Failed to run cleanup' });
  }
});

export default router;
