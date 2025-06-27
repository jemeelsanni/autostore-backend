"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const saleSchema = zod_1.z.object({
    carId: zod_1.z.string(),
    customerName: zod_1.z.string().min(1),
    customerEmail: zod_1.z.string().email(),
    customerPhone: zod_1.z.string().optional(),
    amount: zod_1.z.number().positive(),
    paymentMethod: zod_1.z.string().min(1),
    notes: zod_1.z.string().optional()
});
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { status, salesperson, startDate, endDate, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};
        if (status)
            where.status = status;
        if (salesperson)
            where.salespersonId = salesperson;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [sales, total] = await Promise.all([
            index_1.prisma.sale.findMany({
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
            index_1.prisma.sale.count({ where })
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
    }
    catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const data = saleSchema.parse(req.body);
        const car = await index_1.prisma.car.findUnique({
            where: { id: data.carId }
        });
        if (!car) {
            return res.status(404).json({ error: 'Car not found' });
        }
        if (car.inStock < 1) {
            return res.status(400).json({ error: 'Car is out of stock' });
        }
        const result = await index_1.prisma.$transaction(async (tx) => {
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
            await tx.car.update({
                where: { id: data.carId },
                data: { inStock: { decrement: 1 } }
            });
            return sale;
        });
        res.status(201).json(result);
    }
    catch (error) {
        console.error('Error creating sale:', error);
        res.status(500).json({ error: 'Failed to create sale' });
    }
});
exports.default = router;
//# sourceMappingURL=sales.js.map