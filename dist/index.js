"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.express = exports.app = exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
exports.express = express_1.default;
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_1 = require("@prisma/client");
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const cars_1 = __importDefault(require("./routes/cars"));
const sales_1 = __importDefault(require("./routes/sales"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
exports.prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    errorFormat: 'pretty',
});
const PORT = process.env.PORT || 3000;
const initializeDirectories = () => {
    try {
        if (process.env.NODE_ENV !== 'production') {
            const uploadsDir = path_1.default.join(__dirname, '../uploads');
            const carsDir = path_1.default.join(uploadsDir, 'cars');
            if (!fs_1.default.existsSync(uploadsDir)) {
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
                console.log('📁 Created uploads directory');
            }
            if (!fs_1.default.existsSync(carsDir)) {
                fs_1.default.mkdirSync(carsDir, { recursive: true });
                console.log('📁 Created cars directory');
            }
        }
    }
    catch (error) {
        if (error instanceof Error) {
            console.warn('⚠️ Could not create upload directories (probably in production):', error.message);
        }
        else {
            console.warn('⚠️ Could not create upload directories (probably in production):', error);
        }
    }
};
initializeDirectories();
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin)
            return callback(null, true);
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'https://your-frontend-domain.vercel.app',
            'https://your-frontend-domain.netlify.app',
            'https://jajiautos.ng'
        ];
        if (process.env.NODE_ENV === 'production') {
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'), false);
            }
        }
        else {
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    optionsSuccessStatus: 200
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    }
    next();
});
if (process.env.NODE_ENV !== 'production') {
    const uploadsPath = path_1.default.join(__dirname, '../uploads');
    app.use('/uploads', express_1.default.static(uploadsPath));
}
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/cars', cars_1.default);
app.use('/api/sales', sales_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime()
    });
});
app.get('/api/health/db', async (req, res) => {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        res.json({
            status: 'OK',
            database: 'Connected',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Database health check failed:', error);
        res.status(500).json({
            status: 'ERROR',
            database: 'Disconnected',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        });
    }
});
app.get('/api/status', async (req, res) => {
    try {
        const [userCount, carCount, saleCount] = await Promise.all([
            exports.prisma.user.count(),
            exports.prisma.car.count(),
            exports.prisma.sale.count()
        ]);
        res.json({
            status: 'OK',
            database: 'Connected',
            stats: {
                users: userCount,
                cars: carCount,
                sales: saleCount
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Status check failed:', error);
        res.status(500).json({
            status: 'ERROR',
            database: 'Error',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        });
    }
});
app.get('/', (req, res) => {
    res.json({
        message: 'Jaji Autos API Server',
        version: '1.0.0',
        documentation: '/api/health',
        status: 'Running'
    });
});
app.use('*', (req, res) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    }
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (err.code === 'P2002') {
        return res.status(400).json({
            error: 'Duplicate entry',
            field: err.meta?.target,
            timestamp: new Date().toISOString()
        });
    }
    if (err.code && err.code.startsWith('P')) {
        return res.status(400).json({
            error: 'Database error',
            code: err.code,
            timestamp: new Date().toISOString()
        });
    }
    if (err.message && err.message.includes('CORS')) {
        return res.status(403).json({
            error: 'CORS policy violation',
            message: 'Origin not allowed',
            timestamp: new Date().toISOString()
        });
    }
    return res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            details: err
        })
    });
});
const server = app.listen(PORT, () => {
    console.log(`
🚀 Jaji Autos Server is running!
📍 URL: http://localhost:${PORT}
🔗 API Base: http://localhost:${PORT}/api
📊 Environment: ${process.env.NODE_ENV || 'development'}
🗄️ Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}

Available endpoints:
- GET  / (API info)
- GET  /api/health (Health check)
- GET  /api/health/db (Database health)
- GET  /api/status (API statistics)
- POST /api/auth/* (Authentication)
- GET  /api/cars (Car listings)

Ready to accept requests! 🎯
  `);
});
const gracefulShutdown = async (signal) => {
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
        console.log('HTTP server closed');
        try {
            await exports.prisma.$disconnect();
            console.log('Database connection closed');
            process.exit(0);
        }
        catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});
//# sourceMappingURL=index.js.map