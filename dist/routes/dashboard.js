"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/overview', auth_1.authenticateToken, async (req, res) => {
    try {
        const { timeRange = '30' } = req.query;
        const days = parseInt(timeRange);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const [totalCars, totalSales, totalRevenue, lowStockCars, recentSales] = await Promise.all([
            index_1.prisma.car.count(),
            index_1.prisma.sale.count({
                where: { createdAt: { gte: startDate } }
            }),
            index_1.prisma.sale.aggregate({
                where: { createdAt: { gte: startDate } },
                _sum: { amount: true }
            }),
            index_1.prisma.car.findMany({
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
            index_1.prisma.sale.findMany({
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
            topPerformingCars: []
        });
    }
    catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map