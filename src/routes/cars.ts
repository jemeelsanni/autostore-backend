// server/src/routes/cars.ts - COMPLETE CARS ROUTE WITH CLOUDINARY
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';
import streamifier from 'streamifier';

const router = express.Router();
const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer to use memory storage (no local files)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed') as any, false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (Cloudinary can handle larger files)
    files: 6
  }
});

// Auth middleware (simplified)
const authenticateToken = (req: any, res: any, next: any) => {
  req.user = { id: 'user_1', role: 'SUPER_ADMIN' };
  next();
};

// Helper function to upload buffer to Cloudinary
const uploadToCloudinary = (buffer: Buffer, filename: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'jajiautos/cars', // Organize uploads in folders
        public_id: `car-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        transformation: [
          { width: 1200, height: 800, crop: 'limit' }, // Auto-resize
          { quality: 'auto:good' }, // Auto-optimize quality
          { format: 'auto' } // Auto-format (WebP when supported)
        ],
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// Upload single image
router.post('/upload/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('📤 Uploading to Cloudinary...');

    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    console.log('✅ Image uploaded to Cloudinary:', result.secure_url);

    res.json({
      url: result.secure_url,
      filename: result.public_id,
      size: result.bytes
    });

  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    res.status(500).json({ error: 'Failed to upload image to Cloudinary' });
  }
});

// Upload multiple images
router.post('/upload/multiple', upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || (req.files as any[]).length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const files = req.files as Express.Multer.File[];
    const uploadedImages = [];

    console.log(`📤 Uploading ${files.length} images to Cloudinary...`);

    for (const file of files) {
      const result = await uploadToCloudinary(file.buffer, file.originalname);
      
      uploadedImages.push({
        url: result.secure_url,
        filename: result.public_id,
        size: result.bytes
      });
    }

    console.log(`✅ ${uploadedImages.length} images uploaded to Cloudinary`);
    res.json(uploadedImages);

  } catch (error) {
    console.error('❌ Cloudinary multiple upload error:', error);
    res.status(500).json({ error: 'Failed to upload images to Cloudinary' });
  }
});

// Delete image from Cloudinary
router.delete('/upload/image/:publicId', async (req, res) => {
  try {
    const publicId = req.params.publicId;
    
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      console.log('✅ Image deleted from Cloudinary:', publicId);
      res.json({ message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('❌ Cloudinary deletion error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Get all cars
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    
    const search = req.query.search as string;
    const category = req.query.category as string;
    const brand = req.query.brand as string;
    const featured = req.query.featured === 'true';
    
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (category && category !== 'all') where.category = category;
    if (brand && brand !== 'all') where.brand = brand;
    if (featured) where.featured = true;

    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { featured: 'desc' },
          { createdAt: 'desc' }
        ],
        include: {
          _count: { select: { reviews: true } },
          reviews: { select: { rating: true } }
        }
      }),
      prisma.car.count({ where })
    ]);

    // Calculate average rating
    const carsWithRating = cars.map(car => {
      const avgRating = car.reviews.length > 0 
        ? car.reviews.reduce((sum, review) => sum + review.rating, 0) / car.reviews.length
        : 0;
      
      return {
        ...car,
        rating: Number(avgRating.toFixed(1)),
        reviews: car._count.reviews
      };
    });

    res.json({
      cars: carsWithRating,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching cars:', error);
    res.status(500).json({ error: 'Failed to fetch cars' });
  }
});

// Get single car
router.get('/:id', async (req, res) => {
  try {
    const car = await prisma.car.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { reviews: true } },
        reviews: {
          select: { rating: true, comment: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const avgRating = car.reviews.length > 0 
      ? car.reviews.reduce((sum, review) => sum + review.rating, 0) / car.reviews.length
      : 0;

    const carWithRating = {
      ...car,
      rating: Number(avgRating.toFixed(1)),
      reviewCount: car._count.reviews
    };

    res.json(carWithRating);
  } catch (error) {
    console.error('❌ Error fetching car:', error);
    res.status(500).json({ error: 'Failed to fetch car' });
  }
});

// Create car
router.post('/', async (req, res) => {
  try {
    console.log('🚗 Creating new car with data:', req.body);
    
    const {
      name, brand, model, price, originalPrice, images, category, year,
      mileage, fuel, transmission, engine, horsepower, description,
      features, safetyFeatures, inStock, warranty, featured, isNew,
      torque, acceleration, topSpeed, fuelEconomy, drivetrain,
      exteriorColor, interiorColor, vin
    } = req.body;

    // Validate required fields
    if (!name || !brand || !model || !price || !category || !year || !description || !features || inStock === undefined) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'brand', 'model', 'price', 'category', 'year', 'description', 'features', 'inStock'],
        received: Object.keys(req.body)
      });
    }

    // Validate images array
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.log('❌ Images validation failed:', images);
      return res.status(400).json({ error: 'At least one image is required' });
    }

    // Prepare car data matching your schema
    const carData = {
      name: name.trim(),
      brand: brand.trim(),
      model: model.trim(),
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : parseFloat(price),
      images: Array.isArray(images) ? images : [images],
      category: category.trim(),
      year: parseInt(year),
      mileage: mileage ? parseInt(mileage) : 0,
      fuel: fuel || 'Gasoline',
      transmission: transmission || 'Automatic',
      engine: engine?.trim() || null,
      horsepower: horsepower ? parseInt(horsepower) : null,
      torque: torque?.trim() || null,
      acceleration: acceleration?.trim() || null,
      topSpeed: topSpeed?.trim() || null,
      fuelEconomy: fuelEconomy?.trim() || null,
      drivetrain: drivetrain?.trim() || null,
      exteriorColor: exteriorColor?.trim() || null,
      interiorColor: interiorColor?.trim() || null,
      vin: vin?.trim() || null,
      description: description.trim(),
      features: Array.isArray(features) ? features : features.split(',').map((f: string) => f.trim()),
      safetyFeatures: safetyFeatures ? 
        (Array.isArray(safetyFeatures) ? safetyFeatures : safetyFeatures.split(',').map((f: string) => f.trim())) : 
        [],
      warranty: warranty?.trim() || null,
      featured: Boolean(featured),
      isNew: Boolean(isNew !== false),
      inStock: parseInt(inStock),
      dealType: null // Set default value for dealType
    };

    console.log('📝 Prepared car data:', {
      ...carData,
      images: `Array(${carData.images.length})`,
      features: `Array(${carData.features.length})`
    });

    const car = await prisma.car.create({ 
      data: carData,
      include: {
        _count: { select: { reviews: true } }
      }
    });

    console.log(`✅ Car created successfully: ${car.name} (ID: ${car.id})`);
    res.status(201).json(car);

  } catch (error) {
    console.error('❌ Error creating car:', error);
    
    // Handle Prisma validation errors
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const prismaError = error as { code?: string; meta?: any; message?: string; stack?: string };
      if (prismaError.code === 'P2002') {
        return res.status(400).json({ 
          error: 'A car with this name already exists',
          field: prismaError.meta?.target
        });
      }
      
      if (prismaError.code === 'P2000') {
        return res.status(400).json({ 
          error: 'Value too long for field',
          details: prismaError.meta
        });
      }
      
      if (prismaError.code === 'P2025') {
        return res.status(400).json({ 
          error: 'Referenced record not found',
          details: prismaError.meta
        });
      }

      // Log the full error for debugging
      console.error('Full error details:', {
        message: prismaError.message,
        code: prismaError.code,
        meta: prismaError.meta,
        stack: prismaError.stack
      });
      
      res.status(500).json({ 
        error: 'Failed to create car',
        details: process.env.NODE_ENV === 'development' ? prismaError.message : undefined
      });
    } else {
      // Fallback for non-object errors
      res.status(500).json({ error: 'Failed to create car' });
    }
  }
});

// Update car
router.put('/:id', async (req, res) => {
  try {
    const carId = req.params.id;
    const updateData: any = { ...req.body };

    if (updateData.features && typeof updateData.features === 'string') {
      updateData.features = updateData.features.split(',').map((f: string) => f.trim());
    }
    if (updateData.safetyFeatures && typeof updateData.safetyFeatures === 'string') {
      updateData.safetyFeatures = updateData.safetyFeatures.split(',').map((f: string) => f.trim());
    }

    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.year) updateData.year = parseInt(updateData.year);
    if (updateData.inStock !== undefined) updateData.inStock = parseInt(updateData.inStock);
    if (updateData.featured !== undefined) updateData.featured = Boolean(updateData.featured);

    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.addedById;

    const updatedCar = await prisma.car.update({
      where: { id: carId },
      data: updateData
    });

    res.json(updatedCar);
  } catch (error) {
    console.error('❌ Error updating car:', error);
    res.status(500).json({ error: 'Failed to update car' });
  }
});

// Delete car
router.delete('/:id', async (req, res) => {
  try {
    const carId = req.params.id;
    const existingCar = await prisma.car.findUnique({ where: { id: carId } });

    if (!existingCar) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Delete images from Cloudinary
    if (existingCar.images && Array.isArray(existingCar.images)) {
      for (const imageUrl of existingCar.images) {
        try {
          // Extract public_id from Cloudinary URL
          const publicId = imageUrl.split('/').slice(-1)[0].split('.')[0];
          await cloudinary.uploader.destroy(`jajiautos/cars/${publicId}`);
        } catch (error) {
          console.log('Failed to delete image from Cloudinary:', error);
        }
      }
    }

    await prisma.car.delete({ where: { id: carId } });
    res.json({ message: 'Car deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting car:', error);
    res.status(500).json({ error: 'Failed to delete car' });
  }
});

// Featured cars
router.get('/featured/list', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 6;
    
    const featuredCars = await prisma.car.findMany({
      where: { featured: true, inStock: { gt: 0 } },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { reviews: true } },
        reviews: { select: { rating: true } }
      }
    });

    const carsWithRating = featuredCars.map(car => {
      const avgRating = car.reviews.length > 0 
        ? car.reviews.reduce((sum, review) => sum + review.rating, 0) / car.reviews.length
        : 0;
      
      return {
        ...car,
        rating: Number(avgRating.toFixed(1)),
        reviews: car._count.reviews
      };
    });

    res.json({ cars: carsWithRating });
  } catch (error) {
    console.error('❌ Error fetching featured cars:', error);
    res.json({ cars: [] });
  }
});

export default router;