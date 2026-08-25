import { Router, Request, Response } from 'express';
import * as barController from '../controllers/barController';
import { optionalAuth, authenticateBarAdmin } from '../middleware/auth';
import pool from '../config/database';

const router = Router();

router.get('/', optionalAuth, barController.getAllBars);

// Bar admin routes - MUST come before dynamic :id routes
router.get('/admin/my-bar', authenticateBarAdmin, barController.getBarForAdmin);
router.put('/admin/my-bar', authenticateBarAdmin, barController.updateBar);

// Bar admin deals management
router.get('/admin/deals', authenticateBarAdmin, async (req: any, res: Response) => {
  try {
    const barId = req.admin?.barId;
    const result = await pool.query(
      `SELECT * FROM bar_deals WHERE bar_id = $1 ORDER BY day_of_week, start_time`,
      [barId]
    );
    res.json(result.rows.map((row: any) => ({
      id: row.id,
      barId: row.bar_id,
      title: row.title,
      description: row.description,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      isActive: row.is_active,
    })));
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

router.post('/admin/deals', authenticateBarAdmin, async (req: any, res: Response) => {
  try {
    const barId = req.admin?.barId;
    const { title, description, dayOfWeek, startTime, endTime, isActive } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await pool.query(
      `INSERT INTO bar_deals (bar_id, title, description, day_of_week, start_time, end_time, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [barId, title, description, dayOfWeek, startTime, endTime, isActive ?? true, req.admin?.id]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      barId: row.bar_id,
      title: row.title,
      description: row.description,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      isActive: row.is_active,
    });
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

router.put('/admin/deals/:id', authenticateBarAdmin, async (req: any, res: Response) => {
  try {
    const barId = req.admin?.barId;
    const { id } = req.params;
    const { title, description, dayOfWeek, startTime, endTime, isActive } = req.body;

    const existing = await pool.query('SELECT * FROM bar_deals WHERE id = $1 AND bar_id = $2', [id, barId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const current = existing.rows[0];
    const result = await pool.query(
      `UPDATE bar_deals 
       SET title = $1, description = $2, day_of_week = $3, start_time = $4, end_time = $5, is_active = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        title ?? current.title,
        description ?? current.description,
        dayOfWeek ?? current.day_of_week,
        startTime ?? current.start_time,
        endTime ?? current.end_time,
        isActive ?? current.is_active,
        id
      ]
    );

    const row = result.rows[0];
    res.json({
      id: row.id,
      barId: row.bar_id,
      title: row.title,
      description: row.description,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      isActive: row.is_active,
    });
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

router.delete('/admin/deals/:id', authenticateBarAdmin, async (req: any, res: Response) => {
  try {
    const barId = req.admin?.barId;
    const { id } = req.params;

    const existing = await pool.query('SELECT * FROM bar_deals WHERE id = $1 AND bar_id = $2', [id, barId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await pool.query('DELETE FROM bar_deals WHERE id = $1', [id]);
    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

// Bar admin events management
router.get('/admin/events', authenticateBarAdmin, async (req: any, res: Response) => {
  try {
    const barId = req.admin?.barId;
    const result = await pool.query(
      `SELECT * FROM bar_events WHERE bar_id = $1 ORDER BY event_date, start_time`,
      [barId]
    );
    res.json(result.rows.map((row: any) => ({
      id: row.id,
      barId: row.bar_id,
      title: row.title,
      description: row.description,
      eventDate: row.event_date,
      startTime: row.start_time,
      endTime: row.end_time,
      coverCharge: row.cover_charge,
      imageUrl: row.image_url,
      isPublished: row.is_published,
    })));
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/admin/events', authenticateBarAdmin, async (req: any, res: Response) => {
  try {
    const barId = req.admin?.barId;
    const { title, description, eventDate, startTime, endTime, coverCharge, imageUrl, isPublished } = req.body;

    if (!title || !eventDate) {
      return res.status(400).json({ error: 'Title and event date are required' });
    }

    const result = await pool.query(
      `INSERT INTO bar_events (bar_id, title, description, event_date, start_time, end_time, cover_charge, image_url, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [barId, title, description, eventDate, startTime, endTime, coverCharge ?? 0, imageUrl, isPublished ?? false, req.admin?.id]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      barId: row.bar_id,
      title: row.title,
      description: row.description,
      eventDate: row.event_date,
      startTime: row.start_time,
      endTime: row.end_time,
      coverCharge: row.cover_charge,
      imageUrl: row.image_url,
      isPublished: row.is_published,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/admin/events/:id', authenticateBarAdmin, async (req: any, res: Response) => {
  try {
    const barId = req.admin?.barId;
    const { id } = req.params;
    const { title, description, eventDate, startTime, endTime, coverCharge, imageUrl, isPublished } = req.body;

    const existing = await pool.query('SELECT * FROM bar_events WHERE id = $1 AND bar_id = $2', [id, barId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const current = existing.rows[0];
    const result = await pool.query(
      `UPDATE bar_events 
       SET title = $1, description = $2, event_date = $3, start_time = $4, end_time = $5, cover_charge = $6, image_url = $7, is_published = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        title ?? current.title,
        description ?? current.description,
        eventDate ?? current.event_date,
        startTime ?? current.start_time,
        endTime ?? current.end_time,
        coverCharge ?? current.cover_charge,
        imageUrl ?? current.image_url,
        isPublished ?? current.is_published,
        id
      ]
    );

    const row = result.rows[0];
    res.json({
      id: row.id,
      barId: row.bar_id,
      title: row.title,
      description: row.description,
      eventDate: row.event_date,
      startTime: row.start_time,
      endTime: row.end_time,
      coverCharge: row.cover_charge,
      imageUrl: row.image_url,
      isPublished: row.is_published,
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/admin/events/:id', authenticateBarAdmin, async (req: any, res: Response) => {
  try {
    const barId = req.admin?.barId;
    const { id } = req.params;

    const existing = await pool.query('SELECT * FROM bar_events WHERE id = $1 AND bar_id = $2', [id, barId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await pool.query('DELETE FROM bar_events WHERE id = $1', [id]);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Dynamic routes - MUST come after admin routes
router.get('/:id', optionalAuth, barController.getBarById);
router.get('/:id/crowd', barController.getCrowdLevel);

router.get('/:barId/deals', async (req: Request, res: Response) => {
  try {
    const { barId } = req.params;

    const barExists = await pool.query('SELECT id FROM bars WHERE id = $1', [barId]);
    if (barExists.rows.length === 0) {
      return res.status(404).json({ error: 'Bar not found' });
    }

    const result = await pool.query(
      `SELECT id, bar_id, title, description, day_of_week, start_time, end_time, is_active, created_at, updated_at
       FROM bar_deals 
       WHERE bar_id = $1 AND is_active = true 
       ORDER BY day_of_week, start_time`,
      [barId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bar deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

router.get('/:barId/events', async (req: Request, res: Response) => {
  try {
    const { barId } = req.params;

    const barExists = await pool.query('SELECT id FROM bars WHERE id = $1', [barId]);
    if (barExists.rows.length === 0) {
      return res.status(404).json({ error: 'Bar not found' });
    }

    const result = await pool.query(
      `SELECT id, bar_id, title, description, event_date, start_time, end_time, cover_charge, image_url, is_published, created_at, updated_at
       FROM bar_events 
       WHERE bar_id = $1 AND is_published = true AND event_date >= CURRENT_DATE
       ORDER BY event_date, start_time`,
      [barId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bar events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;
