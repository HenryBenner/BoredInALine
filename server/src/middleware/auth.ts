import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  file?: Express.Multer.File;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string };
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string };
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    next();
  }
};

export interface BarAdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    barId: string;
  };
  file?: Express.Multer.File;
}

export interface SuperAdminRequest extends Request {
  superAdmin?: {
    id: string;
    email: string;
    name: string;
  };
}

export const authenticateSuperAdmin = (req: SuperAdminRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      email: string;
      name: string;
      isSuperAdmin?: boolean;
    };
    if (!decoded.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    req.superAdmin = { id: decoded.id, email: decoded.email, name: decoded.name };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authenticateBarAdmin = (req: BarAdminRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret) as { 
      id: string; 
      email: string; 
      isBarAdmin?: boolean;
      barId?: string;
    };
    
    if (!decoded.isBarAdmin || !decoded.barId) {
      return res.status(403).json({ error: 'Not a bar admin' });
    }
    
    req.admin = {
      id: decoded.id,
      email: decoded.email,
      barId: decoded.barId,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
