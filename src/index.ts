// server/src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import carRoutes from './routes/cars';
import saleRoutes from './routes/sales';
import dashboardRoutes from './routes/dashboard';

// Load environment variables
dotenv.config();

const app = express();

// Prisma Client with production settings
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  errorFormat: 'pretty',
});

const PORT = process.env.PORT || 3000;

// Create upload directories only in development or when file system is writable
const initializeDirectories = () => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const uploadsDir = path.join(__dirname, '../uploads');
      const carsDir = path.join(uploadsDir, 'cars');
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('📁 Created uploads directory');
      }
      if (!fs.existsSync(carsDir)) {
        fs.mkdirSync(carsDir, { recursive: true });
        console.log('📁 Created cars directory');
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn('⚠️ Could not create upload directories (probably in production):', error.message);
    } else {
      console.warn('⚠️ Could not create upload directories (probably in production):', error);
    }
  }
};

initializeDirectories();

// Enhanced CORS for production
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      // Add your production frontend URLs here
      'https://your-frontend-domain.vercel.app',
      'https://your-frontend-domain.netlify.app',
      'https://jajiautos.ng'
    ];
    
    // In production, be more strict about origins
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Body parsing middleware with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging (more concise in production)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

// Static file serving for uploads (only in development)
if (process.env.NODE_ENV !== 'production') {
  const uploadsPath = path.join(__dirname, '../uploads');
  app.use('/uploads', express.static(uploadsPath));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Enhanced health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  });
});

// Database health check
app.get('/api/health/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'OK', 
      database: 'Connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'Disconnected', 
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// API status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const [userCount, carCount, saleCount] = await Promise.all([
      prisma.user.count(),
      prisma.car.count(),
      prisma.sale.count()
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
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      database: 'Error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Jaji Autos API Server',
    version: '1.0.0',
    documentation: '/api/health',
    status: 'Running'
  });
});

// 404 handler
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

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  // Handle Prisma errors
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

  // Handle CORS errors
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

// Start server
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

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      await prisma.$disconnect();
      console.log('Database connection closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Export app and express for use in other files
export { app, express };