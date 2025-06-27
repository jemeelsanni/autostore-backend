"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const index_1 = require("../index");
const router = express_1.default.Router();
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1)
});
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3),
    password: zod_1.z.string().min(6),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    role: zod_1.z.enum(['SUPER_ADMIN', 'SALES_PERSONNEL', 'INVENTORY_MANAGER']).optional()
});
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
router.post('/login', asyncHandler(async (req, res) => {
    try {
        const { username, password } = loginSchema.parse(req.body);
        const user = await index_1.prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { email: username }
                ],
                isActive: true
            }
        });
        if (!user || !await bcryptjs_1.default.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    }
    catch (error) {
        res.status(400).json({ error: 'Invalid request data' });
    }
}));
router.post('/register', asyncHandler(async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);
        const existingUser = await index_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email: data.email },
                    { username: data.username }
                ]
            }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
        const user = await index_1.prisma.user.create({
            data: {
                ...data,
                password: hashedPassword,
                role: data.role || 'SALES_PERSONNEL'
            }
        });
        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    }
    catch (error) {
        res.status(400).json({ error: 'Registration failed' });
    }
}));
router.get('/verify', asyncHandler(async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = await index_1.prisma.user.findUnique({
            where: { id: decoded.userId, isActive: true }
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
}));
exports.default = router;
//# sourceMappingURL=auth.js.map