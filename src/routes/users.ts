// server/src/routes/users.ts - FIXED VERSION
import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['SUPER_ADMIN', 'SALES_PERSONNEL', 'INVENTORY_MANAGER'])
});

// Get all users - Protected route
router.get('/', 
  authenticateToken as express.RequestHandler,
  requireRole(['SUPER_ADMIN']) as express.RequestHandler,
  async (req, res) => {
    try {
      const { role, isActive, page = 1, limit = 20 } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      
      const where: any = {};
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: Number(limit),
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                sales: true,
                cars: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      res.json({
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// Create new user - Protected route
router.post('/',
  authenticateToken as express.RequestHandler,
  requireRole(['SUPER_ADMIN']) as express.RequestHandler,
  async (req, res) => {
    try {
      const data = createUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: data.email },
            { username: data.username }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User with this email or username already exists' });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      const user = await prisma.user.create({
        data: {
          ...data,
          password: hashedPassword
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      });

      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// Other routes remain the same but with proper error handling...

export default router;