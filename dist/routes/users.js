"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3),
    password: zod_1.z.string().min(6),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    role: zod_1.z.enum(['SUPER_ADMIN', 'SALES_PERSONNEL', 'INVENTORY_MANAGER'])
});
router.get('/', auth_1.authenticateToken, (0, auth_1.requireRole)(['SUPER_ADMIN']), async (req, res) => {
    try {
        const { role, isActive, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};
        if (role)
            where.role = role;
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const [users, total] = await Promise.all([
            index_1.prisma.user.findMany({
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
            index_1.prisma.user.count({ where })
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
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)(['SUPER_ADMIN']), async (req, res) => {
    try {
        const data = createUserSchema.parse(req.body);
        const existingUser = await index_1.prisma.user.findFirst({
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
        const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
        const user = await index_1.prisma.user.create({
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
    }
    catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map