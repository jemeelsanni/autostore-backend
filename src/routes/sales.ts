// server/src/routes/sales.ts - FIXED VERSION
import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();

const saleSchema = z.object({
  carId: z.string(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  notes: z.string().optional()
});

// Get all sales - Protected route
router.get('/', 
  authenticateToken as express.RequestHandler,
  async (req, res) => {
    try {
      const { status, salesperson, startDate, endDate, page = 1, limit = 20 } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      
      const where: any = {};
      
      if (status) where.status = status;
      if (salesperson) where.salespersonId = salesperson;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          skip,
          take: Number(limit),
          include: {
            car: {
              select: {
                id: true,
                name: true,
                brand: true,
                model: true,
                images: true,
                category: true
              }
            },
            salesperson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.sale.count({ where })
      ]);

      res.json({
        sales,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching sales:', error);
      res.status(500).json({ error: 'Failed to fetch sales' });
    }
  }
);

// Create new sale - Protected route
router.post('/',
  authenticateToken as express.RequestHandler,
  async (req: any, res) => {
    try {
      const data = saleSchema.parse(req.body);
      
      // Check if car exists and is in stock
      const car = await prisma.car.findUnique({
        where: { id: data.carId }
      });

      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      if (car.inStock < 1) {
        return res.status(400).json({ error: 'Car is out of stock' });
      }

      // Create sale and update stock in transaction
      const result = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            ...data,
            salespersonId: req.user.userId,
            status: 'COMPLETED'
          },
          include: {
            car: {
              select: {
                id: true,
                name: true,
                brand: true,
                model: true,
                images: true,
                category: true
              }
            },
            salesperson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true
              }
            }
          }
        });

        // Update car stock
        await tx.car.update({
          where: { id: data.carId },
          data: { inStock: { decrement: 1 } }
        });

        return sale;
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating sale:', error);
      res.status(500).json({ error: 'Failed to create sale' });
    }
  }
);

export default router;