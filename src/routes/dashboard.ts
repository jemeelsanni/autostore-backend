// server/src/routes/dashboard.ts - FIXED VERSION
import express from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get dashboard overview - Protected route
router.get('/overview', 
  authenticateToken as express.RequestHandler,
  async (req, res) => {
    try {
      const { timeRange = '30' } = req.query;
      
      const days = parseInt(timeRange as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        totalCars,
        totalSales,
        totalRevenue,
        lowStockCars,
        recentSales
      ] = await Promise.all([
        // Total cars in inventory
        prisma.car.count(),
        
        // Total sales in time range
        prisma.sale.count({
          where: { createdAt: { gte: startDate } }
        }),
        
        // Total revenue in time range
        prisma.sale.aggregate({
          where: { createdAt: { gte: startDate } },
          _sum: { amount: true }
        }),
        
        // Low stock cars (less than or equal to 2)
        prisma.car.findMany({
          where: { inStock: { lte: 2 } },
          select: {
            id: true,
            name: true,
            category: true,
            inStock: true,
            images: true
          },
          take: 10
        }),
        
        // Recent sales
        prisma.sale.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            car: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        })
      ]);

      res.json({
        summary: {
          totalCars,
          totalSales,
          totalRevenue: totalRevenue._sum.amount || 0,
          averageSaleValue: totalSales > 0 ? (totalRevenue._sum.amount || 0) / totalSales : 0
        },
        lowStockCars,
        recentSales,
        topPerformingCars: [] // Simplified for now
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  }
);

export default router;